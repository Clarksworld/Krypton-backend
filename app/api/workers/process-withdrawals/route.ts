import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, wallets } from "@/db/schema";
import { and, eq, sql, lt } from "drizzle-orm";
import { JsonRpcProvider } from "ethers";
import { sendFromHotWallet } from "@/lib/blockchain/evm";
import { env } from "@/lib/config";

// Secure with a simple auth token. In production, provide this in .env
/**
 * @swagger
 * /api/workers/process-withdrawals:
 *   post:
 *     summary: Process pending withdrawals
 *     description: Periodic worker that picks up pending withdrawals, signs transactions, and broadcasts them.
 *     tags: [Infrastructure]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Worker finished execution
 *       401:
 *         description: Unauthorized (Invalid Worker Secret)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = env.WORKER_SECRET || "development_secret_only";

    // Support both "Bearer <token>" and just "<token>"
    const providedToken = authHeader?.startsWith("Bearer ") 
      ? authHeader.slice(7).trim() 
      : authHeader?.trim();

    const isAuthorized = providedToken === secret.trim();

    if (!isAuthorized) {
      console.warn(`[Worker] Unauthorized access attempt.`);
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
        
        // Safety check for asset
        if (!tx.asset) {
          throw new Error("Asset configuration missing for transaction");
        }

        const networks = tx.asset.networks as any[];
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
            reference: txHash, // Critical: set reference to txHash for the webhook to find it
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

    // ─── Phase 2: Stale Transaction Recovery ───────────────────
    // Recovery for transactions stuck in 'processing' for > 20 mins
    const STALE_THRESHOLD = new Date(Date.now() - 20 * 60 * 1000);
    const staleTxs = await db.query.transactions.findMany({
      where: (t, { eq, and, lt }) => and(
        eq(t.status, "processing"),
        eq(t.type, "withdrawal"),
        lt(t.updatedAt, STALE_THRESHOLD)
      ),
      with: { asset: true },
      limit: 10,
    });

    const recoveryResults = [];

    for (const tx of staleTxs) {
      try {
        if (!tx.reference || !tx.reference.startsWith("0x")) {
          // If reference is missing or not a txHash (e.g. legacy request ID), 
          // we can't recover it via the blockchain yet.
          continue;
        }

        const receipt = await provider.getTransactionReceipt(tx.reference);
        
        if (receipt) {
          if (receipt.status === 1) {
            // Confirmed on-chain
            await db.transaction(async (dbTx) => {
              const totalAmount = (Number(tx.amount) + Number(tx.fee || 0)).toFixed(8);
              
              await dbTx.update(transactions)
                .set({ status: "completed", updatedAt: new Date() })
                .where(eq(transactions.id, tx.id));

              if (!tx.userId || !tx.assetId) return;

              await dbTx.update(wallets)
                .set({ 
                  frozenBalance: sql`${wallets.frozenBalance} - ${totalAmount}`,
                  updatedAt: new Date()
                })
                .where(and(eq(wallets.userId, tx.userId!), eq(wallets.assetId, tx.assetId!)));
            });
            recoveryResults.push({ id: tx.id, status: "completed (recovered)" });
          } else {
            // Failed on-chain (reverted)
            await db.transaction(async (dbTx) => {
              const totalAmount = (Number(tx.amount) + Number(tx.fee || 0)).toFixed(8);
              
              await dbTx.update(transactions)
                .set({ status: "failed", updatedAt: new Date() })
                .where(eq(transactions.id, tx.id));

              if (!tx.userId || !tx.assetId) return;

              await dbTx.update(wallets)
                .set({ 
                  balance: sql`${wallets.balance} + ${totalAmount}`,
                  frozenBalance: sql`${wallets.frozenBalance} - ${totalAmount}`,
                  updatedAt: new Date()
                })
                .where(and(eq(wallets.userId, tx.userId!), eq(wallets.assetId, tx.assetId!)));
            });
            recoveryResults.push({ id: tx.id, status: "failed (recovered)" });
          }
        } else {
          // No receipt found. Check if transaction even exists in mempool
          const onChainTx = await provider.getTransaction(tx.reference);
          if (!onChainTx) {
            // Dropped from mempool or never arrived. Mark as failed and refund.
            await db.transaction(async (dbTx) => {
              const totalAmount = (Number(tx.amount) + Number(tx.fee || 0)).toFixed(8);
              
              await dbTx.update(transactions)
                .set({ status: "failed", updatedAt: new Date() })
                .where(eq(transactions.id, tx.id));

              if (!tx.userId || !tx.assetId) return;

              await dbTx.update(wallets)
                .set({ 
                  balance: sql`${wallets.balance} + ${totalAmount}`,
                  frozenBalance: sql`${wallets.frozenBalance} - ${totalAmount}`,
                  updatedAt: new Date()
                })
                .where(and(eq(wallets.userId, tx.userId!), eq(wallets.assetId, tx.assetId!)));
            });
            recoveryResults.push({ id: tx.id, status: "failed (dropped/not found)" });
          }
          // If it's in the mempool but no receipt, just leave it alone for now.
        }
      } catch (recoveryErr) {
        console.error(`[Worker] Failed recovery check for tx ${tx.id}:`, recoveryErr);
      }
    }

    return NextResponse.json({ 
      processed: results.length, 
      results,
      recovered: recoveryResults.length,
      recoveryResults 
    });

  } catch (error: any) {
    console.error("Worker error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
