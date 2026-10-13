import {
  hasPermission,
  rolePermissions,
  type Permission,
  type AccessSubject,
} from "@/platform/access";
import { listValue, type Member, type DomainRecord, type RecordKind } from "./contracts";
type Row = Pick<DomainRecord, "kind" | "createdBy" | "data"> &
  Partial<Pick<DomainRecord, "id" | "departmentId">>;
export const centralKinds: RecordKind[] = [
  "productions",
  "actors",
  "characters",
  "casting",
  "people",
  "events",
  "conversations",
  "messages",
  "files",
  "time",
  "attendance",
  "leave",
  "notifications",
];
export const guestOnly = (member: Member) =>
  !!member.grants?.length && member.grants.every((g) => g.role === "guest");
export function anyPermission(member: Member, permission: Permission) {
  return (
    member.grants?.some(
      (g) =>
        (!g.expiresAt || Date.parse(g.expiresAt) > Date.now()) &&
        rolePermissions[g.role]?.includes(permission),
    ) || false
  );
}
export function memberCan(
  member: Member,
  permission: Permission,
  row?: Row,
  departmentId?: string,
) {
  if (member.grants)
    return hasPermission({ id: member.id, grants: member.grants }, permission, {
      departmentId: row?.departmentId ?? departmentId ?? member.departmentId,
      productionId: row?.kind === "productions" ? row.id : String(row?.data.productionId || ""),
    });
  return member.permissions?.includes(permission) || false;
}
/** Team calendar reading is independent of internal production membership. Guests keep their narrower grants. */
export function calendarRowReadable(member: Member, row: Row, departmentId?: string) {
  if (
    !guestOnly(member) &&
    memberCan(member, "schedule.read", { ...row, data: {} }, row.departmentId || departmentId)
  )
    return true;
  const own = listValue(row.data.participantIds).includes(member.id);
  return (own || !!row.data.productionId) && memberCan(member, "schedule.read", row, departmentId);
}
export function privateRowReadable(member: Member, row: Row, departmentId?: string) {
  const own = row.data.userId === member.id;
  if (row.kind === "notifications" || row.kind === "feedback") return own;
  if (["time", "attendance", "timesheets"].includes(row.kind))
    return own || memberCan(member, "time.team.read", row, departmentId);
  if (row.kind === "leave")
    return (
      own ||
      memberCan(member, "leave.approve", row, departmentId) ||
      memberCan(member, "personnel.read", row, departmentId)
    );
  if (row.kind === "looks" && row.data.status !== "published")
    return row.createdBy === member.id || memberCan(member, "document.manage", row, departmentId);
  if (row.kind === "shiftSwaps")
    return (
      row.data.requesterId === member.id ||
      row.data.partnerId === member.id ||
      memberCan(member, "schedule.manage", row, departmentId)
    );
  if (row.kind === "conversations") {
    if (row.data.mode !== "team")
      return (
        listValue(row.data.participantIds).includes(member.id) && anyPermission(member, "chat.read")
      );
    if (guestOnly(member)) return false;
    if (row.data.scope === "theater")
      return memberCan(member, "chat.read", undefined, departmentId);
    return memberCan(member, "chat.read", row, departmentId);
  }
  if (row.kind === "events") return calendarRowReadable(member, row, departmentId);
  const readPermission: Partial<Record<RecordKind, Permission>> = {
    productions: "production.read",
    actors: "production.read",
    characters: "production.read",
    casting: "production.read",
    people: "production.read",
    events: "schedule.read",
    messages: "chat.read",
    files: "document.read",
    looks: "document.read",
    templates: "document.read",
    maskPlans: "document.read",
    materials: "inventory.read",
    reservations: "inventory.read",
    handovers: "document.read",
    categories: "document.read",
    calendarCategories: "schedule.read",
    tasks: "production.read",
    sprints: "production.read",
  };
  const permission = readPermission[row.kind];
  const globalCatalog = ["productions", "actors", "characters", "casting", "people"].includes(
    row.kind,
  );
  if (row.kind === "messages" && (row.data.conversationId || row.data.productionId))
    return anyPermission(member, "chat.read");
  if (globalCatalog && guestOnly(member) && !row.data.productionId && row.kind !== "productions")
    return false;
  return (
    !permission ||
    memberCan(
      member,
      permission,
      globalCatalog ? { ...row, departmentId: departmentId || member.departmentId } : row,
      departmentId,
    )
  );
}
export const writePermission: Partial<Record<RecordKind, Permission>> = {
  productions: "production.manage",
  actors: "casting.manage",
  characters: "casting.manage",
  casting: "casting.manage",
  people: "production.manage",
  tasks: "task.create",
  sprints: "task.manage",
  events: "schedule.manage",
  time: "time.own",
  attendance: "time.own",
  leave: "leave.own",
  looks: "document.create",
  templates: "document.create",
  maskPlans: "document.create",
  materials: "inventory.manage",
  reservations: "inventory.reserve",
  handovers: "handover.create",
  categories: "document.manage",
  calendarCategories: "schedule.manage",
  conversations: "chat.write",
  messages: "chat.write",
  feedback: "chat.write",
};
