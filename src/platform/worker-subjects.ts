import { and, eq } from "drizzle-orm";
import { db, type Transaction } from "./db";
import { memberships, tenantMembers, permissionGrants, user, tenantSettings } from "./db/schema";
import { allowedPermissions, rolePermissions, type Grant } from "./access";
import type { Context } from "./context";
/** Fresh, tenant-local identities for handlers. Never substitutes platform privileges. */
export async function activeSubjects(
  organizationId: string,
  preferredDepartmentId: string,
  tx: Transaction | typeof db = db,
): Promise<Context[]> {
  const [settings] = await tx
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.organizationId, organizationId))
    .limit(1);
  if (settings?.status !== "active") return [];
  const affiliations = await tx
    .select({
      userId: memberships.userId,
      departmentId: memberships.departmentId,
      name: user.name,
      username: user.username,
    })
    .from(memberships)
    .innerJoin(
      tenantMembers,
      and(
        eq(tenantMembers.organizationId, memberships.organizationId),
        eq(tenantMembers.userId, memberships.userId),
      ),
    )
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, "active"),
        eq(tenantMembers.status, "active"),
      ),
    );
  const raw = await tx
    .select()
    .from(permissionGrants)
    .where(eq(permissionGrants.organizationId, organizationId));
  const ids = [...new Set(affiliations.map((a) => a.userId))];
  const now = new Date();
  return ids.flatMap((id) => {
    const scopes = affiliations.filter((a) => a.userId === id),
      departments = new Set(scopes.map((a) => a.departmentId));
    const grants: Grant[] = raw
      .filter(
        (g) =>
          g.userId === id &&
          (!g.expiresAt || g.expiresAt > now) &&
          rolePermissions[g.role]?.length &&
          (g.scope !== "department" || departments.has(g.scopeId || "")),
      )
      .map((g) => ({
        role: g.role,
        scope: g.scope,
        scopeId: g.scopeId,
        expiresAt: g.expiresAt?.toISOString(),
      }));
    if (!grants.length) return [];
    const identity = scopes.find((a) => a.departmentId === preferredDepartmentId) || scopes[0];
    return [
      {
        organizationId,
        departmentId: identity.departmentId,
        organizationName: "",
        timezone: settings.timezone,
        departmentName: "",
        grants,
        activeDepartmentIds: [...departments],
        user: {
          id,
          name: identity.name,
          username: identity.username || "",
          role: "user" as const,
          status: "active" as const,
          departmentId: identity.departmentId,
          grants,
          activeDepartmentIds: [...departments],
          permissions: allowedPermissions({ id, grants }, { departmentId: identity.departmentId }),
        },
      },
    ];
  });
}
