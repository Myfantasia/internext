-- Custom migration: things drizzle-kit cannot express in schema.js.
-- Copied into server/db/migrations/<NNNN>_search_and_backfill.sql after
-- `npx drizzle-kit generate --custom --name=search_and_backfill`.

-- 1. Search ------------------------------------------------------------------
-- pg_trgm is a "trusted" extension (PG13+), so the database owner can create it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
-- Full-text search over the product's searchable text. 'simple' config: no
-- English stemming, which suits model numbers/SKUs ("840 G9", "i5-1334U").
CREATE INDEX IF NOT EXISTS products_search_fts_idx ON products USING gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(short_specs, '') || ' ' || coalesce(description, ''))
);
--> statement-breakpoint
-- Trigram indexes make ILIKE '%term%' and similarity() (typo tolerance) indexable.
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING gin (name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS products_sku_trgm_idx ON products USING gin (sku gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS brands_name_trgm_idx ON brands USING gin (name gin_trgm_ops);
--> statement-breakpoint

-- 2. Order numbers -------------------------------------------------------------
-- Replaces count(*)+1, which collided under concurrent checkouts.
CREATE SEQUENCE IF NOT EXISTS order_number_seq;
--> statement-breakpoint
SELECT setval(
  'order_number_seq',
  GREATEST(COALESCE((SELECT max((substring(order_number from '([0-9]+)$'))::bigint) FROM orders), 0), 1),
  EXISTS (SELECT 1 FROM orders)
);
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;
--> statement-breakpoint
SELECT setval(
  'invoice_number_seq',
  GREATEST(COALESCE((SELECT max((substring(invoice_number from '([0-9]+)$'))::bigint) FROM invoices), 0), 1),
  EXISTS (SELECT 1 FROM invoices)
);
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq;
--> statement-breakpoint
SELECT setval(
  'receipt_number_seq',
  GREATEST(COALESCE((SELECT max((substring(receipt_number from '([0-9]+)$'))::bigint) FROM receipts), 0), 1),
  EXISTS (SELECT 1 FROM receipts)
);
--> statement-breakpoint

-- 3. Referral backfill ------------------------------------------------------------
-- Existing users.referred_by links become attribution rows.
INSERT INTO referral_attributions (referrer_id, referred_user_id, status, qualified_at, created_at)
SELECT referred_by, id,
       CASE WHEN email_verified_at IS NOT NULL THEN 'qualified' ELSE 'pending' END,
       email_verified_at, created_at
FROM users
WHERE referred_by IS NOT NULL AND referred_by <> id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- The old single-rule settings become a "recurring" program so nothing changes for customers.
INSERT INTO referral_reward_programs (name, description, reward_model, value_type, value, threshold_count, min_order_amount, max_discount_amount, coupon_valid_days, is_active)
SELECT 'Legacy referral reward', 'Migrated from the previous single-rule referral settings.', 'recurring',
       discount_type, discount_value, referrals_required, min_order_amount, max_discount_amount, 90, is_active
FROM referral_reward_settings
WHERE id = 1;
--> statement-breakpoint
-- Rewards already issued under the old rule are recorded as grants of that
-- program, so they are not issued a second time.
INSERT INTO referral_reward_grants (program_id, user_id, milestone_key, referral_count, coupon_code, created_at)
SELECT p.id, r.user_id, 'recurring:' || r.milestone, r.referral_count, r.coupon_code, r.created_at
FROM referral_rewards r
CROSS JOIN (SELECT id FROM referral_reward_programs WHERE name = 'Legacy referral reward' ORDER BY created_at LIMIT 1) p
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Referral coupons were previously usable by anyone who knew the code.
UPDATE coupons c
SET assigned_user_id = r.user_id, source = 'referral'
FROM referral_rewards r
WHERE r.coupon_code = c.code;
--> statement-breakpoint

-- 4. Delivery ---------------------------------------------------------------------
-- Keep store pickup; the old flat-rate area zones are switched off in favour of
-- distance bands (an admin can re-enable any of them under Delivery Pricing).
UPDATE delivery_zones SET kind = 'pickup', sort_order = 0 WHERE name ILIKE '%pickup%';
--> statement-breakpoint
UPDATE delivery_zones SET is_active = false WHERE kind = 'fixed';
--> statement-breakpoint
INSERT INTO delivery_rate_bands (name, description, min_km, max_km, fee, free_threshold, estimated_time, sort_order)
SELECT * FROM (VALUES
  ('Within 5 km', 'Nairobi CBD and immediate surroundings.', 0::numeric, 5::numeric, 300::numeric, 50000::numeric, '2-4 hours', 1),
  ('5 - 15 km', 'Most Nairobi suburbs.', 5, 15, 500, 60000, 'Same day', 2),
  ('15 - 40 km', 'Greater Nairobi and nearby towns.', 15, 40, 900, 80000, 'Same day / next morning', 3),
  ('40 - 150 km', 'Neighbouring counties via courier.', 40, 150, 1200, NULL, '1-2 days', 4),
  ('Over 150 km', 'Upcountry courier delivery.', 150, NULL, 1800, NULL, '2-3 days', 5)
) AS v(name, description, min_km, max_km, fee, free_threshold, estimated_time, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM delivery_rate_bands);
