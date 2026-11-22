// Gửi email qua Brevo HTTP API (https://developers.brevo.com/reference/sendtransacemail)
// Chưa set BREVO_API_KEY (vd: chạy local) thì chỉ in nội dung ra console để test
// to: 1 email hoặc mảng email, attachments: [{ name, content: Buffer }]
async function sendMail({ to, subject, html, attachments }) {
    const recipients = [].concat(to);
    if (!process.env.BREVO_API_KEY) {
        console.log(`[mail] Chưa có BREVO_API_KEY, bỏ qua gửi mail tới ${recipients.join(', ')}: ${subject}\n${html}`);
        return;
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            sender: {
                email: process.env.MAIL_FROM_EMAIL,
                name: process.env.MAIL_FROM_NAME || 'Bếp Mộc Linh Đan',
            },
            to: recipients.map((email) => ({ email })),
            subject,
            htmlContent: html,
            ...(attachments?.length && {
                attachment: attachments.map((a) => ({ name: a.name, content: Buffer.from(a.content).toString('base64') })),
            }),
        }),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Brevo trả lỗi ${res.status}: ${detail}`);
    }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
}

function clientUrl(path) {
    const base = (process.env.CLIENT_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
    return `${base}${path}`;
}

function layout(content) {
    return `<div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; color: #1A1A18">${content}</div>`;
}

// Nút + link dạng chữ bên dưới (Brevo bọc link để tracking, link bọc từng trả 404)
function buttonBlock(link, text) {
    return `
        <p style="text-align: center; margin: 32px 0">
            <a href="${link}" style="background: #2F5233; color: #F5F3EE; padding: 12px 24px; border-radius: 6px; text-decoration: none">
                ${text}
            </a>
        </p>
        <p style="font-size: 13px; color: #6B6B65">
            Nếu nút không mở được, hãy copy đường link sau và dán vào trình duyệt:
        </p>
        <p style="font-size: 13px; word-break: break-all; color: #2F5233">${link}</p>
    `;
}

async function sendVerificationEmail(user, token) {
    const link = clientUrl(`/verify-email?token=${encodeURIComponent(token)}`);
    await sendMail({
        to: user.email,
        subject: 'Xác thực email tài khoản của bạn',
        html: layout(`
            <h2 style="color: #2F5233">Chào ${escapeHtml(user.name)},</h2>
            <p>Cảm ơn bạn đã đăng ký. Bấm nút bên dưới để xác thực email và kích hoạt tài khoản:</p>
            ${buttonBlock(link, 'Xác thực email')}
            <p style="font-size: 13px; color: #6B6B65">
                Link có hiệu lực trong 24 giờ. Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.
            </p>
        `),
    });
}

async function sendPasswordResetEmail(user, token) {
    const link = clientUrl(`/reset-password?token=${encodeURIComponent(token)}`);
    await sendMail({
        to: user.email,
        subject: 'Đặt lại mật khẩu',
        html: layout(`
            <h2 style="color: #2F5233">Chào ${escapeHtml(user.name)},</h2>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút bên dưới để đặt mật khẩu mới:</p>
            ${buttonBlock(link, 'Đặt lại mật khẩu')}
            <p style="font-size: 13px; color: #6B6B65">
                Link có hiệu lực trong 30 phút và chỉ dùng được 1 lần.
                Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này, mật khẩu cũ vẫn giữ nguyên.
            </p>
        `),
    });
}

function formatVND(n) {
    return `${Number(n).toLocaleString('vi-VN')}đ`;
}

