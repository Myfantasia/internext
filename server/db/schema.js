import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
  check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'SALES_MANAGER', 'CUSTOMER']);
export const categoryKindEnum = pgEnum('category_kind', ['product', 'service']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed']);
// Kept aligned to the existing frontend contract (AdminOrders.tsx status
// dropdown, TrackOrderPage/OrderConfirmationPage rendering) rather than the
// abstract lifecycle from the spec, to avoid touching working UI — see
// server/repositories/ordersRepo.js for the canonical transition list.
export const orderStatusEnum = pgEnum('order_status', [
  'Pending',
  'Payment Pending',
  'Processing',
  'Packed',
  'Dispatched',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Returned',
  'Refunded'
]);
export const paymentStatusEnum = pgEnum('payment_status', ['Pending', 'Paid', 'Failed', 'Refunded', 'Pending (Cash On Delivery)', 'Cancelled']);
// Lifecycle of a single provider transaction (one order may have several
// attempts, e.g. a cancelled STK push followed by a successful card payment).
export const paymentAttemptStatusEnum = pgEnum('payment_attempt_status', ['pending', 'succeeded', 'failed', 'cancelled', 'refunded']);
export const reviewStatusEnum = pgEnum('review_status', ['pending', 'approved', 'rejected']);
export const referralRewardModelEnum = pgEnum('referral_reward_model', ['one_time', 'per_referral', 'recurring', 'tiered']);
export const couponRedemptionStatusEnum = pgEnum('coupon_redemption_status', ['reserved', 'redeemed', 'released']);
export const newsStatusEnum = pgEnum('news_status', ['draft', 'published', 'archived']);
export const newsKindEnum = pgEnum('news_kind', ['aggregated', 'guide']);
export const ticketStatusEnum = pgEnum('ticket_status', ['Open', 'In Progress', 'Resolved', 'Closed']);
export const ticketSenderEnum = pgEnum('ticket_sender', ['customer', 'staff']);

// ---------------------------------------------------------------------------
// Identity & Access
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  phone: text('phone'),
  role: userRoleEnum('role').notNull().default('CUSTOMER'),
  referralCode: text('referral_code').notNull().default(sql`'REF-' || upper(substr(md5(gen_random_uuid()::text), 1, 10))`),
  referredBy: uuid('referred_by').references(() => users.id, { onDelete: 'set null' }),
  avatarUrl: text('avatar_url'),
  addresses: jsonb('addresses').notNull().default(sql`'[]'::jsonb`),
  // Primary delivery location captured at signup (see server/services/location.js).
  county: text('county'),
  town: text('town'),
  addressLine: text('address_line'),
  locationLat: numeric('location_lat', { precision: 9, scale: 6 }),
  locationLng: numeric('location_lng', { precision: 9, scale: 6 }),
  locationSource: text('location_source'),
  isActive: boolean('is_active').notNull().default(true),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('users_email_unique').on(t.email),
  // One account per phone number. Phones are stored normalized (2547XXXXXXXX);
  // NULLs (staff without a phone) don't clash.
  uniqueIndex('users_phone_unique').on(t.phone),
  uniqueIndex('users_referral_code_unique').on(t.referralCode),
  index('users_referred_by_idx').on(t.referredBy),
  index('users_role_idx').on(t.role),
  index('users_county_idx').on(t.county)
]));

// Tracks issued sessions so JWT cookies can be revoked (logout / logout-all-devices)
// even though the JWT itself is stateless/self-verifying.
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userAgent: text('user_agent'),
  ip: text('ip'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true })
}, (t) => ([
  index('sessions_user_id_idx').on(t.userId),
  index('sessions_expires_at_idx').on(t.expiresAt)
]));

export const loginAttempts = pgTable('login_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  ip: text('ip'),
  success: boolean('success').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('login_attempts_email_idx').on(t.email, t.createdAt),
  index('login_attempts_ip_idx').on(t.ip, t.createdAt)
]));

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('email_verification_token_hash_unique').on(t.tokenHash)
]));

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('password_reset_token_hash_unique').on(t.tokenHash)
]));

