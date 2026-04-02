import { NextRequest } from "next/server";
import { db } from "@/db";
import { bankAccounts } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, err, handleError } from "@/lib/errors";
import { eq, and } from "drizzle-orm";

/**
 * @swagger
 * /api/bank-accounts/{id}:
 *   delete:
 *     summary: Remove Bank Account
 *     description: Unlink a fiat bank account.
 *     tags: [Fiat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the bank account
 *     responses:
 *       200:
 *         description: Bank account removed successfully
 *       404:
 *         description: Bank account not found
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getUserId(req);
    const { id } = params;

    const account = await db.query.bankAccounts.findFirst({
      where: (b, { eq, and }) => and(eq(b.id, id), eq(b.userId, userId)),
    });

    if (!account) {
      return err("Bank account not found", 404);
    }

    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));

    // If it was the default, make another account the default implicitly 
    // or leave it to the user to choose next time
    if (account.isDefault) {
      const remaining = await db.query.bankAccounts.findFirst({
        where: (b, { eq }) => eq(b.userId, userId),
      });
      if (remaining) {
        await db.update(bankAccounts)
          .set({ isDefault: true })
          .where(eq(bankAccounts.id, remaining.id));
      }
    }

    return ok({ message: "Bank account removed successfully" });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * @swagger
 * /api/bank-accounts/{id}:
 *   put:
 *     summary: Set Default Bank Account
 *     description: Set a bank account as the default for withdrawals.
 *     tags: [Fiat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the bank account
 *     responses:
 *       200:
 *         description: Default set successfully
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getUserId(req);
    const { id } = params;

    const account = await db.query.bankAccounts.findFirst({
      where: (b, { eq, and }) => and(eq(b.id, id), eq(b.userId, userId)),
    });

    if (!account) {
      return err("Bank account not found", 404);
    }

    await db.transaction(async (tx) => {
      // Unset all others
      await tx.update(bankAccounts)
        .set({ isDefault: false })
        .where(eq(bankAccounts.userId, userId));
      
      // Set the new default
      await tx.update(bankAccounts)
        .set({ isDefault: true })
        .where(eq(bankAccounts.id, id));
    });

    return ok({ message: "Default bank account updated" });
  } catch (error) {
    return handleError(error);
  }
}
