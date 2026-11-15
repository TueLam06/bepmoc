// Chặn script/test chạy nhầm lên DB production (xoá hoặc ghi đè dữ liệu thật)
const PRODUCTION_HOST_PREFIX = 'ep-weathered-wave-';

function dbHost(url = process.env.DATABASE_URL) {
    return new URL(url).hostname;
}

function assertNotProduction(url = process.env.DATABASE_URL) {
    const host = dbHost(url);
    if (host.startsWith(PRODUCTION_HOST_PREFIX)) {
        throw new Error(`DATABASE_URL đang trỏ vào production (${host}), dừng`);
    }
    return host;
}

module.exports = { PRODUCTION_HOST_PREFIX, dbHost, assertNotProduction };
