// Chạy trước mỗi file test, trước khi require code server (config/db.js đọc DATABASE_URL lúc require)
const { loadTestEnv } = require('./testEnv');

loadTestEnv();
