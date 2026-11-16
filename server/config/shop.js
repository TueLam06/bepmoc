// Thông tin pháp lý của shop in trên phiếu đơn hàng. Lấy từ biến môi trường vì repo public,
// biến nào trống thì phiếu bỏ dòng đó
module.exports = {
    legalName: process.env.SHOP_LEGAL_NAME || '',
    storeName: process.env.SHOP_STORE_NAME || 'BẾP MỘC LINH ĐAN',
    address: process.env.SHOP_ADDRESS || '',
    phone: process.env.SHOP_PHONE || '',
    bankAccount: process.env.SHOP_BANK_ACCOUNT || '',
    bankName: process.env.SHOP_BANK_NAME || '',
};
