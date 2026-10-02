CREATE TABLE "referral_reward_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"referrals_required" integer DEFAULT 3 NOT NULL,
	"discount_type" "discount_type" DEFAULT 'percentage' NOT NULL,
	"discount_value" numeric(12, 2) DEFAULT '5' NOT NULL,
	"min_order_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"max_discount_amount" numeric(12, 2),
	"is_active" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_reward_settings_singleton_check" CHECK ("referral_reward_settings"."id" = 1),
	CONSTRAINT "referral_reward_settings_threshold_check" CHECK ("referral_reward_settings"."referrals_required" > 0),
	CONSTRAINT "referral_reward_settings_value_check" CHECK ("referral_reward_settings"."discount_value" > 0)
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"milestone" integer NOT NULL,
	"referral_count" integer NOT NULL,
	"coupon_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_signup_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"code_hash" text NOT NULL,
	"created_by" uuid,
	"consumed_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_signup_codes_role_check" CHECK ("staff_signup_codes"."role" in ('ADMIN', 'SALES_MANAGER'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" text DEFAULT 'REF-' || upper(substr(md5(gen_random_uuid()::text), 1, 10)) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_by" uuid;--> statement-breakpoint
ALTER TABLE "referral_reward_settings" ADD CONSTRAINT "referral_reward_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_signup_codes" ADD CONSTRAINT "staff_signup_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_signup_codes" ADD CONSTRAINT "staff_signup_codes_consumed_by_users_id_fk" FOREIGN KEY ("consumed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_rewards_user_milestone_unique" ON "referral_rewards" USING btree ("user_id","milestone");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_rewards_coupon_code_unique" ON "referral_rewards" USING btree ("coupon_code");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_signup_codes_hash_unique" ON "staff_signup_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "staff_signup_codes_creator_idx" ON "staff_signup_codes" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_users_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_referral_code_unique" ON "users" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "users_referred_by_idx" ON "users" USING btree ("referred_by");