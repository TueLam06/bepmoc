// Bật khi server đã có API tạo link VNPay (POST /api/orders trả về paymentUrl)
export const VNPAY_ENABLED = false;

export const PAYMENT_METHODS = [
    {
        value: "cod",
        label: "Thanh toán khi nhận hàng",
        hint: "Trả tiền mặt cho nhân viên giao hàng",
    },
    {
        value: "vnpay",
        label: "Thanh toán qua VNPay",
        hint: "Thẻ ATM nội địa, thẻ quốc tế hoặc quét mã QR ngân hàng",
        disabled: !VNPAY_ENABLED,
    },
];

// Lý do thất bại theo vnp_ResponseCode, mã không có ở đây thì dùng câu chung
const VNPAY_FAIL_REASONS = {
    "07": "Giao dịch bị nghi ngờ gian lận, vui lòng liên hệ ngân hàng.",
    "09": "Thẻ/tài khoản chưa đăng ký dịch vụ Internet Banking.",
    10: "Xác thực thông tin thẻ/tài khoản sai quá 3 lần.",
    11: "Đã hết thời gian chờ thanh toán.",
    12: "Thẻ/tài khoản đang bị khoá.",
    13: "Mã OTP không đúng.",
    24: "Bạn đã huỷ giao dịch.",
    51: "Tài khoản không đủ số dư.",
    65: "Tài khoản đã vượt hạn mức giao dịch trong ngày.",
    75: "Ngân hàng thanh toán đang bảo trì.",
    79: "Nhập sai mật khẩu thanh toán quá số lần quy định.",
};

export function vnpayFailReason(code) {
    return VNPAY_FAIL_REASONS[code] || "Giao dịch không thành công, bạn chưa bị trừ tiền.";
}
