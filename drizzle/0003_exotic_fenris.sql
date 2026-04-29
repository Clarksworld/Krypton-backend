CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"device_name" text,
	"location" text,
	"ip_address" text,
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "p2p_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"attachment_url" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mining_upgrades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_usdt" numeric(20, 2) NOT NULL,
	"mining_rate" numeric(28, 8) NOT NULL,
	"duration_days" numeric DEFAULT '30',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "mining_upgrades_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_mining_upgrades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"upgrade_id" uuid NOT NULL,
	"tx_hash" text NOT NULL,
	"status" text DEFAULT 'pending',
	"started_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "global_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"type" text DEFAULT 'string',
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "global_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "private_portfolio" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "preferred_currency" text DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "p2p_trades" ADD COLUMN "escrow_locked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "p2p_trades" ADD COLUMN "escrow_released" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "type" text DEFAULT 'social';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "task_link" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "completion_code" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "puzzle_data" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "correct_answer" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_messages" ADD CONSTRAINT "p2p_messages_trade_id_p2p_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."p2p_trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_messages" ADD CONSTRAINT "p2p_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mining_upgrades" ADD CONSTRAINT "user_mining_upgrades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mining_upgrades" ADD CONSTRAINT "user_mining_upgrades_upgrade_id_mining_upgrades_id_fk" FOREIGN KEY ("upgrade_id") REFERENCES "public"."mining_upgrades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_unique" UNIQUE("title");