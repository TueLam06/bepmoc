const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../app');
const { sendOrderShippedEmail, sendShippingFeeEmail } = require('../utils/mailer');
const { pool, resetDb, createUser, createProduct, createVariant } = require('./helpers');

let token;
beforeEach(async () => {
    await resetDb();
    ({ token } = await createUser({ role: 'admin' }));
});

// Tạo đơn thẳng vào DB, chỉ cần các cột mà phí ship/mã vận đơn dùng tới
async function createOrder({ status = 'confirmed', shipping_fee = null, email = 'khach@test.local' } = {}) {
    const result = await pool.query(
        `INSERT INTO orders (customer_name, phone, address, total, status, email, shipping_fee)
         VALUES ('Nguyễn Văn A', '0912345678', '12 Lý Thường Kiệt, Phường Hoàn Kiếm, Thành phố Hà Nội', 150000, $1, $2, $3)
         RETURNING *`,
        [status, email, shipping_fee]
    );
    return result.rows[0];
}

const setFee = (id, shipping_fee) =>
    request(app)
        .patch(`/api/admin/orders/${id}/shipping-fee`)
        .set('Authorization', `Bearer ${token}`)
        .send({ shipping_fee });

const setTracking = (id, tracking_code) =>
    request(app)
        .patch(`/api/admin/orders/${id}/tracking`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tracking_code });

describe('phí ship', () => {
    test('nhập phí ship cho đơn chờ xác nhận và đã xác nhận', async () => {
        const pending = await createOrder({ status: 'pending' });
        const res = await setFee(pending.id, 30000);
        expect(res.status).toBe(200);
        expect(Number(res.body.shipping_fee)).toBe(30000);

        const confirmed = await createOrder();
        expect((await setFee(confirmed.id, 0)).status).toBe(200);
    });

    test('null thì xoá phí ship', async () => {
        const order = await createOrder({ shipping_fee: 30000 });
        const res = await setFee(order.id, null);
        expect(res.status).toBe(200);
        expect(res.body.shipping_fee).toBeNull();
    });

    test('phí ship âm, thập phân, chuỗi hoặc quá lớn thì báo lỗi', async () => {
        const order = await createOrder();
        for (const fee of [-1, 1000.5, '30000', 2000001, undefined]) {
            expect((await setFee(order.id, fee)).status).toBe(400);
        }
    });

    test('đơn đã giao hoặc đã huỷ thì không sửa phí ship được', async () => {
        for (const status of ['shipping', 'completed', 'cancelled']) {
            const order = await createOrder({ status, shipping_fee: 30000 });
            expect((await setFee(order.id, 50000)).status).toBe(400);
        }
    });

    test('đơn không tồn tại trả 404', async () => {
        expect((await setFee(9999, 30000)).status).toBe(404);
    });

    test('gửi mail báo phí ship khi phí thay đổi, không gửi khi xoá hoặc giữ nguyên', async () => {
        const order = await createOrder({ status: 'pending' });
        await setFee(order.id, 30000);
        expect(sendShippingFeeEmail).toHaveBeenCalledTimes(1);
        expect(Number(sendShippingFeeEmail.mock.calls[0][0].shipping_fee)).toBe(30000);

        await setFee(order.id, 30000);
        expect(sendShippingFeeEmail).toHaveBeenCalledTimes(1);

        await setFee(order.id, 0);
        expect(sendShippingFeeEmail).toHaveBeenCalledTimes(2);

        await setFee(order.id, null);
        expect(sendShippingFeeEmail).toHaveBeenCalledTimes(2);
    });
});

