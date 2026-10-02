import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(30).optional(),
  password: z.string().min(1).max(200), // strength re-checked explicitly with a user-facing message
  referralCode: z.string().trim().max(40).optional()
});

export const staffRegisterSchema = registerSchema.extend({
  invitationCode: z.string().trim().max(100).optional()
});

export const staffCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(['ADMIN', 'SALES_MANAGER'])
});

export const referralRewardSettingsSchema = z.object({
  referralsRequired: z.coerce.number().int().min(1).max(1000),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().positive().max(1000000),
  minOrderAmount: z.coerce.number().min(0).max(100000000).default(0),
  maxDiscountAmount: z.coerce.number().positive().max(100000000).nullable().optional(),
  isActive: z.boolean()
}).superRefine((data, ctx) => {
  if (data.discountType === 'percentage' && data.discountValue > 100) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Percentage discount cannot exceed 100.' });
  }
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200)
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
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  avatar: z.string().trim().max(500).optional(),
  addresses: z.array(z.record(z.string(), z.any())).optional()
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
