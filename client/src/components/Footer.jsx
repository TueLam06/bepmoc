import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "./BrandLogo";

function Footer({ title }) {
    const { user } = useAuth();

    const sections = [
        {
            heading: "Mua sắm",
            links: [
                { to: "/", label: "Trang chủ" },
                { to: "/products", label: "Sản phẩm" },
                { to: "/cart", label: "Giỏ hàng" },
            ],
        },
        {
            heading: "Tài khoản",
            links: user
                ? [{ to: "/orders", label: "Đơn hàng của tôi" }]
                : [
                      { to: "/login", label: "Đăng nhập" },
                      { to: "/register", label: "Tạo tài khoản" },
                  ],
        },
        {
            heading: "Hỗ trợ",
            links: [
                { to: "/chat", label: "Chatbot tư vấn" },
                { href: "tel:0915635588", label: "Hotline: 0915 635 588" },
            ],
        },
    ];

    const linkClass = "text-[#6B6B65] hover:text-[#2F5233] transition-colors";

    return (
        <footer className="bg-[#FAFAF8] border-t border-[#D9D6CC] mt-16">
            <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
                {/* Phần link tới các mục */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
                    <div className="col-span-2 md:col-span-1">
                        <BrandLogo />
                        <p className="text-sm text-[#6B6B65] mt-3 max-w-xs">
                            Đội 7, Thụy Ứng, Thường Tín, Hà Nội
                        </p>
                    </div>

                    {sections.map((section) => (
                        <div key={section.heading}>
                            <h3 className="text-sm font-medium text-[#1A1A18] mb-3">
                                {section.heading}
                            </h3>
                            <ul className="space-y-2 text-sm">
                                {section.links.map((link) => (
                                    <li key={link.to || link.href}>
                                        {link.href ? (
                                            <a href={link.href} className={linkClass}>
                                                {link.label}
                                            </a>
                                        ) : (
                                            <Link to={link.to} className={linkClass}>
                                                {link.label}
                                            </Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Phần dưới cùng */}
                <div className="border-t border-[#D9D6CC] pt-6 text-sm">
                    <p className="text-[#6B6B65]">
                        © {new Date().getFullYear()} {title}
                    </p>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
