import { and, count, desc, eq, gt, gte, isNull, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db/client.js';
import {
  coupons, referralAttributions, referralCodes, referralRewardGrants, referralRewardPrograms, referralRewards, users
} from '../db/schema.js';

export const REFERRAL_CODE_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
// Abuse limit: referred sign-ups for one referrer from a single IP per day.
const MAX_SIGNUPS_PER_IP_PER_REFERRER = 2;

// Crockford base32 without I, L, O, U — unambiguous when read aloud or typed.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function randomCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % 32];
  return `IN-${out}`;
}

export class ReferralError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

export async function getActiveReferralCode(userId) {
  const [row] = await db.select().from(referralCodes)
    .where(and(eq(referralCodes.userId, userId), isNull(referralCodes.revokedAt), gt(referralCodes.expiresAt, new Date())))
    .orderBy(desc(referralCodes.createdAt)).limit(1);
  return row || null;
}

// Issues a new 3-hour code and revokes the user's previous active code(s).
export async function generateReferralCode(userId, { ip } = {}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'referral-code:' + userId}))`);

    const [recent] = await tx.select({ total: count() }).from(referralCodes)
      .where(and(eq(referralCodes.userId, userId), gt(referralCodes.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
    if (Number(recent?.total || 0) >= MAX_CODES_PER_HOUR) {
      throw new ReferralError('You have generated several codes in the last hour. Please use your current code or try again later.', 429);
    }

    await tx.update(referralCodes).set({ revokedAt: new Date() })
      .where(and(eq(referralCodes.userId, userId), isNull(referralCodes.revokedAt)));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomCode();
      const [row] = await tx.insert(referralCodes)
        .values({ userId, code, expiresAt: new Date(Date.now() + REFERRAL_CODE_TTL_MS), createdIp: ip || null })
        .onConflictDoNothing()
        .returning();
      if (row) return row;
    }
    throw new ReferralError('Could not generate a unique code. Please try again.', 500);
  });
}

// Server-side validation of a code entered at signup.
export async function resolveReferralCode(rawCode, tx = db) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^IN-[0-9A-Z]{8}$/.test(code)) return { error: 'That referral code is not valid.' };
  const [row] = await tx.select({
    id: referralCodes.id, userId: referralCodes.userId, expiresAt: referralCodes.expiresAt, revokedAt: referralCodes.revokedAt,
    referrerActive: users.isActive
  }).from(referralCodes).innerJoin(users, eq(users.id, referralCodes.userId))
    .where(eq(referralCodes.code, code)).limit(1);
  if (!row || row.revokedAt || !row.referrerActive) return { error: 'That referral code is not valid.' };
  if (row.expiresAt <= new Date()) return { error: 'That referral code has expired. Ask your friend for a fresh code.' };
  return { codeId: row.id, referrerId: row.userId };
}

// Called inside the signup transaction once the new user row exists.
export async function attributeReferral(tx, { referrerId, referredUserId, codeId, ip, referredEmail }) {
  if (referrerId === referredUserId) return null;

  const [referrer] = await tx.select({ email: users.email }).from(users).where(eq(users.id, referrerId)).limit(1);
  // Same mailbox with "+tag" variations is the same person.
  const canonical = (email) => {
    const [local, domain] = String(email || '').toLowerCase().split('@');
    return `${local.split('+')[0]}@${domain}`;
  };
  let status = 'pending';
  if (referrer && canonical(referrer.email) === canonical(referredEmail)) status = 'rejected';

  if (status === 'pending' && ip) {
    const [sameIp] = await tx.select({ total: count() }).from(referralAttributions)
      .where(and(eq(referralAttributions.referrerId, referrerId), eq(referralAttributions.ip, ip),
        gt(referralAttributions.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))));
    if (Number(sameIp?.total || 0) >= MAX_SIGNUPS_PER_IP_PER_REFERRER) status = 'rejected';
  }

  const [row] = await tx.insert(referralAttributions)
    .values({ referrerId, referredUserId, referralCodeId: codeId, ip: ip || null, status })
    .onConflictDoNothing()
    .returning();
  return row || null;
}

// A referral counts once the referred account verifies its email.
export async function qualifyReferral(referredUserId) {
  const [row] = await db.update(referralAttributions)
    .set({ status: 'qualified', qualifiedAt: new Date() })
    .where(and(eq(referralAttributions.referredUserId, referredUserId), eq(referralAttributions.status, 'pending')))
    .returning();
  if (row) await issueReferralRewards(row.referrerId);
  return row || null;
}

// ---------------------------------------------------------------------------
// Reward programs
// ---------------------------------------------------------------------------

function toApiProgram(p) {
  return {
    ...p,
    value: Number(p.value),
    minOrderAmount: Number(p.minOrderAmount || 0),
    maxDiscountAmount: p.maxDiscountAmount == null ? null : Number(p.maxDiscountAmount),
    tiers: Array.isArray(p.tiers) ? p.tiers : []
  };
}

export async function listRewardPrograms() {
  const rows = await db.select().from(referralRewardPrograms).orderBy(desc(referralRewardPrograms.createdAt));
  const grants = await db.select({ programId: referralRewardGrants.programId, total: count() })
    .from(referralRewardGrants).groupBy(referralRewardGrants.programId);
  const grantCount = Object.fromEntries(grants.map((g) => [g.programId, Number(g.total)]));
  return rows.map((p) => ({ ...toApiProgram(p), rewardsIssued: grantCount[p.id] || 0 }));
}

function programColumns(data) {
  return {
    name: data.name,
    description: data.description || null,
    rewardModel: data.rewardModel,
    valueType: data.valueType,
    value: String(data.rewardModel === 'tiered' ? 0 : data.value),
    thresholdCount: data.rewardModel === 'per_referral' ? 1 : data.thresholdCount,
    tiers: data.rewardModel === 'tiered' ? [...data.tiers].sort((a, b) => a.referrals - b.referrals) : [],
    maxRewardsPerUser: data.maxRewardsPerUser ?? null,
    minOrderAmount: String(data.minOrderAmount ?? 0),
    maxDiscountAmount: data.maxDiscountAmount == null ? null : String(data.maxDiscountAmount),
    couponValidDays: data.couponValidDays,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
    isActive: data.isActive
  };
}

export async function createRewardProgram(data, createdBy) {
  const [row] = await db.insert(referralRewardPrograms).values({ ...programColumns(data), createdBy }).returning();
  return toApiProgram(row);
}

export async function updateRewardProgram(id, data) {
  const [row] = await db.update(referralRewardPrograms)
    .set({ ...programColumns(data), updatedAt: new Date() })
    .where(eq(referralRewardPrograms.id, id)).returning();
  return row ? toApiProgram(row) : null;
}

export async function setRewardProgramActive(id, isActive) {
  const [row] = await db.update(referralRewardPrograms).set({ isActive, updatedAt: new Date() })
    .where(eq(referralRewardPrograms.id, id)).returning();
  return row ? toApiProgram(row) : null;
}

// Which milestones a referrer has earned under a program, given their count of
// qualified referrals. Each entry becomes one coupon; keys make it idempotent.
export function earnedMilestones(program, qualifiedCount) {
  const value = Number(program.value);
  const milestones = [];
  switch (program.rewardModel) {
    case 'one_time':
      if (qualifiedCount >= program.thresholdCount) milestones.push({ key: 'one_time', referrals: program.thresholdCount, value });
      break;
    case 'per_referral':
      for (let n = 1; n <= qualifiedCount; n += 1) milestones.push({ key: `ref:${n}`, referrals: n, value });
      break;
    case 'recurring':
      for (let k = 1; k * program.thresholdCount <= qualifiedCount; k += 1) {
        milestones.push({ key: `recurring:${k}`, referrals: k * program.thresholdCount, value });
      }
      break;
    case 'tiered':
      for (const tier of program.tiers || []) {
        if (qualifiedCount >= Number(tier.referrals)) milestones.push({ key: `tier:${tier.referrals}`, referrals: Number(tier.referrals), value: Number(tier.value) });
      }
      break;
    default:
      break;
  }
  return program.maxRewardsPerUser ? milestones.slice(0, program.maxRewardsPerUser) : milestones;
}

function programIsLive(program, now = new Date()) {
  return program.isActive && (!program.startsAt || program.startsAt <= now) && (!program.endsAt || program.endsAt > now);
}

// Issues any newly-earned rewards for one referrer. Serialised per referrer
// with an advisory lock; the grants unique key is the second line of defence.
export async function issueReferralRewards(referrerId) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'referral-rewards:' + referrerId}))`);
    const now = new Date();
    const programs = (await tx.select().from(referralRewardPrograms).where(eq(referralRewardPrograms.isActive, true)))
      .filter((p) => programIsLive(p, now));
    if (!programs.length) return [];

    const issued = [];
    for (const program of programs) {
      // Only referrals that qualified during the program window count toward it.
      const conditions = [eq(referralAttributions.referrerId, referrerId), eq(referralAttributions.status, 'qualified')];
      if (program.startsAt) conditions.push(gte(referralAttributions.qualifiedAt, program.startsAt));
      if (program.endsAt) conditions.push(lte(referralAttributions.qualifiedAt, program.endsAt));
      const [qualified] = await tx.select({ total: count() }).from(referralAttributions).where(and(...conditions));

      const milestones = earnedMilestones(program, Number(qualified?.total || 0));
      if (!milestones.length) continue;

      const existing = await tx.select({ key: referralRewardGrants.milestoneKey }).from(referralRewardGrants)
        .where(and(eq(referralRewardGrants.programId, program.id), eq(referralRewardGrants.userId, referrerId)));
      const have = new Set(existing.map((e) => e.key));

      for (const m of milestones) {
        if (have.has(m.key) || !(m.value > 0)) continue;
        const couponCode = `RWD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        await tx.insert(coupons).values({
          code: couponCode,
          discountType: program.valueType,
          discountValue: String(program.valueType === 'percentage' ? Math.min(m.value, 100) : m.value),
          minOrderAmount: program.minOrderAmount,
          maxDiscountAmount: program.maxDiscountAmount,
          validFrom: now,
          validUntil: new Date(now.getTime() + program.couponValidDays * 24 * 60 * 60 * 1000),
          usageLimit: 1,
          perUserLimit: 1,
          assignedUserId: referrerId,
          source: 'referral',
          description: `${program.name} — reward for ${m.referrals} qualified referral${m.referrals === 1 ? '' : 's'}`
        });
        const [grant] = await tx.insert(referralRewardGrants).values({
          programId: program.id, userId: referrerId, milestoneKey: m.key, referralCount: m.referrals, couponCode
        }).returning();
        issued.push(grant);
      }
    }
    return issued;
  });
}

// Re-run issuance for everyone with qualified referrals (after an admin creates
// or edits a program). Bounded by the number of distinct referrers.
export async function reissueAllReferralRewards() {
  const referrers = await db.selectDistinct({ id: referralAttributions.referrerId }).from(referralAttributions)
    .where(eq(referralAttributions.status, 'qualified'));
  for (const r of referrers) await issueReferralRewards(r.id);
}

// ---------------------------------------------------------------------------
// Customer-facing summary
// ---------------------------------------------------------------------------

function maskName(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'Customer';
  return first.length <= 2 ? `${first[0]}*` : `${first.slice(0, 2)}${'*'.repeat(Math.min(first.length - 2, 4))}`;
}

export async function getReferralSummary(userId) {
  const [activeCode, statusCounts, history, grants, legacy, programs] = await Promise.all([
    getActiveReferralCode(userId),
    db.select({ status: referralAttributions.status, total: count() }).from(referralAttributions)
      .where(eq(referralAttributions.referrerId, userId)).groupBy(referralAttributions.status),
    db.select({ name: users.name, status: referralAttributions.status, createdAt: referralAttributions.createdAt, qualifiedAt: referralAttributions.qualifiedAt })
      .from(referralAttributions).innerJoin(users, eq(users.id, referralAttributions.referredUserId))
      .where(eq(referralAttributions.referrerId, userId)).orderBy(desc(referralAttributions.createdAt)).limit(25),
    db.select({
      couponCode: referralRewardGrants.couponCode, referralCount: referralRewardGrants.referralCount, createdAt: referralRewardGrants.createdAt,
      programName: referralRewardPrograms.name, usedCount: coupons.usedCount, validUntil: coupons.validUntil,
      discountType: coupons.discountType, discountValue: coupons.discountValue
    }).from(referralRewardGrants)
      .innerJoin(referralRewardPrograms, eq(referralRewardPrograms.id, referralRewardGrants.programId))
      .leftJoin(coupons, eq(coupons.code, referralRewardGrants.couponCode))
      .where(eq(referralRewardGrants.userId, userId)).orderBy(desc(referralRewardGrants.createdAt)),
    db.select({ couponCode: referralRewards.couponCode }).from(referralRewards).where(eq(referralRewards.userId, userId)),
    db.select().from(referralRewardPrograms).where(eq(referralRewardPrograms.isActive, true))
  ]);

  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, Number(s.total)]));
  const qualified = counts.qualified || 0;
  const grantCodes = new Set(grants.map((g) => g.couponCode));
  const now = new Date();

  return {
    activeCode: activeCode ? { code: activeCode.code, expiresAt: activeCode.expiresAt } : null,
    codeTtlHours: REFERRAL_CODE_TTL_MS / 3_600_000,
    totalReferrals: (counts.pending || 0) + qualified + (counts.rejected || 0),
    qualifiedReferrals: qualified,
    pendingReferrals: counts.pending || 0,
    history: history.map((h) => ({ name: maskName(h.name), status: h.status, joinedAt: h.createdAt, qualifiedAt: h.qualifiedAt })),
    rewards: grants.map((g) => ({
      couponCode: g.couponCode,
      programName: g.programName,
      referralCount: g.referralCount,
      discountType: g.discountType,
      discountValue: g.discountValue == null ? null : Number(g.discountValue),
      validUntil: g.validUntil,
      status: g.usedCount ? 'redeemed' : g.validUntil && g.validUntil < now ? 'expired' : 'available',
      createdAt: g.createdAt
    })),
    legacyRewardCodes: legacy.map((l) => l.couponCode).filter((c) => !grantCodes.has(c)),
    programs: programs.filter((p) => programIsLive(p, now)).map((p) => {
      const api = toApiProgram(p);
      const horizon = qualified + Math.max(p.thresholdCount, ...api.tiers.map((t) => Number(t.referrals) || 0), 1);
      const next = earnedMilestones({ ...p, maxRewardsPerUser: null }, horizon).find((m) => m.referrals > qualified);
      return {
        id: api.id, name: api.name, description: api.description, rewardModel: api.rewardModel,
        valueType: api.valueType, value: api.value, thresholdCount: api.thresholdCount, tiers: api.tiers, endsAt: api.endsAt,
        nextMilestone: next ? { referrals: next.referrals, value: next.value } : null
      };
    })
  };
}

// Admin overview for the Referral Rewards page.
export async function getReferralAdminStats() {
  const byStatus = await db.select({ status: referralAttributions.status, total: count() })
    .from(referralAttributions).groupBy(referralAttributions.status);
  const [grants] = await db.select({ total: count() }).from(referralRewardGrants);
  const [redeemed] = await db.select({ total: count() }).from(referralRewardGrants)
    .innerJoin(coupons, eq(coupons.code, referralRewardGrants.couponCode)).where(gt(coupons.usedCount, 0));
  const [activeCodes] = await db.select({ total: count() }).from(referralCodes)
    .where(and(isNull(referralCodes.revokedAt), gt(referralCodes.expiresAt, new Date())));
  return {
    attributions: Object.fromEntries(byStatus.map((s) => [s.status, Number(s.total)])),
    rewardsIssued: Number(grants?.total || 0),
    rewardsRedeemed: Number(redeemed?.total || 0),
    activeCodes: Number(activeCodes?.total || 0)
  };
}
