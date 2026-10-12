import type { Field } from "@/modules/theater/registry";
import type { Workspace } from "./contracts";
import type { Planning } from "@/modules/theater/types";
import { tradeChoiceLabel } from "./trade-labels";
import { theaterLabel } from "./theater-time";
export function tradeCurrentDisplay(
  value: unknown,
  field: Pick<Field, "key"> & Partial<Field>,
  workspace: Workspace,
  planning: Planning,
  approvalVerified?: boolean,
): string {
  if (field.managed && !approvalVerified) return "Freigabe noch erforderlich";
  return tradeDisplay(value, field, workspace, planning);
}
export function tradeDisplay(
  value: unknown,
  field: Pick<Field, "key"> & Partial<Field>,
  workspace: Workspace,
  planning: Planning,
): string {
  if (value === undefined || value === null || value === "") return "–";
  if (Array.isArray(value))
    return value.map((v) => tradeDisplay(v, field, workspace, planning)).join(", ") || "–";
  if (field.key === "amountCents")
    return (Number(value) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  if (field.type === "date" || field.type === "datetime")
    return theaterLabel(String(value), planning.timezone, field.type === "datetime");
  if (["trade", "trades"].includes(field.type || ""))
    return (
      planning.items.find((i) => i.id === value)?.title || "Verknüpfter Fachstand (separat öffnen)"
    );
  if (["member", "members"].includes(field.type || ""))
    return workspace.members.find((m) => m.id === value)?.name || "Zugeordnete Person";
  if (field.type === "resource")
    return planning.resources.find((r) => r.id === value)?.name || "Zugeordnete Ressource";
  if (field.type === "department")
    return planning.departments.find((d) => d.id === value)?.name || "Zugeordnetes Gewerk";
  if (field.type === "budget")
    return planning.funding.find((b) => b.id === value)?.title || "Zugeordneter Budgetrahmen";
  if (field.type === "record") {
    const row = [
      ...(field.source
        ? workspace.records[field.source] || []
        : Object.values(workspace.records).flat()),
      ...(planning.tradeFiles || []),
    ].find((r) => r.id === value);
    return String(row?.data.name || row?.data.title || row?.data.fullName || "Verknüpfter Eintrag");
  }
  if (field.type === "performance") {
    const show = planning.performances.find((p) => p.id === value);
    return show
      ? "Vorstellung " + theaterLabel(show.curtainAt, planning.timezone, true)
      : "Verknüpfte Vorstellung";
  }
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  return typeof value === "object" ? JSON.stringify(value) : tradeChoiceLabel(String(value));
}
