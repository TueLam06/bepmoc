# Bếp Mộc Linh Đan: web bán đồ gỗ gia dụng (thương hiệu HAHANCO)

Web bán hàng cho shop thật **Bếp Mộc Linh Đan** (Shopee Mall: https://shopee.vn/bepmoclinhdan, thương hiệu in trên sản phẩm là **HAHANCO**). Tên hiển thị trên web: "Bếp Mộc Linh Đan", HAHANCO dùng khi nói về sản phẩm.

Mục tiêu kép: chạy bán hàng thật, và làm portfolio (README nói rõ "phát triển từ Stuff Corner để vận hành thật" và liệt kê phần làm mới).

## Về shop

- ~296 sản phẩm, 4.9★ từ hơn 10k đánh giá trên Shopee, kho ở Hà Nội, giao toàn quốc.
- 8 danh mục: Đũa gỗ siêu sạch · Muôi – Thìa · Thớt – Khay – Đĩa · Phụ kiện bàn ăn · Lược sừng xuất khẩu · Lược gỗ thơm · Dụng cụ massage · Đồ thờ cúng.
- Giá từ 16k (đũa nấu gỗ dừa) tới gần 2 triệu (hộp 10 đôi đũa cao cấp), phần lớn dưới 300k. Phiên bản theo vật liệu (gỗ trắc, cẩm lai, hương, dừa, xà cừ, sừng), kích thước, quy cách (1 đôi / bộ 10 đôi). Tên trên Shopee kèm mã SKU dạng `[CTL756]`.
- Khách hay mua nhiều cái một lúc, có khách sỉ (nhà hàng, tiệm nail/spa).
- Dữ liệu sản phẩm nhập từ file Excel chủ shop xuất từ Shopee Seller Centre. **Không cào Shopee.**

## Nguồn gốc repo

- Clone từ đồ án Stuff Corner (web bán đồ công nghệ, `TueLam06/ecommerce-project`), giữ nguyên lịch sử commit. Commit rất cũ không có tiền tố `client/`/`server/` (Stuff Corner từng gộp 2 repo bằng `git subtree`), muốn xem thì `git log -- server.js` theo đường dẫn cũ.
- Remote: `origin` = `TueLam06/bepmoc`, `upstream` = Stuff Corner (chỉ fetch, đã chặn push). Bản sửa lỗi chung lấy bằng `git fetch upstream` + `git cherry-pick <hash>`.
- **Repo public**: không bao giờ commit dữ liệu của shop (file Excel sản phẩm, ảnh gốc, dump DB) hay dữ liệu khách hàng. Seed và test dùng dữ liệu giả.

## Stack và hạ tầng

Monorepo 2 phần, mỗi phần có `package.json` và `node_modules` riêng (không dùng workspaces):

- `client/`: React 19 + Vite + Tailwind 4 + DaisyUI, deploy trên **Cloudflare Pages** (URL: _điền sau_).
- `server/`: Express 5 + PostgreSQL (`pg`), deploy trên **Render** (URL: _điền sau_; bán thật thì gói Starter để không ngủ).
- Database: project **Neon riêng**, 3 branch: `main`/`production` (Render), `dev` (local), `test` (Jest, chỉ có schema). Host production bắt đầu bằng `ep-weathered-wave-`.
- Cloudinary và Brevo: tài khoản riêng, không dùng chung với Stuff Corner.
- Thanh toán: COD + chuyển khoản VietQR tự đối soát qua **PayOS** (webhook là nguồn sự thật: kiểm tra chữ ký, so số tiền, chống xử lý trùng).

Làm việc trên 2 máy (PC và laptop): đầu phiên `git pull`, cuối phiên commit + push (khi được yêu cầu).

## Chạy local

```bash
cd server && npm install && npm run dev   # http://localhost:5000, node --watch
cd client && npm install && npm run dev   # http://localhost:5173
```

- `npm start` ở server **không** tự nạp lại code. Sửa code mà server vẫn chạy bản cũ thì restart, hoặc kiểm tra có process cũ giữ cổng 5000 không.
- `server/.env` không commit, copy từ `server/.env.example`. Biến: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `CLIENT_URL`, `CLOUDINARY_*`, `GEMINI_API_KEY` (chatbot).
- `server/.env` trỏ vào **branch `dev`** của Neon (muốn lấy dữ liệu mới từ production thì *Reset from parent*). Server in host DB lúc khởi động.
- Client: `.env.development` (localhost:5000) và `.env.production` (URL Render) đều được commit, chỉ chứa `VITE_API_URL`. Không bao giờ để secret trong biến `VITE_*` (bị đóng gói vào JS gửi xuống trình duyệt).
- Client không có test, kiểm tra bằng `npm run lint` (0 lỗi, giữ nguyên) và `npm run build`.
- Server: `npm test` (Jest + Supertest, `--runInBand`) chạy trên **branch `test`**, URL trong `server/.env.test` (không commit). `tests/setup/globalSetup.js` xoá bảng rồi dựng lại từ `db/schema.sql`, và dừng nếu host là production (`PRODUCTION_HOST_PREFIX` trong `tests/setup/testEnv.js`) hoặc trùng host DB dev trong `.env`. Mỗi test `TRUNCATE` lại dữ liệu; mailer được mock (đọc token từ `mock.calls`); dữ liệu tạo thẳng vào DB qua `tests/helpers.js`; khách vãng lai mỗi request một IP (`X-Forwarded-For`) để không dính rate limit.
- Tài khoản admin: đăng ký bình thường rồi `UPDATE users SET role = 'admin' WHERE email = '...'` trên đúng branch.

## Cấu trúc

### Server
- `app.js`: tạo app Express, gắn middleware và route, export app (không `listen`, để test dùng được).
- `server.js`: chạy migration nhỏ (`ALTER TABLE ... IF NOT EXISTS`) rồi `listen`. Không có công cụ migration riêng: đổi schema thì thêm câu lệnh idempotent ở đây **và** sửa `db/schema.sql` (schema đầy đủ, dùng dựng DB mới và DB test). DB trống phải chạy `schema.sql` trước, `server.js` không tạo bảng gốc.
- `routes/*.routes.js`: mỗi nhóm API một file, mount dưới `/api/...`. Route admin dùng `verifyToken` + `requireAdmin`.
- `middleware/auth.middleware.js`: `verifyToken`, `requireAdmin`, `optionalAuth` (JWT trong header `Authorization: Bearer`).
- `middleware/rateLimit.middleware.js`: các limiter (`express-rate-limit`, lưu trong RAM nên restart là reset). `app.set('trust proxy', 1)` để lấy IP thật sau proxy Render.
- `config/`: `db.js` (Pool), `cloudinary.js`, `gemini.js` (LangChain + Gemini cho chatbot).
- `utils/token.js`: JWT đăng nhập; token xác thực email ký bằng secret riêng (`JWT_SECRET + ':verify-email'`) và gắn dấu vân tay mật khẩu, để không dùng thay token đăng nhập được và tự hết hiệu lực khi đăng ký lại.
- `utils/mailer.js`: gửi mail qua **Brevo HTTP API**. Thiếu `BREVO_API_KEY` thì chỉ in nội dung mail ra console (tiện test local).
- `utils/orderStock.js`: trừ/hoàn tồn kho theo sản phẩm hoặc phiên bản.
- Bảng: `users` (có `role`, `email_verified`, và `phone`, `city`, `ward`, `street` là địa chỉ giao hàng ở hồ sơ), `categories`, `products`, `product_variants` (sản phẩm có phiên bản thì giá/tồn kho lấy theo phiên bản), `cart_items`, `orders`, `order_items` (lưu tên sản phẩm/phiên bản lúc mua), `order_status_history`.
- Lỗi trả về JSON `{ error }` hoặc `{ message }`, thông báo bằng tiếng Việt.

### Client
- `src/api/http.js`: **nơi duy nhất** đọc `VITE_API_URL` và gọi `fetch` (`authFetch(path, { method, body, token })`, ném `Error` có `message` và `code` từ server). Các module `api/*.js` và `admin/api/*.js` bọc từng endpoint. Trang và context không gọi `fetch` trực tiếp.
- `pages/*Page.jsx`: mỗi route một trang (hậu tố `Page`). `admin/`: trang quản trị (layout, pages, api riêng).
- `context/`: mỗi context tách 2 file, `XxxContext.js` (createContext + hook `useXxx`) và `XxxProvider.jsx` (component), để Vite fast refresh hoạt động. `AuthProvider` lưu token trong `localStorage`; `CartProvider` lưu giỏ khách vãng lai trong `localStorage`, đã đăng nhập thì đồng bộ với DB và merge lúc vừa đăng nhập.
- `constants/vnAddress.js`: dữ liệu tỉnh/thành → phường/xã (cấu trúc 2 cấp sau sáp nhập 07/2025).
- `constants/payment.js`: danh sách phương thức thanh toán ở checkout.
- `components/CategoryIcon.jsx`: icon nét mảnh theo `slug` danh mục.
- Không gọi setState đồng bộ trong `useEffect` (rule `react-hooks/set-state-in-effect`): set state trong callback sau khi fetch, trong handler sự kiện, hoặc điều chỉnh state ngay lúc render khi prop đổi.
- `routes/PrivateRoute.jsx`, `routes/AdminRoute.jsx`: chặn route cần đăng nhập/admin.
- Giao diện: chuyển sang tông màu gỗ (bảng màu chốt khi làm phần thương hiệu, ghi lại ở đây). Font tiêu đề Fraunces.

### Còn sót từ Stuff Corner (sẽ gỡ/đổi trong giai đoạn 1)
- Chatbot (giữ lại, prompt đã viết cho đồ gỗ): `server/routes/chat.routes.js`, `config/gemini.js`, `prompts/systemPrompt.js`, `client/src/pages/ChatPage.jsx`, `api/chat.js`.
- Icon danh mục đồ công nghệ (`CategoryIcon.jsx`), logo/favicon cũ (`public/Logo.png`), trang chủ tạm (`HomePage.jsx`).
- Chỉ giao Hà Nội/TP.HCM: `DELIVERY_CITIES` ở `routes/orders.routes.js` và `routes/auth.routes.js`, `vnAddress.js` chỉ có 2 thành phố.
- Thanh toán online mới có giao diện (đang ghi VNPay, cờ `VNPAY_ENABLED = false`), server chưa có cột/API thanh toán.

## Luồng nghiệp vụ

- **Đăng ký → xác thực email**: đăng ký tạo user `email_verified = false` và gửi link `${CLIENT_URL}/verify-email?token=...` (hết hạn 24h). Chưa xác thực thì login trả `403` với `code: EMAIL_NOT_VERIFIED`. Bấm link thì xác thực và đăng nhập luôn. Email chưa xác thực được đăng ký lại (ghi đè tên/mật khẩu, link cũ hết hiệu lực).
- **Quên mật khẩu**: `forgot-password` luôn trả cùng một câu và không chờ gửi mail (không lộ email nào tồn tại). Link `${CLIENT_URL}/reset-password?token=...` hết hạn 30 phút, ký bằng `JWT_SECRET + ':reset-password'` và gắn dấu vân tay mật khẩu nên chỉ dùng được 1 lần. Đặt lại xong thì đăng nhập luôn và coi email là đã xác thực.
- **Hồ sơ** (`/profile`): xem/sửa họ tên, SĐT, địa chỉ (`PATCH /api/auth/me`, trường không gửi thì giữ nguyên, chuỗi rỗng thì xoá; địa chỉ đủ tỉnh/thành + phường/xã + số nhà hoặc để trống hết) và đổi mật khẩu (`POST /api/auth/change-password`). Mọi response trả `user` đều qua `publicUser()`. Checkout có nút **Tự động điền** lấy từ hồ sơ, không tự điền khi vừa mở trang.
- **Đặt hàng**: `POST /api/orders` nhận cả khách vãng lai (gửi `cart` trong body) lẫn user đăng nhập (lấy giỏ từ DB). Bắt buộc có `email`, gửi mail xác nhận sau khi commit, mail lỗi không làm hỏng đơn. Trừ tồn kho trong transaction với `SELECT ... FOR UPDATE`. Giới hạn số lượng hiện tại (`MAX_QTY_PER_ITEM`, số dòng/đơn) còn theo Stuff Corner, sẽ nâng cho khách mua nhiều/khách sỉ.
- **Rate limit**: chung 200 req/phút/IP; login sai 5 lần/15 phút (IP + email); đăng ký 10 lần thành công/giờ; gửi lại mail xác thực 3 lần/15 phút; quên mật khẩu 3 lần/15 phút; đổi mật khẩu sai 5 lần/15 phút/user; đặt hàng 5 đơn/10 phút; tra cứu đơn 10 lần/phút.

## Deploy

- Push lên `main` thì Cloudflare Pages và Render tự deploy (Render bật **Auto-Deploy: On Commit**).
- Cloudflare Pages: Root Directory `client`, preset React (Vite), output `dist`. Pages tự trả `index.html` cho mọi đường dẫn (SPA) vì `dist` không có `404.html`. Mỗi nhánh có bản xem trước ở `<nhánh>.<project>.pages.dev`.
- Render: Root Directory `server`, build `npm install`, start `npm start`. Biến môi trường nhập trong mục Environment; `CLIENT_URL` phải là URL Cloudflare Pages (link trong email dùng biến này). `DATABASE_URL` trỏ vào branch production của Neon.
- Brevo: tài khoản free bọc link để đếm lượt bấm và link bọc từng trả 404, nên mail có thêm link dạng chữ dưới nút. Tắt chặn IP lạ (Authorised IPs) để Render gửi được.

## Quy ước

- Commit message tiếng Việt, tiền tố `feat:` / `fix:` / `style:` / `ref:` / `chore:` (có thể có scope như `feat(admin):`), chữ thường, **chỉ 1 dòng ngắn gọn, không có thân**. **Không** thêm dòng `Co-Authored-By`.
- Mỗi file một commit, commit lần lượt theo đúng thứ tự file được sửa. Các file gắn chặt cùng một chức năng (route + test của route, component + trang dùng nó) thì gộp chung một commit.
- **Chỉ commit/push khi được yêu cầu.**
- Comment trong code bằng tiếng Việt, ngắn, giải thích lý do.
- Server dùng CommonJS (`require`), client dùng ES modules.
- `ROADMAP.md` và `.claude/` là ghi chú cá nhân, đã được gitignore.
