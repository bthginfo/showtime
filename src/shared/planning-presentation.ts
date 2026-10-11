import type { DomainRecord } from "./contracts";
import { theaterLabel } from "./theater-time";

export function planningEventLabel(event: Pick<DomainRecord, "data">) {
  const title = String(event.data.title || "").trim();
  return title || "Termin ohne Titel";
}

export function planningEventOptions(
  events: DomainRecord[],
  timezone: string,
  productions: DomainRecord[],
) {
  return [...events]
    .sort((a, b) => String(a.data.start).localeCompare(String(b.data.start)))
    .map((event) => ({
      id: event.id,
      label: planningEventLabel(event),
      detail: [
        theaterLabel(String(event.data.start), timezone, true),
        productions.find((production) => production.id === event.data.productionId)?.data.title,
        ["daily", "weekly"].includes(String(event.data.recurrence)) ? "Terminserie" : "",
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}
