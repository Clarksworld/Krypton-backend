import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { checkOnChainDeposits } from "@/lib/blockchain/monitor";

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

    // Format for frontend
    const walletsInfo = userWallets.map((w) => ({
      id: w.id,
      symbol: w.asset.symbol,
      name: w.asset.name,
      iconUrl: w.asset.iconUrl,
      balance: w.balance,
      frozenBalance: w.frozenBalance,
      depositAddress: w.depositAddress,
    }));

    return ok({ wallets: walletsInfo });
  } catch (err) {
    return handleError(err);
  }
}
