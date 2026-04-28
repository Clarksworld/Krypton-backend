import { NextRequest } from "next/server";
import { JsonRpcProvider, Interface, formatUnits } from "ethers";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { userMiningUpgrades, miningStats } from "@/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/lib/config";

// Minimal BEP20 Transfer ABI
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// USDT decimals on BSC (both mainnet and testnet use 18)
const USDT_DECIMALS = 18;

// Minimum on-chain confirmations before accepting payment
const MIN_CONFIRMATIONS = 3;

// BSC RPC fallbacks (testnet)
const BSC_RPCS = [
  env.BSC_TESTNET_RPC_URL,
  "https://bsc-testnet-rpc.publicnode.com",
  "https://endpoints.omniatech.io/v1/bsc/testnet/public",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
];

async function getBscProvider(): Promise<JsonRpcProvider | null> {
  for (const rpc of BSC_RPCS) {
    try {
      const provider = new JsonRpcProvider(rpc, { chainId: 97, name: "bnbt" });
      await Promise.race([
        provider.getBlockNumber(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8_000)
        ),
      ]);
      return provider;
    } catch {
      // try next RPC
    }
  }
  return null;
}

/**
 * @swagger
 * /api/mining/upgrades/verify:
 *   post:
 *     summary: Verify Upgrade Payment
 *     description: Verify a blockchain transaction hash and activate the mining boost.
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [upgradeId, txHash]
 *             properties:
 *               upgradeId:
 *                 type: string
 *               txHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Upgrade activated
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { upgradeId, txHash } = await req.json();

    if (!upgradeId || !txHash) {
      return err("Missing upgradeId or txHash", 400);
    }

    // 1. Check txHash has not already been used
    const existingTx = await db.query.userMiningUpgrades.findFirst({
      where: (u, { eq }) => eq(u.txHash, txHash),
    });
    if (existingTx) {
      return err("This transaction hash has already been used", 400);
    }

    // 2. Get upgrade plan details
    const upgrade = await db.query.miningUpgrades.findFirst({
      where: (u, { eq }) => eq(u.id, upgradeId),
    });
    if (!upgrade) {
      return err("Upgrade plan not found", 404);
    }

    // 3. Get the platform's upgrade fee wallet address
    const walletSetting = await db.query.globalSettings.findFirst({
      where: (s, { eq }) => eq(s.key, "upgrade_fee_wallet_address"),
    });
    if (!walletSetting?.value) {
      return err("Upgrade fee wallet is not configured. Please contact support.", 503);
    }
    const feeWalletAddress = walletSetting.value.toLowerCase();

    // 4. Connect to BSC
    const provider = await getBscProvider();
    if (!provider) {
      return err("Could not connect to the blockchain network. Please try again shortly.", 503);
    }

    // 5. Fetch tx receipt and current block in parallel
    const [receipt, currentBlock] = await Promise.all([
      provider.getTransactionReceipt(txHash),
      provider.getBlockNumber(),
    ]);

    if (!receipt) {
      return err(
        "Transaction not found on chain. It may still be pending — please wait and try again.",
        400
      );
    }

    // 6. Check tx succeeded
    if (receipt.status !== 1) {
      return err("Transaction failed on chain and cannot be used for an upgrade.", 400);
    }

    // 7. Check confirmations
    const confirmations = currentBlock - receipt.blockNumber;
    if (confirmations < MIN_CONFIRMATIONS) {
      return err(
        `Transaction only has ${confirmations} confirmation(s). Please wait for at least ${MIN_CONFIRMATIONS} confirmations before retrying.`,
        400
      );
    }

    // 8. Decode BEP20 Transfer logs — find a transfer to the fee wallet
    const iface = new Interface(ERC20_ABI);
    let verifiedAmount: number | null = null;

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (!parsed || parsed.name !== "Transfer") continue;

        const toAddress: string = (parsed.args.to as string).toLowerCase();
        if (toAddress !== feeWalletAddress) continue;

        verifiedAmount = parseFloat(formatUnits(parsed.args.value, USDT_DECIMALS));
        break;
      } catch {
        // log is not a Transfer event, skip
      }
    }

    if (verifiedAmount === null) {
      return err(
        "No USDT transfer to the upgrade wallet was found in this transaction. Please ensure you sent to the correct address.",
        400
      );
    }

    // 9. Verify amount >= upgrade price
    const requiredAmount = parseFloat(upgrade.priceUsdt);
    if (verifiedAmount < requiredAmount) {
      return err(
        `Insufficient payment. Required: ${requiredAmount} USDT, but only ${verifiedAmount.toFixed(2)} USDT was received.`,
        400
      );
    }

    // 10. All checks passed — activate the upgrade
    const durationDays = parseInt(upgrade.durationDays || "30");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await db.transaction(async (tx) => {
      // Insert user upgrade record (status: active)
      await tx.insert(userMiningUpgrades).values({
        userId,
        upgradeId,
        txHash,
        status: "active",
        startedAt: new Date(),
        expiresAt,
      });

      // Update or create mining stats with the new mining rate
      const stats = await tx.query.miningStats.findFirst({
        where: (m, { eq }) => eq(m.userId, userId),
      });

      if (stats) {
        await tx
          .update(miningStats)
          .set({ miningRate: upgrade.miningRate, updatedAt: new Date() })
          .where(eq(miningStats.userId, userId));
      } else {
        await tx.insert(miningStats).values({
          userId,
          miningRate: upgrade.miningRate,
        });
      }
    });

    return ok({
      message: "Upgrade activated successfully!",
      miningRate: upgrade.miningRate,
      expiresAt,
      verifiedAmount,
    });
  } catch (error) {
    return handleError(error);
  }
}
