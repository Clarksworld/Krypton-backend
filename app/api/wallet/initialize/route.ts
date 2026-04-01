import { NextRequest } from "next/server";
import { db } from "@/db";
import { wallets, cryptoAssets, users } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { generateUserEVMAddress } from "@/lib/blockchain/evm";

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);

    // Get user's index for deterministic address generation
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    // Get all supported crypto assets
    const allAssets = await db.query.cryptoAssets.findMany({
      where: (ca, { eq }) => eq(ca.isActive, true),
    });

    // Create wallets for any missing assets
    const results = await Promise.all(
      allAssets.map(async (asset) => {
        let depositAddress: string | null = null;

        // Check if the asset has a BEP20 or ERC20 network
        const networks = asset.networks as Array<{ name: string; addressRegex: string }> | null;
        const hasEVMNetwork = networks?.some(n => n.name === "BEP20" || n.name === "ERC20");

        if (hasEVMNetwork) {
          // Generate real BSC/EVM address based on userIndex
          depositAddress = generateUserEVMAddress(user.userIndex);
        } else {
          // Fallback to mock for other networks (e.g. BTC) until implemented
          depositAddress = `mock_${asset.symbol.toLowerCase()}_${userId.slice(0, 8)}`;
        }

        // We use insert().onConflictDoUpdate() to ensure address is set if missing
        return await db
          .insert(wallets)
          .values({
            userId,
            assetId: asset.id,
            depositAddress,
          })
          .onConflictDoUpdate({
            target: [wallets.userId, wallets.assetId],
            set: { depositAddress },
          });
      })
    );

    return ok({ message: "Wallets initialized successfully" });
  } catch (err) {
    return handleError(err);
  }
}
