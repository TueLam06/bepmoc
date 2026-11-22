const request = require('supertest');
const app = require('../app');
const { sendOrderConfirmationEmail, sendNewOrderAdminEmail } = require('../utils/mailer');
const {
    pool,
    resetDb,
    createUser,
    createProduct,
    createVariant,
    addToCart,
    getStock,
    nextIp,
    orderBody,
} = require('./helpers');

beforeEach(resetDb);

const guestOrder = (cart, extra) =>
    request(app)
        .post('/api/orders')
        .set('X-Forwarded-For', nextIp())
        .send(orderBody({ cart, ...extra }));

const userOrder = (token) =>
    request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderBody());

const countOrders = async () => (await pool.query('SELECT COUNT(*)::int AS n FROM orders')).rows[0].n;

describe('khách vãng lai đặt hàng', () => {
    test('đặt thành công thì trừ tồn kho, tính đúng tổng tiền và gửi mail xác nhận', async () => {
        const product = await createProduct({ price: 250000, stock: 10 });

        const res = await guestOrder([{ id: product.id, quantity: 3 }]);
        expect(res.status).toBe(201);
        expect(res.body.total).toBe(750000);

        expect(await getStock(product.id)).toBe(7);
        expect(sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
        expect(sendOrderConfirmationEmail.mock.calls[0][0].email).toBe('khach@test.local');
    });

    test('mua quá tồn kho thì bị từ chối và không tạo đơn', async () => {
        const product = await createProduct({ stock: 2 });

        const res = await guestOrder([{ id: product.id, quantity: 3 }]);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/không đủ tồn kho/);

        expect(await getStock(product.id)).toBe(2);
        expect(await countOrders()).toBe(0);
    });

    test.each([0, -1, 1.5, 21])('số lượng %p không hợp lệ', async (quantity) => {
        const product = await createProduct();
        const res = await guestOrder([{ id: product.id, quantity }]);
        expect(res.status).toBe(400);
        expect(await getStock(product.id)).toBe(10);
    });

    test('giao toàn quốc: tỉnh/thành nào trong 34 tỉnh cũng được', async () => {
        const product = await createProduct();
        const res = await guestOrder([{ id: product.id, quantity: 1 }], {
            address: '5 Trần Phú, Phường Hải Châu, Thành phố Đà Nẵng',
        });
        expect(res.status).toBe(201);
    });

    test.each([
        '5 Trần Phú, Phường Hải Châu', // thiếu tỉnh/thành
        '5 Trần Phú, Phường Hải Châu, Quận 1', // không phải tên tỉnh
        '12 Hùng Vương, Phường 1, Tỉnh Bình Dương', // tỉnh cũ đã sáp nhập
    ])('địa chỉ %p bị từ chối', async (address) => {
        const product = await createProduct();
        const res = await guestOrder([{ id: product.id, quantity: 1 }], { address });
        expect(res.status).toBe(400);
    });

    test('sản phẩm có phiên bản thì trừ kho của phiên bản, giá lấy theo phiên bản', async () => {
        const product = await createProduct({ price: 100000, stock: 50 });
        const variant = await createVariant(product.id, { price: 300000, stock: 4 });

        const noVariant = await guestOrder([{ id: product.id, quantity: 1 }]);
        expect(noVariant.status).toBe(400);

        const res = await guestOrder([{ id: product.id, variant_id: variant.id, quantity: 2 }]);
        expect(res.status).toBe(201);
        expect(res.body.total).toBe(600000);

        const stocks = await pool.query('SELECT stock FROM product_variants WHERE id = $1', [variant.id]);
        expect(stocks.rows[0].stock).toBe(2);
        expect(await getStock(product.id)).toBe(50);
    });
});

describe('user đăng nhập đặt hàng', () => {
    test('lấy giỏ trên server, đặt xong thì giỏ trống', async () => {
        const { user, token } = await createUser();
        const product = await createProduct({ price: 100000, stock: 5 });
        await addToCart(user.id, product.id, 2);

        const res = await userOrder(token);
        expect(res.status).toBe(201);
        expect(await getStock(product.id)).toBe(3);

        const cart = await pool.query('SELECT * FROM cart_items WHERE user_id = $1', [user.id]);
        expect(cart.rows).toHaveLength(0);
    });

    test('huỷ đơn đang chờ thì trả lại tồn kho, không huỷ được lần 2', async () => {
        const { user, token } = await createUser();
        const product = await createProduct({ stock: 5 });
        await addToCart(user.id, product.id, 2);
        const { orderId } = (await userOrder(token)).body;

        const cancel = () =>
            request(app)
                .patch(`/api/orders/my/${orderId}/cancel`)
                .set('Authorization', `Bearer ${token}`);

        const res = await cancel();
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('cancelled');
        expect(await getStock(product.id)).toBe(5);

        expect((await cancel()).status).toBe(400);
        expect(await getStock(product.id)).toBe(5);
    });
});

describe('nhiều người mua cùng lúc', () => {
    test('còn 3 cái mà 6 người cùng đặt: đúng 3 đơn thành công, kho về 0 chứ không âm', async () => {
        const product = await createProduct({ stock: 3 });
        const buyers = [];
        for (let i = 0; i < 6; i++) {
            const buyer = await createUser();
            await addToCart(buyer.user.id, product.id, 1);
            buyers.push(buyer);
        }

        const results = await Promise.all(buyers.map(({ token }) => userOrder(token)));
        const statuses = results.map((r) => r.status).sort();

        expect(statuses).toEqual([201, 201, 201, 400, 400, 400]);
        expect(await getStock(product.id)).toBe(0);
        expect(await countOrders()).toBe(3);
    });
});

// Mail admin gửi sau khi trả response nên phải chờ
const waitForCall = async (mock) => {
    for (let i = 0; i < 50 && mock.mock.calls.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 20));
    }
};

describe('báo đơn mới cho admin', () => {
    test('gửi 1 mail tới tất cả admin, kèm phiếu Excel', async () => {
        const { user: a1 } = await createUser({ role: 'admin' });
        const { user: a2 } = await createUser({ role: 'admin' });
        await createUser();
        const product = await createProduct({ price: 510000 });

        const res = await guestOrder([{ id: product.id, quantity: 5 }]);
        expect(res.status).toBe(201);
        await waitForCall(sendNewOrderAdminEmail);

        expect(sendNewOrderAdminEmail).toHaveBeenCalledTimes(1);
        const [emails, order, items, attachment] = sendNewOrderAdminEmail.mock.calls[0];
        expect(emails.sort()).toEqual([a1.email, a2.email].sort());
        expect(order.id).toBe(res.body.orderId);
        expect(items).toHaveLength(1);
        expect(attachment.name).toMatch(/^DH\d{4}\d{6}\.xlsx$/);
        expect(attachment.content.byteLength).toBeGreaterThan(0);
    });

    test('không có admin thì không gửi', async () => {
        const product = await createProduct();
        const res = await guestOrder([{ id: product.id, quantity: 1 }]);
        expect(res.status).toBe(201);
        await new Promise((r) => setTimeout(r, 300));
        expect(sendNewOrderAdminEmail).not.toHaveBeenCalled();
    });
});
