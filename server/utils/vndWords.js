// Đọc số tiền VND thành chữ tiếng Việt, dùng cho dòng "Số tiền bằng chữ" trên phiếu đơn hàng
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

// Đọc 1 nhóm 3 chữ số. full = nhóm không đứng đầu, phải đọc đủ "không trăm", "linh"
function readGroup(n, full) {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    const words = [];

    if (full || h > 0) words.push(DIGITS[h], 'trăm');

    if (t === 0) {
        if (u > 0 && words.length > 0) words.push('linh');
        if (u > 0) words.push(DIGITS[u]);
    } else if (t === 1) {
        words.push('mười');
        if (u === 5) words.push('lăm');
        else if (u > 0) words.push(DIGITS[u]);
    } else {
        words.push(DIGITS[t], 'mươi');
        if (u === 1) words.push('mốt');
        else if (u === 5) words.push('lăm');
        else if (u > 0) words.push(DIGITS[u]);
    }
    return words.join(' ');
}

// 2754000 -> "Hai triệu bảy trăm năm mươi bốn nghìn"
function vndToWords(amount) {
    let n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n < 0) throw new Error('Số tiền không hợp lệ');
    if (n === 0) return 'Không';

    const groups = [];
    while (n > 0) {
        groups.push(n % 1000);
        n = Math.floor(n / 1000);
    }

    const parts = [];
    for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i] === 0) continue;
        const text = readGroup(groups[i], i < groups.length - 1);
        parts.push(UNITS[i] ? `${text} ${UNITS[i]}` : text);
    }
    const sentence = parts.join(' ');
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

module.exports = { vndToWords };
