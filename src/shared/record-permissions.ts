import { listValue, type Member, type RecordData, type RecordKind } from "./contracts";
import { memberCan, writePermission, anyPermission } from "./access-policy";
import { collaborationContributor, collaborationOpen } from "./collaboration";
type Actor = Pick<
  Member,
  "id" | "role" | "permissions" | "grants" | "departmentId" | "activeDepartmentIds"
>;
export function canSetCalendarParticipants(
  member: Actor,
  data: RecordData,
  departmentId = member.departmentId,
) {
  const selected = listValue(data.participantIds);
  const row = { kind: "events" as const, createdBy: member.id, departmentId, data };
  return (
    memberCan(member as Member, "schedule.manage", row) ||
    (memberCan(member as Member, "availability.own", row) &&
      selected.length === 1 &&
      selected[0] === member.id)
  );
}
export function canManageRecord(
  member: Actor,
  kind: RecordKind,
  record?: { id?: string; createdBy: string; departmentId?: string; data: RecordData },
) {
  if (kind === "handovers" && record?.data.collaborationId)
    return (
      collaborationOpen(String(record.data.collaborationState)) &&
      collaborationContributor(member, {
        ...record,
        departmentId: record.departmentId || "",
        productionId: String(record.data.productionId || "") || null,
      })
    );
  if (["notifications", "timesheets", "files", "shiftSwaps"].includes(kind)) return false;
  const row = {
    ...record,
    kind,
    createdBy: record?.createdBy || member.id,
    data: record?.data || {},
  };
  if (
    ["leave", "messages", "feedback"].includes(kind) &&
    record?.data.userId &&
    record.data.userId !== member.id
  )
    return false;
  if (["time", "attendance"].includes(kind))
    return record?.data.userId && record.data.userId !== member.id
      ? memberCan(member as Member, "time.team.manage", row)
      : anyPermission(member as Member, "time.own");
  if (kind === "events" && record?.data.leaveId) return false;
  if (kind === "events" && !record)
    return (
      memberCan(member as Member, "schedule.manage", row) ||
      memberCan(member as Member, "availability.own", row)
    );
  if (kind === "events" && record)
    return canSetCalendarParticipants(member, record.data, record.departmentId);
  if (kind === "conversations" && record?.data.mode !== "team" && record)
    return record.createdBy === member.id && anyPermission(member as Member, "chat.write");
  if (kind === "conversations" && record?.data.mode === "team")
    return memberCan(
      member as Member,
      "chat.channels.manage",
      record.data.scope === "theater" ? { ...row, departmentId: "" } : row,
    );
  if (kind === "messages" && (record?.data.conversationId || record?.data.productionId))
    return anyPermission(member as Member, "chat.write");
  if (kind === "reservations" && record && record.createdBy !== member.id)
    return memberCan(member as Member, "inventory.manage", row);
  if (kind === "tasks" && record && record.createdBy !== member.id)
    return memberCan(member as Member, "task.manage", row);
  if (
    ["looks", "templates", "maskPlans"].includes(kind) &&
    record &&
    record.createdBy !== member.id
  )
    return memberCan(member as Member, "document.manage", row);
  const permission = writePermission[kind];
  return permission ? memberCan(member as Member, permission, row) : false;
}
