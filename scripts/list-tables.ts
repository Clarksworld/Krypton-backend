import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL!;
  console.log("Listing tables in database...");
  const sql = postgres(connectionString);

  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log("Tables found:", tables.map(t => t.table_name));
  } catch (err) {
    console.error("Failed to list tables:", err);
    process.exit(1);
  }
  process.exit(0);
}

main();
