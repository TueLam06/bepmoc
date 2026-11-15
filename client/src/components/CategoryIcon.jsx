// Icon nét mảnh cho ô danh mục ở trang Sản phẩm, chọn theo slug của category
const ICONS = {
    all: (
        <>
            <rect x="5" y="5" width="9" height="9" rx="1.5" />
            <rect x="18" y="5" width="9" height="9" rx="1.5" />
            <rect x="5" y="18" width="9" height="9" rx="1.5" />
            <rect x="18" y="18" width="9" height="9" rx="1.5" />
        </>
    ),
    // Đôi đũa đặt chéo
    "dua-go": (
        <>
            <path d="M9 4l5 24" />
            <path d="M23 4l-5 24" />
            <path d="M10.2 9.5l2.2-.4M21.8 9.5l-2.2-.4" />
        </>
    ),
    // Muôi và thìa
    "muoi-thia": (
        <>
            <ellipse cx="10" cy="8.5" rx="4" ry="5" />
            <path d="M10 13.5V28" />
            <path d="M18 9a5 4 0 0 0 10 0z" />
            <path d="M23 13v15" />
        </>
    ),
    // Thớt có tay cầm và lỗ treo
    "thot-khay-dia": (
        <>
            <rect x="4" y="9" width="19" height="14" rx="3" />
            <path d="M23 14h3.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5H23" />
            <circle cx="8.5" cy="13.5" r="1.2" />
        </>
    ),
    // Gác đũa với đôi đũa nằm trên
    "phu-kien-ban-an": (
        <>
            <path d="M8 24c0-3 3.5-5 8-5s8 2 8 5" />
            <path d="M6 24h20" />
            <path d="M5 16l22-4M5 19l22-4" />
        </>
    ),
    // Lược sừng: sống lược cong, răng thưa
    "luoc-sung": (
        <>
            <path d="M4 13c4-4 20-4 24 0v2H4z" />
            <path d="M7 15v11M11 15v11M15 15v11M19 15v11M23 15v11M27 15v8" />
        </>
    ),
    // Lược gỗ: thân chữ nhật, răng dày
    "luoc-go": (
        <>
            <rect x="4" y="8" width="24" height="6" rx="2" />
            <path d="M6.5 14v10M10 14v10M13.5 14v10M17 14v10M20.5 14v10M24 14v10" />
        </>
    ),
    // Cây lăn massage: tay cầm + bánh lăn
    massage: (
        <>
            <path d="M16 4v10" />
            <path d="M9 14h14" />
            <rect x="7" y="17" width="18" height="8" rx="4" />
            <path d="M12 17v8M16 17v8M20 17v8" />
        </>
    ),
    // Lư hương với nén nhang
    "do-tho-cung": (
        <>
            <path d="M7 18h18l-2 7H9z" />
            <path d="M5 18h22" />
            <path d="M11 25l-1 3M21 25l1 3" />
            <path d="M13 18V7M16 18V5M19 18V7" />
        </>
    ),
    // Danh mục mới chưa có icon riêng
    default: (
        <>
            <path d="M16 4l11 6v12l-11 6-11-6V10z" />
            <path d="M5 10l11 6 11-6M16 16v12" />
        </>
    ),
};

function CategoryIcon({ slug, className = "" }) {
    return (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
        >
            {ICONS[slug] || ICONS.default}
        </svg>
    );
}

export default CategoryIcon;