// Sales-manager provisioning only — never used for ADMIN. Enforced in application logic.
export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  role: userRoleEnum('role').notNull().default('SALES_MANAGER'),
  tokenHash: text('token_hash').notNull(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('invites_token_hash_unique').on(t.tokenHash),
  check('invites_role_check', sql`${t.role} = 'SALES_MANAGER'`)
]));

// Single-use staff signup codes. Only their hash is stored; the raw code is
// returned to an ADMIN once so it can be shared with the intended staff member.
export const staffSignupCodes = pgTable('staff_signup_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  role: userRoleEnum('role').notNull(),
  codeHash: text('code_hash').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  consumedBy: uuid('consumed_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('staff_signup_codes_hash_unique').on(t.codeHash),
  index('staff_signup_codes_creator_idx').on(t.createdBy),
  check('staff_signup_codes_role_check', sql`${t.role} in ('ADMIN', 'SALES_MANAGER')`)
]));

// ---------------------------------------------------------------------------
// Company / Business Profile (singleton-style table, one active row)
// ---------------------------------------------------------------------------

export const companyProfile = pgTable('company_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().default('Internext Business System'),
  tagline: text('tagline').notNull().default('We Make Technology Happen'),
  poBox: text('po_box'),
  address: text('address'),
  phonePrimary: text('phone_primary'),
  phoneSecondary: text('phone_secondary'),
  email: text('email'),
  supportEmail: text('support_email'),
  whatsappNumber: text('whatsapp_number'),
  website: text('website'),
  logoUrl: text('logo_url'),
  socialLinks: jsonb('social_links').notNull().default(sql`'{}'::jsonb`),
  currency: text('currency').notNull().default('KES'),
  currencySymbol: text('currency_symbol').notNull().default('KES '),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('16'),
  pricesIncludeTax: boolean('prices_include_tax').notNull().default(true),
  freeShippingThreshold: numeric('free_shipping_threshold', { precision: 12, scale: 2 }).default('50000'),
  mpesaPaybill: text('mpesa_paybill'),
  mpesaAccountNo: text('mpesa_account_no'),
  mpesaTill: text('mpesa_till'),
  kraPin: text('kra_pin'),
  receiptNotes: text('receipt_notes'),
  // Bank transfer (shown on invoices and the order page for bank-transfer orders).
  bankName: text('bank_name'),
  bankBranch: text('bank_branch'),
  bankAccountName: text('bank_account_name'),
  bankAccountNumber: text('bank_account_number'),
  bankSwiftCode: text('bank_swift_code'),
  // Unpaid bank-transfer orders hold stock this long before auto-cancelling,
  // unless the customer has submitted transfer details awaiting verification.
  bankTransferHoldHours: integer('bank_transfer_hold_hours').notNull().default(48),
  // Pay on delivery is refused above this order total (null = no cap).
  codMaxOrderAmount: numeric('cod_max_order_amount', { precision: 12, scale: 2 }).default('150000'),
  // Delivery origin + rules for distance-based pricing (server/services/delivery.js).
  officeLat: numeric('office_lat', { precision: 9, scale: 6 }).default('-1.283300'),
  officeLng: numeric('office_lng', { precision: 9, scale: 6 }).default('36.825000'),
  // Straight-line distance is multiplied by this to approximate road distance.
  roadDistanceFactor: numeric('road_distance_factor', { precision: 4, scale: 2 }).notNull().default('1.30'),
  // Beyond the last band: charge this fee, or (when null) refuse and ask the customer to call.
  outOfRangeFee: numeric('out_of_range_fee', { precision: 12, scale: 2 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  kind: categoryKindEnum('kind').notNull().default('product'),
  parentId: uuid('parent_id'),
  description: text('description'),
  imageUrl: text('image_url'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('categories_slug_unique').on(t.slug)
]));

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  logoUrl: text('logo_url'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('brands_slug_unique').on(t.slug)
]));

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  sku: text('sku').notNull(),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
  shortSpecs: text('short_specs'),
  description: text('description'),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  compareAtPrice: numeric('compare_at_price', { precision: 12, scale: 2 }),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }),
  condition: text('condition'),
  warranty: text('warranty'),
  stock: integer('stock').notNull().default(0),
  reservedStock: integer('reserved_stock').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(4),
  rating: numeric('rating', { precision: 2, scale: 1 }).notNull().default('0'),
  reviewsCount: integer('reviews_count').notNull().default(0),
  isFeatured: boolean('is_featured').notNull().default(false),
  isFlashDeal: boolean('is_flash_deal').notNull().default(false),
  flashDealEnds: timestamp('flash_deal_ends', { withTimezone: true }),
  isNewArrival: boolean('is_new_arrival').notNull().default(false),
  isBestSeller: boolean('is_best_seller').notNull().default(false),
  thumbnailUrl: text('thumbnail_url'),
  images: jsonb('images').notNull().default(sql`'[]'::jsonb`),
  specs: jsonb('specs').notNull().default(sql`'{}'::jsonb`),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('products_slug_unique').on(t.slug),
  uniqueIndex('products_sku_unique').on(t.sku),
  index('products_category_idx').on(t.categoryId),
  index('products_brand_idx').on(t.brandId),
  // Storefront listing: active products filtered by category, sorted by price.
  index('products_active_category_price_idx').on(t.isActive, t.categoryId, t.price),
  index('products_active_featured_idx').on(t.isActive, t.isFeatured),
  index('products_created_at_idx').on(t.createdAt),
  // Full-text + trigram search indexes live in a custom migration
  // (they need the pg_trgm extension) — see server/db/migrations.
  check('products_price_nonneg', sql`${t.price} >= 0`),
  check('products_stock_nonneg', sql`${t.stock} >= 0`)
]));

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku').notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  stock: integer('stock').notNull().default(0),
  attributes: jsonb('attributes').notNull().default(sql`'{}'::jsonb`),
  imageUrl: text('image_url')
}, (t) => ([
  uniqueIndex('product_variants_sku_unique').on(t.sku),
  index('product_variants_product_idx').on(t.productId)
]));

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export const carts = pgTable('carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('carts_user_id_unique').on(t.userId)
]));

