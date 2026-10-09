import express from 'express';
import { getDashboardAnalytics } from '../repositories/analyticsRepo.js';
import { listAuditLogs, logAudit } from '../repositories/auditLogsRepo.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getCompanyProfile, updateCompanyProfile, listStores, replaceStores } from '../repositories/companyProfileRepo.js';
import { listSubscribers, subscribe } from '../repositories/newsletterRepo.js';
import { requireRole, requirePermission } from '../middleware/authorize.js';
import { referralProgramSchema, formatZodError } from '../schemas/authSchemas.js';
import {
  listRewardPrograms, createRewardProgram, updateRewardProgram, setRewardProgramActive,
  reissueAllReferralRewards, getReferralAdminStats
} from '../repositories/referralRepo.js';
import { getDeliveryConfig } from '../services/delivery.js';
import { verifyEmailTransport, sendTestEmail, activeProviderName } from '../services/email/index.js';
import { isUuid } from '../db/util.js';
import { listCustomers, getCustomerDetail } from '../repositories/customersRepo.js';
import { getFinanceOverview } from '../repositories/financeRepo.js';
import { listExpenses, findExpense, createExpense, updateExpense, deleteExpense } from '../repositories/expensesRepo.js';
import { EXPENSE_CATEGORIES } from '../db/schema.js';
import { setUserActive } from '../repositories/usersRepo.js';
import { revokeAllSessionsForUser } from '../repositories/sessionsRepo.js';
import { createPosOrder } from '../repositories/ordersRepo.js';
import { db } from '../db/client.js';
import { storeStock, products, productVariants } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const router = express.Router();

const newsletterLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' } });

// ---------------------------------------------------------------------------
// Referral reward programs
// ---------------------------------------------------------------------------
router.get('/referral-programs', requirePermission('referrals:read'), async (_req, res) => {
  const [programs, stats] = await Promise.all([listRewardPrograms(), getReferralAdminStats()]);
  res.json({ success: true, programs, stats });
});

router.post('/referral-programs', requirePermission('referrals:write'), async (req, res) => {
  const parsed = referralProgramSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const program = await createRewardProgram(parsed.data, req.user.id);
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'REFERRAL_PROGRAM_CREATE', entity: 'Referral Rewards', entityId: program.id, newValue: `${program.name} (${program.rewardModel})`, ip: req.ip });
  // Customers who already qualify receive their reward without waiting for a new referral.
  if (program.isActive) reissueAllReferralRewards().catch((e) => console.error('Referral reissue failed:', e));
  res.status(201).json({ success: true, program });
});

router.put('/referral-programs/:id', requirePermission('referrals:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Program not found' });
  const parsed = referralProgramSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const program = await updateRewardProgram(req.params.id, parsed.data);
  if (!program) return res.status(404).json({ success: false, message: 'Program not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'REFERRAL_PROGRAM_UPDATE', entity: 'Referral Rewards', entityId: program.id, newValue: program.name, ip: req.ip });
  if (program.isActive) reissueAllReferralRewards().catch((e) => console.error('Referral reissue failed:', e));
  res.json({ success: true, program });
});

router.patch('/referral-programs/:id/status', requirePermission('referrals:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Program not found' });
  const program = await setRewardProgramActive(req.params.id, req.body?.isActive === true);
  if (!program) return res.status(404).json({ success: false, message: 'Program not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: program.isActive ? 'REFERRAL_PROGRAM_ACTIVATE' : 'REFERRAL_PROGRAM_DEACTIVATE', entity: 'Referral Rewards', entityId: program.id, ip: req.ip });
  if (program.isActive) reissueAllReferralRewards().catch((e) => console.error('Referral reissue failed:', e));
  res.json({ success: true, program });
});

// ---------------------------------------------------------------------------
// Email diagnostics
// ---------------------------------------------------------------------------
router.get('/email/status', requireRole('ADMIN'), async (_req, res) => {
  try {
    res.json({ success: true, ...(await verifyEmailTransport()) });
  } catch (err) {
    res.status(502).json({ success: false, provider: activeProviderName(), message: `Could not connect to the mail server: ${err.message}` });
  }
});

router.post('/email/test', requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await sendTestEmail(req.user.email);
    await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'EMAIL_TEST_SENT', entity: 'Email', newValue: result.provider, ip: req.ip });
    res.json({ success: true, provider: result.provider, sentTo: req.user.email });
  } catch (err) {
    res.status(502).json({ success: false, message: `Sending failed: ${err.message}` });
  }
});