describe('xuất phiếu đơn hàng', () => {
    // Gom response nhị phân thành Buffer để đọc bằng exceljs
    const binary = (res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
    };
    const exportOrder = (id) =>
        request(app)
            .get(`/api/admin/orders/${id}/export`)
            .set('Authorization', `Bearer ${token}`)
            .buffer(true)
            .parse(binary);

    // Đơn 2 dòng: sản phẩm thường (SKU sản phẩm) và sản phẩm có phiên bản (SKU phiên bản)
    async function orderWithItems() {
        const order = await createOrder();
        const plate = await createProduct({ name: 'Đĩa trai', price: 510000 });
        await pool.query("UPDATE products SET sku = 'DT01' WHERE id = $1", [plate.id]);
        const chopsticks = await createProduct({ name: 'Đũa gỗ', price: 0 });
        const variant = await createVariant(chopsticks.id, { name: 'Gỗ trắc', price: 90000 });
        await pool.query("UPDATE product_variants SET sku = 'CTL701TT' WHERE id = $1", [variant.id]);
        await pool.query(
            `INSERT INTO order_items (order_id, product_id, variant_id, variant_name, quantity, price_at_purchase, product_name)
             VALUES ($1, $2, NULL, NULL, 5, 510000, 'Đĩa trai'), ($1, $3, $4, 'Gỗ trắc', 2, 90000, 'Đũa gỗ')`,
            [order.id, plate.id, chopsticks.id, variant.id]
        );
        return order;
    }

    // Đọc toàn bộ chữ trong sheet để tìm dòng theo nhãn
    async function readSheet(buffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const ws = workbook.worksheets[0];
        const rows = [];
        ws.eachRow((row) => rows.push(row));
        const text = (cell) => {
            const v = cell.value;
            if (v && v.richText) return v.richText.map((r) => r.text).join('');
            if (v && typeof v === 'object' && 'result' in v) return v.result;
            return v;
        };
        const find = (label) => rows.find((r) => String(text(r.getCell(1)) || '').startsWith(label));
        return { rows, text, find };
    }

    test('phiếu có số DH + năm + mã đơn, bảng hàng có SKU và tổng tiền hàng', async () => {
        const order = await orderWithItems();
        const res = await exportOrder(order.id);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/spreadsheetml/);
        const year = new Date().getFullYear();
        const code = `DH${year}${String(order.id).padStart(6, '0')}`;
        expect(res.headers['content-disposition']).toContain(`${code}.xlsx`);

        const { text, find } = await readSheet(res.body);
        expect(text(find('Số:').getCell(1))).toBe(`Số: ${code}`);

        const head = find('STT');
        const plate = head.worksheet.getRow(head.number + 1);
        expect(text(plate.getCell(2))).toBe('Đĩa trai');
        expect(text(plate.getCell(3))).toBe('DT01');
        expect(text(plate.getCell(7))).toBe(2550000);
        const chopsticks = head.worksheet.getRow(head.number + 2);
        expect(text(chopsticks.getCell(2))).toBe('Đũa gỗ - Gỗ trắc');
        expect(text(chopsticks.getCell(3))).toBe('CTL701TT');

        // Web không cộng VAT: chỉ có 1 dòng tổng tiền hàng
        expect(text(find('Tổng tiền hàng').getCell(7))).toBe(2730000);
        expect(find('Tiền thuế GTGT')).toBeUndefined();
        expect(text(find('Số tiền bằng chữ').getCell(1))).toContain('Hai triệu bảy trăm ba mươi nghìn đồng');
    });

    test('đơn không tồn tại trả 404', async () => {
        expect((await exportOrder(9999)).status).toBe(404);
    });
});

describe('mã vận đơn', () => {
    test('nhập mã thì đơn chuyển sang đang giao và gửi mail cho khách', async () => {
        const order = await createOrder({ shipping_fee: 30000 });
        const res = await setTracking(order.id, ' vtp 1234 5678 ');
        expect(res.status).toBe(200);
        expect(res.body.tracking_code).toBe('VTP12345678');
        expect(res.body.status).toBe('shipping');
        expect(res.body.shipped_at).not.toBeNull();
        expect(sendOrderShippedEmail).toHaveBeenCalledTimes(1);
        expect(sendOrderShippedEmail.mock.calls[0][0].tracking_code).toBe('VTP12345678');
    });

    test('sửa mã khi đang giao: giữ thời điểm giao, chỉ gửi mail khi mã đổi', async () => {
        const order = await createOrder({ shipping_fee: 30000 });
        const first = await setTracking(order.id, 'VTP111111');

        const same = await setTracking(order.id, 'vtp111111');
        expect(same.status).toBe(200);
        expect(sendOrderShippedEmail).toHaveBeenCalledTimes(1);

        const fixed = await setTracking(order.id, 'VTP222222');
        expect(fixed.status).toBe(200);
        expect(fixed.body.tracking_code).toBe('VTP222222');
        expect(fixed.body.shipped_at).toBe(first.body.shipped_at);
        expect(sendOrderShippedEmail).toHaveBeenCalledTimes(2);
    });

    test('chưa có phí ship thì không nhập mã được', async () => {
        const order = await createOrder();
        const res = await setTracking(order.id, 'VTP12345678');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/phí ship/);
    });

    test('đơn chưa xác nhận hoặc đã kết thúc thì không nhập mã được', async () => {
        for (const status of ['pending', 'completed', 'cancelled']) {
            const order = await createOrder({ status, shipping_fee: 30000 });
            expect((await setTracking(order.id, 'VTP12345678')).status).toBe(400);
        }
        expect(sendOrderShippedEmail).not.toHaveBeenCalled();
    });

    test('mã sai định dạng thì báo lỗi', async () => {
        const order = await createOrder({ shipping_fee: 30000 });
        for (const code of ['', 'ABC', 'VTP-123456', 'X'.repeat(31)]) {
            expect((await setTracking(order.id, code)).status).toBe(400);
        }
    });

    test('một mã không gắn được cho 2 đơn', async () => {
        const a = await createOrder({ shipping_fee: 30000 });
        const b = await createOrder({ shipping_fee: 30000 });
        await setTracking(a.id, 'VTP12345678');
        const res = await setTracking(b.id, 'VTP12345678');
        expect(res.status).toBe(409);
    });

    test('đơn không có email thì không gửi mail', async () => {
        const order = await createOrder({ shipping_fee: 30000, email: null });
        expect((await setTracking(order.id, 'VTP12345678')).status).toBe(200);
        expect(sendOrderShippedEmail).not.toHaveBeenCalled();
    });

    test('khách không phải admin thì bị chặn', async () => {
        const order = await createOrder({ shipping_fee: 30000 });
        const { token: customerToken } = await createUser();
        const res = await request(app)
            .patch(`/api/admin/orders/${order.id}/tracking`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ tracking_code: 'VTP12345678' });
        expect(res.status).toBe(403);
    });
});