export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  cartId: uuid('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('cart_items_unique_line').on(t.cartId, t.productId, t.variantId),
  check('cart_items_qty_positive', sql`${t.quantity} > 0`)
]));

// ---------------------------------------------------------------------------
// Commerce configuration
// ---------------------------------------------------------------------------

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  discountType: discountTypeEnum('discount_type').notNull(),
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }).notNull(),
  minOrderAmount: numeric('min_order_amount', { precision: 12, scale: 2 }).default('0'),
  maxDiscountAmount: numeric('max_discount_amount', { precision: 12, scale: 2 }),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  description: text('description'),
  // Max redemptions per customer account (null = unlimited).
  perUserLimit: integer('per_user_limit'),
  // Empty arrays = applies to the whole cart.
  eligibleProductIds: jsonb('eligible_product_ids').notNull().default(sql`'[]'::jsonb`),
  eligibleCategoryIds: jsonb('eligible_category_ids').notNull().default(sql`'[]'::jsonb`),
  // Whether the discount may also apply to items already reduced by a flash deal.
  stackWithFlashDeals: boolean('stack_with_flash_deals').notNull().default(false),
  // Referral reward coupons are bound to the customer who earned them.
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'cascade' }),
  source: text('source').notNull().default('admin'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('coupons_code_unique').on(t.code),
  index('coupons_active_window_idx').on(t.isActive, t.validUntil),
  index('coupons_assigned_user_idx').on(t.assignedUserId),
  check('coupons_value_positive', sql`${t.discountValue} > 0`),
  check('coupons_window_order', sql`${t.validUntil} IS NULL OR ${t.validFrom} IS NULL OR ${t.validUntil} > ${t.validFrom}`)
]));

// One row per order that used a coupon. Reserved at order creation, redeemed
// on confirmed payment, released if payment fails/cancels — usage limits count
// reserved + redeemed rows under a row lock, so concurrent checkouts can't
// exceed them.
export const couponRedemptions = pgTable('coupon_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  couponId: uuid('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull(),
  status: couponRedemptionStatusEnum('status').notNull().default('reserved'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('coupon_redemptions_order_unique').on(t.orderId),
  index('coupon_redemptions_coupon_status_idx').on(t.couponId, t.status),
  index('coupon_redemptions_user_idx').on(t.couponId, t.userId)
]));

