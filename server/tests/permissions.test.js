const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { resetDb, createUser, createProduct, addToCart, orderBody } = require('./helpers');

beforeEach(resetDb);

const get = (path, token) => {
    const req = request(app).get(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('route admin', () => {
    test.each(['/api/admin/stats', '/api/admin/orders', '/api/admin/products', '/api/users'])(
        '%s: không token 401, khách hàng 403, admin 200',
        async (path) => {
            const customer = await createUser();
            const admin = await createUser({ role: 'admin' });

            expect((await get(path)).status).toBe(401);
            expect((await get(path, customer.token)).status).toBe(403);
            expect((await get(path, admin.token)).status).toBe(200);
        }
    );

    test('danh sách user không lộ mật khẩu', async () => {
        const admin = await createUser({ role: 'admin' });
        const res = await get('/api/users', admin.token);
        expect(res.body.length).toBeGreaterThan(0);
        res.body.forEach((u) => expect(u).not.toHaveProperty('password'));
    });
});

describe('token', () => {
    test('token ký bằng secret khác bị từ chối', async () => {
        const fake = jwt.sign({ id: 1, email: 'x@test.local', role: 'admin' }, 'secret-doan-bua');
        expect((await get('/api/admin/stats', fake)).status).toBe(401);
    });

    test('token hết hạn bị từ chối', async () => {
        const expired = jwt.sign(
            { id: 1, email: 'x@test.local', role: 'admin', exp: Math.floor(Date.now() / 1000) - 60 },
            process.env.JWT_SECRET
        );
        const res = await get('/api/auth/me', expired);
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/hết hạn/);
    });
});

describe('đơn hàng của người khác', () => {
    test('không xem và không huỷ được đơn của user khác', async () => {
        const owner = await createUser();
        const other = await createUser();
        const product = await createProduct();
        await addToCart(owner.user.id, product.id, 1);
        const { orderId } = (
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${owner.token}`)
                .send(orderBody())
        ).body;

        expect((await get(`/api/orders/my/${orderId}`, other.token)).status).toBe(404);
        const cancel = await request(app)
            .patch(`/api/orders/my/${orderId}/cancel`)
            .set('Authorization', `Bearer ${other.token}`);
        expect(cancel.status).toBe(404);

        expect((await get(`/api/orders/my/${orderId}`, owner.token)).status).toBe(200);
    });
});
