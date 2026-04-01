
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
  console.log("Checking and fixing database schema...");

  const tables = [
    { name: "crypto_assets", columns: ["created_at", "updated_at"] },
    { name: "wallets", columns: ["updated_at"] },
    { name: "bank_accounts", columns: ["updated_at"] },
    { name: "kyc_submissions", columns: ["updated_at"] },
    { name: "p2p_offers", columns: ["updated_at"] },
    { name: "p2p_trades", columns: ["updated_at"] },
    { name: "p2p_disputes", columns: ["updated_at"] },
    { name: "notifications", columns: ["updated_at"] },
  ];

  for (const table of tables) {
    for (const column of table.columns) {
      if (!(await columnExists(table.name, column))) {
        console.log(`Adding column ${column} to ${table.name}...`);
        await sql.unsafe(`ALTER TABLE ${table.name} ADD COLUMN ${column} TIMESTAMPTZ DEFAULT NOW()`);
      }
    }
  }

  // Handle users.user_index separately as it's a SERIAL/UNIQUE
  if (!(await columnExists("users", "user_index"))) {
    console.log("Adding user_index to users table...");
    // We add it as serial, which creates the sequence automatically
    await sql`ALTER TABLE users ADD COLUMN user_index SERIAL UNIQUE`;
  }

  console.log("Schema fix complete.");
  process.exit(0);
}

fixSchema().catch((err) => {
  console.error("Error fixing schema:", err);
  process.exit(1);
});
