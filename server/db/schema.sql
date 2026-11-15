-- Schema đầy đủ của database, dùng để dựng DB mới (local, test, CI)
-- DB đang chạy thì server.js vẫn tự thêm cột/bảng còn thiếu lúc khởi động, đổi schema thì sửa cả 2 nơi

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    email_verified BOOLEAN NOT NULL DEFAULT false,
    -- Thông tin giao hàng lưu ở hồ sơ để tự điền form đặt hàng
    phone VARCHAR(20),
    city VARCHAR(100),
    ward VARCHAR(100),
    street VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    -- Thứ tự hiện ở trang Sản phẩm, theo cách shop sắp danh mục chứ không theo ABC
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    image TEXT,
    description TEXT,
    category VARCHAR(100),
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    feature BOOLEAN DEFAULT false,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    short_description VARCHAR(200),
    -- Mã hàng của shop (vd CTL756), dùng để đối chiếu với Shopee/file Excel
    sku VARCHAR(50),
    -- Giá trước khi giảm, NULL hoặc không lớn hơn price thì không hiện giá gạch ngang
    original_price NUMERIC(10, 2)
);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON products (sku);

-- Sản phẩm có phiên bản thì giá/tồn kho lấy theo phiên bản, không thì dùng products.price/stock
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price NUMERIC NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    image TEXT,
    sku VARCHAR(50),
    original_price NUMERIC(10, 2),
    UNIQUE (product_id, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_key ON product_variants (sku);

CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items (user_id);
-- 1 sản phẩm nằm trong giỏ nhiều lần với các phiên bản khác nhau (variant_id NULL = không có phiên bản)
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_variant_key
    ON cart_items (user_id, product_id, (COALESCE(variant_id, 0)));

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'shipping', 'completed', 'cancelled')),
    email VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);

-- Lưu tên sản phẩm/phiên bản lúc mua để đơn cũ vẫn hiển thị đúng khi sản phẩm bị sửa/xoá
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price_at_purchase NUMERIC(10, 2) NOT NULL,
    product_name VARCHAR(255),
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    variant_name VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);

CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    changed_by VARCHAR(50) NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT now()
);
