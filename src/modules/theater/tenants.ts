import { applicationURL } from "@/platform/application-url";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { controlDb, authDb } from "@/platform/db/connections";
import {
  organizations,
  departments,
  tenantSettings,
  tenantMembers,
  memberships,
  permissionGrants,
  moduleActivations,
  platformAdmins,
  invitations,
} from "@/platform/db/schema";
import { identity, requireContext, requirePermission, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { moduleRegistry } from "./registry";
import { randomBytes, createHash } from "node:crypto";
import { db } from "@/platform/db";
import { auditChange, scheduleEvents } from "@/platform/events";
import { outbox } from "@/platform/db/schema";
import { roleKeys, canDelegate } from "@/platform/access";
export async function requirePlatformAdmin() {
  const person = await identity();
  const [grant] = await authDb
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, person.id))
    .limit(1);
  if (!grant) throw new HttpError(403, "Diese Aktion ist der Plattformadministration vorbehalten.");
  return person;
}
export async function createTenant(input: unknown, administratorId?: string, creatorId?: string) {
  const body = z
    .object({
      name: z.string().trim().min(2).max(150),
      slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    })
    .parse(input);
  const tenant = await controlDb.transaction(async (tx) => {
    const organizationId = crypto.randomUUID();
    await tx.insert(organizations).values({ id: organizationId, name: body.name });
    await tx
      .insert(tenantSettings)
      .values({
        organizationId,
        slug: body.slug,
        settings: {
          version: 1,
          quotas: { members: 500, filesBytes: 1_000_000_000 },
          workRules: { configured: false },
        },
      });
    if (administratorId) {
      await tx
        .insert(tenantMembers)
        .values({ organizationId, userId: administratorId, status: "active" });
      await tx.insert(permissionGrants).values([
        {
          organizationId,
          userId: administratorId,
          role: "theater_admin",
          scope: "tenant",
          scopeId: null,
        },
        {
          organizationId,
          userId: administratorId,
          role: "employee",
          scope: "tenant",
          scopeId: null,
        },
      ]);
    }
    const created = moduleRegistry.map((module) => ({
      id: crypto.randomUUID(),
      name: module.department,
    }));
    await tx.insert(departments).values(created.map((d) => ({ ...d, organizationId })));
    if (administratorId)
      await tx
        .insert(memberships)
        .values(
          created.map((d) => ({
            id: crypto.randomUUID(),
            organizationId,
            departmentId: d.id,
            userId: administratorId,
            role: "user" as const,
            status: "active" as const,
          })),
        );
    await tx
      .insert(moduleActivations)
      .values(
        moduleRegistry.map((module, index) => ({
          organizationId,
          moduleId: module.id,
          enabled: true,
          config: { departmentId: created[index].id },
        })),
      );
    let invitationUrl: string | undefined;
    if (!administratorId && creatorId) {
      const token = randomBytes(32).toString("base64url");
      await tx
        .insert(invitations)
        .values({
          organizationId,
          departmentId: created[0].id,
          role: "theater_admin",
          tokenHash: createHash("sha256").update(token).digest("hex"),
          createdBy: creatorId,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        });
      invitationUrl = `${applicationURL()}/register?invitation=${token}`;
    }
    return {
      id: organizationId,
      name: body.name,
      slug: body.slug,
      departments: created,
      invitationUrl,
    };
  });
  if (administratorId || creatorId) {
    const { seedTenantDefaults } = await import("./defaults");
    await seedTenantDefaults(tenant.id, administratorId || creatorId!);
  }
  return tenant;
}
export async function tenantConfiguration(context: Context, input: unknown) {
  const body = z
    .object({
      action: z.enum([
        "module",
        "invite",
        "settings",
        "grant",
        "grant-revoke",
        "department",
        "member",
        "event-retry",
      ]),
      data: z.record(z.string(), z.unknown()),
    })
    .parse(input);
  if (body.action === "module") {
    requirePermission(context, "modules.configure");
    const data = z
      .object({ moduleId: z.string(), enabled: z.boolean(), departmentId: z.string().optional() })
      .parse(body.data);
    const module = moduleRegistry.find((m) => m.id === data.moduleId);
    if (!module) throw new HttpError(400, "Unbekanntes Modul.");
    if (data.departmentId) {
      const [department] = await db
        .select()
        .from(departments)
        .where(eq(departments.id, data.departmentId))
        .limit(1);
      if (!department) throw new HttpError(400, "Gewerk nicht gefunden.");
    }
    await db
      .update(moduleActivations)
      .set({
        enabled: data.enabled,
        ...(data.departmentId ? { config: { departmentId: data.departmentId } } : {}),
        version: sql`${moduleActivations.version}+1`,
      })
      .where(eq(moduleActivations.moduleId, data.moduleId));
    return { ok: true };
  }
  if (body.action === "settings") {
    requirePermission(context, "tenant.configure");
    const data = z
      .object({
        timezone: z.string().max(100).optional(),
        workRules: z
          .object({
            minimumBreakMinutes: z.number().min(0).max(180),
            minimumRestHours: z.number().min(0).max(24),
            maxDutyHours: z.number().min(1).max(24),
            breakAfterHours: z.number().min(1).max(24),
            confirmedByTheater: z.boolean(),
          })
          .optional(),
        quotas: z
          .object({
            members: z.number().int().min(1).max(2000),
            filesBytes: z.number().int().min(1_000_000).max(1_000_000_000),
            uploadsPerUserPerDay: z.number().int().min(1).max(1000),
          })
          .optional(),
        requiredReadinessModules: z.array(z.string()).max(100).optional(),
      })
      .parse(body.data);
    if (data.timezone) {
      try {
        new Intl.DateTimeFormat("de", { timeZone: data.timezone });
      } catch {
        throw new HttpError(400, "Ungültige Zeitzone.");
      }
    }
    const [previous] = await db.select().from(tenantSettings).limit(1);
    await db
      .update(tenantSettings)
      .set({
        ...(data.timezone ? { timezone: data.timezone } : {}),
        settings: {
          ...previous.settings,
          ...(data.workRules ? { workRules: data.workRules } : {}),
          ...(data.quotas ? { quotas: data.quotas } : {}),
          ...(data.requiredReadinessModules
            ? { requiredReadinessModules: data.requiredReadinessModules }
            : {}),
        },
        permissionVersion: previous.permissionVersion + 1,
      })
      .where(eq(tenantSettings.organizationId, context.organizationId));
    return { ok: true };
  }
  if (body.action === "department") {
    requirePermission(context, "tenant.configure");
    const data = z.object({ name: z.string().min(2).max(100) }).parse(body.data);
    return (
      await db
        .insert(departments)
        .values({
          id: crypto.randomUUID(),
          organizationId: context.organizationId,
          name: data.name,
        })
        .returning()
    )[0];
  }
  if (body.action === "grant") {
    requirePermission(context, "roles.assign");
    const data = z
      .object({
        userId: z.string(),
        role: z.enum(roleKeys),
        scope: z.enum(["tenant", "department", "production"]),
        scopeId: z.string().nullable(),
        expiresAt: z.iso.datetime().optional(),
      })
      .parse(body.data);
    if (!canDelegate({ id: context.user.id, grants: context.grants }, data))
      throw new HttpError(403, "Nur die Theateradministration darf diese Rolle delegieren.");
    if (data.scope !== "production" && data.role === "guest")
      throw new HttpError(400, "Gäste erhalten Zugriff auf eine konkrete Produktion.");
    const [member] = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, data.userId))
      .limit(1);
    if (!member) throw new HttpError(404, "Mitglied nicht gefunden.");
    if (data.scope === "department") {
      const [dep] = await db
        .select()
        .from(departments)
        .where(eq(departments.id, data.scopeId || ""))
        .limit(1);
      if (!dep) throw new HttpError(404, "Gewerk nicht gefunden.");
      await db
        .insert(memberships)
        .values({
          id: crypto.randomUUID(),
          organizationId: context.organizationId,
          departmentId: dep.id,
          userId: data.userId,
          role: "user",
          status: "active",
        })
        .onConflictDoUpdate({
          target: [memberships.userId, memberships.departmentId],
          set: { status: "active" },
        });
    }
    if (data.scope === "production") {
      const { assertProject } = await import("@/modules/records/repository");
      await assertProject(context, data.scopeId);
    }
    if (data.role === "guest" && (!data.expiresAt || new Date(data.expiresAt) <= new Date()))
      throw new HttpError(400, "Gäste benötigen ein zukünftiges Ablaufdatum.");
    const saved = (
      await db
        .insert(permissionGrants)
        .values({ ...data, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null })
        .returning()
    )[0];
    await db
      .update(tenantSettings)
      .set({ permissionVersion: sql`${tenantSettings.permissionVersion}+1` })
      .where(eq(tenantSettings.organizationId, context.organizationId));
    return saved;
  }
  if (body.action === "grant-revoke") {
    requirePermission(context, "roles.assign");
    const data = z.object({ id: z.string() }).parse(body.data);
    const [grant] = await db
      .select()
      .from(permissionGrants)
      .where(eq(permissionGrants.id, data.id))
      .limit(1);
    if (!grant) throw new HttpError(404, "Rolle nicht gefunden.");
    if (grant.userId === context.user.id && grant.role === "theater_admin")
      throw new HttpError(409, "Die eigene Verwaltungsrolle kann hier nicht entzogen werden.");
    await db.delete(permissionGrants).where(eq(permissionGrants.id, grant.id));
    await db
      .update(tenantSettings)
      .set({ permissionVersion: sql`${tenantSettings.permissionVersion}+1` })
      .where(eq(tenantSettings.organizationId, context.organizationId));
    return { ok: true };
  }
  if (body.action === "member") {
    requirePermission(context, "members.manage");
    const data = z
      .object({ userId: z.string(), status: z.enum(["pending", "active", "disabled"]) })
      .parse(body.data);
    if (data.userId === context.user.id && data.status !== "active")
      throw new HttpError(409, "Der eigene Zugang kann hier nicht deaktiviert werden.");
    const [member] = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, data.userId))
      .limit(1);
    if (!member) throw new HttpError(404, "Mitglied nicht gefunden.");
    if (data.status === "active" && member.status !== "active") {
      const { memberQuota } = await import("@/platform/quotas");
      await memberQuota(context.organizationId);
    }
    await db
      .update(tenantMembers)
      .set({ status: data.status, version: member.version + 1, updatedAt: new Date() })
      .where(eq(tenantMembers.id, member.id));
    await db
      .update(tenantSettings)
      .set({ permissionVersion: sql`${tenantSettings.permissionVersion}+1` })
      .where(eq(tenantSettings.organizationId, context.organizationId));
    await auditChange(db as never, context, "membership." + data.status, data.userId);
    return { ok: true };
  }
  if (body.action === "event-retry") {
    requirePermission(context, "tenant.configure");
    requirePermission(context, "audit.read");
    const data = z.object({ id: z.string() }).parse(body.data);
    const [event] = await db
      .select()
      .from(outbox)
      .where(eq(outbox.id, data.id))
      .limit(1)
      .for("update");
    if (!event || event.status !== "failed")
      throw new HttpError(409, "Nur fehlgeschlagene Events können erneut gestartet werden.");
    await db
      .update(outbox)
      .set({ status: "pending", attempts: 0, availableAt: new Date() })
      .where(eq(outbox.id, event.id));
    await auditChange(db as never, context, "event.retried", event.id);
    scheduleEvents();
    return { ok: true };
  }
  requirePermission(context, "invitations.manage");
  const data = z
    .object({
      departmentId: z.string(),
      productionId: z.string().optional(),
      role: z.enum(roleKeys).default("employee"),
      expiresInDays: z.number().int().min(1).max(30).default(7),
    })
    .parse(body.data);
  if (
    !canDelegate(
      { id: context.user.id, grants: context.grants },
      { role: data.role, scope: "department", scopeId: data.departmentId },
    )
  )
    throw new HttpError(403, "Keine Berechtigung für diese Einladung.");
  const [dep] = await db
    .select()
    .from(departments)
    .where(eq(departments.id, data.departmentId))
    .limit(1);
  if (!dep) throw new HttpError(404, "Gewerk nicht gefunden.");
  if (data.role === "guest") {
    if (!data.productionId) throw new HttpError(400, "Wähle eine Produktion für den Gastzugang.");
    const { assertProject } = await import("@/modules/records/repository");
    await assertProject(context, data.productionId);
  }
  const token = randomBytes(32).toString("base64url");
  await db
    .insert(invitations)
    .values({
      organizationId: context.organizationId,
      departmentId: dep.id,
      productionId: data.productionId || null,
      role: data.role,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      createdBy: context.user.id,
      expiresAt: new Date(Date.now() + data.expiresInDays * 86400000),
    });
  return { url: `${applicationURL()}/register?invitation=${token}` };
}
