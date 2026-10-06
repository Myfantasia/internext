CREATE TYPE "public"."coupon_redemption_status" AS ENUM('reserved', 'redeemed', 'released');--> statement-breakpoint
CREATE TYPE "public"."news_kind" AS ENUM('aggregated', 'guide');--> statement-breakpoint
CREATE TYPE "public"."news_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."referral_reward_model" AS ENUM('one_time', 'per_referral', 'recurring', 'tiered');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'Cancelled';--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"user_id" uuid,
	"order_id" uuid NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"status" "coupon_redemption_status" DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_rate_bands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_km" numeric(8, 2) DEFAULT '0' NOT NULL,
	"max_km" numeric(8, 2),
	"fee" numeric(12, 2) NOT NULL,
	"free_threshold" numeric(12, 2),
	"estimated_time" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_rate_bands_range_check" CHECK ("delivery_rate_bands"."min_km" >= 0 AND ("delivery_rate_bands"."max_km" IS NULL OR "delivery_rate_bands"."max_km" > "delivery_rate_bands"."min_km")),
	CONSTRAINT "delivery_rate_bands_fee_check" CHECK ("delivery_rate_bands"."fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "flash_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"quantity_limit" integer,
	"quantity_sold" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flash_deals_window_check" CHECK ("flash_deals"."ends_at" > "flash_deals"."starts_at"),
	CONSTRAINT "flash_deals_value_check" CHECK ("flash_deals"."discount_value" > 0),
	CONSTRAINT "flash_deals_sold_check" CHECK ("flash_deals"."quantity_sold" >= 0)
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "news_kind" NOT NULL,
	"source_id" uuid,
	"source_name" text,
	"source_url" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"content" text,
	"author" text,
	"image_url" text,
	"category" text,
	"county" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "news_status" DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp with time zone,
	"is_featured" boolean DEFAULT false NOT NULL,
	"original_published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"site_url" text,
	"description" text,
	"default_category" text,
	"default_county" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid,
	"provider" text NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"provider_session_id" text,
	"provider_reference" text,
	"payer_hint" text,
	"failure_reason" text,
	"raw_response" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text,
	"payload" jsonb,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"referral_code_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"ip" text,
	"qualified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_attributions_no_self" CHECK ("referral_attributions"."referrer_id" <> "referral_attributions"."referred_user_id"),
	CONSTRAINT "referral_attributions_status_check" CHECK ("referral_attributions"."status" in ('pending', 'qualified', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_reward_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"milestone_key" text NOT NULL,
	"referral_count" integer NOT NULL,
	"coupon_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_reward_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"reward_model" "referral_reward_model" NOT NULL,
	"value_type" "discount_type" NOT NULL,
	"value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"threshold_count" integer DEFAULT 1 NOT NULL,
	"tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_rewards_per_user" integer,
	"min_order_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"max_discount_amount" numeric(12, 2),
	"coupon_valid_days" integer DEFAULT 30 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_reward_programs_threshold_check" CHECK ("referral_reward_programs"."threshold_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "company_profile" ADD COLUMN "kra_pin" text;--> statement-breakpoint
ALTER TABLE "company_profile" ADD COLUMN "receipt_notes" text;--> statement-breakpoint
ALTER TABLE "company_profile" ADD COLUMN "office_lat" numeric(9, 6) DEFAULT '-1.283300';--> statement-breakpoint
ALTER TABLE "company_profile" ADD COLUMN "office_lng" numeric(9, 6) DEFAULT '36.825000';--> statement-breakpoint
ALTER TABLE "company_profile" ADD COLUMN "road_distance_factor" numeric(4, 2) DEFAULT '1.30' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_profile" ADD COLUMN "out_of_range_fee" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "per_user_limit" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "eligible_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "eligible_category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "stack_with_flash_deals" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "assigned_user_id" uuid;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "source" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "kind" text DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "original_unit_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "flash_deal_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_quote" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_distance_km" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "flash_deal_savings" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_rate" numeric(5, 2) DEFAULT '16' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "status" "review_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "moderation_note" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "moderated_by" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "county" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "town" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address_line" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location_lat" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location_lng" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location_source" text;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flash_deals" ADD CONSTRAINT "flash_deals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flash_deals" ADD CONSTRAINT "flash_deals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referral_code_id_referral_codes_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_reward_grants" ADD CONSTRAINT "referral_reward_grants_program_id_referral_reward_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."referral_reward_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_reward_grants" ADD CONSTRAINT "referral_reward_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_reward_programs" ADD CONSTRAINT "referral_reward_programs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_redemptions_order_unique" ON "coupon_redemptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_status_idx" ON "coupon_redemptions" USING btree ("coupon_id","status");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_user_idx" ON "coupon_redemptions" USING btree ("coupon_id","user_id");--> statement-breakpoint
CREATE INDEX "delivery_rate_bands_active_min_idx" ON "delivery_rate_bands" USING btree ("is_active","min_km");--> statement-breakpoint
CREATE INDEX "flash_deals_product_idx" ON "flash_deals" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "flash_deals_window_idx" ON "flash_deals" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "news_articles_slug_unique" ON "news_articles" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "news_articles_source_url_unique" ON "news_articles" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "news_articles_status_publish_idx" ON "news_articles" USING btree ("status","publish_at");--> statement-breakpoint
CREATE INDEX "news_articles_county_idx" ON "news_articles" USING btree ("county");--> statement-breakpoint
CREATE INDEX "news_articles_category_idx" ON "news_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "news_articles_featured_idx" ON "news_articles" USING btree ("is_featured","publish_at");--> statement-breakpoint
CREATE UNIQUE INDEX "news_sources_feed_url_unique" ON "news_sources" USING btree ("feed_url");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_provider_session_unique" ON "payment_attempts" USING btree ("provider","provider_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_provider_reference_unique" ON "payment_attempts" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "payment_attempts_order_idx" ON "payment_attempts" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_attempts_status_idx" ON "payment_attempts" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_unique" ON "payment_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_attributions_referred_unique" ON "referral_attributions" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "referral_attributions_referrer_status_idx" ON "referral_attributions" USING btree ("referrer_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_codes_code_unique" ON "referral_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referral_codes_user_created_idx" ON "referral_codes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_reward_grants_unique" ON "referral_reward_grants" USING btree ("program_id","user_id","milestone_key");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_reward_grants_coupon_unique" ON "referral_reward_grants" USING btree ("coupon_code");--> statement-breakpoint
CREATE INDEX "referral_reward_grants_user_idx" ON "referral_reward_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referral_reward_programs_active_idx" ON "referral_reward_programs" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_flash_deal_id_flash_deals_id_fk" FOREIGN KEY ("flash_deal_id") REFERENCES "public"."flash_deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupons_active_window_idx" ON "coupons" USING btree ("is_active","valid_until");--> statement-breakpoint
CREATE INDEX "coupons_assigned_user_idx" ON "coupons" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_payment_status_idx" ON "orders" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "orders_payment_reference_idx" ON "orders" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "products_active_category_price_idx" ON "products" USING btree ("is_active","category_id","price");--> statement-breakpoint
CREATE INDEX "products_active_featured_idx" ON "products" USING btree ("is_active","is_featured");--> statement-breakpoint
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reviews_product_status_idx" ON "reviews" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "reviews_user_product_idx" ON "reviews" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "reviews_status_created_idx" ON "reviews" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_county_idx" ON "users" USING btree ("county");--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_value_positive" CHECK ("coupons"."discount_value" > 0);--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_window_order" CHECK ("coupons"."valid_until" IS NULL OR "coupons"."valid_from" IS NULL OR "coupons"."valid_until" > "coupons"."valid_from");