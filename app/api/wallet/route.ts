import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { checkOnChainDeposits } from "@/lib/blockchain/monitor";
import { getNgnRate, computePortfolioValue } from "@/lib/pricing";

/**
 * @swagger
 * /api/wallet:
 *   get:
 *     summary: Get all wallets and balances for the current user
 *     description: Fetch a list of all user wallets with their respective assets, balances, and deposit addresses.
 *     tags: [Wallet]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    // Auto-sync deposits from blockchain on every balance fetch
    try {
      await checkOnChainDeposits(userId);
    } catch (syncErr) {
      console.error("Wallet sync failed:", syncErr);
      // We continue anyway to show existing balances
    }

    // Fetch user with wallets AND assets (thanks to relations)
    const userWallets = await db.query.wallets.findMany({
      where: (w, { eq }) => eq(w.userId, userId),
      with: {
        asset: true,
      },
    });

    // Fetch NGN rate (from admin settings or fallback)
    const ngnRate = await getNgnRate();

    // Compute USD/NGN values per wallet
    const { perWallet, totalBalanceUsd, totalBalanceNgn } = computePortfolioValue(
      userWallets.map((w) => ({ symbol: w.asset.symbol, balance: w.balance })),
      ngnRate
    );

    // Format for frontend
    const walletsInfo = userWallets.map((w, i) => ({
      id: w.id,
      symbol: w.asset.symbol,
      name: w.asset.name,
      iconUrl: w.asset.iconUrl,
      balance: w.balance,
      frozenBalance: w.frozenBalance,
      depositAddress: w.depositAddress,
      usdValue: perWallet[i].usdValue.toFixed(2),
      ngnValue: perWallet[i].ngnValue.toFixed(2),
    }));

    return ok({
      wallets: walletsInfo,
      totalBalanceUsd: totalBalanceUsd.toFixed(2),
      totalBalanceNgn: totalBalanceNgn.toFixed(2),
    });
  } catch (err) {
    return handleError(err);
  }
}
