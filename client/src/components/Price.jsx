const formatVND = (n) => `${Number(n).toLocaleString("vi-VN")}₫`;

// Giá bán, kèm giá gốc gạch ngang và % giảm khi giá gốc lớn hơn giá bán
function Price({ price, originalPrice, size = "sm" }) {
    const original = Number(originalPrice);
    const onSale = original > Number(price);
    const percent = onSale ? Math.round((1 - Number(price) / original) * 100) : 0;
    const main = size === "lg" ? "text-2xl font-medium" : "text-sm md:text-base font-semibold";

    return (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={`${main} text-[#2F5233]`}>{formatVND(price)}</span>
            {onSale && (
                <>
                    <span className={`${size === "lg" ? "text-base" : "text-xs"} text-[#8A8A82] line-through`}>
                        {formatVND(original)}
                    </span>
                    {percent > 0 && (
                        <span className="rounded bg-[#FBF1F0] px-1.5 py-0.5 text-[11px] font-medium text-[#B3413B]">
                            -{percent}%
                        </span>
                    )}
                </>
            )}
        </p>
    );
}

export default Price;
