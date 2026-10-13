import type { ProductionPresentation } from "./calendar-references";
import { textValue, type DomainRecord } from "./contracts";

/** Chronological premieres, earliest first; productions without a date follow at the end. */
export function sortProductionsByPremiere<T extends ProductionPresentation>(records: T[]) {
  return [...records].sort((a, b) => {
    const left = textValue(a.data.premiere).trim(),
      right = textValue(b.data.premiere).trim();
    return (
      Number(!left) - Number(!right) ||
      left.localeCompare(right) ||
      textValue(a.data.title).localeCompare(textValue(b.data.title), "de") ||
      a.id.localeCompare(b.id)
    );
  });
}
