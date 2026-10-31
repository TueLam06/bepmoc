// Chạy 1 lần trước toàn bộ test: kiểm tra DB an toàn rồi dựng lại bảng từ schema.sql
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { SERVER_DIR, loadTestEnv, assertSafeDatabase } = require('./testEnv');

module.exports = async () => {
    loadTestEnv();
    assertSafeDatabase();

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    try {
        // Xoá bảng cũ để schema luôn khớp với schema.sql, kể cả khi schema.sql vừa đổi
        await pool.query(`
            DROP TABLE IF EXISTS order_status_history, order_items, orders, cart_items,
                product_variants, products, categories, users CASCADE
        `);
        await pool.query(fs.readFileSync(path.join(SERVER_DIR, 'db', 'schema.sql'), 'utf8'));
    } finally {
        await pool.end();
    }
};
