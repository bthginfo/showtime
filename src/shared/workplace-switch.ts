import type { Workspace } from "./contracts";

export type WorkplaceScope = NonNullable<Workspace["scopes"]>[number];

export function activeWorkplaceScopes(scopes: readonly WorkplaceScope[]) {
  const unique = new Map<string, WorkplaceScope>();
  for (const scope of scopes) {
    if (scope.status !== "active" || !scope.organizationId || !scope.departmentId) continue;
    unique.set(`${scope.organizationId}:${scope.departmentId}`, scope);
  }
  return [...unique.values()];
}

/** Platform administration is a verified server flag, never a theater leadership role. */
export function workplaceSwitchPolicy(
  workspace: Pick<Workspace, "organization" | "scopes" | "platformAdmin" | "user">,
) {
  const platformAdmin = workspace.platformAdmin === true;
  const scopes = activeWorkplaceScopes(workspace.scopes || []);
  const ownScopes = scopes.filter((scope) => scope.organizationId === workspace.organization.id);
  const departmentCount = workspace.scopes
    ? ownScopes.length
    : new Set(workspace.user.activeDepartmentIds || []).size;
  return {
    canSwitch: platformAdmin || departmentCount > 1,
    canSwitchTheater: platformAdmin,
    scopes: platformAdmin ? scopes : ownScopes,
  };
}

/** A regular account never receives a theater selection in its working UI. */
export function pickerOrganization(
  scopes: readonly WorkplaceScope[],
  platformAdmin: boolean,
  initialOrganization = "",
  currentOrganization = "",
  selection = "",
) {
  const organizations = new Set(activeWorkplaceScopes(scopes).map((scope) => scope.organizationId));
  if (!platformAdmin && initialOrganization)
    return organizations.has(initialOrganization) ? initialOrganization : "";
  const preferred = platformAdmin
    ? [selection, initialOrganization, currentOrganization]
    : [initialOrganization, currentOrganization];
  return (
    preferred.find((id) => organizations.has(id)) ||
    (organizations.size === 1 ? [...organizations][0] || "" : "")
  );
}
