const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;

// Đọc số nguyên dương từ query, sai hoặc thiếu thì dùng giá trị mặc định
function positiveInt(value, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 ? n : fallback;
}

const MAX_QUERY_LENGTH = 100;
const MAX_QUERY_WORDS = 8;

// Tách từ khoá thành các từ, bỏ trống; giới hạn độ dài để không ai gửi chuỗi khổng lồ làm nặng query
function searchWords(q) {
    if (typeof q !== "string") return [];
    return q.slice(0, MAX_QUERY_LENGTH).trim().split(/\s+/).filter(Boolean).slice(0, MAX_QUERY_WORDS);
}

// Thoát ký tự đặc biệt của LIKE, để khách gõ "%" hay "_" thì tìm đúng ký tự đó
const escapeLike = (s) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

// Chuỗi dùng để tìm: tên + mô tả ngắn + tên danh mục, bỏ dấu và viết thường
// để "dua go" hay "ĐŨA GỖ" đều tìm ra "Đũa gỗ"
const SEARCH_TEXT = `unaccent(lower(p.name || ' ' || COALESCE(p.short_description, '') || ' ' || COALESCE(c.name, '')))`;

router.get('/', async (req, res) => {
    const allowedSort = {
        name: "p.name",
        // Sản phẩm có phiên bản thì sắp theo giá thấp nhất của phiên bản
        price: "COALESCE(v.min_price, p.price)",
        newest: "p.id", // đổi thành "p.created_at" nếu bảng products có cột này
    };
    const allowedOrder = ["asc", "desc"];

    let { category, sort = "newest", order = "desc" } = req.query;

    const sortColumn = allowedSort[sort] || "p.id";
    const sortOrder = allowedOrder.includes(String(order).toLowerCase())
        ? order.toUpperCase()
        : "DESC";

    // Không gửi page thì trả cả mảng như cũ: trang chủ cần hết, và client cũ vẫn chạy được nếu server deploy trước
    const paginated = req.query.page !== undefined;
    const page = positiveInt(req.query.page, 1);
    const limit = Math.min(positiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);

    try {
        const params = [];
        let whereClause = "WHERE p.is_active = true";

        if (category) {
            params.push(category);
            whereClause += ` AND p.category_id = $${params.length}`;
        }

        // Mỗi từ phải xuất hiện ở đâu đó (AND), nên "chuột logitech" chỉ ra chuột của Logitech
        for (const word of searchWords(req.query.q)) {
            params.push(`%${escapeLike(word)}%`);
            whereClause += ` AND ${SEARCH_TEXT} LIKE unaccent(lower($${params.length}))`;
        }
        // Câu đếm dùng chung điều kiện lọc, chưa có tham số LIMIT/OFFSET
        const filterParams = [...params];

        let pageClause = "";
        if (paginated) {
            params.push(limit, (page - 1) * limit);
            pageClause = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
        }

        // min_price/variant_count: để thẻ sản phẩm hiện "Từ X đ" khi có nhiều phiên bản
        // variants: để chọn phiên bản ngay trên thẻ sản phẩm; category_name: tên danh mục hiển thị
        const result = await pool.query(
            `SELECT p.*, c.name AS category_name, v.min_price,
                    COALESCE(v.variant_count, 0)::int AS variant_count,
                    COALESCE(v.variants, '[]') AS variants
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN (
                 SELECT product_id, MIN(price) AS min_price, COUNT(*) AS variant_count,
                        json_agg(json_build_object('id', id, 'name', name, 'price', price, 'stock', stock, 'image', image)
                                 ORDER BY sort_order, id) AS variants
                 FROM product_variants
                 GROUP BY product_id
             ) v ON v.product_id = p.id
             ${whereClause}
             ORDER BY ${sortColumn} ${sortOrder}, p.id ${sortOrder}
             ${pageClause}`,
            params
        );
        // p.id ở ORDER BY để thứ tự cố định khi trùng tên/giá, không thì sản phẩm có thể lặp hoặc mất giữa các trang

        if (!paginated) return res.json(result.rows);

        // Đếm riêng để trang vượt quá cuối vẫn biết tổng số
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM products p LEFT JOIN categories c ON c.id = p.category_id
             ${whereClause}`,
            filterParams
        );
        const total = count.rows[0].total;
        res.json({
            items: result.rows,
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM products WHERE id = $1 AND is_active = true',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
        }
        const variants = await pool.query(
            `SELECT id, name, price, stock, image FROM product_variants
             WHERE product_id = $1 ORDER BY sort_order, id`,
            [id]
        );
        res.json({ ...result.rows[0], variants: variants.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

module.exports = router;
