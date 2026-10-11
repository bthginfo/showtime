/** Add the Intendanz workplace for existing, already authorized tenant leaders. */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
const [environment, organizationId, actorId, apply] = process.argv.slice(2);
if (
  !["development", "preview", "production"].includes(environment) ||
  !organizationId ||
  !actorId ||
  apply !== "--apply"
)
  throw new Error(
    "Usage: enable-intendance.ts <environment> <tenant-id> <authorized-administrator-id> --apply",
  );
const runtime = JSON.parse(fs.readFileSync(`.local/runtime-${environment}.json`, "utf8"));
Object.assign(process.env, runtime);
const { controlDb, controlSql, appSql, authSql, workerSql } =
  await import("../src/platform/db/connections");
const tables = await import("../src/platform/db/schema");
const { and, eq, sql } = await import("drizzle-orm");
try {
  const result = await controlDb.transaction(async (tx) => {
    const [settings] = await tx
      .select()
      .from(tables.tenantSettings)
      .where(eq(tables.tenantSettings.organizationId, organizationId));
    const [actor] = await tx
      .select()
      .from(tables.tenantMembers)
      .where(
        and(
          eq(tables.tenantMembers.organizationId, organizationId),
          eq(tables.tenantMembers.userId, actorId),
          eq(tables.tenantMembers.status, "active"),
        ),
      );
    const grants = await tx
      .select()
      .from(tables.permissionGrants)
      .where(
        and(
          eq(tables.permissionGrants.organizationId, organizationId),
          eq(tables.permissionGrants.scope, "tenant"),
        ),
      );
    const active = grants.filter(
      (grant) => !grant.expiresAt || grant.expiresAt.getTime() > Date.now(),
    );
    if (
      settings?.status !== "active" ||
      !actor ||
      !active.some((grant) => grant.userId === actorId && grant.role === "theater_admin")
    )
      throw new Error("Active tenant and existing tenant administrator required");
    const [existing] = await tx
      .select()
      .from(tables.moduleActivations)
      .where(
        and(
          eq(tables.moduleActivations.organizationId, organizationId),
          eq(tables.moduleActivations.moduleId, "intendance"),
        ),
      );
    if (existing && !existing.enabled)
      throw new Error("Intendanz was explicitly disabled; use theater configuration to enable it");
    let [department] = await tx
      .select()
      .from(tables.departments)
      .where(
        and(
          eq(tables.departments.organizationId, organizationId),
          existing?.config.departmentId
            ? eq(tables.departments.id, String(existing.config.departmentId))
            : eq(tables.departments.name, "Intendanz"),
        ),
      );
    if (!department)
      [department] = await tx
        .insert(tables.departments)
        .values({ id: randomUUID(), organizationId, name: "Intendanz" })
        .returning();
    if (!existing)
      await tx.insert(tables.moduleActivations).values({
        organizationId,
        moduleId: "intendance",
        enabled: true,
        config: { departmentId: department.id },
      });
    const leaders = [
      ...new Set(
        active.filter((grant) => grant.role === "intendance").map((grant) => grant.userId),
      ),
    ];
    let added = 0;
    for (const userId of leaders) {
      const [member] = await tx
        .select()
        .from(tables.tenantMembers)
        .where(
          and(
            eq(tables.tenantMembers.organizationId, organizationId),
            eq(tables.tenantMembers.userId, userId),
            eq(tables.tenantMembers.status, "active"),
          ),
        );
      if (!member) continue;
      // Never reactivate an explicitly disabled membership or create a new permission grant.
      const rows = await tx
        .insert(tables.memberships)
        .values({
          id: randomUUID(),
          organizationId,
          departmentId: department.id,
          userId,
          role: "user",
          status: "active",
        })
        .onConflictDoNothing()
        .returning({ id: tables.memberships.id });
      added += rows.length;
    }
    if (!existing || added)
      await tx
        .update(tables.tenantSettings)
        .set({ permissionVersion: sql`${tables.tenantSettings.permissionVersion}+1` })
        .where(eq(tables.tenantSettings.organizationId, organizationId));
    return { departmentId: department.id, membershipsAdded: added, moduleCreated: !existing };
  });
  fs.writeFileSync(
    `.local/intendance-${environment}-${organizationId}.json`,
    JSON.stringify({ organizationId, ...result }, null, 2),
  );
  console.log(JSON.stringify({ success: true, environment, module: "intendance", ...result }));
} finally {
  await Promise.all([controlSql.end(), appSql.end(), authSql.end(), workerSql.end()]);
}
