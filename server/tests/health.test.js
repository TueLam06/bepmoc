const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
    it('trả 200 để dịch vụ ping giữ server thức', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });
});
