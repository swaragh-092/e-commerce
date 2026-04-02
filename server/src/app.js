'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const { globalLimiter } = require('./middleware/rateLimiter.middleware');

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Body Parsing
// Important: Webhook routes must be parsed as raw, so only apply json parser if not a webhook
app.use((req, res, next) => {
  if (req.originalUrl.includes('/webhook')) {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global rate limiting
app.use('/api', globalLimiter);

// Serve uploads statically
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Routes
const settingsRoutes = require('./modules/settings/settings.routes');
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/user/user.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const categoryRoutes = require('./modules/category/category.routes');
const productRoutes = require('./modules/product/product.routes');
const mediaRoutes = require('./modules/media/media.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const couponRoutes = require('./modules/coupon/coupon.routes');
const orderRoutes = require('./modules/order/order.routes');
const paymentRoutes = require('./modules/payment/payment.routes');
const wishlistRoutes = require('./modules/wishlist/wishlist.routes');
const reviewRoutes = require('./modules/review/review.routes');

app.use('/api/settings', settingsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api', reviewRoutes);
// Do not expose notifications out in phase 1, but we can mount if needed:
// app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
