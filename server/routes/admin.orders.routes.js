const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { verifyToken, requireAdmin } = require("../middleware/auth.middleware");
const { restoreStock } = require("../utils/orderStock");
const { sendOrderShippedEmail, sendShippingFeeEmail } = require("../utils/mailer");
const { buildOrderDocument } = require("../utils/orderDocument");
const { orderDocCode } = require("../utils/orderCode");

router.use(verifyToken, requireAdmin);

const VALID_STATUSES = ["pending", "confirmed", "shipping", "completed", "cancelled"];
const DELETABLE_STATUSES = ["completed", "cancelled"];
// Phí ship chỉ sửa được trước khi giao, vì tiền thu hộ đã gửi sang ViettelPost lúc tạo vận đơn
const SHIPPING_FEE_EDITABLE = ["pending", "confirmed"];
const MAX_SHIPPING_FEE = 2000000;
// Mã vận đơn ViettelPost: chữ và số, bỏ khoảng trắng, viết hoa
const TRACKING_CODE_RE = /^[A-Z0-9]{6,30}$/;

// GET /api/admin/orders - danh sách đơn hàng, có thể filter ?status=pending
router.get("/", async (req, res) => {
    const { status } = req.query;
    try {
        let result;
        if (status) {
            if (!VALID_STATUSES.includes(status)) {
                return res.status(400).json({ error: "status không hợp lệ" });
            }
            result = await pool.query(
                "SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC",
                [status]
            );
        } else {
            result = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
        }
        res.json(result.rows);
    } catch (err) {
        console.error("GET /admin/orders error:", err);
        res.status(500).json({ error: "Lỗi server" });
    }
});

// GET /api/admin/orders/stats/revenue - thống kê doanh thu
// LƯU Ý: route này phải đặt TRƯỚC route GET /:id, nếu không "stats" sẽ bị hiểu nhầm là :id
router.get("/stats/revenue", async (req, res) => {
    try {
        const totalResult = await pool.query(
            `SELECT COALESCE(SUM(total), 0) AS total_revenue, COUNT(*) AS total_orders
             FROM orders WHERE status = 'completed'`
        );

        const byStatusResult = await pool.query(
            `SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
             FROM orders GROUP BY status`
        );

        const last30DaysResult = await pool.query(
            `SELECT DATE(created_at) AS date, COALESCE(SUM(total), 0) AS revenue
             FROM orders
             WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '30 days'
             GROUP BY DATE(created_at)
             ORDER BY date ASC`
        );

        res.json({
            total_revenue: totalResult.rows[0].total_revenue,
            total_completed_orders: totalResult.rows[0].total_orders,
            by_status: byStatusResult.rows,
            last_30_days: last30DaysResult.rows,
        });
    } catch (err) {
        console.error("GET /admin/orders/stats/revenue error:", err);
        res.status(500).json({ error: "Lỗi server khi lấy thống kê" });
    }
});

// GET /api/admin/orders/:id - chi tiết 1 đơn hàng + danh sách sản phẩm
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
        }

        const itemsResult = await pool.query(
            `SELECT oi.id, oi.product_id, oi.product_name, oi.variant_name, oi.quantity, oi.price_at_purchase,
                    COALESCE(v.image, p.image) AS image, p.is_active AS product_is_active
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             LEFT JOIN product_variants v ON v.id = oi.variant_id
             WHERE oi.order_id = $1`,
            [id]
        );

        res.json({ ...orderResult.rows[0], items: itemsResult.rows });
    } catch (err) {
        console.error("GET /admin/orders/:id error:", err);
        res.status(500).json({ error: "Lỗi server" });
    }
});

// GET /api/admin/orders/:id/export - tải phiếu "ĐƠN HÀNG" dạng Excel (chỉ tiền hàng, không gồm ship và VAT)
router.get("/:id/export", async (req, res) => {
    const { id } = req.params;
    try {
        const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
        }
        const order = orderResult.rows[0];

        // Mã số lấy theo SKU hiện tại; dòng có phiên bản thì chỉ lấy SKU phiên bản (phiên bản đã xoá thì để trống)
        const itemsResult = await pool.query(
            `SELECT oi.product_name, oi.variant_name, oi.quantity, oi.price_at_purchase,
                    CASE WHEN oi.variant_name IS NOT NULL THEN v.sku ELSE p.sku END AS sku
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             LEFT JOIN product_variants v ON v.id = oi.variant_id
             WHERE oi.order_id = $1
             ORDER BY oi.id`,
            [id]
        );

        const buffer = await buildOrderDocument(order, itemsResult.rows);
        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${orderDocCode(order)}.xlsx"`,
        });
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error("GET /admin/orders/:id/export error:", err);
        res.status(500).json({ error: "Lỗi server khi xuất phiếu đơn hàng" });
    }
});

// PATCH /api/admin/orders/:id/status - cập nhật trạng thái đơn
router.patch("/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
            error: `status phải là một trong: ${VALID_STATUSES.join(", ")}`,
        });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query(
            "SELECT status FROM orders WHERE id = $1 FOR UPDATE",
            [id]
        );
        if (existing.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
        }

        const oldStatus = existing.rows[0].status;
        // Đơn đã kết thúc (đã huỷ / đã giao thành công) thì khoá, không cho đổi trạng thái
        if (oldStatus === "cancelled") {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Đơn đã huỷ, không thể đổi trạng thái" });
        }
        if (oldStatus === "completed") {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Đơn đã giao thành công, không thể đổi trạng thái" });
        }
        // Huỷ đơn -> trả lại tồn kho
        if (status === "cancelled") {
            await restoreStock(client, id);
        }

        const result = await client.query(
            "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
            [status, id]
        );

        await client.query("COMMIT");
        res.json(result.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("PATCH /admin/orders/:id/status error:", err);
        if (err.status) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: "Lỗi server khi cập nhật trạng thái" });
    } finally {
        client.release();
    }
});