// Short-lived shareable referral codes (3 hours). Generating a new code revokes
// the user's previous active code. Only the code itself is shareable — it
// carries no other information about the referrer.
export const referralCodes = pgTable('referral_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdIp: text('created_ip'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('referral_codes_code_unique').on(t.code),
  index('referral_codes_user_created_idx').on(t.userId, t.createdAt)
]));

// Who referred whom. A user can be referred at most once. "qualified" means the
// referral counts toward rewards (referred account verified its email).
export const referralAttributions = pgTable('referral_attributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerId: uuid('referrer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  referredUserId: uuid('referred_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  referralCodeId: uuid('referral_code_id').references(() => referralCodes.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  ip: text('ip'),
  qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('referral_attributions_referred_unique').on(t.referredUserId),
  index('referral_attributions_referrer_status_idx').on(t.referrerId, t.status),
  check('referral_attributions_no_self', sql`${t.referrerId} <> ${t.referredUserId}`),
  check('referral_attributions_status_check', sql`${t.status} in ('pending', 'qualified', 'rejected')`)
]));

// Admin-configurable reward programs. Several can be active at once.
//  one_time     — single reward when the referrer reaches thresholdCount
//  per_referral — a reward for every qualified referral
//  recurring    — a reward every thresholdCount referrals (long-term loyalty)
//  tiered       — progressive: tiers = [{ referrals, value }], one reward per tier reached
export const referralRewardPrograms = pgTable('referral_reward_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  rewardModel: referralRewardModelEnum('reward_model').notNull(),
  valueType: discountTypeEnum('value_type').notNull(),
  value: numeric('value', { precision: 12, scale: 2 }).notNull().default('0'),
  thresholdCount: integer('threshold_count').notNull().default(1),
  tiers: jsonb('tiers').notNull().default(sql`'[]'::jsonb`),
  maxRewardsPerUser: integer('max_rewards_per_user'),
  minOrderAmount: numeric('min_order_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  maxDiscountAmount: numeric('max_discount_amount', { precision: 12, scale: 2 }),
  couponValidDays: integer('coupon_valid_days').notNull().default(30),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('referral_reward_programs_active_idx').on(t.isActive),
  check('referral_reward_programs_threshold_check', sql`${t.thresholdCount} > 0`)
]));

// One issued reward. milestoneKey makes issuance idempotent per program/user/milestone.
export const referralRewardGrants = pgTable('referral_reward_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id').notNull().references(() => referralRewardPrograms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  milestoneKey: text('milestone_key').notNull(),
  referralCount: integer('referral_count').notNull(),
  couponCode: text('coupon_code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('referral_reward_grants_unique').on(t.programId, t.userId, t.milestoneKey),
  uniqueIndex('referral_reward_grants_coupon_unique').on(t.couponCode),
  index('referral_reward_grants_user_idx').on(t.userId)
]));

// LEGACY (pre-programs). Kept so historical rewards remain visible; new
// rewards use referral_reward_programs / referral_reward_grants.
export const referralRewardSettings = pgTable('referral_reward_settings', {
  id: integer('id').primaryKey().default(1),
  referralsRequired: integer('referrals_required').notNull().default(3),
  discountType: discountTypeEnum('discount_type').notNull().default('percentage'),
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }).notNull().default('5'),
  minOrderAmount: numeric('min_order_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  maxDiscountAmount: numeric('max_discount_amount', { precision: 12, scale: 2 }),
  isActive: boolean('is_active').notNull().default(false),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  check('referral_reward_settings_singleton_check', sql`${t.id} = 1`),
  check('referral_reward_settings_threshold_check', sql`${t.referralsRequired} > 0`),
  check('referral_reward_settings_value_check', sql`${t.discountValue} > 0`)
]));

// A referral reward is one single-use coupon issued for a milestone.
export const referralRewards = pgTable('referral_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  milestone: integer('milestone').notNull(),
  referralCount: integer('referral_count').notNull(),
  couponCode: text('coupon_code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('referral_rewards_user_milestone_unique').on(t.userId, t.milestone),
  uniqueIndex('referral_rewards_coupon_code_unique').on(t.couponCode)
]));

