import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

async function main() {
  const connectionString = process.env.DATABASE_URL!;
  console.log("Running manual migration for user_index...");
  const sqlClient = postgres(connectionString);
  const db = drizzle(sqlClient);

  try {
    // Check if the table exists and add the column if not
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_index" SERIAL NOT NULL UNIQUE;`);
    console.log("Successfully added user_index column!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
  process.exit(0);
}

main();
