// Số phiếu đơn hàng: DH + năm đặt + mã đơn web 6 số, VD đơn #123 năm 2026 -> DH2026000123
// Server có hàm giống hệt ở server/utils/orderCode.js, sửa thì sửa cả hai
export function orderDocCode(order) {
    const year = new Date(order.created_at).toLocaleString("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
    });
    return `DH${year}${String(order.id).padStart(6, "0")}`;
}
