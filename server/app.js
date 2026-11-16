// Tạo app Express và gắn route, không listen: server.js chạy thật, test gọi thẳng app qua Supertest
const cors = require('cors');
const express = require('express');
const app = express();
const { apiLimiter, chatLimiter } = require('./middleware/rateLimit.middleware');

// Render đứng sau 1 lớp proxy: để req.ip lấy đúng IP thật của client từ X-Forwarded-For
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Cho dịch vụ ping (UptimeRobot) gọi định kỳ để Render gói Free không ngủ.
// Không truy vấn DB để Neon vẫn được tạm dừng khi rảnh, không tốn giờ compute; đặt trước limiter
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', apiLimiter);

const productRoutes = require('./routes/products.routes');
const categoryRoutes = require('./routes/categories.routes');
const chatRoutes = require('./routes/chat.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/users.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/orders.routes');
const adminProductRoutes = require('./routes/admin.products.routes');
const adminOrdersRoutes = require('./routes/admin.orders.routes');
const adminStatsRoutes = require('./routes/admin.stats.routes');

app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/orders', adminOrdersRoutes);
app.use('/api/admin/stats', adminStatsRoutes);

module.exports = app;
