import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/platform/db";
import { records, performances, resourceBookings, scheduleVersions } from "@/platform/db/schema";
import { HttpError } from "@/platform/http";
import { planningWindow, type PlanningWindow } from "./collections";
export async function planningSnapshot(window: PlanningWindow) {
  const range = planningWindow(window),
    start = new Date(range.from),
    end = new Date(Date.parse(range.to) + 86400000);
  const [shows, bookings, events] = await Promise.all([
    db
      .select()
      .from(performances)
      .where(
        and(
          sql`${performances.curtainAt}>=${start.toISOString()}`,
          sql`${performances.curtainAt}<${end.toISOString()}`,
        ),
      )
      .limit(10001),
    db
      .select()
      .from(resourceBookings)
      .where(
        and(
          sql`${resourceBookings.endAt}>=${start.toISOString()}`,
          sql`${resourceBookings.startAt}<${end.toISOString()}`,
        ),
      )
      .limit(10001),
    db
      .select()
      .from(records)
      .where(
        and(
          eq(records.kind, "events"),
          sql`${records.startAt}<${end.toISOString()}`,
          sql`(${records.endAt}>=${start.toISOString()} or coalesce(${records.data}->>'recurrence','none')<>'none')`,
        ),
      )
      .limit(10001),
  ]);
  if ([shows, bookings, events].some((r) => r.length > 10000))
    throw new HttpError(
      413,
      "Wähle einen kleineren Planzeitraum. Eine Version umfasst höchstens 10.000 Einträge je Bereich.",
    );
  const [previous] = await db
    .select()
    .from(scheduleVersions)
    .where(eq(scheduleVersions.state, "published"))
    .orderBy(desc(scheduleVersions.version))
    .limit(1);
  const old = (previous?.snapshot.events || []) as typeof events;
  const changed = new Set(
    events
      .filter((e) => !old.some((o) => o.id === e.id && o.version === e.version))
      .map((e) => e.productionId)
      .filter((id): id is string => !!id),
  );
  for (const row of old)
    if (!events.some((e) => e.id === row.id) && row.productionId) changed.add(row.productionId);
  return {
    window: range,
    performances: shows,
    bookings,
    events,
    changedProductionIds: [...changed],
  };
}
export function snapshotIdentity(snapshot: Record<string, unknown>) {
  return ["performances", "bookings", "events"]
    .map((key) =>
      ((snapshot[key] || []) as { id: string; version: number }[])
        .map((r) => r.id + ":" + r.version)
        .sort()
        .join("|"),
    )
    .join("\n");
}
