import { useState, useEffect, useRef } from "react";
import ProductCard from "../components/ProductCard";
import CategoryIcon from "../components/CategoryIcon";
import Dropdown from "../components/Dropdown";
import Pagination from "../components/Pagination";
import { getProducts, getCategories } from "../api/products";

const PAGE_SIZE = 12; // lưới 4 cột x 3 hàng

const SORT_OPTIONS = [
    { value: "newest-desc", label: "Mới nhất", sort: "newest", order: "desc" },
    { value: "price-asc", label: "Giá: Thấp đến cao", sort: "price", order: "asc" },
    { value: "price-desc", label: "Giá: Cao đến thấp", sort: "price", order: "desc" },
    { value: "name-asc", label: "Tên: A-Z", sort: "name", order: "asc" },
    { value: "name-desc", label: "Tên: Z-A", sort: "name", order: "desc" },
];

function ProductsPage() {
    const [result, setResult] = useState(null); // { items, total, totalPages, key }
    const [categories, setCategories] = useState([]);
    const [error, setError] = useState(null);
    const [sortValue, setSortValue] = useState("newest-desc");
    const [categoryValue, setCategoryValue] = useState("all");
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState(""); // chữ đang gõ trong ô
    const [query, setQuery] = useState(""); // từ khoá đã gửi lên server
    const listRef = useRef(null);
    const searchTimer = useRef(null);

    // Khoá của bộ lọc hiện tại, so với khoá của dữ liệu đã tải để biết đang chờ trang mới
    const requestKey = `${sortValue}|${categoryValue}|${page}|${query}`;
    const loading = !result && !error;
    const stale = result && result.key !== requestKey;
    const products = result ? result.items : [];

    // Lấy danh sách categories 1 lần khi mount
    useEffect(() => {
        getCategories()
            .then((data) => setCategories(data))
            .catch((err) => console.error("Lỗi tải categories:", err));
    }, []);

    // Lấy 1 trang sản phẩm, phụ thuộc vào sort + category + page
    useEffect(() => {
        const selected =
            SORT_OPTIONS.find((o) => o.value === sortValue) || SORT_OPTIONS[0];
        const params = {
            sort: selected.sort,
            order: selected.order,
            page,
            limit: PAGE_SIZE,
        };
        if (categoryValue !== "all") {
            params.category = categoryValue;
        }
        if (query) {
            params.q = query;
        }
        const key = `${sortValue}|${categoryValue}|${page}|${query}`;

        // Bấm chuyển trang liên tục thì bỏ kết quả của request cũ về muộn
        let ignore = false;
        getProducts(params)
            .then((data) => {
                if (!ignore) setResult({ ...data, key });
            })
            .catch((err) => {
                if (!ignore) setError(err.message);
            });
        return () => {
            ignore = true;
        };
    }, [sortValue, categoryValue, page, query]);

    // Rời trang thì huỷ lượt tìm đang chờ
    useEffect(() => () => clearTimeout(searchTimer.current), []);

    const applySearch = (value) => {
        clearTimeout(searchTimer.current);
        setQuery(value.trim());
        setPage(1);
    };
    // Gõ xong 300ms mới tìm, để không gửi 1 request cho mỗi phím
    const changeSearch = (value) => {
        setSearchInput(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => applySearch(value), 300);
    };
    const clearSearch = () => {
        setSearchInput("");
        applySearch("");
    };

    // Đổi bộ lọc thì quay về trang 1
    const changeCategory = (value) => {
        setCategoryValue(value);
        setPage(1);
    };
    const changeSort = (value) => {
        setSortValue(value);
        setPage(1);
    };
    const changePage = (value) => {
        setPage(value);
        listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const selectedCategory = categories.find((c) => String(c.id) === String(categoryValue));

    if (loading) {
        return (
            <main className="min-h-screen bg-[#FAFAF8]">
                <div className="max-w-6xl mx-auto px-6 py-16">
                    <div className="flex items-center justify-center min-h-[300px]">
                        <p className="text-[#6B6B65]">
                            Đang tải sản phẩm...
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-[#FAFAF8]">
                <div className="max-w-6xl mx-auto px-6 py-16">
                    <div className="rounded-md border border-[#E3C6C3] bg-[#FBF1F0] px-5 py-4">
                        <p className="font-medium text-[#B3413B]">
                            Lỗi: {error}
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#FAFAF8]">
            {/* Page Header */}
            <section className="bg-[#2F5233]">
                <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
                    <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[#D8E2D2]">
                        Bộ sưu tập của chúng tôi
                    </p>

                    <h1
                        className="text-4xl md:text-5xl font-normal text-[#F5F3EE]"
                        style={{ fontFamily: "'Fraunces', serif" }}
                    >
                        Chúng tôi có gì?
                    </h1>
                </div>
            </section>

            {/* Products */}
            <section className="max-w-6xl mx-auto px-6 py-12 md:py-16">
                {/* Danh mục dạng ô icon */}
                <div
                    role="tablist"
                    aria-label="Danh mục sản phẩm"
                    className="-mx-6 px-6 mb-10 flex gap-3 overflow-x-auto pb-1 md:mx-0 md:px-0 md:flex-wrap"
                >
                    {[{ id: "all", slug: "all", name: "Tất cả" }, ...categories].map((c) => {
                        const active = String(c.id) === String(categoryValue);
                        return (
                            <button
                                key={c.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => changeCategory(String(c.id))}
                                className={`flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border bg-white transition-colors md:h-[120px] md:w-[120px] ${
                                    active
                                        ? "border-[#1A1A18] text-[#1A1A18]"
                                        : "border-[#E5E3DC] text-[#3A3A36] hover:border-[#B0AC9C]"
                                }`}
                            >
                                <CategoryIcon slug={c.slug} className="h-10 w-10" />
                                <span className="text-sm font-medium">{c.name}</span>
                            </button>
                        );
                    })}
                </div>

                <form
                    role="search"
                    onSubmit={(e) => {
                        e.preventDefault();
                        applySearch(searchInput); // Enter thì tìm ngay, không chờ
                    }}
                    className="relative mb-8 max-w-md"
                >
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B6B65]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => changeSearch(e.target.value)}
                        placeholder="Tìm sản phẩm hoặc mã, vd: đũa gỗ trắc, CTL756"
                        aria-label="Tìm sản phẩm"
                        maxLength={100}
                        className="h-12 w-full rounded-md border border-[#E5E3DC] bg-white pl-12 pr-11 text-[#1A1A18] placeholder:text-[#9A978C] focus:border-[#2F5233] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={clearSearch}
                            aria-label="Xoá từ khoá"
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-xl text-[#6B6B65] hover:bg-[#F2F1EC]"
                        >
                            ×
                        </button>
                    )}
                </form>

                <div ref={listRef} className="mb-8 flex scroll-mt-24 items-end justify-between gap-4">
                    <div>
                        <h2
                            className="text-2xl md:text-3xl text-[#1A1A18]"
                            style={{ fontFamily: "'Fraunces', serif" }}
                        >
                            {selectedCategory ? selectedCategory.name : "Tất cả sản phẩm"}
                        </h2>

                        <p className="mt-2 text-sm text-[#6B6B65]">
                            {result.total} sản phẩm
                            {query && <> khớp với “{query}”</>}
                        </p>
                    </div>

                    <Dropdown
                        label="Sắp xếp:"
                        value={sortValue}
                        options={SORT_OPTIONS}
                        onChange={changeSort}
                    />
                </div>

                {products.length === 0 && !stale ? (
                    <div className="rounded-md border border-[#D9D6CC] bg-white py-16 text-center">
                        <p className="text-[#6B6B65]">
                            {query
                                ? `Không tìm thấy sản phẩm nào khớp với “${query}”.`
                                : "Chưa có sản phẩm nào."}
                        </p>
                        {query && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="mt-4 text-sm font-medium text-[#2F5233] underline underline-offset-4"
                            >
                                Xoá từ khoá
                            </button>
                        )}
                    </div>
                ) : (
                    // Đang tải trang mới thì làm mờ trang cũ thay vì xoá trắng, để bố cục không nhảy
                    <div
                        aria-busy={stale}
                        className={`grid grid-cols-2 gap-4 transition-opacity md:grid-cols-3 md:gap-5 lg:grid-cols-4 ${
                            stale ? "pointer-events-none opacity-50" : ""
                        }`}
                    >
                        {products.map((p) => (
                            <ProductCard key={p.id} product={p} />
                        ))}
                    </div>
                )}

                <Pagination page={page} totalPages={result.totalPages} onChange={changePage} />
            </section>
        </main>
    );
}

export default ProductsPage;