// Reshapes company_profile into the frontend's StoreSettings contract
// (src/types/index.ts) — camelCase field names it already expects.
function toApiSettings(profile) {
  if (!profile) return null;
  return {
    storeName: profile.name,
    tagline: profile.tagline,
    phone: profile.phonePrimary,
    altPhone: profile.phoneSecondary,
    email: profile.email,
    supportEmail: profile.supportEmail,
    whatsappNumber: profile.whatsappNumber,
    address: `${profile.address || ''}${profile.poBox ? ', ' + profile.poBox : ''}`,
    currency: profile.currency,
    currencySymbol: profile.currencySymbol,
    taxRate: Number(profile.taxRate),
    pricesIncludeTax: profile.pricesIncludeTax,
    freeShippingThreshold: Number(profile.freeShippingThreshold),
    mpesaPaybill: profile.mpesaPaybill,
    mpesaAccountNo: profile.mpesaAccountNo,
    mpesaTill: profile.mpesaTill,
    kraPin: profile.kraPin || '',
    receiptNotes: profile.receiptNotes || '',
    bankName: profile.bankName || '',
    bankBranch: profile.bankBranch || '',
    bankAccountName: profile.bankAccountName || '',
    bankAccountNumber: profile.bankAccountNumber || '',
    bankSwiftCode: profile.bankSwiftCode || '',
    bankTransferHoldHours: Number(profile.bankTransferHoldHours ?? 48),
    codMaxOrderAmount: profile.codMaxOrderAmount != null ? Number(profile.codMaxOrderAmount) : null,
    theme: { primaryColor: '#0b132b', secondaryColor: '#1c2541', accentColor: '#0284c7', highlightColor: '#06b6d4' },
    socialLinks: profile.socialLinks || {}
  };
}

// Legacy `deliveryZones` field for older UI: the active fixed options.
async function publicDeliveryZones() {
  const cfg = await getDeliveryConfig();
  return cfg.options;
}

// Fields that must never reach an unauthenticated client (no M-Pesa secrets
// live on company_profile at all — this endpoint only ever exposes the
// public-safe subset above).
router.get('/settings/public', async (req, res) => {
  const profile = await getCompanyProfile();
  const [deliveryZones, stores] = await Promise.all([publicDeliveryZones(), listStores()]);
  const settings = toApiSettings(profile);
  if (settings) delete settings.receiptNotes;
  res.json({ success: true, settings, deliveryZones, stores });
});

// 1. Executive Dashboard Analytics
router.get('/analytics', requirePermission('reports:read'), async (req, res) => {
  const analytics = await getDashboardAnalytics();
  res.json({ success: true, ...analytics });
});

// Customers: server-side search / filter / sort / paging, plus a full profile.
router.get('/customers', requirePermission('customers:read'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...(await listCustomers(req.query)) });
});

router.get('/customers/:id', requirePermission('customers:read'), async (req, res) => {
  const detail = await getCustomerDetail(String(req.params.id));
  if (!detail) return res.status(404).json({ success: false, message: 'Customer not found' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...detail });
});

// Deactivating signs the customer out everywhere and blocks sign-in; their
// orders and history stay intact.
router.patch('/customers/:id/status', requirePermission('users:deactivate'), async (req, res) => {
  if (!isUuid(req.params.id) || typeof req.body?.isActive !== 'boolean') return res.status(400).json({ success: false, message: 'Invalid request' });
  const detail = await getCustomerDetail(req.params.id);
  if (!detail) return res.status(404).json({ success: false, message: 'Customer not found' });
  const isActive = req.body.isActive;
  await setUserActive(req.params.id, isActive);
  if (!isActive) await revokeAllSessionsForUser(req.params.id);
  await logAudit({
    actorId: req.user.id, actorName: req.user.name, action: isActive ? 'CUSTOMER_REACTIVATED' : 'CUSTOMER_DEACTIVATED',
    entity: 'User', entityId: req.params.id, previousValue: detail.customer.isActive ? 'Active' : 'Inactive', newValue: isActive ? 'Active' : 'Inactive', ip: req.ip
  });
  res.json({ success: true, isActive });
});

// Finance dashboard: revenue, COGS, expenses and profit for a date range.
// Supports ?salesChannel=online|pos and ?storeId=<uuid> for sliced views.
router.get('/finance/overview', requirePermission('reports:read'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...(await getFinanceOverview(req.query)) });
});

// Channel-split summary: returns online vs pos totals for the selected period.
router.get('/finance/channel-split', requirePermission('reports:read'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const [online, pos] = await Promise.all([
    getFinanceOverview({ ...req.query, salesChannel: 'online' }),
    getFinanceOverview({ ...req.query, salesChannel: 'pos' })
  ]);
  res.json({ success: true, online: online.current, pos: pos.current });
});

