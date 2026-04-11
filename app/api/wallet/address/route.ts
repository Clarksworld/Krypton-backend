import { NextRequest } from "next/server";
import { db } from "@/db";
import { wallets, cryptoAssets } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError, ApiError } from "@/lib/errors";
import { eq, and } from "drizzle-orm";
import { generateUserEVMAddress } from "@/lib/blockchain/evm";

/**
 * GET /api/wallet/address?symbol=BNB&network=BEP20
 *
 * Returns (or lazily generates) the deposit address for the requested
 * asset + network combination. Supports ERC20, BEP20, TRC20, etc.
 *
 * Query params:
 *   symbol   - required  - e.g. "BNB", "USDT", "ETH"
 *   network  - optional  - e.g. "BEP20", "TRC20", "ERC20" (defaults to first available)
 */
/**
 * @swagger
 * /api/wallet/address:
 *   get:
 *     summary: Get Deposit Address
 *     description: Returns (or lazily generates) the deposit address for the requested asset.
 *     tags: [Wallet]
 *     parameters:
 *       - in: query
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Asset symbol (e.g. BNB, USDT)
 *       - in: query
 *         name: network
 *         required: false
 *         schema:
 *           type: string
 *         description: Network (e.g. BEP20, TRC20)
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();
    const requestedNetwork = searchParams.get("network")?.toUpperCase() ?? null;

    if (!symbol) {
      return err("Query parameter 'symbol' is required (e.g. ?symbol=BNB)", 400);
    }

    // 1. Find the asset
    let asset = await db.query.cryptoAssets.findFirst({
      where: (ca, { eq, and }) => and(eq(ca.symbol, symbol), eq(ca.isActive, true)),
    });

    // Auto-create BEP20 token if not found
    if (!asset && requestedNetwork === "BEP20") {
      const [newAsset] = await db.insert(cryptoAssets).values({
        symbol,
        name: `${symbol} Token`,
        isActive: true,
        networks: [
          {
            name: "BEP20",
            addressRegex: "^0x[a-fA-F0-9]{40}$",
          },
        ],
      }).returning();
      asset = newAsset;
    } else if (!asset) {
      return err(`Asset '${symbol}' not found or inactive`, 404);
    }

    // 2. Resolve which network to use
    const networks = (asset.networks as any[]) ?? [];

    let selectedNetwork = requestedNetwork
      ? networks.find((n: any) => n.name.toUpperCase() === requestedNetwork)
      : networks[0]; // default: first available network

    // If BEP20 is requested but not in the asset's networks, automatically add it
    if (!selectedNetwork && requestedNetwork === "BEP20") {
      selectedNetwork = {
        name: "BEP20",
        addressRegex: "^0x[a-fA-F0-9]{40}$",
      };
      
      const updatedNetworks = [...networks, selectedNetwork];
      await db.update(cryptoAssets)
        .set({ networks: updatedNetworks })
        .where(eq(cryptoAssets.id, asset.id));
    } else if (!selectedNetwork) {
      return err(
        `Network '${requestedNetwork}' not supported for ${symbol}. ` +
          `Available: ${networks.map((n: any) => n.name).join(", ")}`,
        400
      );
    }

    // 3. Find the user's wallet for this asset
    const wallet = await db.query.wallets.findFirst({
      where: (w, { eq, and }) => and(eq(w.userId, userId), eq(w.assetId, asset.id)),
    });

    // 4. If no wallet, create one on the fly (idempotent)
    let depositAddress = wallet?.depositAddress ?? null;

    if (!depositAddress) {
      // Generate a real EVM address for EVM-compatible networks
      const isEvm =
        selectedNetwork.name === "BEP20" ||
        selectedNetwork.name === "ERC20" ||
        selectedNetwork.isNative === true;

      if (isEvm) {
        const user = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.id, userId),
        });
        if (!user) throw new ApiError("User not found", 404);
        depositAddress = generateUserEVMAddress(user.userIndex);
      } else {
        // Placeholder for non-EVM chains (TRC20, BTC, etc.)
        depositAddress = `pending_${symbol.toLowerCase()}_${userId.slice(0, 8)}`;
      }

      // Upsert the wallet with the address
      await db
        .insert(wallets)
        .values({ userId, assetId: asset.id, depositAddress })
        .onConflictDoUpdate({
          target: [wallets.userId, wallets.assetId],
          set: { depositAddress },
        });
    }

    // 5. Build the response
    return ok({
      symbol: asset.symbol,
      name: asset.name,
      network: {
        name: selectedNetwork.name,
        isNative: selectedNetwork.isNative ?? false,
        contractAddress: selectedNetwork.contractAddress ?? null,
        addressRegex: selectedNetwork.addressRegex ?? null,
        memo: selectedNetwork.memo ?? null, // some chains (e.g. XRP) need a memo
      },
      depositAddress,
      // Warn if this is a placeholder (non-EVM chain not fully integrated yet)
      warning:
        depositAddress.startsWith("pending_") || depositAddress.startsWith("mock_")
          ? `Full ${selectedNetwork.name} integration is coming soon. Do not send real funds to this address.`
          : null,
    });
  } catch (error) {
    return handleError(error);
  }
}
