ALTER TABLE "tasks" ADD COLUMN "type" text DEFAULT 'social';
ALTER TABLE "tasks" ADD COLUMN "task_link" text;
ALTER TABLE "tasks" ADD COLUMN "completion_code" text;
ALTER TABLE "tasks" ADD COLUMN "puzzle_data" text;
ALTER TABLE "tasks" ADD COLUMN "correct_answer" text;
ALTER TABLE "tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_unique" UNIQUE("title");

CREATE TABLE IF NOT EXISTS "mining_upgrades" (
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

CREATE TABLE IF NOT EXISTS "user_mining_upgrades" (
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

DO $$ BEGIN
 ALTER TABLE "user_mining_upgrades" ADD CONSTRAINT "user_mining_upgrades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_mining_upgrades" ADD CONSTRAINT "user_mining_upgrades_upgrade_id_mining_upgrades_id_fk" FOREIGN KEY ("upgrade_id") REFERENCES "public"."mining_upgrades"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
