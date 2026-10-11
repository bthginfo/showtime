import type { DomainRecord, Workspace } from "./contracts";

/** Describe the saved audience, never the workspace the reader happens to be in. */
export function teamChannelLabel(record: DomainRecord, workspace: Workspace) {
  if (record.data.scope === "theater") return "Theaterkanal · Alle Gewerke";
  const name =
    record.departmentId === workspace.department.id
      ? workspace.department.name
      : workspace.scopes?.find(
          (scope) =>
            scope.organizationId === workspace.organization.id &&
            scope.departmentId === record.departmentId,
        )?.departmentName;
  return name ? `${name} · Gewerkkanal` : "Gewerkkanal";
}

export function chatAudienceHint(
  record: DomainRecord | undefined,
  productionId: string,
  workspace: Workspace,
) {
  if (record && record.data.mode !== "team") return "Nur die Teilnehmenden haben Zugriff.";
  if (record?.data.scope === "theater") return "Für berechtigte Personen dieses Theaters.";
  if (productionId) return "Für das freigegebene Produktionsteam.";
  return record
    ? `Zugriff nach Gewerkberechtigung · ${teamChannelLabel(record, workspace)}`
    : `Für berechtigte Personen im Gewerk ${workspace.department.name}.`;
}
