import { and, eq } from "drizzle-orm";
import { auth } from "./auth";
import { authDb } from "./db/connections";
import {
  memberships,
  organizations,
  departments,
  profilePreferences,
  tenantMembers,
  permissionGrants,
  tenantSettings,
  platformAdmins,
} from "./db/schema";
import { HttpError } from "./http";
import { currentRequest } from "./request";
import { hasPermission, rolePermissions, type Grant, type Permission } from "./access";
import type { Member } from "@/shared/contracts";
import { integrationIdentity } from "./integration-auth";
export interface Context {
  user: Member;
  organizationId: string;
  departmentId: string;
  organizationName: string;
  timezone?: string;
  departmentName: string;
  grants: Grant[];
  platformAdmin?: boolean;
  activeDepartmentIds?: string[];
}
export const scopeTag = (departmentId: string) => `workspace:${departmentId}`;
export function cookieValue(cookie: string, key: string) {
  const part = cookie
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${key}=`));
  try {
    return part ? decodeURIComponent(part.slice(key.length + 1)) : "";
  } catch {
    return "";
  }
}
export async function identity() {
  const result = await auth.api.getSession({
    headers: currentRequest().request.headers,
    query: { disableCookieCache: true },
  });
  if (!result) throw new HttpError(401, "Bitte melde dich an.");
  return result.user;
}
export async function availableScopes(userId: string) {
  return authDb
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      timezone: tenantSettings.timezone,
      departmentId: departments.id,
      departmentName: departments.name,
      status: memberships.status,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .innerJoin(
      departments,
      and(
        eq(memberships.departmentId, departments.id),
        eq(memberships.organizationId, departments.organizationId),
      ),
    )
    .innerJoin(
      tenantMembers,
      and(
        eq(tenantMembers.organizationId, memberships.organizationId),
        eq(tenantMembers.userId, memberships.userId),
      ),
    )
    .innerJoin(tenantSettings, eq(tenantSettings.organizationId, memberships.organizationId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(tenantMembers.status, "active"),
        eq(tenantSettings.status, "active"),
      ),
    );
}
export async function effectiveGrants(
  userId: string,
  organizationId: string,
  scopes?: Awaited<ReturnType<typeof availableScopes>>,
): Promise<Grant[]> {
  const activeDepartments = new Set(
    (scopes || (await availableScopes(userId)))
      .filter((s) => s.organizationId === organizationId && s.status === "active")
      .map((s) => s.departmentId),
  );
  if (!activeDepartments.size) return [];
  const raw = await authDb
    .select()
    .from(permissionGrants)
    .where(
      and(eq(permissionGrants.organizationId, organizationId), eq(permissionGrants.userId, userId)),
    );
  return raw
    .filter(
      (g) =>
        (!g.expiresAt || g.expiresAt > new Date()) &&
        rolePermissions[g.role]?.length &&
        (g.scope !== "department" || activeDepartments.has(g.scopeId || "")),
    )
    .map((g) => ({
      role: g.role,
      scope: g.scope,
      scopeId: g.scopeId,
      expiresAt: g.expiresAt?.toISOString(),
    }));
}
export async function requireContext(_fresh = true): Promise<Context> {
  const scope = currentRequest();
  if (scope.context) return scope.context;
  const integration = await integrationIdentity();
  const person = integration?.person || (await identity());
  const list = await availableScopes(person.id);
  const selected =
    integration?.selection ||
    cookieValue(scope.request.headers.get("cookie") || "", "showtime.scope");
  const row = selected
    ? list.find((r) => `${r.organizationId}:${r.departmentId}` === selected)
    : list.length === 1
      ? list[0]
      : undefined;
  if (!row)
    throw new HttpError(
      list.length ? 409 : 403,
      list.length
        ? "Bitte wähle dein Theater und Gewerk."
        : "Dein Zugang wartet auf eine Theaterzuordnung.",
      { scopeRequired: !!list.length, pending: !list.length },
    );
  if (row.status !== "active")
    throw new HttpError(403, "Dein Zugang für dieses Gewerk ist deaktiviert.");
  const [preference] = await authDb
    .select()
    .from(profilePreferences)
    .where(eq(profilePreferences.userId, person.id))
    .limit(1);
  const grants = await effectiveGrants(person.id, row.organizationId, list);
  if (!grants.length)
    throw new HttpError(403, "Deine Theaterzuordnung ist abgelaufen oder wurde entzogen.");
  const permissions = [
    ...new Set(
      grants
        .filter(
          (g) =>
            g.scope === "tenant" || (g.scope === "department" && g.scopeId === row.departmentId),
        )
        .flatMap((g) => rolePermissions[g.role] || []),
    ),
  ];
  const [admin] = await authDb
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, person.id))
    .limit(1);
  const user: Member = {
    id: person.id,
    departmentId: row.departmentId,
    name: person.name,
    username: person.username || "",
    role: permissions.includes("task.manage") ? "admin" : "user",
    status: "active",
    permissions,
    grants,
    activeDepartmentIds: list
      .filter((s) => s.organizationId === row.organizationId && s.status === "active")
      .map((s) => s.departmentId),
    preferences: {
      accentPalette: preference?.accentPalette || "green",
      onboardingVersion: preference?.onboardingVersion || 0,
    },
  };
  const context = {
    ...row,
    user,
    grants,
    activeDepartmentIds: user.activeDepartmentIds,
    platformAdmin: !integration && !!admin,
  };
  scope.context = context;
  return context;
}
export function can(
  context: Context,
  permission: Permission,
  productionId?: string,
  departmentId = context.departmentId,
) {
  return hasPermission({ id: context.user.id, grants: context.grants }, permission, {
    departmentId,
    productionId,
  });
}
export function requirePermission(context: Context, permission: Permission, productionId?: string) {
  if (!can(context, permission, productionId))
    throw new HttpError(403, "Dir fehlt die Berechtigung für diese Aktion.");
}
export function requireAdmin(context: Context) {
  requirePermission(context, "members.manage");
}
export function requireSuperadmin(context: Context) {
  requirePermission(context, "roles.assign");
}
