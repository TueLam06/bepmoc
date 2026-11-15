const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const cloudinary = require("../config/cloudinary");
const { verifyToken, requireAdmin } = require("../middleware/auth.middleware");

router.use(verifyToken, requireAdmin);

// Upload ảnh từ URL lên Cloudinary; URL đã là Cloudinary thì giữ nguyên
async function uploadImageUrl(url) {
    if (!url) return null;
    if (url.includes("res.cloudinary.com")) return url;
    const result = await cloudinary.uploader.upload(url, {
        folder: "bepmoc/products",
    });
    return result.secure_url;
}

// SKU: viết hoa, chỉ chữ/số/gạch ngang. undefined = không gửi (giữ nguyên), null = bỏ mã, false = sai định dạng
function parseSku(value) {
    if (value === undefined) return undefined;
    const s = String(value ?? "").trim().toUpperCase();
    if (!s) return null;
    return /^[A-Z0-9-]{1,50}$/.test(s) ? s : false;
}

// Giá gốc: undefined = không gửi, null = không giảm giá, false = không hợp lệ
function parseOriginalPrice(value) {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : false;
}

// Kiểm tra sku + giá gốc so với giá bán cuối cùng; trả về chuỗi lỗi hoặc null
function validatePricing(sku, originalPrice, price) {
    if (sku === false) return "Mã SKU chỉ gồm chữ, số, gạch ngang, tối đa 50 ký tự";
    if (originalPrice === false) return "Giá gốc không hợp lệ";
    if (originalPrice != null && originalPrice <= Number(price)) return "Giá gốc phải lớn hơn giá bán";
    return null;
}

// Lỗi trùng SKU (unique index) thì báo rõ, lỗi trùng khác trả null để xử lý riêng
function duplicateSkuError(err) {
    return err.code === "23505" && /sku/.test(err.constraint || "") ? "Mã SKU đã được dùng cho sản phẩm khác" : null;
}

// GET /api/admin/products - admin xem TẤT CẢ, kể cả sản phẩm đã ẩn
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, v.min_price, v.total_stock, COALESCE(v.variant_count, 0)::int AS variant_count
             FROM products p
             LEFT JOIN (
                 SELECT product_id, MIN(price) AS min_price, SUM(stock)::int AS total_stock, COUNT(*) AS variant_count
                 FROM product_variants
                 GROUP BY product_id
             ) v ON v.product_id = p.id
             ORDER BY p.id DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET /admin/products error:", err);
        res.status(500).json({ error: "Lỗi server" });
    }
});

// GET /api/admin/products/categories
router.get("/categories", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name FROM categories ORDER BY sort_order, name"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET /admin/products/categories error:", err);
        res.status(500).json({ error: "Lỗi server" });
    }
});

// GET /api/admin/products/:id - Lấy chi tiết 1 sản phẩm
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            "SELECT * FROM products WHERE id = $1",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
        }
        const variants = await pool.query(
            "SELECT id, name, price, stock, image, sku, original_price FROM product_variants WHERE product_id = $1 ORDER BY sort_order, id",
            [id]
        );
        res.json({ ...result.rows[0], variants: variants.rows });
    } catch (err) {
        console.error("GET /admin/products/:id error:", err);
        res.status(500).json({ error: "Lỗi server" });
    }
});

