import { NextRequest } from "next/server";
import { db } from "@/db";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

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
