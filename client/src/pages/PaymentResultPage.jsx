import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { vnpayFailReason } from "../constants/payment";

const fraunces = { fontFamily: "'Fraunces', serif" };
const inter = { fontFamily: "'Inter', sans-serif" };

function formatVND(n) {
    return n.toLocaleString("vi-VN") + "đ";
}

// Đọc kết quả VNPay gửi kèm khi trả khách về trang này.
// Chỉ dùng để hiển thị: trạng thái đơn trong DB do IPN (VNPay gọi thẳng server) cập nhật.
// Khi có backend, thay bằng gọi server kiểm tra chữ ký vnp_SecureHash rồi trả trạng thái đơn
function readVnpayReturn(params) {
    const txnRef = params.get("vnp_TxnRef");
    const code = params.get("vnp_ResponseCode");
    if (!txnRef || !code) return null;

    const amount = Number(params.get("vnp_Amount"));
    return {
        // Mã giao dịch dạng "<mã đơn>-<lần thử>", để thanh toán lại cùng 1 đơn không bị trùng mã
        orderId: txnRef.split("-")[0],
        success: code === "00" && (params.get("vnp_TransactionStatus") ?? "00") === "00",
        code,
        amount: Number.isFinite(amount) && amount > 0 ? amount / 100 : null, // VNPay gửi số tiền x100
        bankCode: params.get("vnp_BankCode"),
    };
}

function PaymentResultPage() {
    const [params] = useSearchParams();
    const { token } = useAuth();
    const result = readVnpayReturn(params);

    const orderLink = result && (
        <Link
            to={token ? `/orders/${result.orderId}` : "/track-order"}
            style={inter}
            className="text-sm text-[#2F5233] underline underline-offset-2"
        >
            Xem trạng thái đơn hàng
        </Link>
    );

    const shopLink = (
        <Link
            to="/products"
            style={inter}
            className="inline-block px-6 py-3 bg-[#2F5233] text-[#F5F3EE] rounded-sm hover:bg-[#26401E] transition-colors"
        >
            Tiếp tục mua sắm
        </Link>
    );

    if (!result) {
        return (
            <Shell icon="?" tone="neutral" title="Không có thông tin thanh toán">
                <p style={inter} className="text-[#6B6F63] mb-8">
                    Đường dẫn này thiếu kết quả từ VNPay. Nếu bạn vừa thanh toán, hãy kiểm tra trạng thái đơn
                    trong mục đơn hàng hoặc email xác nhận.
                </p>
                {shopLink}
            </Shell>
        );
    }

    if (result.success) {
        return (
            <Shell icon="✓" tone="success" title="Thanh toán thành công">
                <Details result={result} />
                <p style={inter} className="text-[#6B6F63] text-sm mb-8">
                    Cảm ơn bạn! Email xác nhận sẽ được gửi khi hệ thống ghi nhận thanh toán.
                    Chúng tôi sẽ liên hệ qua số điện thoại bạn đã cung cấp để giao hàng.
                </p>
                {shopLink}
                <div className="mt-4">{orderLink}</div>
            </Shell>
        );
    }

    return (
        <Shell icon="✕" tone="error" title="Thanh toán chưa thành công">
            <Details result={result} />
            <p style={inter} className="text-[#6B6F63] text-sm mb-8">
                {vnpayFailReason(result.code)} Đơn hàng vẫn được giữ trong thời gian ngắn, bạn có thể thanh toán
                lại từ trang đơn hàng.
            </p>
            {orderLink && <div className="mb-4">{orderLink}</div>}
            {shopLink}
        </Shell>
    );
}

function Details({ result }) {
    return (
        <>
            <p style={inter} className="text-[#6B6F63] mb-1">
                Mã đơn hàng <span className="text-[#1F2420] font-medium">#{result.orderId}</span>
            </p>
            {result.amount !== null && (
                <p style={inter} className="text-[#6B6F63] mb-6">
                    Số tiền: <span className="text-[#1F2420] font-medium">{formatVND(result.amount)}</span>
                    {result.bankCode && <> qua {result.bankCode}</>}
                </p>
            )}
        </>
    );
}

const TONES = {
    success: "bg-[#2F5233] text-[#F5F3EE]",
    error: "bg-[#FBF1F0] text-[#B3413B] border border-[#E3C6C3]",
    neutral: "bg-[#ECEAE3] text-[#6B6F63]",
};

// Khung chung giống màn hình đặt hàng thành công ở checkout
function Shell({ icon, tone, title, children }) {
    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-[#FAFAF8] px-6">
            <div className="text-center max-w-md">
                <div
                    aria-hidden="true"
                    className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl ${TONES[tone]}`}
                >
                    {icon}
                </div>
                <h1 style={fraunces} className="text-3xl text-[#1F2420] mb-3">
                    {title}
                </h1>
                {children}
            </div>
        </div>
    );
}

export default PaymentResultPage;
