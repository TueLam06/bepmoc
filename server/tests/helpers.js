// Hàm tạo dữ liệu cho test: ghi thẳng vào DB, không qua API để không dính rate limit
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateToken } = require('../utils/token');

const PASSWORD = 'matkhau123';
const ADDRESS = '12 Lý Thường Kiệt, Phường Hoàn Kiếm, Thành phố Hà Nội';

async function resetDb() {
    await pool.query(`
        TRUNCATE order_status_history, order_items, orders, cart_items,
            product_variants, products, categories, users RESTART IDENTITY CASCADE
    `);
}

let userSeq = 0;

// Trả về { user, token } với token đăng nhập hợp lệ
async function createUser({ role = 'customer', verified = true, email, password = PASSWORD } = {}) {
    userSeq += 1;
    const hash = await bcrypt.hash(password, 4);
    const result = await pool.query(
        `INSERT INTO users (name, email, password, role, email_verified)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
        [`User ${userSeq}`, email || `user${userSeq}@test.local`, hash, role, verified]
    );
    const user = result.rows[0];
    return { user, token: generateToken(user) };
}

async function createProduct({ name = 'Bàn phím cơ', price = 500000, stock = 10 } = {}) {
    const result = await pool.query(
        'INSERT INTO products (name, price, stock) VALUES ($1, $2, $3) RETURNING *',
        [name, price, stock]
    );
    return result.rows[0];
}

async function createVariant(productId, { name = 'Màu đen', price = 600000, stock = 5 } = {}) {
    const result = await pool.query(
        'INSERT INTO product_variants (product_id, name, price, stock) VALUES ($1, $2, $3, $4) RETURNING *',
        [productId, name, price, stock]
    );
    return result.rows[0];
}

async function addToCart(userId, productId, quantity, variantId = null) {
    await pool.query(
        'INSERT INTO cart_items (user_id, product_id, quantity, variant_id) VALUES ($1, $2, $3, $4)',
        [userId, productId, quantity, variantId]
    );
}

async function getStock(productId) {
    const result = await pool.query('SELECT stock FROM products WHERE id = $1', [productId]);
    return result.rows[0].stock;
}

// Mỗi khách vãng lai một IP riêng (app tin X-Forwarded-For), để rate limit đặt hàng theo IP không ảnh hưởng test khác
let ipSeq = 0;
function nextIp() {
    ipSeq += 1;
    return `10.0.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}`;
}

function orderBody(extra = {}) {
    return {
        customer_name: 'Nguyễn Văn A',
        phone: '0912345678',
        email: 'khach@test.local',
        address: ADDRESS,
        ...extra,
    };
}

module.exports = {
    pool,
    PASSWORD,
    resetDb,
    createUser,
    createProduct,
    createVariant,
    addToCart,
    getStock,
    nextIp,
    orderBody,
};
