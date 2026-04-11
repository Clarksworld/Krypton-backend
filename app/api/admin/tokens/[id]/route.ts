import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { cryptoAssets, wallets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validate } from "@/lib/validate";

const networkSchema = z.object({
  name: z.string().min(1),
  addressRegex: z.string().optional(),
});

const patchTokenSchema = z.object({
  name: z.string().min(1).optional(),
  iconUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  networks: z.array(networkSchema).optional(),
});

/**
 * @swagger
 * /api/admin/tokens/{id}:
 *   patch:
 *     summary: Admin — Update Token
 *     description: Edit a crypto asset's metadata or toggle its active status.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Token UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               iconUrl: { type: string }
 *               isActive: { type: boolean }
 *               networks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     addressRegex: { type: string }
 *     responses:
 *       200:
 *         description: Token updated successfully
 *       404:
 *         description: Token not found
 *       403:
 *         description: Admin access required
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAdminId(req);

    const { id } = await params;
    const body = await req.json();
    const data = validate(patchTokenSchema, body);

    const existing = await db.query.cryptoAssets.findFirst({
      where: (asset, { eq }) => eq(asset.id, id),
    });

    if (!existing) {
      throw new ApiError("Token not found.", 404);
    }

    const [updated] = await db
      .update(cryptoAssets)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.networks !== undefined && { networks: data.networks }),
        updatedAt: new Date(),
      })
      .where(eq(cryptoAssets.id, id))
      .returning();

    return ok({ token: updated, message: `Token '${updated.symbol}' updated successfully.` });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * @swagger
 * /api/admin/tokens/{id}:
 *   delete:
 *     summary: Admin — Delete Token
 *     description: >
 *       Permanently removes a crypto asset. Fails with 409 if any user wallets
 *       are associated with this token — deactivate it with PATCH instead.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Token UUID
 *     responses:
 *       200:
 *         description: Token deleted successfully
 *       404:
 *         description: Token not found
 *       409:
 *         description: Cannot delete — wallets exist for this token
 *       403:
 *         description: Admin access required
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAdminId(req);

    const { id } = await params;

    const existing = await db.query.cryptoAssets.findFirst({
      where: (asset, { eq }) => eq(asset.id, id),
    });

    if (!existing) {
      throw new ApiError("Token not found.", 404);
    }

    // Safety check: refuse if any wallets reference this asset
    const linkedWallet = await db.query.wallets.findFirst({
      where: (w, { eq }) => eq(w.assetId, id),
    });

    if (linkedWallet) {
      throw new ApiError(
        `Cannot delete '${existing.symbol}' — user wallets exist for this token. Deactivate it instead using PATCH.`,
        409
      );
    }

    await db.delete(cryptoAssets).where(eq(cryptoAssets.id, id));

    return ok({ message: `Token '${existing.symbol}' deleted successfully.` });
  } catch (error) {
    return handleError(error);
  }
}
