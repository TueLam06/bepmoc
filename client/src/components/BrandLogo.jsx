import { Link } from "react-router-dom";

// Logo shop: hình ngôi nhà + tên 2 dòng, font Exo 2 gần giống chữ trong logo gốc
function BrandLogo({ to = "/", suffix }) {
    return (
        <Link to={to} className="flex shrink-0 items-center gap-2.5" aria-label="Bếp Mộc Linh Đan, về trang chủ">
            <img src="/logo-mark.png" alt="" width="49" height="44" className="h-11 w-auto" />
            <span
                className="text-[17px] font-medium uppercase leading-[1.05] tracking-[0.06em] text-[#1A1A18]"
                style={{ fontFamily: "'Exo 2', sans-serif" }}
            >
                Bếp Mộc
                <br />
                Linh Đan
            </span>
            {suffix && <span className="ml-1 text-sm text-[#6B6B65]">{suffix}</span>}
        </Link>
    );
}

export default BrandLogo;
