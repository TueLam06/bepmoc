const request = require('supertest');
const app = require('../app');
const { pool, resetDb, createProduct } = require('./helpers');

beforeEach(resetDb);

const list = (query = {}) => request(app).get('/api/products').query(query);

// Tạo n sản phẩm cùng giá, để kiểm tra thứ tự vẫn cố định khi sắp theo giá bị trùng
async function createProducts(n, extra = {}) {
    const products = [];
    for (let i = 1; i <= n; i += 1) {
        products.push(await createProduct({ name: `Sản phẩm ${i}`, price: 100000, ...extra }));
    }
    return products;
}

describe('GET /api/products', () => {
    test('không gửi page thì trả cả mảng như cũ', async () => {
        await createProducts(3);
        const res = await list();
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(3);
    });

    test('phân trang trả items và thông tin trang', async () => {
        await createProducts(5);
        const res = await list({ page: 2, limit: 2 });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
        expect(res.body.items).toHaveLength(2);
    });

    test('các trang không lặp, không sót sản phẩm khi giá trùng nhau', async () => {
        const products = await createProducts(5);
        const ids = [];
        for (let page = 1; page <= 3; page += 1) {
            const res = await list({ page, limit: 2, sort: 'price', order: 'asc' });
            ids.push(...res.body.items.map((p) => p.id));
        }
        expect(ids).toHaveLength(5);
        expect(new Set(ids)).toEqual(new Set(products.map((p) => p.id)));
    });

    test('trang vượt quá cuối trả mảng rỗng nhưng vẫn có tổng số', async () => {
        await createProducts(3);
        const res = await list({ page: 9, limit: 2 });
        expect(res.body.items).toEqual([]);
        expect(res.body).toMatchObject({ total: 3, totalPages: 2 });
    });

    test('page/limit sai thì dùng mặc định, limit bị chặn ở 48', async () => {
        await createProducts(1);
        const bad = await list({ page: 'abc', limit: -3 });
        expect(bad.body).toMatchObject({ page: 1, limit: 12 });

        const big = await list({ page: 1, limit: 1000 });
        expect(big.body.limit).toBe(48);
    });

    describe('tìm kiếm q', () => {
        const names = (res) => res.body.items.map((p) => p.name).sort();

        beforeEach(async () => {
            const cat = (
                await pool.query(`INSERT INTO categories (name, slug) VALUES ('Phụ kiện', 'phu-kien') RETURNING id`)
            ).rows[0];
            await createProduct({ name: 'Bàn phím cơ AKKO' });
            await createProduct({ name: 'Chuột Logitech G102' });
            const mouse = await createProduct({ name: 'Chuột Razer Viper' });
            await pool.query('UPDATE products SET category_id = $1 WHERE id = $2', [cat.id, mouse.id]);
            await createProduct({ name: 'Giảm giá 50%_đặc biệt' });
        });

        test('gõ không dấu, viết hoa vẫn tìm ra', async () => {
            const res = await list({ page: 1, q: 'BAN PHIM' });
            expect(names(res)).toEqual(['Bàn phím cơ AKKO']);
        });

        test('mỗi từ đều phải khớp', async () => {
            const res = await list({ page: 1, q: 'chuot logitech' });
            expect(names(res)).toEqual(['Chuột Logitech G102']);
            expect(res.body.total).toBe(1);
        });

        test('tìm được theo tên danh mục', async () => {
            const res = await list({ page: 1, q: 'phu kien' });
            expect(names(res)).toEqual(['Chuột Razer Viper']);
        });

        test('% và _ được coi là ký tự thường', async () => {
            expect(names(await list({ page: 1, q: '%' }))).toEqual(['Giảm giá 50%_đặc biệt']);
            expect((await list({ page: 1, q: '_' })).body.total).toBe(1);
        });

        test('q rỗng thì trả hết, không tìm thấy thì trả rỗng', async () => {
            expect((await list({ page: 1, q: '   ' })).body.total).toBe(4);
            expect((await list({ page: 1, q: 'tủ lạnh' })).body).toMatchObject({ items: [], total: 0 });
        });
    });

    test('tổng số tính theo danh mục và bỏ qua sản phẩm ẩn', async () => {
        const cat = (
            await pool.query(`INSERT INTO categories (name, slug) VALUES ('Bàn phím', 'ban-phim') RETURNING id`)
        ).rows[0];
        const products = await createProducts(3);
        await pool.query('UPDATE products SET category_id = $1 WHERE id = ANY($2)', [
            cat.id,
            [products[0].id, products[1].id],
        ]);
        await pool.query('UPDATE products SET is_active = false WHERE id = $1', [products[1].id]);

        const res = await list({ page: 1, category: cat.id });
        expect(res.body.total).toBe(1);
        expect(res.body.items.map((p) => p.id)).toEqual([products[0].id]);
    });
});