// PATCH /api/admin/orders/:id/shipping-fee - shop báo phí ship khi gọi xác nhận đơn
// body: { shipping_fee } là số nguyên VND, null để xoá
router.patch("/:id/shipping-fee", async (req, res) => {
    const { id } = req.params;
    const fee = req.body.shipping_fee;

    if (fee !== null && (!Number.isInteger(fee) || fee < 0 || fee > MAX_SHIPPING_FEE)) {
        return res.status(400).json({ error: "Phí ship phải là số nguyên từ 0 đến 2.000.000đ" });
    }

    try {
        const existing = await pool.query("SELECT status, shipping_fee FROM orders WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
        }
        if (!SHIPPING_FEE_EDITABLE.includes(existing.rows[0].status)) {
            return res.status(400).json({ error: "Chỉ sửa được phí ship khi đơn chưa giao" });
        }

        // Điều kiện trạng thái lặp lại trong UPDATE để không ghi đè khi đơn vừa chuyển sang giao
        const result = await pool.query(
            "UPDATE orders SET shipping_fee = $1 WHERE id = $2 AND status = ANY($3) RETURNING *",
            [fee, id, SHIPPING_FEE_EDITABLE]
        );
        if (result.rows.length === 0) {
            return res.status(409).json({ error: "Trạng thái đơn vừa thay đổi, vui lòng tải lại" });
        }

        // Báo phí ship cho khách khi phí mới khác phí cũ; mail lỗi không ảnh hưởng việc lưu
        const order = result.rows[0];
        const oldFee = existing.rows[0].shipping_fee;
        const feeChanged = fee !== null && (oldFee === null || Number(oldFee) !== fee);
        if (feeChanged && order.email) {
            sendShippingFeeEmail(order).catch((mailErr) => console.error("Send shipping fee email error:", mailErr));
        }
        res.json(order);
    } catch (err) {
        console.error("PATCH /admin/orders/:id/shipping-fee error:", err);
        res.status(500).json({ error: "Lỗi server khi cập nhật phí ship" });
    }
});

// PATCH /api/admin/orders/:id/tracking - nhập mã vận đơn ViettelPost
// Đơn đã xác nhận thì chuyển sang đang giao; đơn đang giao thì chỉ sửa mã (nhập nhầm)
router.patch("/:id/tracking", async (req, res) => {
    const { id } = req.params;
    const code = String(req.body.tracking_code || "").replace(/\s/g, "").toUpperCase();

    if (!TRACKING_CODE_RE.test(code)) {
        return res.status(400).json({ error: "Mã vận đơn gồm 6 đến 30 chữ hoặc số" });
    }

    const client = await pool.connect();
    let order;
    let codeChanged = false;
    try {
        await client.query("BEGIN");

        const existing = await client.query(
            "SELECT status, shipping_fee, tracking_code FROM orders WHERE id = $1 FOR UPDATE",
            [id]
        );
        if (existing.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
        }

        const current = existing.rows[0];
        if (current.status === "pending") {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Xác nhận đơn trước khi nhập mã vận đơn" });
        }
        if (current.status !== "confirmed" && current.status !== "shipping") {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Đơn đã kết thúc, không nhập mã vận đơn được" });
        }
        // Tiền thu hộ = tiền hàng + phí ship, thiếu phí ship thì không biết thu bao nhiêu
        if (current.shipping_fee === null) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Nhập phí ship trước khi nhập mã vận đơn" });
        }

        codeChanged = current.tracking_code !== code;
        const result = await client.query(
            `UPDATE orders
             SET tracking_code = $1, status = 'shipping', shipped_at = COALESCE(shipped_at, now())
             WHERE id = $2 RETURNING *`,
            [code, id]
        );
        order = result.rows[0];

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505") {
            return res.status(409).json({ error: "Mã vận đơn này đã gắn với đơn khác" });
        }
        console.error("PATCH /admin/orders/:id/tracking error:", err);
        return res.status(500).json({ error: "Lỗi server khi cập nhật mã vận đơn" });
    } finally {
        client.release();
    }

    // Báo khách sau khi commit, mail lỗi không ảnh hưởng đơn; sửa lại đúng mã cũ thì không gửi lại
    if (codeChanged && order.email) {
        sendOrderShippedEmail(order).catch((mailErr) => console.error("Send order shipped email error:", mailErr));
    }
    res.json(order);
});

// DELETE /api/admin/orders/:id - xóa đơn hàng + order_items liên quan
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query(
            "SELECT status FROM orders WHERE id = $1 FOR UPDATE",
            [id]
        );
        if (existing.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
        }
        // Chỉ xoá được đơn đã kết thúc (giao thành công / đã huỷ)
        if (!DELETABLE_STATUSES.includes(existing.rows[0].status)) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Chỉ xoá được đơn đã giao thành công hoặc đã huỷ" });
        }

        await client.query("DELETE FROM order_items WHERE order_id = $1", [id]);
        await client.query("DELETE FROM orders WHERE id = $1", [id]);

        await client.query("COMMIT");
        res.json({ message: "Đã xóa đơn hàng" });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("DELETE /admin/orders/:id error:", err);
        res.status(500).json({ error: "Lỗi server khi xóa đơn hàng" });
    } finally {
        client.release();
    }
});

module.exports = router;