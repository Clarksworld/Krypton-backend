import { db } from "../db";
import { transactions, wallets, cryptoAssets, users } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

async function verify() {
  console.log("🚀 Starting Phase 5 Verification...");

  // 1. Setup Test User & Wallet
  let testUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, "test@krypton.xyz"),
  });

  if (!testUser) {
    console.log("Creating test user...");
    const [u] = await db.insert(users).values({
      email: "test@krypton.xyz",
      passwordHash: "not_needed_for_this_test",
      isEmailVerified: true,
    }).returning();
    testUser = u;
  }

  const usdt = await db.query.cryptoAssets.findFirst({
    where: (ca, { eq }) => eq(ca.symbol, "USDT"),
  });

  if (!usdt) {
    console.error("❌ USDT asset not found in DB. Please run seed first.");
    return;
  }

  let wallet = await db.query.wallets.findFirst({
    where: (w, { eq, and }) => and(eq(w.userId, testUser!.id), eq(w.assetId, usdt.id)),
  });

  if (!wallet) {
    console.log("Creating test wallet...");
    const [w] = await db.insert(wallets).values({
      userId: testUser.id,
      assetId: usdt.id,
      depositAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Mock address
      balance: "100.00000000",
      frozenBalance: "0.00000000",
    }).returning();
    wallet = w;
  }

  console.log("Using Wallet ID:", wallet.id);
  console.log("Initial Balance:", wallet.balance, "Frozen:", wallet.frozenBalance);

  // 2. Simulate Webhook Calls via CURL (so we hit the REAL route handler)
  const webhookUrl = "http://localhost:3000/api/webhooks/blockchain";
  const workerUrl = "http://localhost:3000/api/workers/process-withdrawals";
  const webhookSecret = process.env.WEBHOOK_SECRET || "77cd2288ff73c8b7d283ccf23a0ecff7a974b8e53ad70bf1eeb7ff7b04b69b0a";
  const workerSecret = process.env.WORKER_SECRET || "development_secret_only";

  async function callWebhook(payload: any) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": webhookSecret,
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function callWorker() {
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${workerSecret}`,
      },
    });
    return res.json();
  }

  // --- SCENARIO 1: NEW DEPOSIT ---
  console.log("\n--- Scenario 1: New Deposit ---");
  const depositTxHash = "0x" + Math.random().toString(16).slice(2, 66).padEnd(64, '0');
  const depositPayload = {
    txHash: depositTxHash,
    toAddress: wallet.depositAddress,
    value: "50000000000000000000", // 50 USDT (18 decimals)
    asset: "USDT",
    network: "BSC-TESTNET",
    confirmed: true,
    contractAddress: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"
  };

  const depositRes = await callWebhook(depositPayload);
  console.log("Deposit Result:", depositRes);

  let updatedWallet = await db.query.wallets.findFirst({ where: eq(wallets.id, wallet.id) });
  console.log("New Balance:", updatedWallet?.balance);

  // --- SCENARIO 2: WITHDRAWAL CONFIRMATION ---
  console.log("\n--- Scenario 2: Withdrawal Confirmation ---");
  const withdrawTxHash = "0x" + Math.random().toString(16).slice(2, 66).padEnd(64, '0');
  
  // Create a processing withdrawal manually
  const [withdrawTx] = await db.insert(transactions).values({
    userId: testUser.id,
    assetId: usdt.id,
    type: "withdrawal",
    amount: "10.00000000",
    fee: "1.00000000",
    status: "processing",
    reference: withdrawTxHash,
  }).returning();

  // Set frozen balance to 11 (10 + 1 fee)
  await db.update(wallets).set({ 
    frozenBalance: sql`${wallets.frozenBalance} + 11.00000000` 
  }).where(eq(wallets.id, wallet.id));

  const confirmationPayload = {
    txHash: withdrawTxHash,
    toAddress: "0xUserExternalAddress",
    confirmed: true,
  };

  const confirmRes = await callWebhook(confirmationPayload);
  console.log("Confirmation Result:", confirmRes);

  updatedWallet = await db.query.wallets.findFirst({ where: eq(wallets.id, wallet.id) });
  const finalTx = await db.query.transactions.findFirst({ where: eq(transactions.id, withdrawTx.id) });

  console.log("Withdrawal Status:", finalTx?.status);
  console.log("Final Frozen Balance:", updatedWallet?.frozenBalance);

  // --- SCENARIO 3: STALE RECOVERY (DROPPED TX) ---
  console.log("\n--- Scenario 3: Stale Recovery (Mocking Failure) ---");
  const staleTxHash = "0x" + Math.random().toString(16).slice(2, 66).padEnd(64, '0');
  
  // Create a processing withdrawal that is "stale" (manually set updatedAt to past)
  const [staleTx] = await db.insert(transactions).values({
    userId: testUser.id,
    assetId: usdt.id,
    type: "withdrawal",
    amount: "5.00000000",
    fee: "1.00000000",
    status: "processing",
    reference: staleTxHash,
    updatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
  }).returning();

  // Update current wallet balance & frozen
  await db.update(wallets).set({ 
    frozenBalance: sql`${wallets.frozenBalance} + 6.00000000` 
  }).where(eq(wallets.id, wallet.id));

  console.log("Triggering worker for recovery...");
  const workerRes = await callWorker();
  console.log("Worker Result (Recovered):", workerRes.recoveryResults);

  updatedWallet = await db.query.wallets.findFirst({ where: eq(wallets.id, wallet.id) });
  const recoveredTx = await db.query.transactions.findFirst({ where: eq(transactions.id, staleTx.id) });

  console.log("Recovered Tx Status:", recoveredTx?.status);
  console.log("Final Wallet Balance (Refunded):", updatedWallet?.balance);
  console.log("Final Wallet Frozen Balance (Refunded):", updatedWallet?.frozenBalance);

  console.log("\n✅ Verification complete.");
}

verify().catch(err => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