// POST /api/admin/products - Thêm sản phẩm mới
router.post("/", async (req, res) => {
    const { name, price, stock, description, short_description, image_url, category_id } = req.body;

    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ error: "Thiếu name/price/stock" });
    }
    if (Number(price) < 0 || Number(stock) < 0) {
        return res.status(400).json({ error: "price/stock không được âm" });
    }
    const sku = parseSku(req.body.sku);
    const originalPrice = parseOriginalPrice(req.body.original_price);
    const invalid = validatePricing(sku, originalPrice, price);
    if (invalid) return res.status(400).json({ error: invalid });

    let image;
    try {
        image = await uploadImageUrl(image_url);
    } catch (err) {
        console.error("Cloudinary upload error:", err);
        return res.status(400).json({ error: "Không upload được ảnh từ URL này" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO products (name, price, stock, description, short_description, image, category_id, sku, original_price, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING *`,
            [name, price, stock, description || null, short_description || null, image, category_id || null,
                sku ?? null, originalPrice ?? null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        const dup = duplicateSkuError(err);
        if (dup) return res.status(400).json({ error: dup });
        console.error("POST /admin/products error:", err);
        res.status(500).json({ error: "Lỗi server khi tạo sản phẩm" });
    }
});

// PUT /api/admin/products/:id - Sửa thông tin sản phẩm
// LƯU Ý: không cho sửa "stock" ở đây nữa, dùng route /:id/stock riêng bên dưới
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { name, price, description, short_description, image_url, category_id } = req.body;

    if (price !== undefined && Number(price) < 0) {
        return res.status(400).json({ error: "price không được âm" });
    }

    try {
        const existing = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
        }
        const current = existing.rows[0];

        // Giá gốc so với giá bán sau khi sửa (gửi thiếu trường nào thì lấy giá trị đang có)
        const sku = parseSku(req.body.sku);
        const originalPrice = parseOriginalPrice(req.body.original_price);
        const finalOriginal = originalPrice === undefined ? current.original_price : originalPrice;
        const invalid = validatePricing(sku, finalOriginal, price ?? current.price);
        if (invalid) return res.status(400).json({ error: invalid });

        // Chỉ upload khi admin đổi sang URL ảnh mới
        let image = current.image;
        if (image_url !== undefined && image_url !== current.image) {
            try {
                image = await uploadImageUrl(image_url);
            } catch (err) {
                console.error("Cloudinary upload error:", err);
                return res.status(400).json({ error: "Không upload được ảnh từ URL này" });
            }
        }

        const result = await pool.query(
            `UPDATE products
             SET name = $1, price = $2, description = $3, short_description = $4, image = $5, category_id = $6,
                 sku = $7, original_price = $8
             WHERE id = $9 RETURNING *`,
            [
                name ?? current.name,
                price ?? current.price,
                description ?? current.description,
                short_description !== undefined ? short_description || null : current.short_description,
                image,
                category_id ?? current.category_id,
                sku === undefined ? current.sku : sku,
                finalOriginal,
                id,
            ]
        );
        res.json(result.rows[0]);
    } catch (err) {
        const dup = duplicateSkuError(err);
        if (dup) return res.status(400).json({ error: dup });
        console.error("PUT /admin/products/:id error:", err);
        res.status(500).json({ error: "Lỗi server khi cập nhật sản phẩm" });
    }
});

// PATCH /api/admin/products/:id/stock - Điều chỉnh tồn kho
// body: { type: "add" | "subtract" | "set", quantity: number }
router.patch("/:id/stock", async (req, res) => {
    const { id } = req.params;
    const { type, quantity } = req.body;

    if (!["add", "subtract", "set"].includes(type)) {
        return res.status(400).json({ error: "type phải là 'add', 'subtract' hoặc 'set'" });
    }
    if (quantity === undefined || Number(quantity) < 0 || !Number.isInteger(Number(quantity))) {
        return res.status(400).json({ error: "quantity phải là số nguyên không âm" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query(
            "SELECT * FROM products WHERE id = $1 FOR UPDATE",
            [id]
        );
        if (existing.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
        }
        const product = existing.rows[0];

        let newStock;
        if (type === "add") {
            newStock = product.stock + Number(quantity);
        } else if (type === "subtract") {
            newStock = product.stock - Number(quantity);
            if (newStock < 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    error: `Không thể trừ: tồn kho hiện tại chỉ còn ${product.stock}`,
                });
            }
        } else {
            newStock = Number(quantity);
        }

        const result = await client.query(
            "UPDATE products SET stock = $1 WHERE id = $2 RETURNING *",
            [newStock, id]
        );

        await client.query("COMMIT");
        res.json(result.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("PATCH /admin/products/:id/stock error:", err);
        res.status(500).json({ error: "Lỗi server khi cập nhật tồn kho" });
    } finally {
        client.release();
    }
});

// PATCH /api/admin/products/:id/status - Ẩn/hiện sản phẩm (soft delete / khôi phục)
// body: { is_active: boolean }
router.patch("/:id/status", async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
        return res.status(400).json({ error: "is_active phải là true hoặc false" });
    }

    try {
        const result = await pool.query(
            "UPDATE products SET is_active = $1 WHERE id = $2 RETURNING *",
            [is_active, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
        }
        res.json({
            message: is_active ? "Đã hiện lại sản phẩm" : "Đã ẩn sản phẩm",
            product: result.rows[0],
        });
    } catch (err) {
        console.error("PATCH /admin/products/:id/status error:", err);
        res.status(500).json({ error: "Lỗi server khi cập nhật trạng thái" });
    }
});

// Kiểm tra dữ liệu phiên bản; trả về chuỗi lỗi hoặc null
function validateVariant({ name, price, stock, image }) {
    const n = String(name || "").trim();
    if (!n || n.length > 100) return "Tên phiên bản dài từ 1 đến 100 ký tự";
    if (price === undefined || price === "" || !(Number(price) >= 0)) return "Giá phiên bản không hợp lệ";
    if (stock === undefined || stock === "" || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
        return "Tồn kho phải là số nguyên không âm";
    }
    if (image && !/^https?:\/\/\S+$/.test(String(image).trim())) return "Link ảnh phiên bản không hợp lệ";
    return null;
}

// Đọc sku + giá gốc của phiên bản; trả về { sku, originalPrice } hoặc { error }
function parseVariantPricing(body) {
    const sku = parseSku(body.sku);
    const originalPrice = parseOriginalPrice(body.original_price);
    const error = validatePricing(sku, originalPrice, body.price);
    return error ? { error } : { sku, originalPrice };
}

// Báo lỗi trùng của phiên bản: trùng SKU hay trùng tên trong cùng sản phẩm
function variantDuplicateError(err) {
    if (err.code !== "23505") return null;
    return duplicateSkuError(err) || "Tên phiên bản đã tồn tại trong sản phẩm này";
}

// Ảnh phiên bản: link ngoài thì upload lên Cloudinary, bỏ trống thì dùng ảnh sản phẩm (NULL)
// Trả về { image } hoặc gửi lỗi 400 và trả về null
async function resolveVariantImage(req, res) {
    try {
        return { image: await uploadImageUrl(String(req.body.image || "").trim()) };
    } catch (err) {
        console.error("Cloudinary upload error:", err);
        res.status(400).json({ error: "Không upload được ảnh từ URL này" });
        return null;
    }
}

// POST /api/admin/products/:id/variants - thêm phiên bản (vd "1 đôi", "Bộ 10 đôi", "Gỗ trắc")
// body: { name, price, stock, image?, sku?, original_price? }
router.post("/:id/variants", async (req, res) => {
    const { id } = req.params;
    const invalid = validateVariant(req.body);
    if (invalid) return res.status(400).json({ error: invalid });
    const pricing = parseVariantPricing(req.body);
    if (pricing.error) return res.status(400).json({ error: pricing.error });

    const uploaded = await resolveVariantImage(req, res);
    if (!uploaded) return;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const product = await client.query("SELECT id FROM products WHERE id = $1 FOR UPDATE", [id]);
        if (product.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Không tìm thấy sản phẩm" });
        }

        const result = await client.query(
            `INSERT INTO product_variants (product_id, name, price, stock, image, sku, original_price, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7,
                     COALESCE((SELECT MAX(sort_order) + 1 FROM product_variants WHERE product_id = $1), 0))
             RETURNING id, name, price, stock, image, sku, original_price`,
            [id, req.body.name.trim(), Number(req.body.price), Number(req.body.stock), uploaded.image,
                pricing.sku ?? null, pricing.originalPrice ?? null]
        );
        // Sản phẩm đã chuyển sang dạng có phiên bản: dòng giỏ cũ không chọn phiên bản không còn hợp lệ
        await client.query("DELETE FROM cart_items WHERE product_id = $1 AND variant_id IS NULL", [id]);

        await client.query("COMMIT");
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK");
        const dup = variantDuplicateError(err);
        if (dup) return res.status(400).json({ error: dup });
        console.error("POST /admin/products/:id/variants error:", err);
        res.status(500).json({ error: "Lỗi server khi thêm phiên bản" });
    } finally {
        client.release();
    }
});

// PUT /api/admin/products/:id/variants/:variantId - sửa tên/giá/tồn kho/ảnh/sku/giá gốc phiên bản
// sku/original_price không gửi thì giữ nguyên, gửi rỗng thì xoá
router.put("/:id/variants/:variantId", async (req, res) => {
    const { id, variantId } = req.params;
    const invalid = validateVariant(req.body);
    if (invalid) return res.status(400).json({ error: invalid });
    const pricing = parseVariantPricing(req.body);
    if (pricing.error) return res.status(400).json({ error: pricing.error });

    const uploaded = await resolveVariantImage(req, res);
    if (!uploaded) return;

    try {
        const result = await pool.query(
            `UPDATE product_variants SET name = $1, price = $2, stock = $3, image = $4,
                 sku = CASE WHEN $7 THEN $8 ELSE sku END,
                 original_price = CASE WHEN $9 THEN $10::numeric ELSE original_price END
             WHERE id = $5 AND product_id = $6
             RETURNING id, name, price, stock, image, sku, original_price`,
            [req.body.name.trim(), Number(req.body.price), Number(req.body.stock), uploaded.image, variantId, id,
                pricing.sku !== undefined, pricing.sku ?? null,
                pricing.originalPrice !== undefined, pricing.originalPrice ?? null]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy phiên bản" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        const dup = variantDuplicateError(err);
        if (dup) return res.status(400).json({ error: dup });
        console.error("PUT /admin/products/:id/variants/:variantId error:", err);
        res.status(500).json({ error: "Lỗi server khi cập nhật phiên bản" });
    }
});

// DELETE /api/admin/products/:id/variants/:variantId - xoá phiên bản
// Giỏ hàng chứa phiên bản này bị xoá theo (ON DELETE CASCADE); đơn cũ giữ lại variant_name
router.delete("/:id/variants/:variantId", async (req, res) => {
    const { id, variantId } = req.params;
    try {
        const result = await pool.query(
            "DELETE FROM product_variants WHERE id = $1 AND product_id = $2 RETURNING id",
            [variantId, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy phiên bản" });
        }
        res.json({ message: "Đã xoá phiên bản" });
    } catch (err) {
        console.error("DELETE /admin/products/:id/variants/:variantId error:", err);
        res.status(500).json({ error: "Lỗi server khi xoá phiên bản" });
    }
});

module.exports = router;
