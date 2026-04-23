import { NextRequest } from "next/server";
import { db } from "@/db";
import { userProfiles, users } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { ok, handleError, ApiError } from "@/lib/errors";
import { validate } from "@/lib/validate";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getNgnRate, computePortfolioValue } from "@/lib/pricing";

const updateProfileSchema = z.object({
  username: z.string().optional(),
  fullName: z.string().optional(),
  dateOfBirth: z.string().optional(), // YYYY-MM-DD
  country: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  privatePortfolio: z.boolean().optional(),
  preferredCurrency: z.string().optional(),
});

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get Profile
 *     description: Get user profile details.
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);

    // Fetch user with profile
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      with: {
        profile: true, // This requires 'profile' relation to be defined in drizzle schema
      },
    });

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    // Trade stats
    const userTrades = await db.query.p2pTrades.findMany({
      where: (t, { eq, or }) => or(eq(t.makerId, userId), eq(t.takerId, userId)),
      columns: { status: true },
    });

    const totalTrades = userTrades.length;
    const completedTrades = userTrades.filter(t => t.status === "completed").length;
    const completionRate = totalTrades === 0 ? 100 : Math.round((completedTrades / totalTrades) * 100);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    
    // Check if preferredCurrency or privatePortfolio is missing, default them for frontend
    if ((safeUser as any).profile && (safeUser as any).profile.preferredCurrency === null) {
      (safeUser as any).profile.preferredCurrency = "USD";
    }

    // Fetch user wallets and compute overall balance in USD & NGN
    const userWallets = await db.query.wallets.findMany({
      where: (w, { eq }) => eq(w.userId, userId),
      with: { asset: true },
    });
    const ngnRate = await getNgnRate();
    const { totalBalanceUsd, totalBalanceNgn } = computePortfolioValue(
      userWallets.map((w) => ({ symbol: w.asset.symbol, balance: w.balance })),
      ngnRate
    );

    return ok({ 
      user: safeUser,
      stats: {
        totalTrades,
        completionRate,
        memberSince: user.createdAt,
      },
      balance: {
        totalBalanceUsd: totalBalanceUsd.toFixed(2),
        totalBalanceNgn: totalBalanceNgn.toFixed(2),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const body = await req.json();
    const data = validate(updateProfileSchema, body);

    if (data.username) {
      // Check if username is already taken by someone else
      const existingUser = await db.query.users.findFirst({
        where: (u, { eq, ne, and }) => and(eq(u.username, data.username!), ne(u.id, userId)),
      });
      if (existingUser) {
        throw new ApiError("Username is already taken", 400);
      }
      // Update username in users table
      await db
        .update(users)
        .set({ username: data.username })
        .where(eq(users.id, userId));
    }

    const { username, ...profileData } = data;

    let updatedProfile = null;
    if (Object.keys(profileData).length > 0) {
      const [updated] = await db
        .update(userProfiles)
        .set({
          ...profileData,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();
      updatedProfile = updated;
    } else {
      updatedProfile = await db.query.userProfiles.findFirst({
        where: (up, { eq }) => eq(up.userId, userId)
      });
    }

    return ok({ profile: updatedProfile });
  } catch (err) {
    return handleError(err);
  }
}
