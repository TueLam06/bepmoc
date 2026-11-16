const { vndToWords } = require('../utils/vndWords');

describe('đọc số tiền thành chữ', () => {
    test.each([
        [0, 'Không'],
        [5, 'Năm'],
        [15, 'Mười lăm'],
        [21, 'Hai mươi mốt'],
        [105, 'Một trăm linh năm'],
        [1000, 'Một nghìn'],
        [16000, 'Mười sáu nghìn'],
        [105840, 'Một trăm linh năm nghìn tám trăm bốn mươi'],
        [2754000, 'Hai triệu bảy trăm năm mươi bốn nghìn'],
        [1000005, 'Một triệu không trăm linh năm'],
        [1250000000, 'Một tỷ hai trăm năm mươi triệu'],
    ])('%d', (n, words) => {
        expect(vndToWords(n)).toBe(words);
    });

    test('số âm thì báo lỗi', () => {
        expect(() => vndToWords(-1)).toThrow();
    });
});
