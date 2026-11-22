import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { HERO_VIDEO_URL } from "../constants/hero";
import { videoSources } from "../utils/image";

// Banner đầu trang chủ: video ngắn lặp lại làm nền, chữ nằm đè bên trái.
// Chưa có video thì nền xanh đậm, chữ vẫn đọc được như nhau.
function HeroBanner() {
    const videoRef = useRef(null);
    const src = HERO_VIDEO_URL ? videoSources(HERO_VIDEO_URL, 1600) : null;

    // Người dùng bật "giảm chuyển động" thì dừng ở khung đầu thay vì phát
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
        const apply = () => (reduce.matches ? video.pause() : video.play().catch(() => {}));
        apply();
        reduce.addEventListener("change", apply);
        return () => reduce.removeEventListener("change", apply);
    }, []);

    return (
        <section className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-12">
            <div className="relative isolate overflow-hidden rounded-xl bg-[#2F5233] aspect-[4/5] sm:aspect-[16/10] md:aspect-[16/7]">
                {src && (
                    <video
                        ref={videoRef}
                        className="absolute inset-0 -z-10 h-full w-full object-cover"
                        poster={src.poster || undefined}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                    >
                        {src.webm && <source src={src.webm} type="video/webm" />}
                        <source src={src.mp4} type="video/mp4" />
                    </video>
                )}

                {/* Phủ tối dần từ trái (desktop) / từ dưới (mobile) để chữ trắng luôn đọc được trên video sáng */}
                <div
                    className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent md:bg-gradient-to-r md:from-black/65 md:via-black/30"
                    aria-hidden="true"
                />

                <div className="flex h-full flex-col justify-end md:justify-center px-6 py-8 md:px-14">
                    <p className="text-sm tracking-wide text-[#D8E2D2] mb-3">Đồ gỗ gia dụng</p>
                    <h1
                        className="max-w-xl text-3xl sm:text-4xl md:text-5xl leading-tight text-[#F5F3EE]"
                        style={{ fontFamily: "'Fraunces', serif" }}
                    >
                        Đồ gỗ tự nhiên cho căn bếp và bàn ăn.
                    </h1>
                    <Link
                        to="/products"
                        className="mt-8 inline-flex w-fit items-center gap-2 rounded-md bg-[#F5F3EE] px-5 py-2.5 font-medium text-[#1E3A22] hover:bg-white transition-colors"
                    >
                        Xem sản phẩm
                        <span aria-hidden="true">→</span>
                    </Link>
                </div>
            </div>
        </section>
    );
}

export default HeroBanner;
