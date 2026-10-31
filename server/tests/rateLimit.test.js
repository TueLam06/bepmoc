// Limiter lưu trong RAM của từng file test (Jest nạp lại module cho mỗi file), nên đếm bắt đầu từ 0
const request = require('supertest');
const app = require('../app');
const { PASSWORD, resetDb, createUser, nextIp } = require('./helpers');

beforeEach(resetDb);

test('đăng nhập sai 5 lần thì lần thứ 6 bị chặn, kể cả khi nhập đúng', async () => {
    const { user } = await createUser();
    const ip = nextIp();
    const login = (password) =>
        request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ email: user.email, password });

    for (let i = 0; i < 5; i++) {
        expect((await login('saimatkhau')).status).toBe(401);
    }
    expect((await login('saimatkhau')).status).toBe(429);
    expect((await login(PASSWORD)).status).toBe(429);
});

test('bị chặn với 1 email thì email khác cùng IP vẫn đăng nhập được', async () => {
    const victim = await createUser();
    const other = await createUser();
    const ip = nextIp();
    const login = (email, password) =>
        request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ email, password });

    for (let i = 0; i < 6; i++) await login(victim.user.email, 'saimatkhau');
    expect((await login(victim.user.email, PASSWORD)).status).toBe(429);
    expect((await login(other.user.email, PASSWORD)).status).toBe(200);
});

test('tra cứu đơn quá 10 lần/phút thì bị chặn (chống dò SĐT)', async () => {
    const ip = nextIp();
    const track = () =>
        request(app).post('/api/orders/track').set('X-Forwarded-For', ip).send({ orderId: 1, phone: '0912345678' });

    for (let i = 0; i < 10; i++) {
        expect((await track()).status).toBe(404);
    }
    expect((await track()).status).toBe(429);
});
