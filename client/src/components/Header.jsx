import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "./BrandLogo";

// Màn hình rộng (lg trở lên) hiện đủ menu ngang; nhỏ hơn thì gom vào nút ☰, chỉ để giỏ hàng ngoài
// cho khách thấy số món mà không phải mở menu. Đã đăng nhập thì menu dài, nên mốc là lg chứ không phải md.
function Header() {
    const { cartCount } = useCart();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const close = () => setOpen(false);

    const handleLogout = () => {
        close();
        logout();
        navigate("/");
    };

    const links = [
        { to: "/", label: "Trang chủ" },
        { to: "/products", label: "Sản phẩm" },
        { to: "/chat", label: "Chatbot" },
        ...(user ? [{ to: "/orders", label: "Đơn hàng của tôi" }] : [{ to: "/track-order", label: "Tra cứu đơn" }]),
    ];

    const navClass = ({ isActive }) =>
        `border-b-2 py-1 font-medium transition-colors ${
            isActive ? "border-[#2F5233] text-[#2F5233]" : "border-transparent text-[#1A1A18] hover:text-[#2F5233]"
        }`;
    const mobileNavClass = ({ isActive }) =>
        `py-3 border-b border-[#ECEAE3] font-medium ${isActive ? "text-[#2F5233] font-semibold underline decoration-2 underline-offset-[6px]" : "text-[#1A1A18] hover:text-[#2F5233]"}`;
    const buttonClass =
        "rounded-md bg-[#2F5233] text-[#F5F3EE] px-4 py-2 text-sm font-medium hover:bg-[#244027] transition-colors";
    const adminClass =
        "rounded-md border border-[#2F5233] text-[#2F5233] px-4 py-2 text-sm font-medium hover:bg-[#2F5233] hover:text-[#F5F3EE] transition-colors";

    return (
        <header
            className="relative bg-[#FAFAF8] border-b border-[#D9D6CC]"
            onKeyDown={(e) => e.key === "Escape" && close()}
        >
            <nav className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
                <BrandLogo />

                {/* Menu ngang cho màn hình rộng */}
                <div className="hidden lg:flex items-center gap-6">
                    {links.map((l) => (
                        <NavLink key={l.to} to={l.to} end={l.to === "/"} className={navClass}>
                            {l.label}
                        </NavLink>
                    ))}
                    <NavLink to="/cart" className={navClass}>
                        Giỏ hàng {cartCount > 0 ? `(${cartCount})` : ""}
                    </NavLink>
                    {user ? (
                        <>
                            {user.role === "admin" && (
                                <Link to="/admin" className={adminClass}>
                                    Trang quản trị
                                </Link>
                            )}
                            <Link to="/profile" className="text-sm text-[#6B6B65] hover:text-[#2F5233] transition-colors">
                                Xin chào, {user.name}
                            </Link>
                            <button onClick={handleLogout} className={buttonClass}>
                                Đăng xuất
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className={buttonClass}>
                            Đăng nhập
                        </Link>
                    )}
                </div>

                {/* Điện thoại / tablet: giỏ hàng + nút mở menu */}
                <div className="flex lg:hidden items-center gap-1">
                    <NavLink
                        to="/cart"
                        onClick={close}
                        className={({ isActive }) => `relative p-2 hover:text-[#2F5233] ${isActive ? "text-[#2F5233]" : "text-[#1A1A18]"}`}
                        aria-label={`Giỏ hàng${cartCount > 0 ? `, ${cartCount} sản phẩm` : ""}`}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                            <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" strokeLinejoin="round" />
                            <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
                        </svg>
                        {cartCount > 0 && (
                            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] rounded-full bg-[#2F5233] px-1 text-[11px] leading-[18px] text-center text-[#F5F3EE]">
                                {cartCount > 99 ? "99+" : cartCount}
                            </span>
                        )}
                    </NavLink>
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="p-2 text-[#1A1A18] hover:text-[#2F5233]"
                        aria-expanded={open}
                        aria-controls="mobile-menu"
                        aria-label={open ? "Đóng menu" : "Mở menu"}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                            {open ? (
                                <path d="M6 6l12 12M18 6L6 18" />
                            ) : (
                                <path d="M4 7h16M4 12h16M4 17h16" />
                            )}
                        </svg>
                    </button>
                </div>
            </nav>

            {/* Menu thả xuống: bấm link nào cũng đóng lại */}
            {open && (
                <div
                    id="mobile-menu"
                    className="lg:hidden border-t border-[#ECEAE3] bg-[#FAFAF8]"
                >
                    <div className="flex flex-col px-4 sm:px-6 py-2" onClick={(e) => e.target.closest("a") && close()}>
                        {user && (
                            <Link to="/profile" className="py-3 text-sm text-[#6B6B65] border-b border-[#ECEAE3]">
                                Xin chào, <span className="text-[#1A1A18] font-medium">{user.name}</span>
                            </Link>
                        )}
                        {links.map((l) => (
                            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={mobileNavClass}>
                                {l.label}
                            </NavLink>
                        ))}
                        <div className="flex flex-wrap gap-3 py-4">
                            {user ? (
                                <>
                                    {user.role === "admin" && (
                                        <Link to="/admin" className={adminClass}>
                                            Trang quản trị
                                        </Link>
                                    )}
                                    <button onClick={handleLogout} className={buttonClass}>
                                        Đăng xuất
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" className={buttonClass}>
                                        Đăng nhập
                                    </Link>
                                    <Link to="/register" className={adminClass}>
                                        Tạo tài khoản
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

export default Header;
