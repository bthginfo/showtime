import { HttpError } from "./http";
export const permissions = [
  "production.read",
  "production.manage",
  "casting.manage",
  "schedule.read",
  "schedule.manage",
  "schedule.publish",
  "task.create",
  "task.manage",
  "task.assign",
  "document.read",
  "document.create",
  "document.manage",
  "document.publish",
  "chat.read",
  "chat.write",
  "chat.channels.manage",
  "inventory.read",
  "inventory.manage",
  "inventory.reserve",
  "handover.create",
  "time.own",
  "time.team.read",
  "time.team.manage",
  "leave.own",
  "leave.approve",
  "availability.own",
  "readiness.manage",
  "budget.read",
  "budget.request",
  "budget.approve",
  "personnel.read",
  "personnel.manage",
  "measurements.read",
  "measurements.manage",
  "tenant.configure",
  "members.manage",
  "roles.assign",
  "modules.configure",
  "invitations.manage",
  "audit.read",
] as const;
export type Permission = (typeof permissions)[number];
export const roleKeys = [
  "employee",
  "team_lead",
  "production_lead",
  "disposition",
  "technical_lead",
  "intendance",
  "theater_admin",
  "personnel",
  "costume_specialist",
  "guest",
] as const;
export type TheaterRole = (typeof roleKeys)[number];
export type Grant = {
  role: TheaterRole;
  scope: "tenant" | "department" | "production";
  scopeId: string | null;
  expiresAt?: string | null;
};
const employee: Permission[] = [
  "production.read",
  "schedule.read",
  "task.create",
  "document.read",
  "document.create",
  "chat.read",
  "chat.write",
  "inventory.read",
  "inventory.reserve",
  "handover.create",
  "time.own",
  "leave.own",
  "availability.own",
  "budget.request",
];
export const rolePermissions: Record<TheaterRole, readonly Permission[]> = {
  employee,
  team_lead: [
    ...employee,
    "task.manage",
    "task.assign",
    "schedule.manage",
    "document.manage",
    "document.publish",
    "inventory.manage",
    "leave.approve",
    "readiness.manage",
    "time.team.read",
    "time.team.manage",
    "chat.channels.manage",
  ],
  production_lead: [
    ...employee,
    "production.manage",
    "casting.manage",
    "schedule.manage",
    "task.manage",
    "task.assign",
    "document.manage",
    "readiness.manage",
    "budget.read",
  ],
  disposition: [
    "production.read",
    "casting.manage",
    "schedule.read",
    "schedule.manage",
    "schedule.publish",
    "task.manage",
    "task.assign",
    "document.read",
    "chat.read",
    "chat.write",
    "chat.channels.manage",
    "inventory.read",
    "inventory.reserve",
    "readiness.manage",
  ],
  technical_lead: [
    ...employee,
    "task.manage",
    "task.assign",
    "schedule.manage",
    "document.manage",
    "document.publish",
    "inventory.manage",
    "readiness.manage",
  ],
  intendance: [
    "production.read",
    "schedule.read",
    "document.read",
    "chat.read",
    "chat.write",
    "readiness.manage",
    "budget.read",
    "budget.approve",
  ],
  theater_admin: [
    "tenant.configure",
    "members.manage",
    "roles.assign",
    "modules.configure",
    "invitations.manage",
    "audit.read",
    "chat.channels.manage",
  ],
  personnel: [
    "personnel.read",
    "personnel.manage",
    "time.team.read",
    "time.team.manage",
    "leave.approve",
    "schedule.read",
    "chat.read",
    "chat.write",
  ],
  costume_specialist: [...employee, "measurements.read", "measurements.manage"],
  guest: [
    "production.read",
    "schedule.read",
    "document.read",
    "chat.read",
    "chat.write",
    "availability.own",
  ],
};
export type AccessSubject = { id: string; grants: readonly Grant[] };
export type ResourceScope = { departmentId?: string; productionId?: string; ownerId?: string };
export function grantApplies(grant: Grant, scope: ResourceScope, now = Date.now()) {
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= now) return false;
  return (
    grant.scope === "tenant" ||
    (grant.scope === "department" && grant.scopeId === scope.departmentId) ||
    (grant.scope === "production" && grant.scopeId === scope.productionId)
  );
}
export function hasPermission(
  subject: AccessSubject,
  permission: Permission,
  scope: ResourceScope = {},
) {
  return subject.grants.some(
    (g) => grantApplies(g, scope) && rolePermissions[g.role]?.includes(permission),
  );
}
export function allowedPermissions(subject: AccessSubject, scope: ResourceScope) {
  return permissions.filter((p) => hasPermission(subject, p, scope));
}
export function assertPermission(
  subject: AccessSubject,
  permission: Permission,
  scope: ResourceScope = {},
) {
  if (!hasPermission(subject, permission, scope))
    throw new HttpError(403, "Für diese Aktion fehlt dir die Berechtigung.");
}
export function assertOtherPerson(subject: AccessSubject, ownerId: string) {
  if (subject.id === ownerId)
    throw new HttpError(403, "Eigene Anträge dürfen nicht selbst genehmigt werden.");
}
export function canDelegate(subject: AccessSubject, grant: Grant) {
  const scope =
    grant.scope === "department"
      ? { departmentId: grant.scopeId || "" }
      : grant.scope === "production"
        ? { productionId: grant.scopeId || "" }
        : {};
  if (!hasPermission(subject, "roles.assign", scope)) return false;
  // Theater admins can assign the defined theater templates; never platform rights.
  return subject.grants.some(
    (g) => g.role === "theater_admin" && g.scope === "tenant" && grantApplies(g, scope),
  );
}
