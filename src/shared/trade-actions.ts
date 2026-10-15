import { hasPermission, type Permission } from "@/platform/access";
import type { Feature } from "@/modules/theater/registry";
import type { TradeItem } from "@/modules/theater/types";

type Subject = Parameters<typeof hasPermission>[0];
/** UI affordances mirror the action-specific server checks; never grant access themselves. */
export function tradeActions(
  subject: Subject,
  item: TradeItem,
  feature: Feature | undefined,
  activeDepartmentId: string,
) {
  const can = (permission: Permission) =>
    hasPermission(subject, permission, {
      productionId: item.productionId || "",
      departmentId: item.departmentId,
    });
  const permitted = !!feature && can(feature.permission);
  const closed = ["archived", "cancelled"].includes(item.status);
  const manager: Permission =
    item.type === "budget"
      ? "budget.approve"
      : item.type === "measurements"
        ? "measurements.manage"
        : feature?.permission === "schedule.manage"
          ? "schedule.manage"
          : "document.manage";
  const editable =
    permitted &&
    (item.createdBy === subject.id || can(manager)) &&
    !closed &&
    item.type !== "stock-movement" &&
    !(item.type === "purchase" && ["approved", "rejected"].includes(item.status));
  const lifecycle =
    permitted &&
    !["workspace", "collaboration", "stock-movement"].includes(item.type) &&
    (item.createdBy === subject.id ||
      can(feature?.private ? feature.permission : "document.manage"));
  const financial =
    ["budget", "purchase", "procurement"].includes(item.type) &&
    ["published", "approved", "done"].includes(item.status);
  const openLoan = item.type === "loan" && !item.data.returnedAt;
  return {
    edit: editable,
    attach: permitted && !closed,
    successor: lifecycle,
    restore: lifecycle && closed && !financial,
    archive: lifecycle && !closed && !financial && !openLoan,
    cancel: lifecycle && !closed && !financial && !openLoan,
    followup:
      !!feature &&
      !feature.private &&
      !!item.productionId &&
      !closed &&
      item.departmentId === activeDepartmentId &&
      can("collaboration.create"),
  };
}

export function tradeStatus(
  item: Pick<TradeItem, "type" | "status"> & { data?: Record<string, unknown> },
) {
  // Historic stock rows used "draft" although their ledger effect was already committed.
  return item.type === "stock-movement"
    ? "Gebucht"
    : item.type === "loan" && !["archived", "cancelled"].includes(item.status)
      ? item.data?.returnedAt
        ? "Zurückgegeben"
        : "Ausgeliehen"
      : item.type === "readiness" && !["archived", "cancelled"].includes(item.status)
        ? item.data?.ready === true
          ? "Bestätigung gespeichert"
          : "Noch offen"
        : undefined;
}
