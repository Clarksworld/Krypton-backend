import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { cryptoAssets } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { validate } from "@/lib/validate";

const networkSchema = z.object({
  name: z.string().min(1),
  addressRegex: z.string().optional(),
});

const addTokenSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(1),
  iconUrl: z.string().url().optional(),
  isActive: z.boolean().optional().default(true),
  networks: z.array(networkSchema).optional().default([]),
});

/**
 * @swagger
 * /api/admin/tokens:
 *   get:
 *     summary: Admin — List All Tokens
 *     description: >
 *       Returns all crypto assets (active and inactive).
 *       Supports optional `search` filter on symbol/name and `isActive` filter.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by symbol or name
 *       - in: query
 *         name: isActive
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Filter by active status (true/false). Omit to return all.
 *     responses:
 *       200:
 *         description: List of tokens
 *       403:
 *         description: Admin access required
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const isActiveParam = searchParams.get("isActive");

    const tokens = await db.query.cryptoAssets.findMany({
      where: (asset, { and, eq, or, ilike }) => {
        const conditions = [];

        if (search) {
          conditions.push(
            or(
              ilike(asset.symbol, `%${search}%`),
              ilike(asset.name, `%${search}%`)
            )
          );
        }

        if (isActiveParam !== null) {
          conditions.push(eq(asset.isActive, isActiveParam === "true"));
        }

        return conditions.length > 0 ? and(...conditions) : undefined;
      },
      orderBy: (asset, { asc }) => [asc(asset.symbol)],
    });

    return ok({ tokens, total: tokens.length });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * @swagger
 * /api/admin/tokens:
 *   post:
 *     summary: Admin — Add Token
 *     description: Add a new supported crypto asset to the platform.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [symbol, name]
 *             properties:
 *               symbol:
 *                 type: string
 *                 example: SOL
 *               name:
 *                 type: string
 *                 example: Solana
 *               iconUrl:
 *                 type: string
 *                 example: https://cdn.example.com/sol.png
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               networks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     addressRegex: { type: string }
 *     responses:
 *       201:
 *         description: Token created successfully
 *       409:
 *         description: Token with this symbol already exists
 *       422:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 */
export async function POST(req: NextRequest) {
  try {
    getAdminId(req);

    const body = await req.json();
    const data = validate(addTokenSchema, body);

    // Check for duplicate symbol
    const existing = await db.query.cryptoAssets.findFirst({
      where: (asset, { eq }) => eq(asset.symbol, data.symbol),
    });

    if (existing) {
      throw new ApiError(
        `Token with symbol '${data.symbol}' already exists.`,
        409
      );
    }

    const [token] = await db
      .insert(cryptoAssets)
      .values({
        symbol: data.symbol,
        name: data.name,
        iconUrl: data.iconUrl ?? null,
        isActive: data.isActive,
        networks: data.networks,
      })
      .returning();

    return ok({ token, message: `Token '${token.symbol}' added successfully.` }, 201);
  } catch (error) {
    return handleError(error);
  }
}
