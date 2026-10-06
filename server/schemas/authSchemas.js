import { z } from 'zod';
import { isValidCounty, normalizeKenyanPhone } from '../services/location.js';

const coordinate = z.union([z.number(), z.string().trim().max(20)]).optional().nullable();

// Location shared by signup and profile updates. Only what delivery needs:
// county + town are required, a street/building line and an optional map pin.
export const locationSchema = z.object({
  county: z.string().trim().refine(isValidCounty, { message: 'Choose your county from the list' }),
  town: z.string().trim().min(2, 'Enter your town or area').max(120),
  addressLine: z.string().trim().max(200).optional().nullable(),
  lat: coordinate,
  lng: coordinate,
  source: z.enum(['gps', 'map', 'manual']).optional()
});

const baseRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  password: z.string().min(1).max(200), // strength re-checked explicitly with a user-facing message
  referralCode: z.string().trim().max(40).optional()
});

export const registerSchema = baseRegisterSchema.extend({
  phone: z.string().trim().max(30).refine((v) => !!normalizeKenyanPhone(v), { message: 'Enter a valid Kenyan mobile number, e.g. 0712 345 678' }),
  location: locationSchema
});

// Staff accounts have no referral privileges, so no referral code is accepted.
export const staffRegisterSchema = baseRegisterSchema.omit({ referralCode: true }).extend({
  phone: z.string().trim().max(30).optional()
    .refine((v) => !v || !!normalizeKenyanPhone(v), { message: 'Enter a valid Kenyan mobile number, e.g. 0712 345 678' }),
  invitationCode: z.string().trim().max(100).optional()
});

export const staffCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(['ADMIN', 'SALES_MANAGER'])
});

// Admin-configured referral reward program (see referralRepo.earnedMilestones).
export const referralProgramSchema = z.object({
  name: z.string().trim().min(3, 'Give the reward a name').max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  rewardModel: z.enum(['one_time', 'per_referral', 'recurring', 'tiered']),
  valueType: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().min(0).max(10_000_000).default(0),
  thresholdCount: z.coerce.number().int().min(1).max(1000).default(1),
  tiers: z.array(z.object({
    referrals: z.coerce.number().int().min(1).max(10_000),
    value: z.coerce.number().positive().max(10_000_000)
  })).max(20).default([]),
  maxRewardsPerUser: z.union([z.coerce.number().int().min(1).max(1000), z.null()]).optional(),
  minOrderAmount: z.coerce.number().min(0).max(1e9).default(0),
  maxDiscountAmount: z.union([z.coerce.number().positive().max(1e9), z.null()]).optional(),
  couponValidDays: z.coerce.number().int().min(1).max(365).default(30),
  startsAt: z.union([z.coerce.date(), z.null()]).optional(),
  endsAt: z.union([z.coerce.date(), z.null()]).optional(),
  isActive: z.boolean().default(true)
}).superRefine((d, ctx) => {
  if (d.rewardModel === 'tiered') {
    if (!d.tiers.length) ctx.addIssue({ code: 'custom', path: ['tiers'], message: 'Add at least one tier' });
    const counts = d.tiers.map((t) => t.referrals);
    if (new Set(counts).size !== counts.length) ctx.addIssue({ code: 'custom', path: ['tiers'], message: 'Each tier needs a different referral count' });
    if (d.valueType === 'percentage' && d.tiers.some((t) => t.value > 100)) ctx.addIssue({ code: 'custom', path: ['tiers'], message: 'Percentage rewards cannot exceed 100%' });
  } else {
    if (!(d.value > 0)) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter the reward amount' });
    if (d.valueType === 'percentage' && d.value > 100) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Percentage rewards cannot exceed 100%' });
  }
  if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end date must be after the start date' });
});

// `portal` says which sign-in page was used: customers sign in on the store,
// staff only through the staff portal (/admin/login).
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  portal: z.enum(['store', 'staff']).default('store')
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200)
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(1).max(200)
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10)
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120).optional(),
  phone: z.string().trim().max(30).optional()
    .refine((v) => !v || !!normalizeKenyanPhone(v), { message: 'Enter a valid Kenyan mobile number, e.g. 0712 345 678' }),
  avatar: z.string().trim().max(500).optional(),
  addresses: z.array(z.record(z.string(), z.any())).max(10).optional(),
  location: locationSchema.optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: z.string().min(1).max(200)
});

export const changeEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  currentPassword: z.string().min(1, 'Enter your current password').max(200)
});

export const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200)
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(1).max(200)
});

export function formatZodError(error) {
  return error.issues.map((i) => i.message).join('; ');
}
