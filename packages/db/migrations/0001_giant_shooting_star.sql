-- Per-language product slugs (P8 storefront routes products by slug).
-- Backfilled from sku so the NOT NULL can be applied to existing rows.
ALTER TABLE "products" ADD COLUMN "slug_th" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "slug_en" text;--> statement-breakpoint
UPDATE "products" SET "slug_th" = lower("sku"), "slug_en" = lower("sku") WHERE "slug_th" IS NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "slug_th" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "slug_en" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_th_key" ON "products" USING btree ("slug_th");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_en_key" ON "products" USING btree ("slug_en");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_slug_th_format" CHECK ("products"."slug_th" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_slug_en_format" CHECK ("products"."slug_en" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
