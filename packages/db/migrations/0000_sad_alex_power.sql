CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" bigint,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "admin_users_role_check" CHECK ("admin_users"."role" in ('superadmin', 'admin', 'officer'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"division_code" text NOT NULL,
	"slug_th" text NOT NULL,
	"slug_en" text NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "categories_slug_th_format" CHECK ("categories"."slug_th" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "categories_slug_en_format" CHECK ("categories"."slug_en" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"code" text PRIMARY KEY NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"ribbon_text" text NOT NULL,
	"delivery_date" bigint,
	"delivery_time_note" text,
	"venue" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"line_id" text,
	"message" text,
	"status" text DEFAULT 'new' NOT NULL,
	"handled_by_admin_id" uuid,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "product_enquiries_status_check" CHECK ("product_enquiries"."status" in ('new', 'contacted', 'quoted', 'converted', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"alt_th" text,
	"alt_en" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"width_ladder" jsonb NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"lot_code" text NOT NULL,
	"purchase_mode" text NOT NULL,
	"name_th" text DEFAULT '' NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"body_th" text,
	"body_en" text,
	"material_th" text,
	"material_en" text,
	"finish_note_th" text,
	"finish_note_en" text,
	"price_satang" bigint,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_at" bigint,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "products_purchase_mode_check" CHECK ("products"."purchase_mode" in ('cart', 'enquiry')),
	CONSTRAINT "products_status_check" CHECK ("products"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "products_price_nonneg" CHECK ("products"."price_satang" is null or "products"."price_satang" >= 0),
	CONSTRAINT "products_cart_needs_price" CHECK ("products"."purchase_mode" <> 'cart' or "products"."price_satang" is not null),
	CONSTRAINT "products_publish_completeness" CHECK ("products"."status" <> 'published' or ("products"."name_th" <> '' and "products"."name_en" <> '' and "products"."body_th" is not null and "products"."body_en" is not null))
);
--> statement-breakpoint
CREATE TABLE "inventory_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"ref_type" text,
	"ref_id" uuid,
	"actor_admin_id" uuid,
	"note" text,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "inventory_ledger_reason_check" CHECK ("inventory_ledger"."reason" in ('production_receipt', 'sale_reserve', 'sale_commit', 'reserve_release', 'shipment', 'damage', 'correction')),
	CONSTRAINT "inventory_ledger_ref_type_check" CHECK ("inventory_ledger"."ref_type" is null or "inventory_ledger"."ref_type" in ('order', 'stocktake', 'manual')),
	CONSTRAINT "inventory_ledger_delta_nonzero" CHECK ("inventory_ledger"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"value_percent" integer,
	"value_satang" bigint,
	"starts_at" bigint,
	"ends_at" bigint,
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "coupons_kind_check" CHECK ("coupons"."kind" in ('percent', 'fixed')),
	CONSTRAINT "coupons_single_value_shape" CHECK ((
        ("coupons"."kind" = 'percent' and "coupons"."value_percent" between 1 and 100 and "coupons"."value_satang" is null)
        or
        ("coupons"."kind" = 'fixed' and "coupons"."value_satang" > 0 and "coupons"."value_percent" is null)
      )),
	CONSTRAINT "coupons_window_order" CHECK ("coupons"."starts_at" is null or "coupons"."ends_at" is null or "coupons"."ends_at" >= "coupons"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text NOT NULL,
	"unit_price_satang" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_satang" bigint NOT NULL,
	CONSTRAINT "order_items_qty_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_nonneg" CHECK ("order_items"."unit_price_satang" >= 0),
	CONSTRAINT "order_items_line_total_math" CHECK ("order_items"."line_total_satang" = "order_items"."unit_price_satang" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" text NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"addr_line1" text NOT NULL,
	"addr_line2" text,
	"subdistrict" text NOT NULL,
	"district" text NOT NULL,
	"province" text NOT NULL,
	"postcode" text NOT NULL,
	"shipping_note" text,
	"subtotal_satang" bigint NOT NULL,
	"discount_satang" bigint DEFAULT 0 NOT NULL,
	"shipping_satang" bigint DEFAULT 0 NOT NULL,
	"total_satang" bigint NOT NULL,
	"coupon_id" uuid,
	"tracking_no" text,
	"placed_at" bigint NOT NULL,
	"paid_at" bigint,
	"shipped_at" bigint,
	"completed_at" bigint,
	"cancelled_at" bigint,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('pending_payment', 'awaiting_verification', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded')),
	CONSTRAINT "orders_postcode_check" CHECK ("orders"."postcode" ~ '^[0-9]{5}$'),
	CONSTRAINT "orders_subtotal_nonneg" CHECK ("orders"."subtotal_satang" >= 0),
	CONSTRAINT "orders_discount_nonneg" CHECK ("orders"."discount_satang" >= 0),
	CONSTRAINT "orders_shipping_nonneg" CHECK ("orders"."shipping_satang" >= 0),
	CONSTRAINT "orders_total_nonneg" CHECK ("orders"."total_satang" >= 0),
	CONSTRAINT "orders_total_math" CHECK ("orders"."total_satang" = "orders"."subtotal_satang" - "orders"."discount_satang" + "orders"."shipping_satang")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"rail" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_satang" bigint NOT NULL,
	"trans_ref" text,
	"external_ref" text,
	"provider_payload" jsonb,
	"verified_via" text,
	"verified_by_admin_id" uuid,
	"verified_reason" text,
	"verified_at" bigint,
	"initiated_at" bigint NOT NULL,
	"settled_at" bigint,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "payments_rail_check" CHECK ("payments"."rail" in ('promptpay_billpay', 'promptpay_ewallet', 'bank_transfer')),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" in ('pending', 'awaiting_provider', 'verified', 'failed', 'cancelled', 'refund_recorded')),
	CONSTRAINT "payments_verified_via_check" CHECK ("payments"."verified_via" is null or "payments"."verified_via" in ('provider_lookup', 'statement_match', 'manual_override')),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_satang" > 0),
	CONSTRAINT "payments_verified_has_trans_ref" CHECK ("payments"."status" <> 'verified' or "payments"."trans_ref" is not null),
	CONSTRAINT "payments_manual_override_needs_reason" CHECK ("payments"."verified_via" <> 'manual_override' or "payments"."verified_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_no" text NOT NULL,
	"tax_invoice_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"reason_detail" text NOT NULL,
	"subtotal_satang" bigint NOT NULL,
	"vat_satang" bigint NOT NULL,
	"total_satang" bigint NOT NULL,
	"approved_by_admin_id" uuid,
	"issued_at" bigint NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "credit_notes_reason_check" CHECK ("credit_notes"."reason_code" in ('pricing_error', 'returned_goods', 'cancellation')),
	CONSTRAINT "credit_notes_amounts_math" CHECK ("credit_notes"."total_satang" = "credit_notes"."subtotal_satang" + "credit_notes"."vat_satang")
);
--> statement-breakpoint
CREATE TABLE "document_counters" (
	"scope" text NOT NULL,
	"period" text NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "document_counters_pk" PRIMARY KEY("scope","period"),
	CONSTRAINT "document_counters_nonneg" CHECK ("document_counters"."last_value" >= 0),
	CONSTRAINT "document_counters_scope_check" CHECK ("document_counters"."scope" in ('order_no', 'tax_invoice', 'credit_note'))
);
--> statement-breakpoint
CREATE TABLE "tax_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_no" text NOT NULL,
	"order_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_tax_id" text NOT NULL,
	"buyer_branch_no" text,
	"buyer_address" text NOT NULL,
	"subtotal_satang" bigint NOT NULL,
	"vat_satang" bigint NOT NULL,
	"total_satang" bigint NOT NULL,
	"issued_at" bigint NOT NULL,
	"voided_at" bigint,
	"pdf_key" text,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "tax_invoices_taxid_check" CHECK ("tax_invoices"."buyer_tax_id" ~ '^[0-9]{13}$'),
	CONSTRAINT "tax_invoices_amounts_math" CHECK ("tax_invoices"."total_satang" = "tax_invoices"."subtotal_satang" + "tax_invoices"."vat_satang")
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"placement" text NOT NULL,
	"image_key" text NOT NULL,
	"alt_th" text NOT NULL,
	"alt_en" text NOT NULL,
	"link_path_th" text,
	"link_path_en" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" bigint,
	"ends_at" bigint,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "banners_placement_check" CHECK ("banners"."placement" in ('home_hero', 'home_promo')),
	CONSTRAINT "banners_window_order" CHECK ("banners"."starts_at" is null or "banners"."ends_at" is null or "banners"."ends_at" >= "banners"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_th" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"description_th" text,
	"description_en" text,
	"location_th" text,
	"location_en" text,
	"starts_at" bigint NOT NULL,
	"ends_at" bigint,
	"hero_image_key" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" bigint,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "events_status_check" CHECK ("events"."status" in ('draft', 'published')),
	CONSTRAINT "events_window_order" CHECK ("events"."ends_at" is null or "events"."ends_at" >= "events"."starts_at"),
	CONSTRAINT "events_publish_completeness" CHECK ("events"."status" <> 'published' or ("events"."title_th" <> '' and "events"."title_en" <> '' and "events"."description_th" is not null and "events"."description_en" is not null))
);
--> statement-breakpoint
CREATE TABLE "news_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug_th" text NOT NULL,
	"slug_en" text NOT NULL,
	"title_th" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"excerpt_th" text,
	"excerpt_en" text,
	"body_th" text,
	"body_en" text,
	"hero_image_key" text,
	"author_admin_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"publish_at" bigint,
	"published_at" bigint,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "news_posts_slug_th_format" CHECK ("news_posts"."slug_th" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "news_posts_slug_en_format" CHECK ("news_posts"."slug_en" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "news_posts_status_check" CHECK ("news_posts"."status" in ('draft', 'published')),
	CONSTRAINT "news_posts_publish_completeness" CHECK ("news_posts"."status" <> 'published' or ("news_posts"."title_th" <> '' and "news_posts"."title_en" <> '' and "news_posts"."body_th" is not null and "news_posts"."body_en" is not null))
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug_th" text NOT NULL,
	"slug_en" text NOT NULL,
	"title_th" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"body_th" text,
	"body_en" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" bigint,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "pages_slug_th_format" CHECK ("pages"."slug_th" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "pages_slug_en_format" CHECK ("pages"."slug_en" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "pages_status_check" CHECK ("pages"."status" in ('draft', 'published')),
	CONSTRAINT "pages_publish_completeness" CHECK ("pages"."status" <> 'published' or ("pages"."title_th" <> '' and "pages"."title_en" <> '' and "pages"."body_th" is not null and "pages"."body_en" is not null))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_admin_id" uuid,
	"action" text NOT NULL,
	"severity" text DEFAULT 'normal' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"request_id" text,
	"ip" text,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "audit_log_severity_check" CHECK ("audit_log"."severity" in ('normal', 'red'))
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_email" text NOT NULL,
	"consent_type" text NOT NULL,
	"policy_version" text NOT NULL,
	"granted" boolean NOT NULL,
	"source" text,
	"order_id" uuid,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "consents_type_check" CHECK ("consents"."consent_type" in ('marketing', 'analytics'))
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"permanent" boolean DEFAULT true NOT NULL,
	"created_by_admin_id" uuid,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "redirects_from_absolute" CHECK ("redirects"."from_path" like '/%'),
	CONSTRAINT "redirects_to_absolute" CHECK ("redirects"."to_path" like '/%')
);
--> statement-breakpoint
CREATE TABLE "settings_registry" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"value_type" text NOT NULL,
	"description" text NOT NULL,
	"updated_by_admin_id" uuid,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "settings_registry_type_check" CHECK ("settings_registry"."value_type" in ('string', 'number', 'boolean', 'json'))
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_division_code_divisions_code_fk" FOREIGN KEY ("division_code") REFERENCES "public"."divisions"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_enquiries" ADD CONSTRAINT "product_enquiries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_enquiries" ADD CONSTRAINT "product_enquiries_handled_by_admin_id_admin_users_id_fk" FOREIGN KEY ("handled_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_actor_admin_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_admin_id_admin_users_id_fk" FOREIGN KEY ("verified_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_tax_invoice_id_tax_invoices_id_fk" FOREIGN KEY ("tax_invoice_id") REFERENCES "public"."tax_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_approved_by_admin_id_admin_users_id_fk" FOREIGN KEY ("approved_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_author_admin_id_admin_users_id_fk" FOREIGN KEY ("author_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_admin_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_created_by_admin_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings_registry" ADD CONSTRAINT "settings_registry_updated_by_admin_id_admin_users_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_admin_idx" ON "sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_th_key" ON "categories" USING btree ("slug_th");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_en_key" ON "categories" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "product_enquiries_product_idx" ON "product_enquiries" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_enquiries_status_time_idx" ON "product_enquiries" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_storage_key_key" ON "product_images" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_key" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_ledger_product_time_idx" ON "inventory_ledger" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_ledger_ref_idx" ON "inventory_ledger" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders" USING btree ("order_no");--> statement-breakpoint
CREATE INDEX "orders_status_placed_idx" ON "orders" USING btree ("status","placed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_trans_ref_key" ON "payments" USING btree ("trans_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_rail_external_key" ON "payments" USING btree ("rail","external_ref");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_initiated_idx" ON "payments" USING btree ("status","initiated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_note_no_key" ON "credit_notes" USING btree ("note_no");--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_idx" ON "credit_notes" USING btree ("tax_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_invoices_invoice_no_key" ON "tax_invoices" USING btree ("invoice_no");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_invoices_order_key" ON "tax_invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "banners_placement_sort_idx" ON "banners" USING btree ("placement","sort_order");--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "news_posts_slug_th_key" ON "news_posts" USING btree ("slug_th");--> statement-breakpoint
CREATE UNIQUE INDEX "news_posts_slug_en_key" ON "news_posts" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "news_posts_status_publish_idx" ON "news_posts" USING btree ("status","publish_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_th_key" ON "pages" USING btree ("slug_th");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_en_key" ON "pages" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_time_idx" ON "audit_log" USING btree ("actor_admin_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_severity_time_idx" ON "audit_log" USING btree ("severity","created_at");--> statement-breakpoint
CREATE INDEX "consents_subject_idx" ON "consents" USING btree ("subject_email","consent_type");--> statement-breakpoint
CREATE UNIQUE INDEX "redirects_from_path_key" ON "redirects" USING btree ("from_path");