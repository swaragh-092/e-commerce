'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const { globalLimiter } = require('./middleware/rateLimiter.middleware');

const app = express();

// Security Middleware
app.use(helmet());
app.use(compression());
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = (
        process.env.CLIENT_URL ||
        'http://localhost:5173,http://localhost:3000,http://localhost:3001'
      ).split(',');
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

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

// Serve uploads statically — allow cross-origin loading for <img> tags
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Fallback: serve placeholder for any missing upload file
app.use('/uploads', (req, res) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.sendFile(path.join(__dirname, '../public/no-image.png'));
});

// Serve public statically for robots.txt
app.use(express.static(path.join(__dirname, '../public')));

// Routes
const seoRoutes = require('./modules/seo/seo.routes');
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
const auditRoutes = require('./modules/audit/audit.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const attributeRoutes = require('./modules/attribute/attribute.routes');
const categoryAttributeRoutes = require('./modules/attribute/categoryAttribute.routes');
const productVariantRoutes = require('./modules/attribute/productVariant.routes');

app.use('/api', seoRoutes);
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
app.use('/api/audit-logs', auditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attributes', attributeRoutes);
app.use('/api/categories', categoryAttributeRoutes); // extends existing /api/categories with /:id/attributes sub-routes
app.use('/api/products', productVariantRoutes);     // extends existing /api/products with /:id/variants/* sub-routes
// Do not expose notifications out in phase 1, but we can mount if needed:
// app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const { sequelize } = require('./modules');
    await sequelize.authenticate();
    res.status(200).json({ status: 'ok', db: 'connected', uptime: process.uptime() });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', uptime: process.uptime() });
  }
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
