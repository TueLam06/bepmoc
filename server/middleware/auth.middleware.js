const { verifyTokenString } = require('../utils/token');
const pool = require('../config/db');

// Middleware bắt buộc phải đăng nhập mới được đi tiếp
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization']; // dạng: "Bearer <token>"

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Thiếu token xác thực' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = verifyTokenString(token);
        req.user = decoded; // { id, email, role } — dùng ở các route sau
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token đã hết hạn, vui lòng đăng nhập lại' });
        }
        return res.status(401).json({ error: 'Token không hợp lệ' });
    }
}

// Middleware chỉ cho phép admin đi tiếp (dùng sau verifyToken)
// Đọc role từ DB chứ không tin role trong token: đổi quyền xong có hiệu lực ngay, không phải đăng nhập lại
async function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(403).json({ error: 'Chỉ admin mới được phép thực hiện hành động này' });
    }
    try {
        const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        const role = result.rows[0]?.role;
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ admin mới được phép thực hiện hành động này' });
        }
        req.user.role = role;
        next();
    } catch (err) {
        console.error('Lỗi kiểm tra quyền admin:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
}

// Middleware "tuỳ chọn": nếu có token thì gắn req.user, không có cũng không lỗi
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            req.user = verifyTokenString(token);
        } catch (err) {
            // token sai/hết hạn thì bỏ qua, coi như khách vãng lai
        }
    }
    next();
}

module.exports = { verifyToken, requireAdmin, optionalAuth };