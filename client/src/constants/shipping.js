// Trang tra cứu của ViettelPost có captcha nên không gắn sẵn mã vào link được, khách tự dán mã
export const VIETTELPOST_TRACKING_URL = "https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/";

// Tiền thu hộ COD = tiền hàng + phí ship; chưa báo phí ship thì trả null
export function codAmount(order) {
    if (order.shipping_fee === null || order.shipping_fee === undefined) return null;
    return Number(order.total) + Number(order.shipping_fee);
}
