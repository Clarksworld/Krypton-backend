import { NextRequest } from "next/server";
import { db } from "@/db";
import { getAdminId } from "@/lib/auth";
import { ok, handleError } from "@/lib/errors";
import { count, eq, desc } from "drizzle-orm";
import { auditLogs, users } from "@/db/schema";

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Admin — Audit Logs
 *     description: Retrieve a paginated list of system audit logs.
 *     tags: [Admin, Audit]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET(req: NextRequest) {
  try {
    getAdminId(req);
    const { searchParams } = new URL(req.url);
    
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "50")));
    const actionParam = searchParams.get("action");

    const offset = (page - 1) * pageSize;

    let whereCond = undefined;
    if (actionParam && actionParam !== "all") {
        whereCond = eq(auditLogs.action, actionParam);
    }

    // Get total count
    const [totalCountRes] = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereCond);
    const totalCount = totalCountRes.count;

    const logsRaw = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        adminUsername: users.username,
        adminEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.adminId, users.id))
      .where(whereCond)
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(auditLogs.createdAt));

    const logs = logsRaw.map(l => ({
      id: l.id,
      admin: l.adminUsername || l.adminEmail || 'Unknown Admin',
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt?.toISOString()
    }));

    return ok({ 
        logs,
        pagination: {
            total: totalCount,
            page,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
        }
    });

  } catch (error) {
    return handleError(error);
  }
}
