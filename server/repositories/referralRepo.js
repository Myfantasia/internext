import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db/client.js';
import { coupons, referralRewardSettings, referralRewards, users } from '../db/schema.js';

export async function getReferralRewardSettings() {
  let [settings] = await db.select().from(referralRewardSettings).where(eq(referralRewardSettings.id, 1)).limit(1);
  if (!settings) {
    await db.insert(referralRewardSettings).values({ id: 1 }).onConflictDoNothing();
    [settings] = await db.select().from(referralRewardSettings).where(eq(referralRewardSettings.id, 1)).limit(1);
  }
  return settings;
}

export async function saveReferralRewardSettings({ referralsRequired, discountType, discountValue, minOrderAmount, maxDiscountAmount, isActive, updatedBy }) {
  const [settings] = await db.insert(referralRewardSettings).values({
    id: 1, referralsRequired, discountType, discountValue: String(discountValue),
    minOrderAmount: String(minOrderAmount ?? 0),
    maxDiscountAmount: maxDiscountAmount == null ? null : String(maxDiscountAmount),
    isActive, updatedBy, updatedAt: new Date()
  }).onConflictDoUpdate({
    target: referralRewardSettings.id,
    set: {
      referralsRequired, discountType, discountValue: String(discountValue),
      minOrderAmount: String(minOrderAmount ?? 0),
      maxDiscountAmount: maxDiscountAmount == null ? null : String(maxDiscountAmount),
      isActive, updatedBy, updatedAt: new Date()
    }
  }).returning();
  const referrers = await db.selectDistinct({ userId: users.referredBy }).from(users)
    .where(and(isNotNull(users.referredBy), isNotNull(users.emailVerifiedAt)));
  for (const referrer of referrers) {
    if (referrer.userId) await issueReferralRewards(referrer.userId);
  }
  return settings;
}

export async function getReferralSummary(userId) {
  const [[user], [total], [verified], rewards, settings] = await Promise.all([
    db.select({ referralCode: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ total: count() }).from(users).where(eq(users.referredBy, userId)),
    db.select({ total: count() }).from(users).where(and(eq(users.referredBy, userId), isNotNull(users.emailVerifiedAt))),
    db.select({
      couponCode: referralRewards.couponCode,
      referralCount: referralRewards.referralCount,
      createdAt: referralRewards.createdAt,
      usedCount: coupons.usedCount,
      validUntil: coupons.validUntil
    }).from(referralRewards).leftJoin(coupons, eq(referralRewards.couponCode, coupons.code))
      .where(eq(referralRewards.userId, userId)).orderBy(referralRewards.createdAt),
    getReferralRewardSettings()
  ]);
  return {
    referralCode: user?.referralCode || null,
    totalReferrals: Number(total?.total || 0),
    verifiedReferrals: Number(verified?.total || 0),
    rewards,
    settings: settings ? {
      referralsRequired: settings.referralsRequired,
      discountType: settings.discountType,
      discountValue: Number(settings.discountValue),
      minOrderAmount: Number(settings.minOrderAmount || 0),
      maxDiscountAmount: settings.maxDiscountAmount == null ? null : Number(settings.maxDiscountAmount),
      isActive: settings.isActive
    } : null
  };
}

// Run after a referred user's email is verified. A transaction lock and
// milestone uniqueness prevent concurrent verification requests from issuing
// duplicate coupon rewards.
export async function issueReferralRewards(referrerId) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(73190543)`);
    const [settings] = await tx.select().from(referralRewardSettings).where(eq(referralRewardSettings.id, 1)).limit(1);
    if (!settings?.isActive || settings.referralsRequired < 1) return [];

    const [referrals] = await tx.select({ total: count() }).from(users)
      .where(and(eq(users.referredBy, referrerId), isNotNull(users.emailVerifiedAt)));
    const [issued] = await tx.select({ total: count() }).from(referralRewards).where(eq(referralRewards.userId, referrerId));
    const milestoneLimit = Math.floor(Number(referrals?.total || 0) / settings.referralsRequired);
    const firstMilestone = Number(issued?.total || 0) + 1;
    const newlyIssued = [];

    for (let milestone = firstMilestone; milestone <= milestoneLimit; milestone += 1) {
      const couponCode = `REF-${crypto.randomBytes(7).toString('hex').toUpperCase()}`;
      await tx.insert(coupons).values({
        code: couponCode,
        discountType: settings.discountType,
        discountValue: settings.discountValue,
        minOrderAmount: settings.minOrderAmount,
        maxDiscountAmount: settings.maxDiscountAmount,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        usageLimit: 1,
        description: `Referral reward for ${settings.referralsRequired} verified referrals`
      });
      const [reward] = await tx.insert(referralRewards).values({
        userId: referrerId,
        milestone,
        referralCount: milestone * settings.referralsRequired,
        couponCode
      }).returning();
      newlyIssued.push(reward);
    }
    return newlyIssued;
  });
}
