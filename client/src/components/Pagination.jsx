// Danh sách số trang cần hiện: luôn có trang đầu, trang cuối và 1 trang mỗi bên trang hiện tại,
// khoảng trống ở giữa thay bằng "…"
function pageItems(page, totalPages) {
    const pages = new Set([1, totalPages, page - 1, page, page + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

    const items = [];
    sorted.forEach((p, i) => {
        const prev = sorted[i - 1];
        if (prev && p - prev === 2) items.push(prev + 1); // thiếu đúng 1 trang thì hiện luôn số, không cần "…"
        else if (prev && p - prev > 2) items.push(`gap-${p}`);
        items.push(p);
    });
    return items;
}

const baseBtn =
    "flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm transition-colors";

function Pagination({ page, totalPages, onChange }) {
    if (totalPages <= 1) return null;

    const arrowClass = (disabled) =>
        `${baseBtn} ${
            disabled
                ? "cursor-not-allowed border-[#E5E3DC] text-[#B0AC9C]"
                : "border-[#E5E3DC] bg-white text-[#3A3A36] hover:border-[#B0AC9C]"
        }`;

    return (
        <nav aria-label="Phân trang" className="mt-10 flex flex-wrap items-center justify-center gap-2">
            <button
                type="button"
                onClick={() => onChange(page - 1)}
                disabled={page <= 1}
                className={arrowClass(page <= 1)}
                aria-label="Trang trước"
            >
                ‹
            </button>

            {pageItems(page, totalPages).map((item) =>
                typeof item === "string" ? (
                    <span key={item} className="px-1 text-[#6B6B65]" aria-hidden="true">
                        …
                    </span>
                ) : (
                    <button
                        key={item}
                        type="button"
                        onClick={() => onChange(item)}
                        aria-current={item === page ? "page" : undefined}
                        className={`${baseBtn} ${
                            item === page
                                ? "border-[#2F5233] bg-[#2F5233] text-[#F5F3EE]"
                                : "border-[#E5E3DC] bg-white text-[#3A3A36] hover:border-[#B0AC9C]"
                        }`}
                    >
                        {item}
                    </button>
                )
            )}

            <button
                type="button"
                onClick={() => onChange(page + 1)}
                disabled={page >= totalPages}
                className={arrowClass(page >= totalPages)}
                aria-label="Trang sau"
            >
                ›
            </button>
        </nav>
    );
}

export default Pagination;
