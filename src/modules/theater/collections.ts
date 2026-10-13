import { and, eq, desc, lt, sql, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/platform/db";
import {
  venueResources,
  resourceBookings,
  performances,
  productionRuns,
  theaterWorks,
  theaterSeasons,
  theaterProductions,
  scheduleVersions,
} from "@/platform/db/schema";
import type { Context } from "@/platform/context";
import { can } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { readReferences, type ReadReferences } from "@/modules/records/pages";
import { decodePosition, encodePosition } from "@/platform/pagination";
import { guestOnly, anyPermission } from "@/shared/access-policy";
export const collections = [
  "resources",
  "bookings",
  "performances",
  "runs",
  "works",
  "seasons",
  "productionMetadata",
  "scheduleVersions",
] as const;
export type Collection = (typeof collections)[number];
export type PlanningWindow = { from?: string; to?: string };
export function planningWindow(input: PlanningWindow = {}) {
  const today = new Date();
  const from = input.from
      ? z.iso.date().parse(input.from)
      : new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10),
    to = input.to
      ? z.iso.date().parse(input.to)
      : new Date(today.getTime() + 120 * 86400000).toISOString().slice(0, 10);
  if (to < from || Date.parse(to) - Date.parse(from) > 366 * 86400000)
    throw new HttpError(400, "Wähle einen Zeitraum von höchstens einem Jahr.");
  return { from, to };
}
export async function collectionPage(
  context: Context,
  name: Collection,
  cursor?: string,
  productionId?: string,
  window: PlanningWindow = {},
  references?: ReadReferences,
) {
  const tables = {
    resources: venueResources,
    bookings: resourceBookings,
    performances,
    runs: productionRuns,
    works: theaterWorks,
    seasons: theaterSeasons,
    productionMetadata: theaterProductions,
    scheduleVersions,
  };
  const table = tables[name],
    range = planningWindow(window),
    purpose = `theater:${name}:${productionId || ""}:${range.from}:${range.to}`,
    position = decodePosition(cursor, context, purpose);
  const reference = references || (await readReferences(context)),
    permitted = (id: string | null) => !id || reference.projectIds.has(id);
  // Only a fixed server-side table registry is accepted. Tenant RLS applies to every page.
  const page: any[] = await db
    .select({
      ...getTableColumns(table),
      ...(name === "scheduleVersions"
        ? { snapshot: sql`showtime_safe_snapshot(${scheduleVersions.snapshot})` }
        : {}),
    })
    .from(table)
    .where(
      and(
        eq(table.organizationId, context.organizationId),
        position ? lt(table.id, position[1]) : undefined,
        name === "bookings"
          ? and(
              productionId ? eq(resourceBookings.productionId, productionId) : undefined,
              sql`${resourceBookings.endAt}>=${new Date(range.from).toISOString()}`,
              sql`${resourceBookings.startAt}<${new Date(Date.parse(range.to) + 86400000).toISOString()}`,
            )
          : undefined,
        name === "performances"
          ? and(
              productionId ? eq(performances.productionId, productionId) : undefined,
              sql`${performances.curtainAt}>=${new Date(range.from).toISOString()}`,
              sql`${performances.curtainAt}<${new Date(Date.parse(range.to) + 86400000).toISOString()}`,
            )
          : undefined,
        name === "runs" && productionId ? eq(productionRuns.productionId, productionId) : undefined,
      ),
    )
    .orderBy(desc(table.id))
    .limit(201);
  const scanned = page.slice(0, 200);
  const visible = scanned
    .filter((row) => {
      if (name === "resources")
        return (
          anyPermission(context.user, "inventory.read") &&
          (!row.departmentId || can(context, "inventory.read", undefined, row.departmentId))
        );
      if (["bookings", "performances", "runs"].includes(name))
        return anyPermission(context.user, "schedule.read") && permitted(row.productionId);
      if (name === "productionMetadata") return permitted(row.recordId);
      if (name === "scheduleVersions")
        return (
          anyPermission(context.user, "schedule.read") &&
          (row.state === "published" || can(context, "schedule.manage", undefined, ""))
        );
      if (guestOnly(context.user)) return false;
      return anyPermission(context.user, "production.read");
    })
    .map((row) => {
      if (name === "productionMetadata" && !can(context, "budget.read", row.recordId)) {
        const { budgetCents, ...rest } = row;
        return rest;
      }
      if (name === "scheduleVersions") {
        const { snapshot, ...rest } = row;
        return {
          ...rest,
          changedProductionIds: (snapshot.changedProductionIds || []).filter(permitted),
        };
      }
      return row;
    });
  return {
    entries: visible,
    nextCursor:
      page.length > 200
        ? encodePosition(["1970-01-01T00:00:00.000Z", scanned.at(-1)!.id], context, purpose)
        : null,
    window: range,
  };
}
