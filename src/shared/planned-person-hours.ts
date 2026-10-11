import type { DomainRecord } from "./contracts";
import { calendarPresentation } from "./calendar-categories";
import { occurrences } from "@/modules/calendar/occurrences";

/** Net planned presence. Overlapping services and rehearsals are counted once; this is not payroll. */
export function plannedPersonHours(
  events: DomainRecord[],
  from: Date,
  to: Date,
  zone: string,
  categories: DomainRecord[] = [],
) {
  const byPerson = new Map<string, { start: number; end: number; weight: number }[]>();
  for (const event of events) {
    const presentation = calendarPresentation(event, [], categories);
    if (event.data.cancelled || presentation.allDay || presentation.background === "hint") continue;
    for (const slot of occurrences(event, from, to, zone)) {
      const start = Math.max(from.getTime(), slot.start.getTime()),
        end = Math.min(to.getTime(), slot.end.getTime());
      const elapsed = slot.end.getTime() - slot.start.getTime();
      if (end <= start || elapsed <= 0) continue;
      const weight = Math.max(0, 1 - (Number(event.data.pauseMinutes || 0) * 60000) / elapsed);
      for (const id of Array.isArray(event.data.participantIds) ? event.data.participantIds : []) {
        const rows = byPerson.get(String(id)) || [];
        rows.push({ start, end, weight });
        byPerson.set(String(id), rows);
      }
    }
  }
  const hours = new Map<string, number>();
  for (const [person, intervals] of byPerson) {
    const edges = intervals
      .flatMap((row, id) => [
        { at: row.start, id, enter: true },
        { at: row.end, id, enter: false },
      ])
      .sort((a, b) => a.at - b.at);
    const active = new Set<number>(),
      heap: number[] = [];
    const weight = (id: number) => intervals[id].weight;
    const push = (id: number) => {
      heap.push(id);
      let i = heap.length - 1;
      while (i) {
        const parent = (i - 1) >> 1;
        if (weight(heap[parent]) >= weight(heap[i])) break;
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
      }
    };
    const pop = () => {
      const last = heap.pop();
      if (!heap.length) return;
      heap[0] = last!;
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && weight(heap[child + 1]) > weight(heap[child])) child++;
        if (weight(heap[i]) >= weight(heap[child])) break;
        [heap[i], heap[child]] = [heap[child], heap[i]];
        i = child;
      }
    };
    let total = 0,
      previous = edges[0]?.at || 0;
    for (const edge of edges) {
      while (heap.length && !active.has(heap[0])) pop();
      total += (edge.at - previous) * (heap.length ? weight(heap[0]) : 0);
      previous = edge.at;
      if (edge.enter) {
        active.add(edge.id);
        push(edge.id);
      } else active.delete(edge.id);
    }
    hours.set(person, total / 3600000);
  }
  return hours;
}
