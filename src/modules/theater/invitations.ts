import { createHash } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { controlDb } from "@/platform/db/connections";
import {
  invitations,
  tenantMembers,
  memberships,
  permissionGrants,
  tenantSettings,
} from "@/platform/db/schema";
import { memberQuota } from "@/platform/quotas";
import { HttpError } from "@/platform/http";
export async function invitationScope(token: string) {
  if (token.length < 32 || token.length > 100) throw new HttpError(400, "Ungültige Einladung.");
  const [row] = await controlDb
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, createHash("sha256").update(token).digest("hex")))
    .limit(1);
  if (!row || row.usedAt || row.expiresAt <= new Date())
    throw new HttpError(400, "Diese Einladung ist abgelaufen oder bereits verwendet.");
  return row;
}
export async function acceptInvitation(token: string, userId: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  return controlDb.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hash))
      .limit(1)
      .for("update");
    if (!row || row.usedAt || row.expiresAt <= new Date())
      throw new HttpError(400, "Diese Einladung ist abgelaufen oder bereits verwendet.");
    const [setting] = await tx
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.organizationId, row.organizationId))
      .limit(1);
    if (setting?.status !== "active")
      throw new HttpError(403, "Dieses Theater ist derzeit deaktiviert.");
    const [existingMember] = await tx
      .select()
      .from(tenantMembers)
      .where(
        and(eq(tenantMembers.organizationId, row.organizationId), eq(tenantMembers.userId, userId)),
      )
      .limit(1);
    if (!existingMember) await memberQuota(row.organizationId, tx);
    await tx
      .insert(tenantMembers)
      .values({ organizationId: row.organizationId, userId, status: "active" })
      .onConflictDoNothing();
    await tx
      .insert(memberships)
      .values({
        id: crypto.randomUUID(),
        organizationId: row.organizationId,
        departmentId: row.departmentId,
        userId,
        role: "user",
        status: "active",
      })
      .onConflictDoNothing();
    if (row.role === "guest" && !row.productionId)
      throw new HttpError(400, "Die Gasteinladung benötigt eine konkrete Produktion.");
    await tx
      .insert(permissionGrants)
      .values({
        organizationId: row.organizationId,
        userId,
        role: row.role,
        scope:
          row.role === "theater_admin"
            ? "tenant"
            : row.role === "guest"
              ? "production"
              : "department",
        scopeId:
          row.role === "theater_admin"
            ? null
            : row.role === "guest"
              ? row.productionId
              : row.departmentId,
        expiresAt: row.role === "guest" ? row.expiresAt : null,
      });
    await tx
      .update(invitations)
      .set({ usedAt: new Date(), usedBy: userId })
      .where(eq(invitations.id, row.id));
    await tx
      .update(tenantSettings)
      .set({ permissionVersion: sql`${tenantSettings.permissionVersion}+1` })
      .where(eq(tenantSettings.organizationId, row.organizationId));
    return { organizationId: row.organizationId, departmentId: row.departmentId };
  });
}