// Expenses (admin only — individual records include salaries).
const expenseSchema = z.object({
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date of the expense')
    .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00+03:00`).getTime()), 'Choose a valid date')
    .refine((d) => d <= new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }), 'The date cannot be in the future'),
  category: z.enum(EXPENSE_CATEGORIES, { message: 'Choose a category' }),
  description: z.string().trim().min(2, 'Describe the expense').max(300),
  amount: z.coerce.number({ message: 'Enter the amount' }).positive('The amount must be greater than zero').max(1e9),
  paymentMethod: z.string().trim().max(60).optional().nullable(),
  reference: z.string().trim().max(100).optional().nullable()
});

router.get('/expenses', requirePermission('expenses:read'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, categories: EXPENSE_CATEGORIES, ...(await listExpenses(req.query)) });
});

router.post('/expenses', requirePermission('expenses:write'), async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const expense = await createExpense({ ...parsed.data, paymentMethod: parsed.data.paymentMethod || null, reference: parsed.data.reference || null }, req.user.id);
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'EXPENSE_CREATE', entity: 'Expense', entityId: expense.id, newValue: `${expense.category}: KES ${expense.amount} (${expense.spentOn})`, ip: req.ip });
  res.status(201).json({ success: true, expense });
});

router.put('/expenses/:id', requirePermission('expenses:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Expense not found' });
  const existing = await findExpense(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Expense not found' });
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const expense = await updateExpense(existing.id, { ...parsed.data, paymentMethod: parsed.data.paymentMethod || null, reference: parsed.data.reference || null });
  await logAudit({
    actorId: req.user.id, actorName: req.user.name, action: 'EXPENSE_UPDATE', entity: 'Expense', entityId: expense.id,
    previousValue: `${existing.category}: KES ${existing.amount} (${existing.spentOn})`, newValue: `${expense.category}: KES ${expense.amount} (${expense.spentOn})`, ip: req.ip
  });
  res.json({ success: true, expense });
});

router.delete('/expenses/:id', requirePermission('expenses:write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Expense not found' });
  const deleted = await deleteExpense(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: 'Expense not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'EXPENSE_DELETE', entity: 'Expense', entityId: deleted.id, previousValue: `${deleted.category}: KES ${deleted.amount} (${deleted.spentOn})`, ip: req.ip });
  res.json({ success: true });
});

// 2. Audit Logs
router.get('/audit-logs', requireRole('ADMIN'), async (req, res) => {
  const logs = await listAuditLogs();
  res.json({ success: true, logs });
});

// 3. Settings
router.get('/settings', requireRole('ADMIN'), async (req, res) => {
  const profile = await getCompanyProfile();
  const [deliveryZones, stores] = await Promise.all([publicDeliveryZones(), listStores()]);
  res.json({ success: true, settings: toApiSettings(profile), deliveryZones, stores });
});

// Delivery options/bands are managed under /api/delivery/admin, not here.
router.put('/settings', requireRole('ADMIN'), async (req, res) => {
  const { settings, stores } = req.body;

  let profile = await getCompanyProfile();
  if (settings) {
    const [addressLine] = (settings.address || '').split(',');
    profile = await updateCompanyProfile({
      name: settings.storeName,
      tagline: settings.tagline,
      phonePrimary: settings.phone,
      phoneSecondary: settings.altPhone,
      email: settings.email,
      supportEmail: settings.supportEmail,
      whatsappNumber: settings.whatsappNumber,
      address: addressLine || settings.address,
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      taxRate: settings.taxRate != null ? String(settings.taxRate) : undefined,
      pricesIncludeTax: settings.pricesIncludeTax,
      freeShippingThreshold: settings.freeShippingThreshold != null ? String(settings.freeShippingThreshold) : undefined,
      mpesaPaybill: settings.mpesaPaybill,
      mpesaAccountNo: settings.mpesaAccountNo,
      mpesaTill: settings.mpesaTill,
      kraPin: settings.kraPin !== undefined ? String(settings.kraPin).trim().slice(0, 20) || null : undefined,
      receiptNotes: settings.receiptNotes !== undefined ? String(settings.receiptNotes).slice(0, 2000) || null : undefined,
      bankName: settings.bankName !== undefined ? String(settings.bankName).trim().slice(0, 120) || null : undefined,
      bankBranch: settings.bankBranch !== undefined ? String(settings.bankBranch).trim().slice(0, 120) || null : undefined,
      bankAccountName: settings.bankAccountName !== undefined ? String(settings.bankAccountName).trim().slice(0, 160) || null : undefined,
      bankAccountNumber: settings.bankAccountNumber !== undefined ? String(settings.bankAccountNumber).replace(/\s+/g, '').slice(0, 40) || null : undefined,
      bankSwiftCode: settings.bankSwiftCode !== undefined ? String(settings.bankSwiftCode).trim().toUpperCase().slice(0, 20) || null : undefined,
      bankTransferHoldHours: settings.bankTransferHoldHours != null ? Math.min(168, Math.max(6, Math.round(Number(settings.bankTransferHoldHours) || 48))) : undefined,
      codMaxOrderAmount: settings.codMaxOrderAmount !== undefined
        ? (settings.codMaxOrderAmount === null || settings.codMaxOrderAmount === '' || Number(settings.codMaxOrderAmount) <= 0 ? null : String(Number(settings.codMaxOrderAmount)))
        : undefined,
      socialLinks: settings.socialLinks
    });
  }
  if (Array.isArray(stores)) await replaceStores(stores.map(({ id, coordinates, ...s }) => s));

  await logAudit({
    actorId: req.user.id, actorName: req.user.name, action: 'SETTINGS_UPDATE', entity: 'Store Settings',
    entityId: profile?.id, previousValue: 'Previous Settings', newValue: 'Updated Configuration', ip: req.ip
  });

  const [newZones, newStores] = await Promise.all([publicDeliveryZones(), listStores()]);
  res.json({ success: true, settings: toApiSettings(profile), deliveryZones: newZones, stores: newStores });
});

// 4. Newsletter Subscribers
router.get('/subscribers', requireRole('ADMIN'), async (req, res) => {
  const subscribers = await listSubscribers();
  res.json({ success: true, subscribers });
});

router.post('/newsletter', newsletterLimiter, async (req, res) => {
  const parsed = z.string().trim().toLowerCase().email().max(200).safeParse(req.body?.email);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Valid email is required' });
  }
  await subscribe(parsed.data);
  res.json({ success: true, message: 'Thank you for subscribing to Internext Business System updates!' });
});

// ---------------------------------------------------------------------------
// POS System
// ---------------------------------------------------------------------------
const posCheckoutSchema = z.object({
  storeId: z.string().uuid(),
  customer: z.object({
    name: z.string().trim().max(100).optional(),
    email: z.string().trim().email().max(200).optional().or(z.literal('')),
    phone: z.string().trim().max(30).optional().or(z.literal(''))
  }).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().positive()
  })).min(1, 'Cart is empty'),
  paymentMethod: z.string().min(1).max(60),
  amountPaid: z.number().min(0),
  couponCode: z.string().max(30).optional().nullable()
});

router.post('/pos/checkout', requirePermission('orders:write'), async (req, res) => {
  try {
    const parsed = posCheckoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });

    const result = await createPosOrder({
      ...parsed.data,
      servedBy: req.user.id,
      userId: req.body.userId || null // Optional if mapping to existing online account
    });

    await logAudit({
      actorId: req.user.id, actorName: req.user.name, action: 'POS_CHECKOUT',
      entity: 'Order', entityId: result.order.id, newValue: `POS Sale ${result.order.orderNumber} for KES ${result.order.total}`, ip: req.ip
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message, code: err.code || 'POS_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// Store Stock — manage branch-level inventory levels
// ---------------------------------------------------------------------------

// GET /api/admin/pos/store-stock?storeId=<uuid>  — list stock entries for a branch
router.get('/pos/store-stock', requirePermission('inventory:read'), async (req, res) => {
  const { storeId } = req.query;
  if (!isUuid(String(storeId || ''))) return res.status(400).json({ success: false, message: 'storeId is required' });
  const rows = await db
    .select({ id: storeStock.id, storeId: storeStock.storeId, productId: storeStock.productId, variantId: storeStock.variantId, stock: storeStock.stock, updatedAt: storeStock.updatedAt, productName: products.name, variantName: productVariants.name })
    .from(storeStock)
    .leftJoin(products, eq(storeStock.productId, products.id))
    .leftJoin(productVariants, eq(storeStock.variantId, productVariants.id))
    .where(eq(storeStock.storeId, String(storeId)));
  res.json({ success: true, stock: rows });
});

// PUT /api/admin/pos/store-stock  — upsert stock level for a product/variant at a branch
const storeStockSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  stock: z.number().int().min(0)
});

router.put('/pos/store-stock', requirePermission('inventory:write'), async (req, res) => {
  const parsed = storeStockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const { storeId, productId, variantId, stock } = parsed.data;
  const [row] = await db
    .insert(storeStock).values({ storeId, productId, variantId: variantId || null, stock })
    .onConflictDoUpdate({ target: [storeStock.storeId, storeStock.productId, storeStock.variantId], set: { stock, updatedAt: new Date() } })
    .returning();
  await logAudit({
    actorId: req.user.id, actorName: req.user.name, action: 'STORE_STOCK_UPDATE', entity: 'StoreStock',
    entityId: row.id, newValue: `Stock set to ${stock}`, ip: req.ip
  });
  res.json({ success: true, row });
});

export default router;
