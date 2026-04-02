import postgres from "postgres";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(connectionString);

async function run() {
  console.log("Applying migration...\n");
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "mining_stats" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "balance" numeric(28, 8) DEFAULT '0',
        "mining_rate" numeric(28, 8) DEFAULT '0.5',
        "last_claimed_at" timestamp with time zone DEFAULT now(),
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now(),
        CONSTRAINT "mining_stats_user_id_unique" UNIQUE("user_id")
      )
    `;
    console.log("✅ mining_stats created");

    await sql`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "reward_amount" numeric(28, 8) NOT NULL,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp with time zone DEFAULT now()
      )
    `;
    console.log("✅ tasks created");

    await sql`
      CREATE TABLE IF NOT EXISTS "user_tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "task_id" uuid NOT NULL,
        "completed_at" timestamp with time zone DEFAULT now(),
        CONSTRAINT "user_task_unique" UNIQUE("user_id","task_id")
      )
    `;
    console.log("✅ user_tasks created");

    await sql`
      CREATE TABLE IF NOT EXISTS "subscription_plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "price_usdt" numeric(20, 2) NOT NULL,
        "duration_days" numeric NOT NULL,
        "features" text[],
        "is_active" boolean DEFAULT true,
        "created_at" timestamp with time zone DEFAULT now()
      )
    `;
    console.log("✅ subscription_plans created");

    await sql`
      CREATE TABLE IF NOT EXISTS "user_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "plan_id" uuid NOT NULL,
        "status" text DEFAULT 'active',
        "started_at" timestamp with time zone DEFAULT now(),
        "expires_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone DEFAULT now()
      )
    `;
    console.log("✅ user_subscriptions created");

    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false`;
    console.log("✅ users.is_admin column added");

    // Add FKs if not already present (ignore errors)
    try {
      await sql`ALTER TABLE "mining_stats" ADD CONSTRAINT "mining_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade`;
    } catch { /* already exists */ }

    try {
      await sql`ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade`;
    } catch { /* already exists */ }

    try {
      await sql`ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade`;
    } catch { /* already exists */ }

    try {
      await sql`ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade`;
    } catch { /* already exists */ }

    try {
      await sql`ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id")`;
    } catch { /* already exists */ }

    console.log("\n✅ All migrations applied successfully!");

    // Verify tables
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' 
      AND table_name IN ('mining_stats','tasks','user_tasks','subscription_plans','user_subscriptions')
      ORDER BY table_name
    `;
    console.log("\nVerified tables:", tables.map((r: any) => r.table_name));

  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

run();
