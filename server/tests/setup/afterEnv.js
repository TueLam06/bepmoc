// Chạy trước mỗi file test, sau khi Jest sẵn sàng

// Không gửi mail thật: test đọc token từ tham số của các hàm này (mock.calls)
jest.mock('../../utils/mailer', () => ({
    sendMail: jest.fn().mockResolvedValue(),
    sendVerificationEmail: jest.fn().mockResolvedValue(),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(),
    sendOrderConfirmationEmail: jest.fn().mockResolvedValue(),
    sendShippingFeeEmail: jest.fn().mockResolvedValue(),
    sendOrderShippedEmail: jest.fn().mockResolvedValue(),
}));

beforeEach(() => {
    jest.clearAllMocks();
    // Route in lỗi ra console.error cả với lỗi đã lường trước (vd hết hàng), ẩn đi cho gọn kết quả
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
    await require('../../config/db').end();
});
