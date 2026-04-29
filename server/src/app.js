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
const { success, error } = require('./utils/response');

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

// Global rate limiting
app.use('/api', globalLimiter);

// Body Parsing
// Important: Webhook routes must be parsed as raw, so only apply json parser if not a webhook
app.use((req, res, next) => {
  if (req.originalUrl.includes('/webhook')) {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api', globalLimiter);

// Use the same resolution strategy as media.service.js so both always point
// to the same directory regardless of the working directory at startup.
const UPLOADS_SERVE_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/uploads', express.static(UPLOADS_SERVE_DIR));
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
const categoryRoutes = require('./modules/category/category.routes');
const productRoutes = require('./modules/product/product.routes');
const mediaRoutes = require('./modules/media/media.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const couponRoutes = require('./modules/coupon/coupon.routes');
const orderRoutes = require('./modules/order/order.routes');
const paymentRoutes = require('./modules/payment/payment.routes');
const shippingRoutes = require('./modules/shipping/shipping.routes');
const wishlistRoutes = require('./modules/wishlist/wishlist.routes');
const reviewRoutes = require('./modules/review/review.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const brandRoutes = require('./modules/brand/brand.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const attributeRoutes = require('./modules/attribute/attribute.routes');
const categoryAttributeRoutes = require('./modules/attribute/categoryAttribute.routes');
const productAttributeRoutes = require('./modules/attribute/productAttribute.routes');
const productVariantRoutes = require('./modules/attribute/productVariant.routes');
const pageRoutes = require('./modules/page/page.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const shippingAdminRoutes = require('./modules/shipping/shipping.admin.routes');
const shippingWebhookRoutes = require('./modules/shipping/shipping.webhook.routes');

app.use('/api', seoRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/webhook/shipping', shippingWebhookRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api', reviewRoutes);
app.use('/api/audit-logs', auditRoutes);
// Admin route is mounted at a configurable secret path to prevent enumeration.
// Set ADMIN_ROUTE_PREFIX in .env — e.g. /api/mgmt-xK9mP2 — to mask the endpoint.
// Falls back to /api/admin in development if not set.
const adminPrefix = process.env.ADMIN_ROUTE_PREFIX || '/api/admin';
app.use(adminPrefix, adminRoutes);
app.use(adminPrefix, shippingAdminRoutes);
app.use('/api/attributes', attributeRoutes);
app.use('/api/categories', categoryAttributeRoutes); // extends existing /api/categories with /:id/attributes sub-routes
app.use('/api/products', productAttributeRoutes);   // extends existing /api/products with /:id/attributes sub-routes
app.use('/api/products', productVariantRoutes);     // extends existing /api/products with /:id/variants/* sub-routes
app.use('/api/pages', pageRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const { sequelize } = require('./modules');
    await sequelize.authenticate();
    return success(res, { status: 'ok', db: 'connected', uptime: process.uptime() }, 'Health check OK');
  } catch (err) {
    return error(res, 'Database disconnected', 500, 'HEALTH_CHECK_FAILED', {
      status: 'error',
      db: 'disconnected',
      uptime: process.uptime(),
    });
  }
});

// Handle 404
app.use((req, res) => {
  return error(res, 'Endpoint not found', 404, 'NOT_FOUND');
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
