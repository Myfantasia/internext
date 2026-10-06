import crypto from 'crypto';
import 'dotenv/config';
import express from 'express';
import './middleware/asyncErrors.js';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { attachUser } from './middleware/session.js';
import { errorHandler } from './middleware/asyncErrors.js';
import { corsOptions, csrfOriginCheck } from './middleware/security.js';
import { db } from './db/client.js';
import { products, orders } from './db/schema.js';
import { sql } from 'drizzle-orm';

import authRoutes from './routes/authRoutes.js';
import inviteRoutes from './routes/inviteRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import receiptRoutes from './routes/receiptRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import paymentRoutes, { stripeWebhookHandler } from './routes/paymentRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import flashDealRoutes from './routes/flashDealRoutes.js';
import newsRoutes from './routes/newsRoutes.js';
import { expireStaleUnpaidOrders } from './repositories/ordersRepo.js';
import { expireStaleBankTransferOrders } from './services/payments/offline.js';
import { importAllSources } from './repositories/newsRepo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({
  contentSecurityPolicy: false // frontend is a separate Vite build; CSP tuned when the two are unified for production
}));
app.set('trust proxy', process.env.TRUST_PROXY === 'true' || !!process.env.VERCEL ? 1 : false);
app.use(cors(corsOptions()));
// Stripe signs the exact raw bytes, so this route must see the body before express.json parses it.
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhookHandler);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(csrfOriginCheck);
app.use(attachUser);

// Request logging middleware
app.use((req, res, next) => {
  if (!req.url.startsWith('/assets') && !req.url.includes('.')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/invites', inviteRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/flash-deals', flashDealRoutes);
app.use('/api/news', newsRoutes);
app.use('/api', invoiceRoutes);
app.use('/api', receiptRoutes);

const uploadsPath = path.join(__dirname, '../uploads');
// Local uploads only; on Vercel the disk is read-only and images go to Vercel Blob.
try { fs.mkdirSync(uploadsPath, { recursive: true }); } catch { /* read-only filesystem */ }
app.use('/uploads', express.static(uploadsPath));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const [[{ productsCount }], [{ ordersCount }]] = await Promise.all([
      db.select({ productsCount: sql`count(*)::int` }).from(products),
      db.select({ ordersCount: sql`count(*)::int` }).from(orders)
    ]);
    res.json({
      status: 'ok',
      storeName: 'Internext Business System',
      productsCount,
      ordersCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check database query failed:', error);
    res.status(503).json({
      status: 'unavailable',
      code: 'DATABASE_UNAVAILABLE',
      message: 'The database could not be reached. Check DATABASE_URL and database network access.'
    });
  }
});

// Serve frontend public and dist assets
const publicPath = path.join(__dirname, '../public');
const distPath = path.join(__dirname, '../dist');

app.use(express.static(publicPath));
app.use(express.static(distPath));

// Explicit favicon handler
app.get('/favicon.ico', (req, res) => {
  const iconPath = path.join(publicPath, 'favicon.ico');
  res.sendFile(iconPath, (err) => {
    if (err) res.status(204).end();
  });
});

app.get('/favicon.svg', (req, res) => {
  const svgPath = path.join(publicPath, 'favicon.svg');
  res.sendFile(svgPath, (err) => {
    if (err) res.status(204).end();
  });
});

// Housekeeping, shared by the long-running server (timers below) and Vercel
// Cron, which calls GET /api/cron/housekeeping (see vercel.json). Vercel sends
// "Authorization: Bearer $CRON_SECRET"; anything else is refused.
async function runHousekeeping() {
  const [unpaid, bank] = await Promise.all([expireStaleUnpaidOrders(), expireStaleBankTransferOrders()]);
  return { expiredUnpaidOrders: unpaid, expiredBankTransferOrders: bank };
}

app.get('/api/cron/housekeeping', async (req, res) => {
  const secret = process.env.CRON_SECRET || '';
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const ok = secret.length >= 16 && provided.length === secret.length
    && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  if (!ok) return res.status(401).json({ success: false });
  try {
    res.json({ success: true, ...(await runHousekeeping()) });
  } catch (err) {
    console.error('[cron] housekeeping failed:', err);
    res.status(500).json({ success: false });
  }
});

// Fallback handler for SPA client-side routing
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: "API endpoint not found" });
  }

  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Internext Business System API</title><style>body{font-family:sans-serif;padding:40px;background:#0b132b;color:#fff;text-align:center;}</style></head>
        <body>
          <h1>Internext Business System API Server is Running on Port ${PORT}</h1>
          <p>Please launch the Vite development frontend on <a href="http://localhost:5174" style="color:#38bdf8;">http://localhost:5174</a> or run <code>npm run build</code>.</p>
        </body>
        </html>
      `);
    }
  });
});

app.use(errorHandler);

// Background housekeeping for long-running servers (Vercel uses the cron route above).
function startBackgroundJobs() {
  const every = (minutes, job, label) => setInterval(() => {
    job().catch((e) => console.error(`[jobs] ${label} failed:`, e.message));
  }, minutes * 60 * 1000).unref();
  every(15, () => runHousekeeping(), 'expire unpaid orders');
  const newsMinutes = Number(process.env.NEWS_FETCH_INTERVAL_MINUTES || 0);
  if (newsMinutes >= 15) every(newsMinutes, () => importAllSources(), 'news feed import');
}

if (!process.env.VERCEL) {
  startBackgroundJobs();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`Internext Business System API Server is Live on Port ${PORT}`);
    console.log(`Local API: http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });
}

export default app;
