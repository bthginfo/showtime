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
  records,
} from "@/platform/db/schema";
import { identity, requireContext, requirePermission, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { moduleRegistry } from "./registry";
import { randomBytes, createHash } from "node:crypto";
import { db } from "@/platform/db";
import { auditChange, scheduleEvents } from "@/platform/events";
import { outbox } from "@/platform/db/schema";
import { roleKeys, canDelegate } from "@/platform/access";
import { tenantInput } from "@/shared/tenant-management";
import { workRuleProfilesInput } from "@/shared/work-rule-profiles";
import { requireMfa } from "@/platform/auth/mfa";
export async function requirePlatformAdmin() {
  const person = await identity();
  const [grant] = await authDb
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, person.id))
    .limit(1);
  if (!grant) throw new HttpError(403, "Diese Aktion ist der Plattformadministration vorbehalten.");
  await requireMfa();
  return person;
}
export async function createTenant(input: unknown, administratorId?: string, creatorId?: string) {
  const body = tenantInput.parse(input);
  const tenant = await controlDb
    .transaction(async (tx) => {
      const organizationId = crypto.randomUUID();
      await tx.insert(organizations).values({ id: organizationId, name: body.name });
      await tx.insert(tenantSettings).values({
        organizationId,
        slug: body.slug,
        status: "provisioning",
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
        await tx.insert(memberships).values(
          created.map((d) => ({
            id: crypto.randomUUID(),
            organizationId,
            departmentId: d.id,
            userId: administratorId,
            role: "user" as const,
            status: "active" as const,
          })),
        );
      await tx.insert(moduleActivations).values(
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
        await tx.insert(invitations).values({
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
    })
    .catch((error: unknown) => {
      if (
        (error as { cause?: { code?: string }; code?: string }).cause?.code === "23505" ||
        (error as { code?: string }).code === "23505"
      )
        throw new HttpError(
          409,
          "Diese Kennung ist bereits vergeben. Wähle eine andere Kennung oder öffne das vorhandene Theater.",
        );
      throw error;
    });
  if (administratorId || creatorId) {
    await completeTenantSetup(tenant.id, administratorId || creatorId!);
  }
  return tenant;
}

export async function completeTenantSetup(organizationId: string, actorId: string) {
  const [setting] = await controlDb
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, organizationId))
    .limit(1);
  if (!setting) throw new HttpError(404, "Theater nicht gefunden.");
  if (setting.status === "disabled")
    throw new HttpError(409, "Gib das Theater zuerst wieder frei.");
  if (setting.status === "active") return;
  await controlDb
    .update(tenantSettings)
    .set({ status: "provisioning" })
    .where(
      and(
        eq(tenantSettings.organizationId, organizationId),
        eq(tenantSettings.status, setting.status),
      ),
    );
  try {
    const { seedTenantDefaults } = await import("./defaults");
    await seedTenantDefaults(organizationId, actorId);
    await controlDb
      .update(tenantSettings)
      .set({ status: "active", updatedAt: new Date() })
      .where(
        and(
          eq(tenantSettings.organizationId, organizationId),
          eq(tenantSettings.status, "provisioning"),
        ),
      );
  } catch {
    await controlDb
      .update(tenantSettings)
      .set({ status: "setup_failed", updatedAt: new Date() })
      .where(
        and(
          eq(tenantSettings.organizationId, organizationId),
          eq(tenantSettings.status, "provisioning"),
        ),
      );
    throw new HttpError(
      503,
      "Das Theater wurde gespeichert, aber die Einrichtung ist noch nicht vollständig. Öffne es in der Verwaltung und wähle „Einrichtung fortsetzen“.",
    );
  }
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
    const [existing] = await db
      .select()
      .from(moduleActivations)
      .where(eq(moduleActivations.moduleId, data.moduleId))
      .limit(1);
    if (!existing && !data.departmentId)
      throw new HttpError(400, "Ordne das neue Modul zuerst einem Gewerk zu.");
    await db
      .insert(moduleActivations)
      .values({
        organizationId: context.organizationId,
        moduleId: data.moduleId,
        enabled: data.enabled,
        config: { departmentId: data.departmentId || String(existing?.config.departmentId || "") },
      })
      .onConflictDoUpdate({
        target: [moduleActivations.organizationId, moduleActivations.moduleId],
        set: {
          enabled: data.enabled,
          ...(data.departmentId ? { config: { departmentId: data.departmentId } } : {}),
          version: sql`${moduleActivations.version}+1`,
        },
      });
    await auditChange(db as never, context, "theater.module.configured", data.moduleId);
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
        workRuleProfiles: workRuleProfilesInput.optional(),
        reminderRules: z
          .object({
            beforeDays: z.number().int().min(0).max(30),
            escalateAfterDays: z.number().int().min(0).max(30),
          })
          .optional(),
        setupComplete: z.boolean().optional(),
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
    if (data.setupComplete) {
      const enabled = await db
        .select()
        .from(moduleActivations)
        .where(eq(moduleActivations.enabled, true));
      if (!enabled.length || enabled.some((m) => !m.config.departmentId))
        throw new HttpError(
          409,
          "Ordne zunächst mindestens ein aktives Fachmodul einem Gewerk zu.",
        );
    }
    if (data.workRuleProfiles) {
      const members = await db
        .select({ id: memberships.userId })
        .from(memberships)
        .where(eq(memberships.status, "active"));
      const actors = await db
        .select({ id: records.id })
        .from(records)
        .where(eq(records.kind, "actors"));
      const membersSet = new Set(members.map((m) => m.id)),
        actorsSet = new Set(actors.map((a) => a.id));
      if (
        data.workRuleProfiles.some(
          (p) =>
            p.memberIds.some((id) => !membersSet.has(id)) ||
            p.actorIds.some((id) => !actorsSet.has(id)),
        )
      )
        throw new HttpError(
          400,
          "Regelprofile dürfen nur aktive Personen dieses Theaters enthalten.",
        );
    }
    await db
      .update(tenantSettings)
      .set({
        ...(data.timezone ? { timezone: data.timezone } : {}),
        settings: {
          ...previous.settings,
          ...(data.setupComplete
            ? { setupCompletedAt: new Date().toISOString(), setupCompletedBy: context.user.id }
            : {}),
          ...(data.workRules ? { workRules: data.workRules } : {}),
          ...(data.quotas ? { quotas: data.quotas } : {}),
          ...(data.workRuleProfiles
            ? {
                workRuleProfiles: data.workRuleProfiles.map((profile) => ({
                  ...profile,
                  confirmedBy: profile.rules.confirmedByTheater ? context.user.id : null,
                  confirmedAt: profile.rules.confirmedByTheater ? new Date().toISOString() : null,
                })),
              }
            : {}),
          ...(data.reminderRules ? { reminderRules: data.reminderRules } : {}),
          ...(data.requiredReadinessModules
            ? { requiredReadinessModules: data.requiredReadinessModules }
            : {}),
        },
        permissionVersion: previous.permissionVersion + 1,
      })
      .where(eq(tenantSettings.organizationId, context.organizationId));
    await auditChange(db as never, context, "theater.settings", context.organizationId);
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
        sensitiveConfirmed: z.boolean().optional(),
        sensitiveReason: z.string().trim().max(2000).optional(),
      })
      .parse(body.data);
    if (!canDelegate({ id: context.user.id, grants: context.grants }, data))
      throw new HttpError(403, "Nur die Theateradministration darf diese Rolle delegieren.");
    if (
      ["personnel", "costume_specialist", "intendance"].includes(data.role) &&
      (!data.sensitiveConfirmed || (data.sensitiveReason || "").length < 10)
    )
      throw new HttpError(
        400,
        "Bestätige den sensiblen Zusatzbereich mit einer nachvollziehbaren Begründung.",
      );
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
        .values({
          userId: data.userId,
          role: data.role,
          scope: data.scope,
          scopeId: data.scopeId,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        })
        .returning()
    )[0];
    await db
      .update(tenantSettings)
      .set({ permissionVersion: sql`${tenantSettings.permissionVersion}+1` })
      .where(eq(tenantSettings.organizationId, context.organizationId));
    await auditChange(
      db as never,
      context,
      data.sensitiveConfirmed ? "role.sensitive.confirmed" : "role.assigned",
      saved.id,
    );
    if (data.sensitiveConfirmed)
      await db
        .update(tenantSettings)
        .set({
          settings: sql`jsonb_set(${tenantSettings.settings},'{sensitiveGrantApprovals}',coalesce(${tenantSettings.settings}->'sensitiveGrantApprovals','{}'::jsonb) || ${JSON.stringify({ [saved.id]: { reason: data.sensitiveReason, userId: data.userId, role: data.role, scope: data.scope, scopeId: data.scopeId, confirmedBy: context.user.id, confirmedAt: new Date().toISOString() } })}::jsonb)`,
        })
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
  if (["personnel", "costume_specialist", "intendance"].includes(data.role))
    throw new HttpError(
      400,
      "Lade die Person zunächst als Mitarbeitende ein. Sensible Zusatzrollen werden anschließend mit geprüfter Zuständigkeit und Begründung zugewiesen.",
    );
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
  await db.insert(invitations).values({
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
