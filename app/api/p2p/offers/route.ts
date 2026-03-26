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
