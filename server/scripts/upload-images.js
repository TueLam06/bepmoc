// Chuyển ảnh sản phẩm/phiên bản đang là link ngoài (vd CDN Shopee) lên Cloudinary rồi thay link trong DB.
// Chạy: cd server && npm run upload-images [-- --dry-run]
// Chạy lại được nhiều lần: ảnh đã ở Cloudinary thì bỏ qua, public_id lấy theo hash link gốc nên không tạo bản trùng.
require('dotenv').config();
const crypto = require('crypto');
const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');
const { dbHost } = require('../db/guard');

const FOLDER = 'bepmoc/products';
const CONCURRENCY = 4;
const dryRun = process.argv.includes('--dry-run');

const isCloudinary = (url) => url.includes('res.cloudinary.com');

async function uploadOne(url) {
    const publicId = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
    const result = await cloudinary.uploader.upload(url, {
        folder: FOLDER,
        public_id: publicId,
        overwrite: false,
        // Ảnh gốc lớn thì thu về tối đa 1600px để không tốn dung lượng lưu trữ
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
    });
    return result.secure_url;
}

async function main() {
    console.log(`DB: ${dbHost()}${dryRun ? ' (dry-run, không ghi gì)' : ''}`);
    if (!dryRun) await cloudinary.api.ping(); // sai key thì dừng ngay, không chạy nửa chừng

    const { rows } = await pool.query(`
        SELECT 'products' AS tbl, id, image FROM products WHERE image IS NOT NULL
        UNION ALL
        SELECT 'product_variants', id, image FROM product_variants WHERE image IS NOT NULL
    `);
    // Nhiều dòng dùng chung 1 ảnh (sản phẩm và phiên bản đầu tiên): mỗi link chỉ upload 1 lần
    const urls = [...new Set(rows.map((r) => r.image).filter((u) => !isCloudinary(u)))];
    console.log(`${rows.length} dòng có ảnh, ${urls.length} link cần chuyển`);
    if (dryRun || urls.length === 0) return;

    const mapped = new Map();
    const failed = [];
    let next = 0;
    async function worker() {
        while (next < urls.length) {
            const url = urls[next++];
            try {
                mapped.set(url, await uploadOne(url));
                process.stdout.write(`\r${mapped.size + failed.length}/${urls.length}`);
            } catch (err) {
                failed.push([url, err.message || err.error?.message]);
            }
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log();

    // Thay link theo từng giá trị cũ, cả 2 bảng
    for (const [oldUrl, newUrl] of mapped) {
        await pool.query('UPDATE products SET image = $2 WHERE image = $1', [oldUrl, newUrl]);
        await pool.query('UPDATE product_variants SET image = $2 WHERE image = $1', [oldUrl, newUrl]);
    }
    console.log(`Đã chuyển ${mapped.size} ảnh lên Cloudinary (${FOLDER})`);
    if (failed.length) {
        console.log(`${failed.length} ảnh lỗi, giữ link cũ, chạy lại script để thử tiếp:`);
        for (const [url, msg] of failed) console.log(`- ${url}: ${msg}`);
    }
}

main()
    .catch((err) => {
        console.error(err.message || err.error?.message || err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
