const request = require('supertest');
const app = require('../app');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
const { generateEmailToken } = require('../utils/token');
const { pool, PASSWORD, resetDb, createUser } = require('./helpers');

beforeEach(resetDb);

// Token mà server vừa gửi trong mail (tham số thứ 2 của hàm gửi mail đã mock)
const lastToken = (mailFn) => mailFn.mock.calls.at(-1)[1];

const login = (email, password = PASSWORD) =>
    request(app).post('/api/auth/login').send({ email, password });

describe('đăng ký và xác thực email', () => {
    test('chưa bấm link xác thực thì không đăng nhập được, bấm xong thì được', async () => {
        const reg = await request(app)
            .post('/api/auth/register')
            .send({ name: 'An', email: 'an@test.local', password: PASSWORD });
        expect(reg.status).toBe(201);
        expect(reg.body.token).toBeUndefined();
        expect(sendVerificationEmail).toHaveBeenCalledTimes(1);

        const before = await login('an@test.local');
        expect(before.status).toBe(403);
        expect(before.body.code).toBe('EMAIL_NOT_VERIFIED');

        const verify = await request(app)
            .post('/api/auth/verify-email')
            .send({ token: lastToken(sendVerificationEmail) });
        expect(verify.status).toBe(200);
        expect(verify.body.token).toEqual(expect.any(String));

        const after = await login('an@test.local');
        expect(after.status).toBe(200);
        expect(after.body.user).not.toHaveProperty('password');
    });

    test('đăng ký lại email chưa xác thực thì link cũ hết hiệu lực', async () => {
        const body = { name: 'Bình', email: 'binh@test.local', password: PASSWORD };
        await request(app).post('/api/auth/register').send(body).expect(201);
        const oldToken = lastToken(sendVerificationEmail);

        const again = await request(app)
            .post('/api/auth/register')
            .send({ ...body, password: 'matkhaumoi456' });
        expect(again.status).toBe(200);
        const newToken = lastToken(sendVerificationEmail);

        const oldRes = await request(app).post('/api/auth/verify-email').send({ token: oldToken });
        expect(oldRes.status).toBe(400);

        const newRes = await request(app).post('/api/auth/verify-email').send({ token: newToken });
        expect(newRes.status).toBe(200);
    });

    test('email đã xác thực thì không đăng ký lại được', async () => {
        await createUser({ email: 'cuong@test.local' });
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Kẻ giả mạo', email: 'cuong@test.local', password: 'matkhaukhac' });
        expect(res.status).toBe(409);
    });

    test('token trong link xác thực không dùng thay token đăng nhập được', async () => {
        const { user } = await createUser();
        const row = (await pool.query('SELECT * FROM users WHERE id = $1', [user.id])).rows[0];

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${generateEmailToken(row)}`);
        expect(res.status).toBe(401);
    });
});

describe('quên mật khẩu', () => {
    test('email có hay không tồn tại đều trả cùng một câu', async () => {
        await createUser({ email: 'dung@test.local' });

        const exists = await request(app).post('/api/auth/forgot-password').send({ email: 'dung@test.local' });
        const missing = await request(app).post('/api/auth/forgot-password').send({ email: 'khongco@test.local' });

        expect(exists.status).toBe(200);
        expect(missing.status).toBe(200);
        expect(missing.body).toEqual(exists.body);
        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    test('link đặt lại mật khẩu chỉ dùng được 1 lần', async () => {
        await createUser({ email: 'em@test.local' });
        await request(app).post('/api/auth/forgot-password').send({ email: 'em@test.local' }).expect(200);
        const token = lastToken(sendPasswordResetEmail);

        const first = await request(app)
            .post('/api/auth/reset-password')
            .send({ token, password: 'matkhaumoi789' });
        expect(first.status).toBe(200);
        expect(first.body.token).toEqual(expect.any(String));

        const second = await request(app)
            .post('/api/auth/reset-password')
            .send({ token, password: 'lanhaithuxem' });
        expect(second.status).toBe(400);

        expect((await login('em@test.local', 'matkhaumoi789')).status).toBe(200);
        expect((await login('em@test.local', PASSWORD)).status).toBe(401);
    });
});

describe('đổi mật khẩu', () => {
    test('sai mật khẩu hiện tại thì không đổi được, đúng thì đổi và đăng nhập bằng mật khẩu mới', async () => {
        const { user, token } = await createUser();
        const change = (currentPassword) =>
            request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ currentPassword, newPassword: 'matkhaumoi000' });

        expect((await change('saimatkhau')).status).toBe(400);
        expect((await change(PASSWORD)).status).toBe(200);

        expect((await login(user.email, PASSWORD)).status).toBe(401);
        expect((await login(user.email, 'matkhaumoi000')).status).toBe(200);
    });
});

describe('hồ sơ: địa chỉ giao hàng', () => {
    const updateMe = (token, body) =>
        request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`).send({ name: 'Khách', ...body });

    test('lưu được địa chỉ ở tỉnh ngoài Hà Nội/TP.HCM', async () => {
        const { token } = await createUser();
        const res = await updateMe(token, {
            city: 'Tỉnh Cà Mau', ward: 'Phường An Xuyên', street: '12 Lý Thường Kiệt',
        });
        expect(res.status).toBe(200);
        expect(res.body.user).toMatchObject({ city: 'Tỉnh Cà Mau', ward: 'Phường An Xuyên' });
    });

    test('tỉnh/thành không có trong danh sách 34 tỉnh bị từ chối', async () => {
        const { token } = await createUser();
        const res = await updateMe(token, { city: 'Tỉnh Bình Dương', ward: 'Phường 1', street: '12 Hùng Vương' });
        expect(res.status).toBe(400);
    });
});
