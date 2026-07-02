require('dotenv').config();
require('express-async-errors');

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

const authRoutes          = require('./routes/auth');
const inventoryRoutes     = require('./routes/inventory');
const stagesRoutes        = require('./routes/stages');
const invoicesRoutes      = require('./routes/invoices');
const notificationsRoutes = require('./routes/notifications');
const reportsRoutes       = require('./routes/reports');
const settingsRoutes      = require('./routes/settings');
const finishedGoodsModel  = require('./models/finishedGoodsModel');
const { authenticate }    = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Security & Parsing ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

// ── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Starline IMS Backend', timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/inventory',     inventoryRoutes);
app.use('/api/stages',        stagesRoutes);
app.use('/api/invoices',      invoicesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports',       reportsRoutes);
app.use('/api/settings',      settingsRoutes);

// GET /api/finished-goods — convenience endpoint
app.get('/api/finished-goods', authenticate, async (req, res) => {
  const { ready_for_invoice } = req.query;
  const items = await finishedGoodsModel.findAll({
    ready_for_invoice: ready_for_invoice === undefined ? undefined : ready_for_invoice === 'true',
  });
  return res.json({ success: true, items });
});

// ── 404 ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An internal error occurred',
  });
});

// ── Start Server ────────────────────────────────────────────
// Skip listen when deployed on Vercel (serverless functions export the handler directly)
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅  Starline IMS Backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

module.exports = app;
