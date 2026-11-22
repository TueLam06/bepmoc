// Phiếu "ĐƠN HÀNG" dạng Excel theo mẫu shop đang dùng: thông tin shop, người nhận, bảng hàng, thuế, tổng
// Phiếu chỉ tính tiền hàng, phí ship shop báo riêng qua email
const ExcelJS = require('exceljs');
const shop = require('../config/shop');
const { orderDocCode } = require('./orderCode');
const { vndToWords } = require('./vndWords');

const FONT = { name: 'Times New Roman', size: 12 };
const MONEY = '#,##0';
const THIN = { style: 'thin' };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

// Ngày theo giờ Việt Nam để phiếu không lệch ngày khi server chạy giờ UTC
function vnDateParts(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
    }).formatToParts(new Date(date));
    const get = (type) => parts.find((p) => p.type === type).value;
    return { day: get('day'), month: get('month'), year: get('year') };
}

// order: dòng bảng orders; items: { product_name, variant_name, sku, quantity, price_at_purchase }
// Đơn trên web không cộng thuế GTGT, khách cần hoá đơn VAT thì đặt trực tiếp với shop
async function buildOrderDocument(order, items) {
    const workbook = new ExcelJS.Workbook();
    // Bắt Excel tính lại công thức khi mở, phòng khi shop sửa số lượng trong file
    workbook.calcProperties.fullCalcOnLoad = true;
    const ws = workbook.addWorksheet('Sheet1', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = [
        { width: 6 },
        { width: 42 },
        { width: 14 },
        { width: 8 },
        { width: 10 },
        { width: 14 },
        { width: 16 },
    ];

    // 1 dòng gộp A:G, xuống dòng tự động khi chữ dài
    const fullRow = (text, style = {}, lines = 1) => {
        const row = ws.addRow([text]);
        ws.mergeCells(`A${row.number}:G${row.number}`);
        const cell = row.getCell(1);
        cell.font = { ...FONT, ...style.font };
        cell.alignment = { vertical: 'middle', wrapText: true, ...style.alignment };
        if (lines > 1) row.height = lines * 16;
        return row;
    };

    const header = [
        shop.legalName && { text: `${shop.legalName.toUpperCase()}\n`, font: { ...FONT, bold: true } },
        { text: shop.storeName, font: { ...FONT, bold: true } },
        shop.address && { text: `\nĐịa chỉ: ${shop.address}`, font: FONT },
        shop.phone && { text: `\nĐiện thoại: ${shop.phone}`, font: FONT },
    ].filter(Boolean);
    const headerRow = fullRow({ richText: header }, {}, header.length);
    headerRow.getCell(1).alignment = { vertical: 'middle', wrapText: true };

    const { day, month, year } = vnDateParts(order.created_at);
    const center = { alignment: { horizontal: 'center' } };
    fullRow('ĐƠN HÀNG', { font: { bold: true, size: 16 }, ...center }).height = 26;
    fullRow(`Ngày ${day} tháng ${month} năm ${year}`, { font: { italic: true }, ...center });
    fullRow(`Số: ${orderDocCode(order)}`, center);
    fullRow(`Người nhận: ${order.customer_name}`);
    fullRow(`Điện thoại: ${order.phone}${order.email ? `          Email: ${order.email}` : ''}`);
    fullRow(`Địa chỉ nhận hàng: ${order.address}`, {}, order.address.length > 80 ? 2 : 1);
    fullRow('Phương thức thanh toán: Tiền mặt khi nhận hàng (COD)');

    const head = ws.addRow(['STT', 'Tên hàng hóa', 'Mã số', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền']);
    head.eachCell((cell) => {
        cell.font = { ...FONT, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = BORDER;
    });

    const firstItemRow = head.number + 1;
    items.forEach((item, i) => {
        const r = firstItemRow + i;
        const name = item.variant_name ? `${item.product_name} - ${item.variant_name}` : item.product_name;
        const price = Number(item.price_at_purchase);
        // ĐVT để trống vì sản phẩm chưa có đơn vị tính, shop tự điền khi cần
        const row = ws.addRow([
            i + 1,
            name,
            item.sku || '',
            '',
            item.quantity,
            price,
            { formula: `E${r}*F${r}`, result: price * item.quantity },
        ]);
        row.eachCell({ includeEmpty: true }, (cell, col) => {
            cell.font = FONT;
            cell.border = BORDER;
            cell.alignment = { vertical: 'middle', wrapText: col === 2, horizontal: [1, 4, 5].includes(col) ? 'center' : undefined };
            if (col >= 6) cell.numFmt = MONEY;
        });
    });
    const lastItemRow = firstItemRow + items.length - 1;

    const total = items.reduce((sum, i) => sum + Number(i.price_at_purchase) * i.quantity, 0);

    // Dòng tổng: nhãn gộp A:F, số tiền ở G
    const totalRow = ws.addRow(['Tổng tiền hàng:']);
    ws.mergeCells(`A${totalRow.number}:F${totalRow.number}`);
    totalRow.getCell(7).value = {
        formula: items.length ? `SUM(G${firstItemRow}:G${lastItemRow})` : '0',
        result: total,
    };
    totalRow.getCell(7).numFmt = MONEY;
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { ...FONT, bold: true };
        cell.border = BORDER;
    });

    fullRow(`Số tiền bằng chữ: ${vndToWords(total)} đồng./.`, { font: { italic: true } });

    if (shop.bankAccount) {
        const lines = [
            'Thông tin chuyển khoản:',
            shop.legalName && shop.legalName.toUpperCase(),
            `Số TK: ${shop.bankAccount}`,
            shop.bankName,
        ].filter(Boolean);
        fullRow(lines.join('\n'), {}, lines.length);
    }

    const notes = [
        '* Ghi chú:',
        '- Đơn giá chưa bao gồm phí vận chuyển, shop báo phí vận chuyển qua email sau khi xác nhận đơn.',
        '- Đơn hàng không bao gồm hoá đơn VAT. Quý khách cần xuất hoá đơn VAT vui lòng liên hệ trực tiếp với shop.',
        '- Ngày làm việc không tính thứ 7, chủ nhật và ngày lễ.',
    ];
    fullRow(notes.join('\n'), {}, notes.length + 1);

    return workbook.xlsx.writeBuffer();
}

// Mã số lấy theo SKU hiện tại; dòng có phiên bản thì chỉ lấy SKU phiên bản (phiên bản đã xoá thì để trống)
async function getOrderDocumentData(db, orderId) {
    const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) return null;
    const itemsResult = await db.query(
        `SELECT oi.product_name, oi.variant_name, oi.quantity, oi.price_at_purchase,
                CASE WHEN oi.variant_name IS NOT NULL THEN v.sku ELSE p.sku END AS sku
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         LEFT JOIN product_variants v ON v.id = oi.variant_id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [orderId]
    );
    return { order: orderResult.rows[0], items: itemsResult.rows };
}

module.exports = { buildOrderDocument, getOrderDocumentData };
