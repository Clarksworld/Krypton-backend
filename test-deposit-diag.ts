import "dotenv/config";
import { db } from "./db";
import { JsonRpcProvider, formatUnits } from "ethers";

const RPC = process.env.BSC_TESTNET_RPC_URL ?? "https://bsc-testnet.public.blastapi.io";

async function main() {
  console.log("\n=== BSC RPC ===");
  console.log("RPC URL:", RPC);

  // 1. Connect to provider
  const provider = new JsonRpcProvider(RPC, { chainId: 97, name: "bnbt" });
  try {
    const block = await Promise.race([
      provider.getBlockNumber(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)),
    ]);
    console.log("Current block:", block);
  } catch (e) {
    console.error("❌ Provider failed:", e);
    process.exit(1);
  }

  // 2. List all users
  const users = await db.query.users.findMany({ columns: { id: true, email: true } });
  console.log("\n=== USERS ===");
  users.forEach(u => console.log(" -", u.id, u.email));

  // 3. For each user, list their wallets
  for (const user of users) {
    const wallets = await db.query.wallets.findMany({
      where: (w, { eq }) => eq(w.userId, user.id),
      with: { asset: true },
    });

    console.log(`\n=== WALLETS for ${user.email} ===`);
    for (const wallet of wallets) {
      console.log(`\n  Asset: ${wallet.asset.symbol}`);
      console.log(`  DB Balance: ${wallet.balance}`);
      console.log(`  Deposit Address: ${wallet.depositAddress}`);
      console.log(`  Networks (raw):`, JSON.stringify(wallet.asset.networks, null, 4));

      if (wallet.depositAddress) {
        try {
          const onChainBal = await provider.getBalance(wallet.depositAddress);
          console.log(`  On-chain Balance: ${formatUnits(onChainBal, 18)} BNB`);
        } catch (e) {
          console.error(`  ❌ Failed to get on-chain balance:`, e);
        }
      }
    }
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
