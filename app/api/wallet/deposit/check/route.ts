import { NextRequest } from "next/server";
import { getUserId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { checkOnChainDeposits } from "@/lib/blockchain/monitor";

/**
 * @swagger
 * /api/wallet/deposit/check:
 *   post:
 *     summary: Check On-chain Deposits
 *     description: Check the blockchain for new on-chain deposits.
 *     tags: [Wallet]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);

    // Scan the blockchain for new deposits
    const newDeposits = await checkOnChainDeposits(userId);

    if (newDeposits.length === 0) {
      return ok({ 
        message: "No new deposits found", 
        newDepositsCount: 0 
      });
    }

    return ok({ 
      message: `Found and verified ${newDeposits.length} new deposits`,
      newDepositsCount: newDeposits.length,
      deposits: newDeposits
    });
  } catch (err) {
    return handleError(err);
  }
}
