import express from 'express';
import { getDashboardAnalytics } from '../repositories/analyticsRepo.js';
import { listAuditLogs, logAudit } from '../repositories/auditLogsRepo.js';
import { getCompanyProfile, updateCompanyProfile, listDeliveryZones, replaceDeliveryZones, listStores, replaceStores } from '../repositories/companyProfileRepo.js';
import { listSubscribers, subscribe } from '../repositories/newsletterRepo.js';
import { requireRole, requirePermission } from '../middleware/authorize.js';
import { referralRewardSettingsSchema, formatZodError } from '../schemas/authSchemas.js';
import { getReferralRewardSettings, saveReferralRewardSettings } from '../repositories/referralRepo.js';

const router = express.Router();

router.get('/referral-rewards', requireRole('ADMIN'), async (_req, res) => {
  res.json({ success: true, settings: await getReferralRewardSettings() });
});

router.put('/referral-rewards', requireRole('ADMIN'), async (req, res) => {
  const parsed = referralRewardSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const settings = await saveReferralRewardSettings({ ...parsed.data, updatedBy: req.user.id });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'REFERRAL_REWARDS_UPDATED', entity: 'Referral Rewards', entityId: String(settings.id), newValue: `${settings.referralsRequired} referrals for ${settings.discountValue}${settings.discountType === 'percentage' ? '%' : ' KES'}`, ip: req.ip });
  res.json({ success: true, settings });
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
    theme: { primaryColor: '#0b132b', secondaryColor: '#1c2541', accentColor: '#0284c7', highlightColor: '#06b6d4' },
    socialLinks: profile.socialLinks || {}
  };
}

// Fields that must never reach an unauthenticated client (no M-Pesa secrets
// live on company_profile at all — this endpoint only ever exposes the
// public-safe subset above).
router.get('/settings/public', async (req, res) => {
  const profile = await getCompanyProfile();
  const [deliveryZones, stores] = await Promise.all([listDeliveryZones(), listStores()]);
  res.json({ success: true, settings: toApiSettings(profile), deliveryZones, stores });
});

// 1. Executive Dashboard Analytics
router.get('/analytics', requirePermission('reports:read'), async (req, res) => {
  const analytics = await getDashboardAnalytics();
  res.json({ success: true, ...analytics });
});

// 2. Audit Logs
router.get('/audit-logs', requireRole('ADMIN'), async (req, res) => {
  const logs = await listAuditLogs();
  res.json({ success: true, logs });
});

// 3. Settings
router.get('/settings', requireRole('ADMIN'), async (req, res) => {
  const profile = await getCompanyProfile();
  const [deliveryZones, stores] = await Promise.all([listDeliveryZones(), listStores()]);
  res.json({ success: true, settings: toApiSettings(profile), deliveryZones, stores });
});

router.put('/settings', requireRole('ADMIN'), async (req, res) => {
  const { settings, deliveryZones, stores } = req.body;

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
      socialLinks: settings.socialLinks
    });
  }
  if (deliveryZones) await replaceDeliveryZones(deliveryZones.map(({ id, ...z }) => ({ ...z, fee: String(z.fee), freeThreshold: z.freeThreshold != null ? String(z.freeThreshold) : null })));
  if (stores) await replaceStores(stores.map(({ id, coordinates, ...s }) => s));

  await logAudit({
    actorId: req.user.id, actorName: req.user.name, action: 'SETTINGS_UPDATE', entity: 'Store Settings',
    entityId: profile?.id, previousValue: 'Previous Settings', newValue: 'Updated Configuration', ip: req.ip
  });

  const [newZones, newStores] = await Promise.all([listDeliveryZones(), listStores()]);
  res.json({ success: true, settings: toApiSettings(profile), deliveryZones: newZones, stores: newStores });
});

// 4. Newsletter Subscribers
router.get('/subscribers', requireRole('ADMIN'), async (req, res) => {
  const subscribers = await listSubscribers();
  res.json({ success: true, subscribers });
});

router.post('/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email is required' });
  }
  await subscribe(email);
  res.json({ success: true, message: 'Thank you for subscribing to Internext Business System updates!' });
});

export default router;
