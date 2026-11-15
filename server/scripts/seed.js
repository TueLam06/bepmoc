// Nạp danh mục + sản phẩm mẫu (dữ liệu giả) để chạy thử web ở local.
// Chạy: cd server && npm run seed [-- --reset]
// --reset: xoá hết sản phẩm/danh mục (kéo theo giỏ hàng, chi tiết đơn) rồi nạp lại.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { assertNotProduction } = require('../db/guard');
const { upsertCategories } = require('../db/categories');

// Dữ liệu giả: tên, giá, mã đều bịa, không lấy từ shop thật. Ảnh để trống.
// variants: [tên, giá, giá gốc]; giá gốc null = không giảm
const PRODUCTS = [
    { cat: 'dua-go', sku: 'DEMO-D01', name: 'Đũa gỗ trắc đầu vuông', short: 'Gỗ trắc · 24 cm', feature: true,
        variants: [['1 đôi', 45000, 55000], ['Bộ 10 đôi', 390000, 450000]] },
    { cat: 'dua-go', sku: 'DEMO-D02', name: 'Đũa gỗ cẩm lai trơn', short: 'Gỗ cẩm lai · 24 cm', feature: true,
        variants: [['1 đôi', 30000, null], ['Bộ 10 đôi', 260000, 300000]] },
    { cat: 'dua-go', sku: 'DEMO-D03', name: 'Đũa nấu gỗ dừa dài', short: 'Gỗ dừa · 39 cm', price: 18000, original: 22000 },
    { cat: 'dua-go', sku: 'DEMO-D04', name: 'Đũa trẻ em gỗ hương', short: 'Gỗ hương · 18 cm', price: 28000 },
    { cat: 'muoi-thia', sku: 'DEMO-M01', name: 'Muôi xới cơm gỗ', short: 'Gỗ nhãn · 22 cm', price: 39000, feature: true },
    { cat: 'muoi-thia', sku: 'DEMO-M02', name: 'Thìa cà phê gỗ mini', short: 'Gỗ trắc · 13 cm', price: 32000, original: 38000 },
    { cat: 'thot-khay-dia', sku: 'DEMO-T01', name: 'Thớt gỗ tay cầm', short: 'Gỗ nghiến · 35 × 16 cm', price: 290000, feature: true },
    { cat: 'thot-khay-dia', sku: 'DEMO-T02', name: 'Khay gỗ chữ nhật', short: 'Gỗ tràm · 30 × 20 cm', price: 150000 },
    { cat: 'phu-kien-ban-an', sku: 'DEMO-P01', name: 'Gác đũa gỗ giọt nước', short: 'Gỗ óc chó', feature: true,
        variants: [['1 chiếc', 15000, null], ['Bộ 10 chiếc', 120000, 150000]] },
    { cat: 'luoc-sung', sku: 'DEMO-L01', name: 'Lược sừng răng thưa', short: 'Sừng trâu · 17 cm', price: 85000 },
    { cat: 'luoc-go', sku: 'DEMO-G01', name: 'Lược gỗ đàn hương', short: 'Gỗ đàn hương · 18 cm', price: 69000, original: 79000 },
    { cat: 'massage', sku: 'DEMO-S01', name: 'Cây lăn massage gỗ', short: 'Gỗ thông · 6 bánh lăn', price: 95000 },
    { cat: 'do-tho-cung', sku: 'DEMO-C01', name: 'Bộ đũa thờ gỗ', short: 'Gỗ hương · 5 đôi', price: 180000 },
];

const STOCK = 50;

async function main() {
    console.log(`DB: ${assertNotProduction()}`);
    const client = await pool.connect();
    try {
        // DB mới (branch vừa tạo) có thể chưa có bảng
        const { rows: [t] } = await client.query(`SELECT to_regclass('public.products') AS t`);
        if (!t.t) {
            console.log('Chưa có bảng, chạy db/schema.sql');
            await client.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
        }

        const { rows: [c] } = await client.query('SELECT COUNT(*)::int AS n FROM products');
        if (c.n > 0 && !process.argv.includes('--reset')) {
            throw new Error(`Đã có ${c.n} sản phẩm, chạy lại với --reset để xoá và nạp lại`);
        }

        await client.query('BEGIN');
        if (c.n > 0) await client.query('TRUNCATE products, categories RESTART IDENTITY CASCADE');
        const catIds = await upsertCategories(client);

        for (const p of PRODUCTS) {
            const variants = p.variants || [];
            const { rows } = await client.query(
                `INSERT INTO products (name, price, original_price, stock, sku, short_description, description,
                                       category_id, feature, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING id`,
                [p.name, p.price ?? variants[0][1], p.original ?? null, variants.length ? 0 : STOCK, p.sku, p.short,
                    `Chất liệu: ${p.short.split(' · ')[0]}\nGhi chú: Sản phẩm mẫu`,
                    catIds[p.cat], Boolean(p.feature)]
            );
            for (const [i, [name, price, original]] of variants.entries()) {
                await client.query(
                    `INSERT INTO product_variants (product_id, name, price, original_price, stock, sku, sort_order)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [rows[0].id, name, price, original, STOCK, `${p.sku}-${i + 1}`, i]
                );
            }
        }
        await client.query('COMMIT');
        console.log(`Đã nạp ${PRODUCTS.length} sản phẩm mẫu`);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
