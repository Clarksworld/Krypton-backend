import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import {
  users,
  userProfiles,
  userSessions,
  transactions,
} from "@/db/schema";
import { p2pTrades, cryptoAssets } from "@/db/schema";
import { count, sum, eq, gte, lt, and, desc, sql } from "drizzle-orm";

/** Calculate % change between two periods, rounded to 1 decimal place. */
function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * @swagger
 * /api/admin/overview:
 *   get:
 *     summary: Admin — Platform Overview
 *     description: >
 *       Full platform snapshot: stat cards (with % change), network growth
 *       chart (7-day daily), volume distribution by asset, system status,
 *       latest trades and latest signups.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
    const oneMinuteAgo  = new Date(now.getTime() -       60 * 1000);

    // ── 1. STAT CARDS ──────────────────────────────────────────────────────

    // Total users (all-time) + 30-day window for % change
    const [totalUsersRow]      = await db.select({ total: count() }).from(users);
    const [usersCurrent]       = await db.select({ total: count() }).from(users).where(gte(users.createdAt, thirtyDaysAgo));
    const [usersPrevious]      = await db.select({ total: count() }).from(users).where(and(gte(users.createdAt, sixtyDaysAgo), lt(users.createdAt, thirtyDaysAgo)));

    // Active users — distinct users with a session touched in the window
    const [activeUsersCurrent]  = await db
      .select({ total: sql<number>`COUNT(DISTINCT ${userSessions.userId})` })
      .from(userSessions)
      .where(gte(userSessions.lastSeenAt, thirtyDaysAgo));
    const [activeUsersPrevious] = await db
      .select({ total: sql<number>`COUNT(DISTINCT ${userSessions.userId})` })
      .from(userSessions)
      .where(and(gte(userSessions.lastSeenAt, sixtyDaysAgo), lt(userSessions.lastSeenAt, thirtyDaysAgo)));

    // Total trades (all p2p trades, all statuses)
    const [totalTradesRow]      = await db.select({ total: count() }).from(p2pTrades);
    const [tradesCurrent]       = await db.select({ total: count() }).from(p2pTrades).where(gte(p2pTrades.createdAt, thirtyDaysAgo));
    const [tradesPrevious]      = await db.select({ total: count() }).from(p2pTrades).where(and(gte(p2pTrades.createdAt, sixtyDaysAgo), lt(p2pTrades.createdAt, thirtyDaysAgo)));

    // Trade volume — completed transactions (fiat value)
    const [completedTxs]       = await db.select({ total: count(), volume: sum(transactions.amount) }).from(transactions).where(eq(transactions.status, "completed"));
    const [volumeCurrent]      = await db.select({ volume: sum(transactions.fiatAmount) }).from(transactions).where(and(eq(transactions.status, "completed"), gte(transactions.createdAt, thirtyDaysAgo)));
    const [volumePrevious]     = await db.select({ volume: sum(transactions.fiatAmount) }).from(transactions).where(and(eq(transactions.status, "completed"), gte(transactions.createdAt, sixtyDaysAgo), lt(transactions.createdAt, thirtyDaysAgo)));

    // Fees + pending (preserved from original endpoint)
    const [feeTotal]           = await db.select({ total: sum(transactions.fee) }).from(transactions).where(eq(transactions.status, "completed"));
    const [pendingTxs]         = await db.select({ total: count() }).from(transactions).where(eq(transactions.status, "pending"));

    // ── 2. NETWORK GROWTH CHART (last 7 days, daily) ───────────────────────

    const dailyUsers = await db
      .select({
        date: sql<string>`DATE(${users.createdAt} AT TIME ZONE 'UTC')`.as("date"),
        newUsers: count(),
      })
      .from(users)
      .where(gte(users.createdAt, sevenDaysAgo))
      .groupBy(sql`DATE(${users.createdAt} AT TIME ZONE 'UTC')`)
      .orderBy(sql`DATE(${users.createdAt} AT TIME ZONE 'UTC')`);

    const dailyVolume = await db
      .select({
        date: sql<string>`DATE(${transactions.createdAt} AT TIME ZONE 'UTC')`.as("date"),
        volume: sum(transactions.fiatAmount),
      })
      .from(transactions)
      .where(and(eq(transactions.status, "completed"), gte(transactions.createdAt, sevenDaysAgo)))
      .groupBy(sql`DATE(${transactions.createdAt} AT TIME ZONE 'UTC')`)
      .orderBy(sql`DATE(${transactions.createdAt} AT TIME ZONE 'UTC')`);

    // Build a full 7-day array (fill missing days with 0)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sevenDaysAgo.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
      return d.toISOString().split("T")[0];
    });
    const usersByDate   = Object.fromEntries(dailyUsers.map((r) => [r.date, r.newUsers]));
    const volumeByDate  = Object.fromEntries(dailyVolume.map((r) => [r.date, parseFloat(r.volume ?? "0")]));
    const networkGrowthData = last7Days.map((date) => ({
      date,
      newUsers: usersByDate[date]  ?? 0,
      volume:   volumeByDate[date] ?? 0,
    }));
    const peakVolume = Math.max(...networkGrowthData.map((d) => d.volume), 0);

    // ── 3. VOLUME DISTRIBUTION (by crypto asset, completed p2p trades) ─────

    const assetVolumes = await db
      .select({
        symbol:     cryptoAssets.symbol,
        totalFiat:  sum(p2pTrades.fiatAmount),
        tradeCount: count(),
      })
      .from(p2pTrades)
      .innerJoin(cryptoAssets, eq(p2pTrades.assetId, cryptoAssets.id))
      .where(eq(p2pTrades.status, "completed"))
      .groupBy(cryptoAssets.symbol)
      .orderBy(desc(sum(p2pTrades.fiatAmount)));

    const totalFiatAllAssets = assetVolumes.reduce(
      (acc, r) => acc + parseFloat(r.totalFiat ?? "0"),
      0
    );

    // Top 2 assets get their own row; the rest are collapsed into "OTHERS"
    const volumeDistribution = assetVolumes.reduce(
      (acc: { pair: string; percentage: number; tradeCount: number }[], row, idx) => {
        const fiat = parseFloat(row.totalFiat ?? "0");
        const pct  = totalFiatAllAssets > 0 ? Math.round((fiat / totalFiatAllAssets) * 100) : 0;
        const pair = idx < 2 ? `${row.symbol}/NGN` : "OTHERS";
        const existing = acc.find((a) => a.pair === pair);
        if (existing) {
          existing.percentage  += pct;
          existing.tradeCount  += row.tradeCount;
        } else {
          acc.push({ pair, percentage: pct, tradeCount: row.tradeCount });
        }
        return acc;
      },
      []
    );

    // ── 4. SYSTEM STATUS ───────────────────────────────────────────────────

    const pingStart = Date.now();
    const [tpsRow]  = await db
      .select({ txCount: count() })
      .from(transactions)
      .where(gte(transactions.createdAt, oneMinuteAgo));
    const latencyMs = Date.now() - pingStart;
    const tps       = Math.round(tpsRow.txCount / 60);

    // ── 5. LATEST TRADES ───────────────────────────────────────────────────

    const latestTradeRows = await db
      .select({
        id:          p2pTrades.id,
        symbol:      cryptoAssets.symbol,
        price:       p2pTrades.pricePerUnit,
        cryptoAmount: p2pTrades.cryptoAmount,
        fiatAmount:  p2pTrades.fiatAmount,
        status:      p2pTrades.status,
        createdAt:   p2pTrades.createdAt,
      })
      .from(p2pTrades)
      .innerJoin(cryptoAssets, eq(p2pTrades.assetId, cryptoAssets.id))
      .orderBy(desc(p2pTrades.createdAt))
      .limit(5);

    const latestTrades = latestTradeRows.map((t) => ({
      id:          t.id,
      pair:        `${t.symbol}/NGN`,
      price:       t.price,
      amount:      t.cryptoAmount,
      fiatAmount:  t.fiatAmount,
      status:      t.status,
      timestamp:   t.createdAt,
    }));

    // ── 6. LATEST SIGNUPS ──────────────────────────────────────────────────

    const latestSignupRows = await db
      .select({
        id:        users.id,
        email:     users.email,
        username:  users.username,
        createdAt: users.createdAt,
        fullName:  userProfiles.fullName,
        kycLevel:  userProfiles.kycLevel,
        kycStatus: userProfiles.kycStatus,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(users.isAdmin, false))
      .orderBy(desc(users.createdAt))
      .limit(5);

    const latestSignups = latestSignupRows.map((u) => {
      const level  = u.kycLevel  ?? "0";
      const status = u.kycStatus ?? "unverified";
      let kycLabel = "KYC UNVERIFIED";
      if (status === "pending")  kycLabel = "KYC PENDING";
      if (status === "approved") kycLabel = `KYC LEVEL ${level}`;
      if (status === "failed")   kycLabel = "KYC FAILED";
      return {
        id:        u.id,
        name:      u.fullName ?? u.username ?? "Unknown",
        email:     u.email,
        kycStatus: kycLabel,
        joinedAt:  u.createdAt,
      };
    });

    // ── RESPONSE ───────────────────────────────────────────────────────────

    return ok({
      overview: {
        // ── Stat Cards
        totalUsers:           totalUsersRow.total,
        totalUsersChange:     pctChange(usersCurrent.total, usersPrevious.total),
        activeUsers:          Number(activeUsersCurrent.total),
        activeUsersChange:    pctChange(Number(activeUsersCurrent.total), Number(activeUsersPrevious.total)),
        totalTrades:          totalTradesRow.total,
        totalTradesChange:    pctChange(tradesCurrent.total, tradesPrevious.total),
        tradeVolume:          completedTxs.volume ?? "0",
        tradeVolumeChange:    pctChange(parseFloat(volumeCurrent.volume ?? "0"), parseFloat(volumePrevious.volume ?? "0")),

        // ── Preserved fields (backward-compatible)
        completedTransactions: completedTxs.total,
        feesCollected:         feeTotal.total    ?? "0",
        pendingTransactions:   pendingTxs.total,

        // ── Network Growth Chart
        networkGrowth: {
          data:        networkGrowthData,
          peakVolume,
        },

        // ── Volume Distribution
        volumeDistribution,

        // ── System Status
        systemStatus: {
          status:    "operational" as const,
          tps,
          latencyMs,
        },

        // ── Latest Trades
        latestTrades,

        // ── Latest Signups
        latestSignups,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
