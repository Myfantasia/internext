CREATE TABLE "store_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"stock" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_stock_nonneg" CHECK ("store_stock"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "sales_channel" text DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "store_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "served_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_stock_unique" ON "store_stock" USING btree ("store_id","product_id","variant_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_served_by_users_id_fk" FOREIGN KEY ("served_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_store_idx" ON "orders" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "orders_channel_idx" ON "orders" USING btree ("sales_channel");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_check" CHECK ("orders"."sales_channel" IN ('online', 'pos'));