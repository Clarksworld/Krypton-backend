import { checkOnChainDeposits } from "./lib/blockchain/monitor";
import { db } from "./db";

async function run() {
  const users = await db.query.users.findMany({ limit: 1 });
  if (users.length === 0) {
    console.log("No users found");
    process.exit(0);
  }
  const userId = users[0].id;
  console.log(`Checking deposits for user ${userId}...`);
  try {
    const results = await checkOnChainDeposits(userId);
    console.log("Results:", results);
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

run();
