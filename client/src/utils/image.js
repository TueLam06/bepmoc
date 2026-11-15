// Link ảnh Cloudinary kèm biến đổi: tự chọn định dạng (WebP/AVIF), nén vừa đủ, thu về đúng cỡ hiển thị,
// để không gửi ảnh gốc vài MB xuống trình duyệt (tốn băng thông Cloudinary, trang tải chậm).
// width nên gấp đôi cỡ hiển thị cho màn hình nét. Ảnh không phải Cloudinary thì giữ nguyên link.
export function imageUrl(url, width, { square = false } = {}) {
    if (!url || !url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
    const transform = square
        ? `f_auto,q_auto,c_pad,b_white,w_${width},h_${width}` // ảnh nhỏ vuông cho nút chọn phiên bản
        : `f_auto,q_auto,c_limit,w_${width}`;
    return url.replace("/image/upload/", `/image/upload/${transform}/`);
}
