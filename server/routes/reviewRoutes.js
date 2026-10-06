import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  listApprovedReviews, getRatingSummary, listReviewsForModeration, listReviewsByUser, findReviewById,
  upsertReview, deleteReview, moderateReview, moderationRequired
} from '../repositories/reviewsRepo.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { requireAuth, requirePermission } from '../middleware/authorize.js';
import { can } from '../auth/permissions.js';
import { formatZodError } from '../schemas/authSchemas.js';
import { isUuid } from '../db/util.js';

const router = express.Router();

const writeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many review submissions. Please try again later.' } });

const reviewSchema = z.object({
  productId: z.string().uuid('Invalid product'),
  rating: z.coerce.number().int().min(1, 'Choose a rating from 1 to 5 stars').max(5, 'Choose a rating from 1 to 5 stars'),
  title: z.string().trim().max(120).optional().nullable(),
  comment: z.string().trim().min(10, 'Please write at least 10 characters').max(2000),
  userCity: z.string().trim().max(60).optional().nullable()
});

const moderationSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
  note: z.string().trim().max(300).optional()
});

// Public: approved reviews for one product + rating summary.
router.get('/', async (req, res) => {
  const { productId } = req.query;
  if (!isUuid(productId)) return res.status(400).json({ success: false, message: 'productId is required' });
  const [reviews, summary] = await Promise.all([listApprovedReviews(productId), getRatingSummary(productId)]);
  res.json({ success: true, reviews, summary });
});

// The signed-in customer's own reviews, including pending/rejected ones.
router.get('/mine', requireAuth, async (req, res) => {
  res.json({ success: true, reviews: await listReviewsByUser(req.user.id), moderationRequired: moderationRequired() });
});

// Staff moderation queue.
router.get('/moderation', requirePermission('reviews:read'), async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : undefined;
  res.json({ success: true, reviews: await listReviewsForModeration({ status }) });
});

// Create or update the customer's review of a product. Author identity comes
// from the session; "verified purchase" is computed from paid orders.
router.post('/', requirePermission('reviews:create'), writeLimiter, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const result = await upsertReview(req.user, parsed.data);
  if (result.error) return res.status(result.status).json({ success: false, message: result.error });
  res.status(result.created ? 201 : 200).json({
    success: true,
    review: result.review,
    message: result.review.status === 'pending' ? 'Thanks! Your review will appear once our team has checked it.' : 'Thanks! Your review is live.'
  });
});

// Owner deletes their review; staff with moderation rights may delete any.
router.delete('/:id', requireAuth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Review not found' });
  const review = await findReviewById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  const isOwner = review.userId === req.user.id;
  if (!isOwner && !can(req.user.role, 'reviews:moderate')) return res.status(403).json({ success: false, message: 'You can only delete your own reviews' });

  await deleteReview(review.id);
  if (!isOwner) {
    await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'REVIEW_MODERATED_DELETE', entity: 'Review', entityId: review.id, previousValue: review.comment?.slice(0, 200), newValue: 'Deleted', ip: req.ip });
  }
  res.json({ success: true, message: 'Review removed' });
});

router.patch('/:id/moderation', requirePermission('reviews:moderate'), async (req, res) => {
  const parsed = moderationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Review not found' });
  const review = await moderateReview(req.params.id, { ...parsed.data, moderatorId: req.user.id });
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'REVIEW_MODERATED', entity: 'Review', entityId: review.id, newValue: parsed.data.status, ip: req.ip });
  res.json({ success: true, review });
});

export default router;
