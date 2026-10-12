import type { DomainRecord } from "@/shared/contracts";

const normalized = (value: unknown) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const credited = new Set([
  "vacation",
  "urlaub",
  "holiday",
  "feiertag",
  "holidaycompensation",
  "feiertagsausgleich",
  "sick",
  "krank",
  "sickwithcertificate",
  "sickwithoutcertificate",
  "krankmitattest",
  "krankohneattest",
  "krankattest",
  "krankmitohneattest",
]);
const excluded = new Set(["abf", "rest", "ruhetag", "halfdayoff", "halberfreiertag"]);

/** Stable system keys win; imported named categories use already loaded definitions. */
export function calendarDayCreditCategory(event: DomainRecord, categories: DomainRecord[]) {
  const key = normalized(event.data.category);
  if (excluded.has(key)) return false;
  if (credited.has(key)) return true;
  const definition = categories.find(
    (row) => row.data.key === event.data.category && row.departmentId === event.departmentId,
  );
  const name = normalized(definition?.data.name);
  return !excluded.has(name) && credited.has(name);
}