export const deliveryZones = pgTable('delivery_zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  fee: numeric('fee', { precision: 12, scale: 2 }).notNull().default('0'),
  estimatedTime: text('estimated_time'),
  freeThreshold: numeric('free_threshold', { precision: 12, scale: 2 }),
  // Fixed-price options shown next to distance-based delivery: store pickup
  // (kind='pickup') or a special flat rate (kind='fixed', e.g. courier).
  kind: text('kind').notNull().default('fixed'),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0)
});

// Distance bands used to price delivery from the office. maxKm null = open-ended.
export const deliveryRateBands = pgTable('delivery_rate_bands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  minKm: numeric('min_km', { precision: 8, scale: 2 }).notNull().default('0'),
  maxKm: numeric('max_km', { precision: 8, scale: 2 }),
  fee: numeric('fee', { precision: 12, scale: 2 }).notNull(),
  freeThreshold: numeric('free_threshold', { precision: 12, scale: 2 }),
  estimatedTime: text('estimated_time'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('delivery_rate_bands_active_min_idx').on(t.isActive, t.minKm),
  check('delivery_rate_bands_range_check', sql`${t.minKm} >= 0 AND (${t.maxKm} IS NULL OR ${t.maxKm} > ${t.minKm})`),
  check('delivery_rate_bands_fee_check', sql`${t.fee} >= 0`)
]));

// Admin-scheduled discounts on individual products. The storefront and the
// order pipeline both price items through server/services/pricing.js.
export const flashDeals = pgTable('flash_deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  discountType: discountTypeEnum('discount_type').notNull(),
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  quantityLimit: integer('quantity_limit'),
  quantitySold: integer('quantity_sold').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('flash_deals_product_idx').on(t.productId),
  index('flash_deals_window_idx').on(t.isActive, t.startsAt, t.endsAt),
  check('flash_deals_window_check', sql`${t.endsAt} > ${t.startsAt}`),
  check('flash_deals_value_check', sql`${t.discountValue} > 0`),
  check('flash_deals_sold_check', sql`${t.quantitySold} >= 0`)
]));

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  phone: text('phone'),
  hours: text('hours'),
  services: jsonb('services').notNull().default(sql`'[]'::jsonb`),
  lat: numeric('lat', { precision: 10, scale: 6 }),
  lng: numeric('lng', { precision: 10, scale: 6 })
});

export const storeStock = pgTable('store_stock', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  stock: integer('stock').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('store_stock_unique').on(t.storeId, t.productId, t.variantId),
  check('store_stock_nonneg', sql`${t.stock} >= 0`)
]));

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  salesChannel: text('sales_channel').notNull().default('online'),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'set null' }),
  servedBy: uuid('served_by').references(() => users.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  couponCode: text('coupon_code'),
  deliveryFee: numeric('delivery_fee', { precision: 12, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('KES'),
  status: orderStatusEnum('status').notNull().default('Pending'),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('Pending'),
  paymentMethod: text('payment_method'),
  paymentReference: text('payment_reference'),
  deliveryMethod: text('delivery_method'),
  deliveryAddress: jsonb('delivery_address').notNull().default(sql`'{}'::jsonb`),
  // Server-computed delivery quote: { mode, label, distanceKm, bandId, optionId, estimated }.
  deliveryQuote: jsonb('delivery_quote').notNull().default(sql`'{}'::jsonb`),
  deliveryDistanceKm: numeric('delivery_distance_km', { precision: 8, scale: 2 }),
  flashDealSavings: numeric('flash_deal_savings', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('16'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  trackingNumber: text('tracking_number'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('orders_order_number_unique').on(t.orderNumber),
  index('orders_user_idx').on(t.userId),
  index('orders_customer_email_idx').on(t.customerEmail),
  index('orders_status_created_idx').on(t.status, t.createdAt),
  index('orders_payment_status_idx').on(t.paymentStatus),
  index('orders_payment_reference_idx').on(t.paymentReference),
  index('orders_created_at_idx').on(t.createdAt),
  // Finance dashboard: revenue is booked by payment date.
  index('orders_paid_at_idx').on(t.paidAt),
  index('orders_store_idx').on(t.storeId),
  index('orders_channel_idx').on(t.salesChannel),
  check('orders_channel_check', sql`${t.salesChannel} IN ('online', 'pos')`),
  check('orders_total_nonneg', sql`${t.total} >= 0`)
]));

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  variantName: text('variant_name'),
  sku: text('sku').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  // Catalog price before any flash deal; equals unitPrice when no deal applied.
  originalUnitPrice: numeric('original_unit_price', { precision: 12, scale: 2 }),
  // Product cost price when the order was placed (cost of goods sold).
  // Null when the product had no cost price recorded.
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }),
  flashDealId: uuid('flash_deal_id').references(() => flashDeals.id, { onDelete: 'set null' }),
  shortDescription: text('short_description'),
  quantity: integer('quantity').notNull(),
  thumbnailUrl: text('thumbnail_url')
}, (t) => ([
  index('order_items_order_idx').on(t.orderId),
  index('order_items_product_idx').on(t.productId),
  check('order_items_qty_positive', sql`${t.quantity} > 0`)
]));

