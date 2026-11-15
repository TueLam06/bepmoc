const request = require('supertest');
const app = require('../app');
const { pool, resetDb, createUser, createProduct, createVariant } = require('./helpers');

let token;
beforeEach(async () => {
    await resetDb();
    ({ token } = await createUser({ role: 'admin' }));
});

const auth = (req) => req.set('Authorization', `Bearer ${token}`);
const create = (body) => auth(request(app).post('/api/admin/products')).send({ stock: 10, ...body });
const update = (id, body) => auth(request(app).put(`/api/admin/products/${id}`)).send(body);

describe('sku và giá gốc của sản phẩm', () => {
    test('tạo sản phẩm: sku viết hoa, có giá gốc', async () => {
        const res = await create({ name: 'Đũa gỗ trắc', price: 90000, sku: ' ctl701tt ', original_price: 120000 });
        expect(res.status).toBe(201);
        expect(res.body.sku).toBe('CTL701TT');
        expect(Number(res.body.original_price)).toBe(120000);
    });

    test('sku và giá gốc để trống thì lưu NULL', async () => {
        const res = await create({ name: 'Gác đũa', price: 30000, sku: '', original_price: '' });
        expect(res.status).toBe(201);
        expect(res.body.sku).toBeNull();
        expect(res.body.original_price).toBeNull();
    });

    test('sku sai định dạng hoặc trùng thì báo lỗi', async () => {
        expect((await create({ name: 'A', price: 1000, sku: 'CTL 701' })).status).toBe(400);
        await create({ name: 'A', price: 1000, sku: 'CTL720' });
        const dup = await create({ name: 'B', price: 1000, sku: 'ctl720' });
        expect(dup.status).toBe(400);
        expect(dup.body.error).toMatch(/SKU/);
    });

    test('giá gốc phải lớn hơn giá bán', async () => {
        expect((await create({ name: 'A', price: 50000, original_price: 50000 })).status).toBe(400);
        expect((await create({ name: 'A', price: 50000, original_price: -1 })).status).toBe(400);
    });

    test('sửa giá bán vượt giá gốc đang có thì báo lỗi, gửi giá gốc rỗng thì xoá', async () => {
        const product = await createProduct({ price: 50000 });
        await pool.query('UPDATE products SET original_price = 60000 WHERE id = $1', [product.id]);

        expect((await update(product.id, { price: 70000 })).status).toBe(400);

        const res = await update(product.id, { price: 70000, original_price: '' });
        expect(res.status).toBe(200);
        expect(res.body.original_price).toBeNull();
    });

    test('không gửi sku thì giữ nguyên', async () => {
        const created = await create({ name: 'A', price: 1000, sku: 'CTL756' });
        const res = await update(created.body.id, { name: 'Tên mới' });
        expect(res.body.sku).toBe('CTL756');
    });
});

describe('sku và giá gốc của phiên bản', () => {
    const addVariant = (productId, body) =>
        auth(request(app).post(`/api/admin/products/${productId}/variants`)).send({ stock: 5, ...body });

    test('thêm phiên bản có sku và giá gốc, trang công khai trả kèm', async () => {
        const product = await createProduct();
        const res = await addVariant(product.id, {
            name: 'Bộ 10 đôi', price: 195000, sku: 'ctl701tt-10', original_price: 250000,
        });
        expect(res.status).toBe(201);
        expect(res.body.sku).toBe('CTL701TT-10');

        const list = await request(app).get('/api/products');
        expect(list.body[0].variants[0]).toMatchObject({ sku: 'CTL701TT-10', original_price: 250000 });
        const detail = await request(app).get(`/api/products/${product.id}`);
        expect(Number(detail.body.variants[0].original_price)).toBe(250000);
    });

    test('trùng sku hay giá gốc không hợp lệ thì báo lỗi', async () => {
        const product = await createProduct();
        await addVariant(product.id, { name: '1 đôi', price: 97000, sku: 'CTL701TT-1' });
        const dup = await addVariant(product.id, { name: 'Bộ 10 đôi', price: 195000, sku: 'CTL701TT-1' });
        expect(dup.status).toBe(400);
        expect(dup.body.error).toMatch(/SKU/);
        expect((await addVariant(product.id, { name: 'Bộ 5 đôi', price: 100000, original_price: 90000 })).status).toBe(400);
    });

    test('sửa phiên bản không gửi sku thì giữ, gửi rỗng thì xoá', async () => {
        const product = await createProduct();
        const variant = await createVariant(product.id);
        await pool.query("UPDATE product_variants SET sku = 'CTL1', original_price = 900000 WHERE id = $1", [variant.id]);
        const url = `/api/admin/products/${product.id}/variants/${variant.id}`;

        const kept = await auth(request(app).put(url)).send({ name: 'Màu đen', price: 600000, stock: 5 });
        expect(kept.body).toMatchObject({ sku: 'CTL1' });
        expect(Number(kept.body.original_price)).toBe(900000);

        const cleared = await auth(request(app).put(url)).send({
            name: 'Màu đen', price: 600000, stock: 5, sku: '', original_price: '',
        });
        expect(cleared.body).toMatchObject({ sku: null, original_price: null });
    });
});

test('tìm sản phẩm theo mã SKU', async () => {
    const product = await createProduct({ name: 'Đũa ăn cơm' });
    await pool.query("UPDATE products SET sku = 'CTL756' WHERE id = $1", [product.id]);
    const res = await request(app).get('/api/products').query({ q: 'ctl756' });
    expect(res.body.map((p) => p.id)).toEqual([product.id]);
});
