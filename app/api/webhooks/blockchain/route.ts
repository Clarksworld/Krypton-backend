import { NextRequest } from "next/server";
import { db } from "@/db";
import { wallets, transactions } from "@/db/schema";
import { ok, err } from "@/lib/errors";
import { eq, sql } from "drizzle-orm";
import { formatUnits } from "ethers";
import crypto from "crypto";

/**
 * POST /api/webhooks/blockchain
 *
 * Receives real-time deposit signals from blockchain providers and
 * automatically credits the matching user wallet.
 *
 * Supported providers / formats:
 *   - Alchemy  (ADDRESS_ACTIVITY webhook, verified via HMAC-SHA256)
 *   - Moralis  (Stream webhook, verified via x-signature header)
 *   - Generic  (custom JSON, verified via Authorization: Bearer <secret>)
 *
 * Required env var:
 *   WEBHOOK_SECRET – shared secret used to authenticate incoming webhooks
 *
 * ─────────────────────────────────────────────────────────────────────────
 * How to set up with Alchemy (recommended for BSC testnet):
 *   1. Go to https://dashboard.alchemy.com → Notify → New Webhook
 *   2. Type: Address Activity
 *   3. Network: BSC Testnet (BSC-TESTNET)
 *   4. Addresses: paste your users' deposit addresses (or use a wildcard)
 *   5. URL: https://your-server.com/api/webhooks/blockchain
 *   6. Copy the webhook signing key → set WEBHOOK_SECRET in .env
 *
 * How to set up with Moralis Streams:
 *   1. Go to https://admin.moralis.io → Streams → New Stream
 *   2. Add the contract / address to watch
 *   3. Set webhook URL and copy the secret → set WEBHOOK_SECRET in .env
 * ─────────────────────────────────────────────────────────────────────────
 */

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Verify a Alchemy webhook signature.
 * Alchemy signs the raw body with HMAC-SHA256 using the signing key.
 */
