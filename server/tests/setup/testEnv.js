// Nạp biến môi trường cho test và chặn chạy nhầm lên DB thật (test xoá sạch dữ liệu)
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const SERVER_DIR = path.join(__dirname, '..', '..');
const PRODUCTION_HOST_PREFIX = 'ep-weathered-wave-';

function loadTestEnv() {
    const file = path.join(SERVER_DIR, '.env.test');
    if (fs.existsSync(file)) {
        Object.assign(process.env, dotenv.parse(fs.readFileSync(file)));
    } else if (!process.env.CI) {
        // Không có .env.test thì DATABASE_URL đang có (nếu có) rất có thể là DB dev
        throw new Error('Thiếu server/.env.test (DATABASE_URL trỏ vào branch test của Neon)');
    }

    if (!process.env.DATABASE_URL) {
        throw new Error('Thiếu DATABASE_URL cho test');
    }
    process.env.JWT_SECRET ||= 'test-secret';
    // dotenv.config() trong code không ghi đè biến đã có: để rỗng thì không gửi mail thật, có key giả thì Gemini khởi tạo được
    process.env.BREVO_API_KEY = '';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.DOTENV_CONFIG_QUIET = 'true';
}

function assertSafeDatabase() {
    const host = new URL(process.env.DATABASE_URL).hostname;
    if (host.startsWith(PRODUCTION_HOST_PREFIX)) {
        throw new Error(`DATABASE_URL đang trỏ vào production (${host}), dừng test`);
    }

    const devFile = path.join(SERVER_DIR, '.env');
    if (fs.existsSync(devFile)) {
        const devUrl = dotenv.parse(fs.readFileSync(devFile)).DATABASE_URL;
        if (devUrl && new URL(devUrl).hostname === host) {
            throw new Error(`DATABASE_URL của test trùng DB dev (${host}), dừng test`);
        }
    }
}

module.exports = { SERVER_DIR, loadTestEnv, assertSafeDatabase };
