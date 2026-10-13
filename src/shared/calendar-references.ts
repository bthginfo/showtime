import type { CalendarProductionReference, DomainRecord, RecordData, Workspace } from "./contracts";
import { textValue } from "./contracts";

/** Uses the existing tenant reference query; only calendar presentation fields leave the server. */
export function reducedCalendarProductions(
  productions: Pick<DomainRecord, "id" | "data">[],
  events: Pick<DomainRecord, "data">[],
): CalendarProductionReference[] {
  const used = new Set(events.map((row) => textValue(row.data.productionId)).filter(Boolean));
  return productions
    .filter((row) => used.has(row.id))
    .map((row) => ({
      id: row.id,
      data: {
        title: textValue(row.data.title),
        color: textValue(row.data.color),
        ...(typeof row.data.season === "string" ? { season: row.data.season } : {}),
        ...(typeof row.data.premiere === "string" ? { premiere: row.data.premiere } : {}),
      },
    }));
}

export function calendarProductionReferences(workspace: Workspace) {
  return (
    workspace.calendarProductions ??
    reducedCalendarProductions(workspace.records.productions, workspace.records.events)
  );
}

export function mergeCalendarProductions(
  existing: CalendarProductionReference[] = [],
  fresh: CalendarProductionReference[] = [],
) {
  const ids = new Set(fresh.map((row) => row.id));
  return [...existing.filter((row) => !ids.has(row.id)), ...fresh];
}

export type ProductionPresentation = { id: string; data: RecordData };
