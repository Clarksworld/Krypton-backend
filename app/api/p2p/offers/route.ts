import { NextRequest } from "next/server";
import { db } from "@/db";
import { p2pOffers } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

const createOfferSchema = z.object({
  type: z.enum(["buy", "sell"]),
  assetSymbol: z.string(),
  pricePerUnit: z.number().positive(),
  availableQty: z.number().positive(),
  minOrderFiat: z.number().positive(),
  maxOrderFiat: z.number().positive(),
  paymentMethod: z.string(),
  paymentWindow: z.number().int().min(5).max(60).optional(),
});

/**
 * @swagger
 * /api/p2p/offers:
 *   get:
 *     summary: List P2P Offers
 *     description: Get available P2P offers.
 *     tags: [P2P]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET() {
  try {
    const list = await db.query.p2pOffers.findMany({
      where: (o, { eq }) => eq(o.isActive, true),
      with: {
        maker: {
          with: { profile: true },
        },
        asset: true,
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });

    return ok({ offers: list });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * @swagger
 * /api/p2p/offers:
 *   post:
 *     summary: Create P2P Offer
 *     description: Create a new P2P offer.
 *     tags: [P2P]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, assetSymbol, pricePerUnit, availableQty, minOrderFiat, maxOrderFiat, paymentMethod]
 *             properties:
 *               type: { type: string, enum: [buy, sell] }
 *               assetSymbol: { type: string }
 *               pricePerUnit: { type: number }
 *               availableQty: { type: number }
 *               minOrderFiat: { type: number }
 *               maxOrderFiat: { type: number }
 *               paymentMethod: { type: string }
 *               paymentWindow: { type: number }
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const data = validate(createOfferSchema, body);

    // Get asset ID
    const asset = await db.query.cryptoAssets.findFirst({
      where: (a, { eq }) => eq(a.symbol, data.assetSymbol),
    });

    if (!asset) {
      throw new ApiError("Unsupported asset", 400);
    }

    const [offer] = await db
      .insert(p2pOffers)
      .values({
        makerId: userId,
        type: data.type,
        assetId: asset.id,
        pricePerUnit: data.pricePerUnit.toString(),
        availableQty: data.availableQty.toString(),
        minOrderFiat: data.minOrderFiat.toString(),
        maxOrderFiat: data.maxOrderFiat.toString(),
        paymentMethod: data.paymentMethod,
        paymentWindow: data.paymentWindow,
      })
      .returning();

    return ok({ offer }, 201);
  } catch (err) {
    return handleError(err);
  }
}
