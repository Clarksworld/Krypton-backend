import postgres from "postgres";
import * as dotenv from "dotenv";
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function columnExists(table: string, column: string) {
  const result = await sql`
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = ${table} AND column_name = ${column}
  `;
  return result.length > 0;
}

async function fixSchema() {
  console.log("Applying profile schema updates...");

  if (!(await columnExists("users", "password_updated_at"))) {
    console.log("Adding password_updated_at to users");
    await sql`ALTER TABLE users ADD COLUMN password_updated_at TIMESTAMPTZ`;
  }

  if (!(await columnExists("user_profiles", "private_portfolio"))) {
    console.log("Adding private_portfolio to user_profiles");
    await sql`ALTER TABLE user_profiles ADD COLUMN private_portfolio BOOLEAN DEFAULT false`;
  }

  if (!(await columnExists("user_profiles", "preferred_currency"))) {
    console.log("Adding preferred_currency to user_profiles");
    await sql`ALTER TABLE user_profiles ADD COLUMN preferred_currency TEXT DEFAULT 'USD'`;
  }

  const tableResult = await sql`
    SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions'
  `;
  if (tableResult.length === 0) {
    console.log("Creating user_sessions table");
    await sql`
      CREATE TABLE user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        device_name TEXT,
        location TEXT,
        ip_address TEXT,
        user_agent TEXT,
        last_seen_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  }

  console.log("Profile schema updates complete.");
  process.exit(0);
}

fixSchema().catch(err => {
  console.error("Error applying schema:", err);
  process.exit(1);
});
