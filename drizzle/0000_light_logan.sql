-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "kyc_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"id_type" text NOT NULL,
	"id_number" text NOT NULL,
	"id_doc_url" text,
	"selfie_url" text,
	"status" text DEFAULT 'pending',
	"reject_reason" text,
	"submitted_at" timestamp with time zone DEFAULT now(),
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"balance" numeric(28, 8) DEFAULT '0',
	"frozen_balance" numeric(28, 8) DEFAULT '0',
	"deposit_address" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "wallets_user_asset_unique" UNIQUE("user_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "crypto_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"icon_url" text,
	"is_active" boolean DEFAULT true,
	"networks" jsonb,
	CONSTRAINT "crypto_assets_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"asset_id" uuid,
	"amount" numeric(28, 8) NOT NULL,
	"fee" numeric(28, 8) DEFAULT '0',
	"fiat_amount" numeric(20, 2),
	"fiat_currency" text DEFAULT 'NGN',
	"status" text DEFAULT 'pending',
	"reference" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transactions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "p2p_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"raised_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"evidence_urls" jsonb,
	"status" text DEFAULT 'open',
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "p2p_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"maker_id" uuid NOT NULL,
	"type" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"price_per_unit" numeric(20, 2) NOT NULL,
	"available_qty" numeric(28, 8) NOT NULL,
	"min_order_fiat" numeric(20, 2) NOT NULL,
	"max_order_fiat" numeric(20, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"payment_window" integer DEFAULT 15,
	"is_active" boolean DEFAULT true,
	"total_orders" integer DEFAULT 0,
	"completion_rate" numeric(5, 2) DEFAULT '100',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"username" text,
	"phone" text,
	"is_email_verified" boolean DEFAULT false,
	"email_verify_token" text,
	"password_reset_token" text,
	"password_reset_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"date_of_birth" text,
	"country" text,
	"kyc_level" text DEFAULT '0',
	"kyc_status" text DEFAULT 'unverified',
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "p2p_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"maker_id" uuid NOT NULL,
	"taker_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"crypto_amount" numeric(28, 8) NOT NULL,
	"fiat_amount" numeric(20, 2) NOT NULL,
	"price_per_unit" numeric(20, 2) NOT NULL,
	"status" text DEFAULT 'pending',
	"bank_account_id" uuid,
	"payment_sent_at" timestamp with time zone,
	"payment_confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"trade_alerts" boolean DEFAULT true,
	"transaction_alerts" boolean DEFAULT true,
	"kyc_alerts" boolean DEFAULT true,
	"security_alerts" boolean DEFAULT true,
	"promo_alerts" boolean DEFAULT false,
	"push_enabled" boolean DEFAULT true,
	"email_enabled" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text,
	"is_read" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_asset_id_crypto_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."crypto_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_crypto_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."crypto_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_disputes" ADD CONSTRAINT "p2p_disputes_trade_id_p2p_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."p2p_trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_disputes" ADD CONSTRAINT "p2p_disputes_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_offers" ADD CONSTRAINT "p2p_offers_maker_id_users_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_offers" ADD CONSTRAINT "p2p_offers_asset_id_crypto_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."crypto_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_trades" ADD CONSTRAINT "p2p_trades_offer_id_p2p_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."p2p_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_trades" ADD CONSTRAINT "p2p_trades_maker_id_users_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_trades" ADD CONSTRAINT "p2p_trades_taker_id_users_id_fk" FOREIGN KEY ("taker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_trades" ADD CONSTRAINT "p2p_trades_asset_id_crypto_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."crypto_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_trades" ADD CONSTRAINT "p2p_trades_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
*/