export const orderStatusHistory = pgTable('order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  note: text('note'),
  changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('order_status_history_order_idx').on(t.orderId)
]));

// Business running costs entered by admins (rent, salaries, utilities, …).
// Stock purchases are NOT recorded here: the cost of goods sold comes from
// order_items.unit_cost, so recording stock here too would count it twice.
export const EXPENSE_CATEGORIES = ['Rent', 'Salaries & wages', 'Utilities', 'Internet & phone', 'Transport & delivery', 'Marketing', 'Repairs & maintenance', 'Bank & payment fees', 'Taxes & licences', 'Office supplies', 'Other'];

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  // The day the cost was incurred (Nairobi date), used for period reporting.
  spentOn: date('spent_on').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method'),
  reference: text('reference'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('expenses_spent_on_idx').on(t.spentOn),
  index('expenses_category_idx').on(t.category),
  check('expenses_amount_positive', sql`${t.amount} > 0`)
]));

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull(),
  // The provider's receipt / charge id (M-Pesa receipt, Stripe payment_intent).
  providerReference: text('provider_reference'),
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('payments_order_idx').on(t.orderId)
]));

// One row per attempt to pay an order through a provider. providerSessionId is
// the id we get when *starting* the payment (Daraja CheckoutRequestID, Stripe
// Checkout Session id); callbacks/webhooks look the attempt up by it.
export const paymentAttempts = pgTable('payment_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  status: paymentAttemptStatusEnum('status').notNull().default('pending'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('KES'),
  providerSessionId: text('provider_session_id'),
  providerReference: text('provider_reference'),
  // Masked (e.g. 2547******78) — enough for support, not a full MSISDN.
  payerHint: text('payer_hint'),
  failureReason: text('failure_reason'),
  rawResponse: jsonb('raw_response'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('payment_attempts_provider_session_unique').on(t.provider, t.providerSessionId),
  uniqueIndex('payment_attempts_provider_reference_unique').on(t.provider, t.providerReference),
  index('payment_attempts_order_idx').on(t.orderId, t.createdAt),
  index('payment_attempts_status_idx').on(t.status, t.createdAt)
]));

// Every webhook / callback we accept is recorded here first; the unique key
// makes duplicate deliveries a no-op.
export const paymentEvents = pgTable('payment_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(),
  eventId: text('event_id').notNull(),
  type: text('type'),
  payload: jsonb('payload'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('payment_events_provider_event_unique').on(t.provider, t.eventId)
]));

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNumber: text('invoice_number').notNull(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  deliveryFee: numeric('delivery_fee', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull().default('ISSUED'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('invoices_invoice_number_unique').on(t.invoiceNumber),
  index('invoices_order_idx').on(t.orderId)
]));

export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptNumber: text('receipt_number').notNull(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('receipts_receipt_number_unique').on(t.receiptNumber),
  index('receipts_order_idx').on(t.orderId)
]));

