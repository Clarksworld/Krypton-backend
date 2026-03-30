import { NextRequest } from "next/server";
import { db } from "@/db";
import { wallets, cryptoAssets } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);

    // Get all supported crypto assets
    const allAssets = await db.query.cryptoAssets.findMany({
      where: (ca, { eq }) => eq(ca.isActive, true),
    });

    // Create wallets for any missing assets
    const results = await Promise.all(
      allAssets.map(async (asset) => {
        // We use insert().onConflictDoNothing() to be idempotent
        return await db
          .insert(wallets)
          .values({
            userId,
            assetId: asset.id,
            depositAddress: `mock_${asset.symbol.toLowerCase()}_${userId.slice(0, 8)}`,
          })
          .onConflictDoNothing();
      })
    );

    return ok({ message: "Wallets initialized successfully" });
  } catch (err) {
    return handleError(err);
  }
}
