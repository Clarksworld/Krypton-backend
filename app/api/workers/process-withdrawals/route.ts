import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { JsonRpcProvider } from "ethers";
import { sendFromHotWallet } from "@/lib/blockchain/evm";
import { env } from "@/lib/config";

// Secure with a simple auth token. In production, provide this in .env
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = env.WORKER_SECRET || "development_secret_only";
    const expectedHeader = `Bearer ${secret}`;

    // Case-insensitive check for 'Bearer ' and trimmed token comparison
    const isAuthorized = authHeader && 
                         authHeader.toLowerCase().startsWith("bearer ") && 
                         authHeader.slice(7).trim() === secret.trim();

    if (!isAuthorized) {
      console.warn(`[Worker] Unauthorized access attempt: 
        Received: "${authHeader}"
        Expected: "${expectedHeader}"`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get up to 5 pending withdrawals to process in batch
    const pendingWithdrawals = await db.query.transactions.findMany({
      where: (t, { eq, and }) => and(
        eq(t.type, "withdrawal"),
        eq(t.status, "pending")
      ),
      with: {
        asset: true,
      },
      limit: 5,
    });

    if (pendingWithdrawals.length === 0) {
      return NextResponse.json({ message: "No pending withdrawals to process." });
    }

    const provider = new JsonRpcProvider(env.BSC_TESTNET_RPC_URL, {
      chainId: 97,
      name: "bnbt",
    });

    const results = [];

    for (const tx of pendingWithdrawals) {
      try {
        const metadata = tx.metadata as any;
        // Verify this is an external withdrawal by checking metadata
        if (!metadata || !metadata.to || !metadata.isExternal) {
          continue; // skip internal or malformed txs
        }

        const toAddress = metadata.to;
        const amount = tx.amount;
        
        const networks = tx.asset?.networks as any[];
        const bscNetwork = networks?.find(n => n.name === "BEP20" || n.name === "ERC20");
        
        let contractAddress: string | null = null;
        if (bscNetwork && !bscNetwork.isNative) {
          contractAddress = bscNetwork.contractAddress || bscNetwork.tokenAddress;
        }

        console.log(`[Worker] Sending ${amount} ${tx.asset.symbol} to ${toAddress}`);

        // Execute on blockchain
        const txHash = await sendFromHotWallet(provider, toAddress, amount, contractAddress);

        // Update to processing with txHash. 
        // User instructions: "Update the status to PROCESSING (with the txHash). Wait for the webhook to mark it COMPLETED"
        await db
          .update(transactions)
          .set({
            status: "processing",
            metadata: {
              ...metadata,
              txHash,
              processedAt: new Date().toISOString(),
            }
          })
          .where(eq(transactions.id, tx.id));

        results.push({ id: tx.id, status: "processing", txHash });
      } catch (err: any) {
        console.error(`[Worker] Failed to process withdrawal ${tx.id}:`, err);
        results.push({ id: tx.id, status: "error", error: err.message });
      }
    }

    return NextResponse.json({ processed: results.length, results });

  } catch (error: any) {
    console.error("Worker error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