function verifyAlchemySignature(rawBody: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify a Moralis stream signature.
 * Moralis sends sha3(secret + rawBody) in x-signature header.
 */
function verifyMoralisSignature(rawBody: string, signature: string, secret: string): boolean {
  const hash = crypto
    .createHash("sha3-256")
    .update(secret + rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

type NormalizedActivity = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  /** Raw wei string (for ERC20 Transfer value) or native value in ether */
  value: string;
  asset: string; // "BNB", "USDT", etc.
  network: string; // "BSC-TESTNET", "ETH-MAINNET", etc.
  blockNumber: number;
  confirmed: boolean;
  isErc20: boolean;
  contractAddress: string | null;
};

/** Normalise Alchemy ADDRESS_ACTIVITY payload → our common format */
function normalizeAlchemy(body: any): NormalizedActivity[] {
  const activities: any[] = body?.event?.activity ?? [];
  return activities.map((a: any) => ({
    txHash: a.hash,
    fromAddress: (a.fromAddress ?? "").toLowerCase(),
    toAddress: (a.toAddress ?? "").toLowerCase(),
    value: a.rawContract?.value ?? String(a.value ?? 0),
    asset: a.asset ?? "BNB",
    network: body?.event?.network ?? "BSC-TESTNET",
    blockNumber: parseInt(a.blockNum ?? "0", 16),
    confirmed: body?.type === "ADDRESS_ACTIVITY", // live = confirmed; pending = !confirmed
    isErc20: a.category === "token" || !!a.rawContract?.address,
    contractAddress: a.rawContract?.address?.toLowerCase() ?? null,
  }));
}

/** Normalise Moralis Streams payload → our common format */
function normalizeMoralis(body: any): NormalizedActivity[] {
  const results: NormalizedActivity[] = [];

  // Native transfers
  const nativeTxs: any[] = body?.txs ?? [];
  for (const tx of nativeTxs) {
    results.push({
      txHash: tx.hash,
      fromAddress: (tx.fromAddress ?? "").toLowerCase(),
      toAddress: (tx.toAddress ?? "").toLowerCase(),
      value: tx.value ?? "0",
      asset: "BNB",
      network: "BSC-TESTNET",
      blockNumber: parseInt(tx.blockNumber ?? "0", 10),
      confirmed: !!body.confirmed,
      isErc20: false,
      contractAddress: null,
    });
  }

  // ERC20 transfers
  const erc20Transfers: any[] = body?.erc20Transfers ?? [];
  for (const t of erc20Transfers) {
    results.push({
      txHash: t.transactionHash,
      fromAddress: (t.from ?? "").toLowerCase(),
      toAddress: (t.to ?? "").toLowerCase(),
      value: t.value ?? "0",
      asset: t.tokenSymbol ?? "UNKNOWN",
      network: "BSC-TESTNET",
      blockNumber: parseInt(t.blockNumber ?? "0", 10),
      confirmed: !!body.confirmed,
      isErc20: true,
      contractAddress: (t.contract ?? "").toLowerCase(),
    });
  }

  return results;
}

/** Normalise our own generic test format */
function normalizeGeneric(body: any): NormalizedActivity[] {
  // Single-activity generic format:
  // { txHash, fromAddress, toAddress, value, asset, network, blockNumber, confirmed, contractAddress }
  if (body.txHash && body.toAddress) {
    return [
      {
        txHash: body.txHash,
        fromAddress: (body.fromAddress ?? "").toLowerCase(),
        toAddress: (body.toAddress ?? "").toLowerCase(),
        value: String(body.value ?? "0"),
        asset: body.asset ?? "BNB",
        network: body.network ?? "BSC-TESTNET",
        blockNumber: body.blockNumber ?? 0,
        confirmed: body.confirmed !== false,
        isErc20: !!body.contractAddress,
        contractAddress: body.contractAddress?.toLowerCase() ?? null,
      },
    ];
  }
  return [];
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // ── 1. Authentication / signature verification ───────────────────────
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[webhook] WEBHOOK_SECRET env var not set");
    return err("Webhook secret not configured", 500);
  }

  const alchemySignature = req.headers.get("x-alchemy-signature");
  const moralisSignature = req.headers.get("x-signature");
  const authHeader = req.headers.get("authorization");
  const genericSecret = req.headers.get("x-webhook-secret");

  let provider = "generic";
  let verified = false;

  if (alchemySignature) {
    provider = "alchemy";
    verified = verifyAlchemySignature(rawBody, alchemySignature, webhookSecret);
  } else if (moralisSignature) {
    provider = "moralis";
    verified = verifyMoralisSignature(rawBody, moralisSignature, webhookSecret);
  } else if (authHeader?.startsWith("Bearer ")) {
    provider = "generic";
    const token = authHeader.slice(7);
    verified = crypto.timingSafeEqual(
      Buffer.from(token.padEnd(64)),
      Buffer.from(webhookSecret.padEnd(64))
    );
  } else if (genericSecret) {
    provider = "generic";
    verified = crypto.timingSafeEqual(
      Buffer.from(genericSecret.padEnd(64)),
      Buffer.from(webhookSecret.padEnd(64))
    );
  }

  if (!verified) {
    console.warn(`[webhook] Rejected unauthorized ${provider} webhook`);
    return err("Unauthorized", 401);
  }

  // ── 2. Parse body & normalise ────────────────────────────────────────
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return err("Invalid JSON body", 400);
  }

  let activities: NormalizedActivity[] = [];

  if (provider === "alchemy" || body?.type === "ADDRESS_ACTIVITY") {
    activities = normalizeAlchemy(body);
  } else if (provider === "moralis" || body?.streamId != null) {
    activities = normalizeMoralis(body);
  } else {
    activities = normalizeGeneric(body);
  }

  if (activities.length === 0) {
    return ok({ message: "No actionable activities in this webhook", processed: 0 });
  }

  // ── 3. Process each activity ─────────────────────────────────────────
  const processed: string[] = [];
  const skipped: string[] = [];

  for (const activity of activities) {
    // Only process incoming transfers (to a deposit address)
    if (!activity.toAddress || !activity.txHash) continue;

    // Find the wallet that owns this deposit address
    const wallet = await db.query.wallets.findFirst({
      where: (w, { sql }) =>
        sql`lower(${w.depositAddress}) = ${activity.toAddress}`,
      with: { asset: true },
    });

    if (!wallet) {
      console.log(`[webhook] No wallet found for address ${activity.toAddress}`);
      skipped.push(activity.txHash);
      continue;
    }

    // Idempotency: skip already-processed transactions
    const existing = await db.query.transactions.findFirst({
      where: (t, { eq }) => eq(t.reference, activity.txHash),
    });

    if (existing) {
      // If it exists as 'pending' and this is now confirmed, upgrade it
      if (existing.status === "pending" && activity.confirmed) {
        await db
          .update(transactions)
          .set({ status: "completed" })
          .where(eq(transactions.id, existing.id));
        console.log(`[webhook] Upgraded tx ${activity.txHash} pending → completed`);
        processed.push(activity.txHash);
      } else {
        skipped.push(activity.txHash);
      }
      continue;
    }

    // Determine the amount in human-readable form
    // For ERC20: value is in wei (raw uint256), for native: value is already in ether
    let amount: string;
    if (activity.isErc20) {
      try {
        // parse as 18-decimal token amount (covers USDT on BSC testnet which is 18 decimals)
        amount = formatUnits(BigInt(activity.value), 18);
      } catch {
        amount = activity.value;
      }
    } else {
      try {
        // Native value: could be wei string or already ether float string
        amount = BigInt(activity.value) >= BigInt("1000000000") // looks like wei?
          ? formatUnits(BigInt(activity.value), 18)
          : String(activity.value);
      } catch {
        amount = String(activity.value);
      }
    }

    const status = activity.confirmed ? "completed" : "pending";

    // Insert transaction + update balance atomically if confirmed
    await db.transaction(async (tx) => {
      await tx.insert(transactions).values({
        userId: wallet.userId,
        assetId: wallet.assetId,
        type: "deposit",
        amount,
        status,
        reference: activity.txHash,
        metadata: {
          provider,
          fromAddress: activity.fromAddress,
          toAddress: activity.toAddress,
          blockNumber: activity.blockNumber,
          network: activity.network,
          contractAddress: activity.contractAddress,
        },
      });

      // Only update the balance for confirmed transactions
      if (activity.confirmed) {
        await tx
          .update(wallets)
          .set({ balance: sql`${wallets.balance} + ${amount}` })
          .where(eq(wallets.id, wallet.id));
      }
    });

    console.log(
      `[webhook] ${status.toUpperCase()} deposit: ${amount} ${wallet.asset.symbol} → ${activity.toAddress} (tx: ${activity.txHash})`
    );
    processed.push(activity.txHash);
  }

  return ok({
    message: `Processed ${processed.length} activit${processed.length === 1 ? "y" : "ies"}`,
    processed: processed.length,
    skipped: skipped.length,
    txHashes: processed,
  });
}

// Alchemy sends a GET to verify the webhook endpoint is reachable
export async function GET() {
  return ok({ status: "Blockchain webhook endpoint is active" });
}