// order: { id, customer_name, phone, address, total, email, user_id }, items: { name, variant_name, quantity, price }
async function sendOrderConfirmationEmail(order, items) {
    // Khách có tài khoản xem đơn trong lịch sử, khách vãng lai tra cứu bằng mã đơn + SĐT
    const link = clientUrl(order.user_id ? `/orders/${order.id}` : '/track-order');
    const rows = items.map((i) => `
        <tr>
            <td style="padding: 8px 0; border-top: 1px solid #E5E3DC">
                ${escapeHtml(i.name)}${i.variant_name ? `<br><span style="font-size: 13px; color: #6B6B65">${escapeHtml(i.variant_name)}</span>` : ''}
            </td>
            <td style="padding: 8px 0; border-top: 1px solid #E5E3DC; text-align: center">x${i.quantity}</td>
            <td style="padding: 8px 0; border-top: 1px solid #E5E3DC; text-align: right; white-space: nowrap">${formatVND(i.price * i.quantity)}</td>
        </tr>
    `).join('');

    await sendMail({
        to: order.email,
        subject: `Xác nhận đơn hàng #${order.id}`,
        html: layout(`
            <h2 style="color: #2F5233">Cảm ơn ${escapeHtml(order.customer_name)} đã đặt hàng!</h2>
            <p>Đơn hàng <strong>#${order.id}</strong> đã được ghi nhận. Chúng tôi sẽ gọi qua số điện thoại bên dưới để xác nhận và báo phí vận chuyển trước khi giao.</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 24px 0">
                ${rows}
                <tr>
                    <td colspan="2" style="padding: 12px 0; border-top: 2px solid #2F5233"><strong>Tiền hàng</strong> <span style="color: #6B6B65">(chưa gồm phí vận chuyển)</span></td>
                    <td style="padding: 12px 0; border-top: 2px solid #2F5233; text-align: right"><strong>${formatVND(order.total)}</strong></td>
                </tr>
            </table>
            <p style="font-size: 14px; margin: 4px 0"><span style="color: #6B6B65">Người nhận:</span> ${escapeHtml(order.customer_name)}</p>
            <p style="font-size: 14px; margin: 4px 0"><span style="color: #6B6B65">Số điện thoại:</span> ${escapeHtml(order.phone)}</p>
            <p style="font-size: 14px; margin: 4px 0"><span style="color: #6B6B65">Địa chỉ:</span> ${escapeHtml(order.address)}</p>            ${buttonBlock(link, 'Xem trạng thái đơn hàng')}
            ${order.user_id ? '' : `<p style="font-size: 13px; color: #6B6B65">Tra cứu bằng mã đơn <strong>#${order.id}</strong> và số điện thoại đặt hàng.</p>`}
        `),
    });
}

// Báo admin có đơn mới, đính kèm phiếu Excel. items: như buildOrderDocument
async function sendNewOrderAdminEmail(adminEmails, order, items, attachment) {
    const rows = items.map((i) => `
        <tr>
            <td style="padding: 6px 0; border-top: 1px solid #E5E3DC">
                ${escapeHtml(i.product_name)}${i.variant_name ? ` - ${escapeHtml(i.variant_name)}` : ''}
            </td>
            <td style="padding: 6px 0; border-top: 1px solid #E5E3DC; text-align: center">x${i.quantity}</td>
            <td style="padding: 6px 0; border-top: 1px solid #E5E3DC; text-align: right; white-space: nowrap">${formatVND(i.price_at_purchase * i.quantity)}</td>
        </tr>
    `).join('');
    const info = (label, value) =>
        `<p style="font-size: 14px; margin: 4px 0"><span style="color: #6B6B65">${label}:</span> ${escapeHtml(value)}</p>`;

    await sendMail({
        to: adminEmails,
        subject: `Đơn hàng mới #${order.id} - ${order.customer_name}`,
        html: layout(`
            <h2 style="color: #2F5233">Đơn hàng mới #${order.id}</h2>
            ${info('Người nhận', order.customer_name)}
            ${info('Số điện thoại', order.phone)}
            ${order.email ? info('Email', order.email) : ''}
            ${info('Địa chỉ', order.address)}
            ${info('Loại khách', order.user_id ? 'Có tài khoản' : 'Khách vãng lai')}
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0">
                ${rows}
                <tr>
                    <td colspan="2" style="padding: 10px 0; border-top: 2px solid #2F5233"><strong>Tiền hàng</strong></td>
                    <td style="padding: 10px 0; border-top: 2px solid #2F5233; text-align: right"><strong>${formatVND(order.total)}</strong></td>
                </tr>
            </table>
            <p style="font-size: 14px">Phiếu đơn hàng trong file Excel đính kèm.</p>
            ${buttonBlock(clientUrl(`/admin/orders/${order.id}`), 'Xem đơn trong trang quản trị')}
        `),
        attachments: attachment ? [attachment] : undefined,
    });
}

// Trang tra cứu của ViettelPost có captcha nên không gắn sẵn mã vào link được, khách tự dán mã
const VIETTELPOST_TRACKING_URL = 'https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/';

// Báo phí ship sau khi shop xác nhận đơn. order: 1 dòng bảng orders (đã có shipping_fee)
async function sendShippingFeeEmail(order) {
    const link = clientUrl(order.user_id ? `/orders/${order.id}` : '/track-order');
    const fee = Number(order.shipping_fee);
    const codAmount = Number(order.total) + fee;
    const row = (label, value, bold = false) => `
        <tr>
            <td style="padding: 6px 0; color: #6B6B65">${label}</td>
            <td style="padding: 6px 0; text-align: right">${bold ? `<strong>${value}</strong>` : value}</td>
        </tr>
    `;

    await sendMail({
        to: order.email,
        subject: `Phí vận chuyển đơn hàng #${order.id}`,
        html: layout(`
            <h2 style="color: #2F5233">Chào ${escapeHtml(order.customer_name)},</h2>
            <p>Shop đã xác nhận đơn hàng <strong>#${order.id}</strong>. Phí vận chuyển và số tiền thanh toán khi nhận hàng như sau:</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0">
                ${row('Tiền hàng', formatVND(order.total))}
                ${row('Phí vận chuyển', fee === 0 ? 'Miễn phí' : formatVND(fee))}
                ${row('Thanh toán khi nhận hàng', formatVND(codAmount), true)}
            </table>
            <p style="font-size: 14px">Shop sẽ gửi mã vận đơn khi giao hàng cho đơn vị vận chuyển.</p>
            ${buttonBlock(link, 'Xem đơn hàng')}
        `),
    });
}

// order: 1 dòng bảng orders (đã có tracking_code và shipping_fee)
async function sendOrderShippedEmail(order) {
    const link = clientUrl(order.user_id ? `/orders/${order.id}` : '/track-order');
    const codAmount = Number(order.total) + Number(order.shipping_fee || 0);

    await sendMail({
        to: order.email,
        subject: `Đơn hàng #${order.id} đang được giao`,
        html: layout(`
            <h2 style="color: #2F5233">Chào ${escapeHtml(order.customer_name)},</h2>
            <p>Đơn hàng <strong>#${order.id}</strong> đã được giao cho ViettelPost.</p>
            <p style="font-size: 14px; margin: 4px 0"><span style="color: #6B6B65">Mã vận đơn:</span> <strong>${escapeHtml(order.tracking_code)}</strong></p>
            <p style="font-size: 14px; margin: 4px 0">
                <span style="color: #6B6B65">Số tiền thanh toán khi nhận hàng:</span> <strong>${formatVND(codAmount)}</strong>
                <span style="color: #6B6B65">(tiền hàng ${formatVND(order.total)} + phí vận chuyển ${formatVND(order.shipping_fee || 0)})</span>
            </p>
            <p style="font-size: 14px">
                Theo dõi hành trình bằng mã vận đơn trên trang
                <a href="${VIETTELPOST_TRACKING_URL}" style="color: #2F5233">tra cứu của ViettelPost</a>.
            </p>
            ${buttonBlock(link, 'Xem đơn hàng')}
        `),
    });
}

module.exports = {
    sendMail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendOrderConfirmationEmail,
    sendShippingFeeEmail,
    sendOrderShippedEmail,
    sendNewOrderAdminEmail,
};