// ---------------------------------------------------------------------------
// Reviews / Support / Content
// ---------------------------------------------------------------------------

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  userName: text('user_name').notNull(),
  userCity: text('user_city'),
  rating: integer('rating').notNull(),
  title: text('title'),
  comment: text('comment'),
  verifiedPurchase: boolean('verified_purchase').notNull().default(false),
  // Existing rows were already public, so they default to approved; new
  // submissions are inserted as 'pending' by reviewsRepo.
  status: reviewStatusEnum('status').notNull().default('approved'),
  moderationNote: text('moderation_note'),
  moderatedBy: uuid('moderated_by').references(() => users.id, { onDelete: 'set null' }),
  moderatedAt: timestamp('moderated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('reviews_product_idx').on(t.productId),
  index('reviews_product_status_idx').on(t.productId, t.status),
  index('reviews_user_product_idx').on(t.userId, t.productId),
  index('reviews_status_created_idx').on(t.status, t.createdAt),
  check('reviews_rating_range', sql`${t.rating} >= 1 AND ${t.rating} <= 5`)
]));

export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketNumber: text('ticket_number').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  // Optional: the order the ticket is about.
  orderNumber: text('order_number'),
  subject: text('subject').notNull(),
  category: text('category'),
  priority: text('priority').default('Normal'),
  status: ticketStatusEnum('status').notNull().default('Open'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('support_tickets_ticket_number_unique').on(t.ticketNumber),
  index('support_tickets_user_idx').on(t.userId),
  index('support_tickets_status_updated_idx').on(t.status, t.updatedAt)
]));

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  senderRole: ticketSenderEnum('sender_role').notNull(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  senderName: text('sender_name'),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('ticket_messages_ticket_idx').on(t.ticketId)
]));

export const blogPosts = pgTable('blog_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  category: text('category'),
  author: text('author'),
  readTime: text('read_time'),
  imageUrl: text('image_url'),
  excerpt: text('excerpt'),
  content: text('content'),
  tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('blog_posts_slug_unique').on(t.slug)
]));

// ---------------------------------------------------------------------------
// Tech News & Guides
// ---------------------------------------------------------------------------

export const newsSources = pgTable('news_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  feedUrl: text('feed_url').notNull(),
  siteUrl: text('site_url'),
  description: text('description'),
  defaultCategory: text('default_category'),
  defaultCounty: text('default_county'),
  isActive: boolean('is_active').notNull().default(true),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('news_sources_feed_url_unique').on(t.feedUrl)
]));

// Aggregated items store only headline/excerpt/metadata + a link back to the
// publisher (never the full third-party article). Guides are original content.
export const newsArticles = pgTable('news_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: newsKindEnum('kind').notNull(),
  sourceId: uuid('source_id').references(() => newsSources.id, { onDelete: 'set null' }),
  sourceName: text('source_name'),
  sourceUrl: text('source_url'),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  summary: text('summary'),
  content: text('content'),
  author: text('author'),
  imageUrl: text('image_url'),
  category: text('category'),
  // null = national / not location-specific
  county: text('county'),
  tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
  status: newsStatusEnum('status').notNull().default('draft'),
  // Published items with a future publishAt are "scheduled".
  publishAt: timestamp('publish_at', { withTimezone: true }),
  isFeatured: boolean('is_featured').notNull().default(false),
  originalPublishedAt: timestamp('original_published_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('news_articles_slug_unique').on(t.slug),
  uniqueIndex('news_articles_source_url_unique').on(t.sourceUrl),
  index('news_articles_status_publish_idx').on(t.status, t.publishAt),
  index('news_articles_county_idx').on(t.county),
  index('news_articles_category_idx').on(t.category),
  index('news_articles_featured_idx').on(t.isFeatured, t.publishAt)
]));

// ---------------------------------------------------------------------------
// Audit & Misc
// ---------------------------------------------------------------------------

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorName: text('actor_name'),
  action: text('action').notNull(),
  entity: text('entity'),
  entityId: text('entity_id'),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('audit_logs_actor_idx').on(t.actorId),
  index('audit_logs_created_idx').on(t.createdAt)
]));

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('newsletter_subscribers_email_unique').on(t.email)
]));
