import { recordPage, readReferences, allRows, rowReadable } from "./pages";
import { and, eq, ne, or, inArray, desc, sql } from "drizzle-orm";
import { db } from "@/platform/db";
import {
  records,
  memberships,
  user,
  timers,
  attendanceTimers,
  tenantProfiles,
  moduleActivations,
} from "@/platform/db/schema";
import { can, availableScopes, type Context } from "@/platform/context";
import {
  recordKinds,
  listValue,
  type DomainRecord,
  type Workspace,
  type RecordKind,
} from "@/shared/contracts";
import { centralKinds, privateRowReadable, memberCan } from "@/shared/access-policy";
import { serialize, projectVisible } from "./repository";
import { activeSubjects } from "@/platform/worker-subjects";
import { hasPermission } from "@/platform/access";
import { scheduleLiveChange } from "@/platform/realtime";
export function invalidateWorkspace(departmentId: string, broadcast = true) {
  if (broadcast) scheduleLiveChange(departmentId);
}
export function invalidateTeam(_departmentId: string) {}
export function invalidateTimer(_userId: string) {}
export async function getWorkspace(context: Context, exportKind?: RecordKind): Promise<Workspace> {
  const refs = await readReferences(context);
  const grouped = Object.fromEntries(recordKinds.map((k) => [k, []])) as unknown as Record<
    RecordKind,
    DomainRecord[]
  >;
  const pages: Partial<Record<RecordKind, string | null>> = {};
  const exportReferences = new Set<RecordKind>([
    "productions",
    "actors",
    "characters",
    "casting",
    "people",
    "conversations",
    "categories",
    "calendarCategories",
    "sprints",
    "materials",
  ]);
  for (const kind of recordKinds) {
    if (kind === "timesheets") continue;
    if (exportKind && (kind === exportKind || exportReferences.has(kind))) {
      grouped[kind] = (await allRows(context, kind))
        .filter((r) => rowReadable(context, r, refs))
        .reverse()
        .map(serialize);
      continue;
    }
    const page = await recordPage(context, kind, {}, refs);
    grouped[kind] = page.records;
    pages[kind] = page.nextCursor;
  }
  if (exportKind) {
    const ids = Object.values(grouped)
      .flat()
      .map((r) => r.id);
    grouped.files = [];
    for (let offset = 0; offset < ids.length; offset += 1000) {
      const parents = ids.slice(offset, offset + 1000);
      const files = await db
        .select()
        .from(records)
        .where(
          and(
            eq(records.kind, "files"),
            sql`${records.data}->>'recordId' in (${sql.join(
              parents.map((id) => sql`${id}`),
              sql`,`,
            )})`,
          ),
        );
      grouped.files.push(
        ...files
          .filter((r) => !r.data.pendingDeletionOperation)
          .map((r) => ({ ...serialize(r), data: { ...r.data, path: undefined } })),
      );
    }
  }
  const projectHours: Record<string, number> = {};
  const teamScope = context.grants.filter((g) =>
    hasPermission({ id: context.user.id, grants: [g] }, "time.team.read", {
      departmentId: g.scope === "department" ? g.scopeId || "" : undefined,
      productionId: g.scope === "production" ? g.scopeId || "" : undefined,
    }),
  );
  const allTeam = teamScope.some((g) => g.scope === "tenant");
  const departmentIds = teamScope
    .filter((g) => g.scope === "department")
    .map((g) => g.scopeId!)
    .filter(Boolean);
  const productionIds = teamScope
    .filter((g) => g.scope === "production")
    .map((g) => g.scopeId!)
    .filter(Boolean);
  const totals = await db
    .select({
      productionId: records.productionId,
      seconds: sql<number>`sum(coalesce((${records.data}->>'durationSeconds')::numeric,0))`,
    })
    .from(records)
    .where(
      and(
        eq(records.organizationId, context.organizationId),
        eq(records.kind, "time"),
        allTeam
          ? undefined
          : or(
              eq(records.ownerId, context.user.id),
              departmentIds.length ? inArray(records.departmentId, departmentIds) : undefined,
              productionIds.length ? inArray(records.productionId, productionIds) : undefined,
            ),
      ),
    )
    .groupBy(records.productionId);
  for (const total of totals)
    if (total.productionId && refs.projectIds.has(total.productionId))
      projectHours[total.productionId] = Number(total.seconds);
  const [affiliations, profiles, personalTimers, attendance, activated, scopes] = await Promise.all(
    [
      activeSubjects(context.organizationId, context.departmentId).then((subjects) =>
        subjects.map((s) => s.user),
      ),
      db
        .select()
        .from(tenantProfiles)
        .where(
          and(
            eq(tenantProfiles.organizationId, context.organizationId),
            can(context, "personnel.read") ? undefined : eq(tenantProfiles.userId, context.user.id),
          ),
        )
        .limit(1000),
      db.select().from(timers).where(eq(timers.userId, context.user.id)).limit(1),
      db
        .select()
        .from(attendanceTimers)
        .where(eq(attendanceTimers.userId, context.user.id))
        .limit(1),
      db
        .select()
        .from(moduleActivations)
        .where(
          and(
            eq(moduleActivations.organizationId, context.organizationId),
            eq(moduleActivations.enabled, true),
          ),
        ),
      availableScopes(context.user.id),
    ],
  );
  const own = profiles.find((p) => p.userId === context.user.id);
  const seen = new Set<string>();
  const permittedMembers = context.user.grants?.every((g) => g.role === "guest")
    ? new Set([context.user.id, ...refs.projects.flatMap((p) => listValue(p.data.memberIds))])
    : null;
  const members = affiliations
    .filter(
      (m) =>
        (!permittedMembers || permittedMembers.has(m.id)) &&
        m.status === "active" &&
        !seen.has(m.id) &&
        !!seen.add(m.id),
    )
    .map((m) => ({
      id: m.id,
      name: m.name,
      username: m.username || "",
      role: m.role,
      status: m.status,
      ...(profiles.find((p) => p.userId === m.id)?.workingTime
        ? {
            preferences: {
              accentPalette: "green" as const,
              onboardingVersion: 0,
              workingTime: profiles.find((p) => p.userId === m.id)!.workingTime!,
            },
          }
        : {}),
    }));
  return {
    timezone: context.timezone || "Europe/Berlin",
    pages,
    user: {
      ...context.user,
      preferences: {
        ...context.user.preferences!,
        ...(own?.workingTime ? { workingTime: own.workingTime } : {}),
      },
    },
    organization: { id: context.organizationId, name: context.organizationName },
    department: { id: context.departmentId, name: context.departmentName },
    members,
    records: grouped,
    timer: personalTimers[0] || null,
    attendanceTimer: attendance[0] || null,
    projectHours,
    currentModuleId: activated.find((module) => module.config.departmentId === context.departmentId)
      ?.moduleId,
    modules: activated.map((m) => m.moduleId),
    scopes,
    platformAdmin: context.platformAdmin,
  };
}
