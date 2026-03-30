import "dotenv/config";
import { db } from "./db";
import { users, cryptoAssets } from "./db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = `wallet-test-${Date.now()}@example.com`;
  const password = "password123";
  const username = `walletuser_${Date.now()}`;

  console.log(`--- Testing Wallet Module for ${email} ---`);

  // 1. Register User
  console.log("1. Registering user...");
  const regRes = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
    headers: { "Content-Type": "application/json" },
  });
  const regData = await regRes.json();
  const cookie = regRes.headers.get("set-cookie");

  if (!cookie) {
    console.error("Failed to get session cookie from registration");
    return;
  }

  // 2. Initialize Wallets
  console.log("2. Initializing wallets...");
  const initRes = await fetch("http://localhost:3000/api/wallet/initialize", {
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        "Cookie": cookie
    },
  });
  console.log("Init Wallets Response:", await initRes.json());

  // 3. Check Initial Balances
  console.log("3. Checking balances...");
  const balanceRes = await fetch("http://localhost:3000/api/wallet", {
    headers: { "Cookie": cookie },
  });
  const balanceData = await balanceRes.json();
  console.log("Initial Wallets:", JSON.stringify(balanceData.wallets, null, 2));

  // 4. Simulate Deposit (USDT)
  console.log("4. Simulating deposit of 100 USDT...");
  const depositRes = await fetch("http://localhost:3000/api/wallet/deposit", {
    method: "POST",
    body: JSON.stringify({ assetSymbol: "USDT", amount: "100" }),
    headers: { 
        "Content-Type": "application/json",
        "Cookie": cookie
    },
  });
  console.log("Deposit Response:", await depositRes.json());

  // 5. Final Balance Check
  console.log("5. Final balance check...");
  const finalBalanceRes = await fetch("http://localhost:3000/api/wallet", {
    headers: { "Cookie": cookie },
  });
  const finalBalanceData = await finalBalanceRes.json();
  console.log("Final USDT Balance:", finalBalanceData.wallets.find((w: any) => w.symbol === "USDT")?.balance);

  // 6. Check Transactions
  console.log("6. Checking transactions...");
  const txRes = await fetch("http://localhost:3000/api/transactions", {
    headers: { "Cookie": cookie },
  });
  const txData = await txRes.json();
  console.log("Latest Transaction:", txData.transactions[0]?.type, txData.transactions[0]?.amount);
}

main();
