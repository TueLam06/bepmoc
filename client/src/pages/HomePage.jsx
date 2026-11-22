import ProductCard from "../components/ProductCard";
import HeroBanner from "../components/HeroBanner";
import Reveal from "../components/Reveal";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "../api/products";

// Trang chủ tạm, phần giới thiệu và hình ảnh thương hiệu làm lại ở bước thương hiệu
function HomePage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const featuredProducts = products.filter((item) => item.feature).slice(0, 8);
    // Sản phẩm mới về: 8 sản phẩm tạo gần nhất
    const newestProducts = [...products]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8);

    useEffect(() => {
        getProducts()
            .then((data) => {
                setProducts(data);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px] bg-[#FAFAF8]">
                <div className="w-8 h-8 rounded-full border-2 border-[#D9D6CC] border-t-[#2F5233] animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center p-10 bg-[#FAFAF8] min-h-[400px]">
                <div className="max-w-lg w-full rounded-md border border-[#E3C6C3] bg-[#FBF1F0] px-5 py-4 text-[#B3413B] text-sm">
                    Lỗi: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAF8]">

            {/* GIỚI THIỆU: banner video */}
            <HeroBanner />


            {/* NỔI BẬT */}
            <ProductSection
                eyebrow="Nổi bật"
                title="Được chọn nhiều"
                products={featuredProducts}
                className="py-12"
            />


            {/* MỚI VỀ */}
            <ProductSection
                eyebrow="Mới về"
                title="Sản phẩm mới"
                products={newestProducts}
                className="pt-12 pb-20"
            />

        </div>
    );
}

function ProductSection({ eyebrow, title, products, linkTo = "/products", className = "" }) {
    if (products.length === 0) return null;

    return (
        <section className={`max-w-6xl mx-auto px-6 ${className}`}>
            <Reveal from="up" className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
                <div>
                    <p className="text-sm tracking-wide text-[#6B6B65] mb-2">{eyebrow}</p>
                    <h2
                        className="text-3xl md:text-4xl text-[#1A1A18]"
                        style={{ fontFamily: "'Fraunces', serif" }}
                    >
                        {title}
                    </h2>
                </div>

                <Link
                    to={linkTo}
                    className="text-[#2F5233] font-medium underline underline-offset-2 self-start md:self-auto"
                >
                    Xem tất cả
                </Link>
            </Reveal>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
                {products.map((p, i) => (
                    <Reveal key={p.id} from="left" delay={i * 110}>
                        <div className="h-full transition duration-300 hover:-translate-y-1">
                            <ProductCard product={p} />
                        </div>
                    </Reveal>
                ))}
            </div>
        </section>
    );
}

export default HomePage;
