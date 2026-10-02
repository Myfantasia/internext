import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
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
export const paymentStatusEnum = pgEnum('payment_status', ['Pending', 'Paid', 'Failed', 'Refunded', 'Pending (Cash On Delivery)']);
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
  isActive: boolean('is_active').notNull().default(true),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('users_email_unique').on(t.email),
  uniqueIndex('users_referral_code_unique').on(t.referralCode),
  index('users_referred_by_idx').on(t.referredBy)
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
  index('sessions_user_id_idx').on(t.userId)
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('coupons_code_unique').on(t.code)
]));

// Singleton settings record controlled by an ADMIN from the dashboard.
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
  freeThreshold: numeric('free_threshold', { precision: 12, scale: 2 })
});

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

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  couponCode: text('coupon_code'),
  deliveryFee: numeric('delivery_fee', { precision: 12, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('KES'),
  status: orderStatusEnum('status').notNull().default('Pending'),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('Pending'),
  paymentMethod: text('payment_method'),
  paymentReference: text('payment_reference'),
  deliveryMethod: text('delivery_method'),
  deliveryAddress: jsonb('delivery_address').notNull().default(sql`'{}'::jsonb`),
  trackingNumber: text('tracking_number'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('orders_order_number_unique').on(t.orderNumber),
  index('orders_user_idx').on(t.userId),
  index('orders_customer_email_idx').on(t.customerEmail),
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
  quantity: integer('quantity').notNull(),
  thumbnailUrl: text('thumbnail_url')
}, (t) => ([
  index('order_items_order_idx').on(t.orderId),
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

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull(),
  providerReference: text('provider_reference'),
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('payments_order_idx').on(t.orderId)
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  index('reviews_product_idx').on(t.productId),
  check('reviews_rating_range', sql`${t.rating} >= 1 AND ${t.rating} <= 5`)
]));

export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketNumber: text('ticket_number').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  subject: text('subject').notNull(),
  category: text('category'),
  priority: text('priority').default('Normal'),
  status: ticketStatusEnum('status').notNull().default('Open'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ([
  uniqueIndex('support_tickets_ticket_number_unique').on(t.ticketNumber),
  index('support_tickets_user_idx').on(t.userId)
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
