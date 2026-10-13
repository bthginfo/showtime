import { safeRecordColumns, safeRecordData } from "@/modules/privacy/read-projection";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { plannedPersonHours } from "@/shared/planned-person-hours";
import { serialize } from "@/modules/records/repository";
import { db } from "@/platform/db";
import {
  tradeItems,
  moduleActivations,
  performances,
  theaterProductions,
  tenantSettings,
  theaterSeasons,
  records,
} from "@/platform/db/schema";
import { can, requirePermission, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { readReferences } from "@/modules/records/pages";
import { readinessSnapshot } from "./readiness";
import { moduleById } from "./registry";
import { tradeReadable } from "./service";
import { collaborationOpen } from "@/shared/collaboration";
import { audienceOccupancy, type TheaterOverview } from "@/shared/theater-overview";

export async function leadershipOverview(
  context: Context,
  period: { from: string; to: string },
): Promise<TheaterOverview> {
  requirePermission(context, "budget.read");
  const from = z.iso.date().parse(period.from),
    to = z.iso.date().parse(period.to);
  if (to < from || Date.parse(to) - Date.parse(from) > 366 * 86400000)
    throw new HttpError(400, "Wähle einen Zeitraum von höchstens einem Jahr.");
  const refs = await readReferences(context);
  const projects = refs.projects.filter(
    (project) => project.data.status !== "archived" && project.data.archived !== true,
  );
  const activeProjectIds = new Set(projects.map((project) => project.id));
  const projectIds = refs.projects.map((project) => project.id),
    projectScope = projectIds.length ? inArray(tradeItems.productionId, projectIds) : sql`false`;
  const items = await db
    .select()
    .from(tradeItems)
    .where(or(isNull(tradeItems.productionId), projectScope))
    .limit(100001);
  if (items.length > 100000)
    throw new HttpError(
      413,
      "Der Datenbestand ist für diese Übersicht zu groß. Bitte kontaktiere die Theateradministration.",
    );
  const visible = items.filter((item) => tradeReadable(context, item));
  const current = visible.filter(
    (item) => !item.productionId || activeProjectIds.has(item.productionId),
  );
  const [settings] = await db.select().from(tenantSettings).limit(1);
  const [modules, metadata, shows] = await Promise.all([
    db.select().from(moduleActivations).where(eq(moduleActivations.enabled, true)),
    projectIds.length
      ? db.select().from(theaterProductions).where(inArray(theaterProductions.recordId, projectIds))
      : Promise.resolve([]),
    projectIds.length
      ? db
          .select()
          .from(performances)
          .where(
            and(
              inArray(performances.productionId, projectIds),
              sql`(${performances.curtainAt} at time zone ${settings?.timezone || "Europe/Berlin"})::date between ${from}::date and ${to}::date`,
            ),
          )
      : Promise.resolve([]),
  ]);
  const productionRows = projects
    .map((project) => {
      const states = readinessSnapshot(project.id, modules, items, settings?.settings || {}),
        activeRequired = states.filter((s) => s.required),
        missing = activeRequired.filter((s) => !s.ready).map((s) => s.label);
      return {
        id: project.id,
        title: String(project.data.title || "Produktion"),
        stage: metadata.find((row) => row.recordId === project.id)?.stage || "concept",
        required: activeRequired.length,
        confirmed: activeRequired.length - missing.length,
        missing,
      };
    })
    .sort((a, b) => b.missing.length - a.missing.length || a.title.localeCompare(b.title, "de"));
  const budgets = current.filter(
    (item) =>
      item.type === "budget" &&
      item.status === "published" &&
      can(context, "budget.read", item.productionId || "", item.departmentId),
  );
  const purchases = current.filter(
    (item) =>
      item.type === "purchase" &&
      can(context, "budget.read", item.productionId || "", item.departmentId),
  );
  const sum = (rows: typeof items, key = "amountCents") =>
    rows.reduce((total, item) => total + Number(item.data[key] || 0), 0);
  const plannedCents = sum(budgets),
    committedCents = sum(purchases.filter((item) => item.status === "approved"));
  const procurement = current.filter(
    (i) =>
      i.type === "procurement" &&
      !["archived", "cancelled"].includes(i.status) &&
      can(context, "budget.read", i.productionId || "", i.departmentId),
  );
  const invoices = procurement.filter((i) => ["invoiced", "paid"].includes(String(i.data.phase))),
    invoicedCents = sum(invoices),
    paidCents = sum(procurement.filter((i) => i.data.phase === "paid"));
  const approved = purchases.filter((i) => i.status === "approved"),
    forecastCents =
      committedCents +
      approved.reduce(
        (total, p) =>
          total +
          Math.max(
            0,
            sum(invoices.filter((i) => i.data.purchaseId === p.id)) -
              Number(p.data.amountCents || 0),
          ),
        0,
      ) +
      sum(purchases.filter((i) => i.status === "review"));
  const open = visible.filter(
    (item) => item.type === "collaboration" && collaborationOpen(item.status),
  );
  const now = new Date(),
    today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: settings?.timezone || "Europe/Berlin",
    }).format(now);
  const reportable = shows.filter((show) => show.curtainAt <= now && show.status !== "cancelled");
  const reportIds = new Set(reportable.map((show) => show.id));
  const reports = visible.filter(
    (item) =>
      item.type === "audience-report" &&
      ["done", "published"].includes(item.status) &&
      reportIds.has(String(item.data.performanceId)),
  );
  const visitors = sum(reports, "visitors"),
    offeredSeats = sum(reports, "offeredSeats");
  const zone = settings?.timezone || "Europe/Berlin",
    monthFormat = new Intl.DateTimeFormat("sv-SE", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
    });
  const trend = [...new Set(shows.map((s) => monthFormat.format(s.curtainAt)))]
    .sort()
    .map((month) => {
      const ids = new Set(
          shows.filter((s) => monthFormat.format(s.curtainAt) === month).map((s) => s.id),
        ),
        rows = reports.filter((r) => ids.has(String(r.data.performanceId)));
      return {
        month,
        visitors: sum(rows, "visitors"),
        incomeCents: sum(rows),
        reports: rows.length,
        occupancy: audienceOccupancy(sum(rows, "visitors"), sum(rows, "offeredSeats")),
      };
    });
  const priorDate = (date: string) => {
      const d = new Date(date + "T12:00Z");
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      return d.toISOString().slice(0, 10);
    },
    priorShows = projectIds.length
      ? await db
          .select()
          .from(performances)
          .where(
            and(
              inArray(performances.productionId, projectIds),
              sql`(${performances.curtainAt} at time zone ${zone})::date between ${priorDate(from)}::date and ${priorDate(to)}::date`,
            ),
          )
      : [];
  const priorIds = new Set(priorShows.filter((s) => s.status !== "cancelled").map((s) => s.id)),
    priorReports = visible.filter(
      (i) =>
        i.type === "audience-report" &&
        ["done", "published"].includes(i.status) &&
        priorIds.has(String(i.data.performanceId)),
    );
  const seasons = await db.select().from(theaterSeasons);
  const duties = projectIds.length
    ? await db
        .select(safeRecordColumns(context))
        .from(records)
        .where(
          and(
            eq(records.kind, "events"),
            inArray(records.productionId, projectIds),
            sql`((${records.startAt} at time zone ${zone})::date<=${to}::date and (${records.endAt} at time zone ${zone})::date>=${from}::date or coalesce(${records.data}->>'recurrence','none')<>'none')`,
          ),
        )
        .limit(10001)
    : [];
  if (duties.length > 10000)
    throw new HttpError(413, "Wähle für die Belastungsübersicht einen kürzeren Zeitraum.");
  const windowStart = fromZonedTime(from + "T00:00:00", zone),
    lastDay = new Date(Date.parse(to + "T12:00Z") + 86400000).toISOString().slice(0, 10),
    windowEnd = fromZonedTime(lastDay + "T00:00:00", zone);
  const categories = await db
    .select(safeRecordColumns(context))
    .from(records)
    .where(eq(records.kind, "calendarCategories"));
  const hours = plannedPersonHours(
    duties
      .filter((duty) => can(context, "schedule.read", duty.productionId || "", duty.departmentId))
      .map(serialize),
    windowStart,
    windowEnd,
    zone,
    categories.map(serialize),
  );
  return {
    generatedAt: now.toISOString(),
    period: { from, to },
    productionCount: productionRows.length,
    performances: {
      total: shows.length,
      played: reportable.length,
      cancelled: shows.filter((show) => show.status === "cancelled").length,
      upcoming: shows.filter((show) => show.curtainAt > now && show.status !== "cancelled").length,
    },
    readiness: {
      confirmed: productionRows.reduce((total, row) => total + row.confirmed, 0),
      required: productionRows.reduce((total, row) => total + row.required, 0),
      readyProductions: productionRows.filter((row) => row.required > 0 && !row.missing.length)
        .length,
    },
    requests: {
      open: open.length,
      overdue: open.filter((row) => row.data.dueDate && String(row.data.dueDate) < today).length,
      changesRequested: open.filter((row) => row.status === "changes_requested").length,
    },
    blockedItems: visible.filter((row) => row.type !== "workspace" && row.status === "blocked")
      .length,
    budget: {
      plannedCents,
      committedCents,
      pendingCents: sum(purchases.filter((row) => row.status === "review")),
      remainingCents: plannedCents - committedCents,
      orderedCents: sum(
        procurement.filter((i) => ["ordered", "delivered"].includes(String(i.data.phase))),
      ),
      invoicedCents,
      paidCents,
      forecastCents,
    },
    audience: {
      reports: reports.length,
      reportablePerformances: reportable.length,
      visitors,
      offeredSeats,
      paidTickets: sum(reports, "paidTickets"),
      complimentaryTickets: sum(reports, "complimentaryTickets"),
      incomeCents: sum(reports),
      occupancy: audienceOccupancy(visitors, offeredSeats),
    },
    productions: productionRows,
    trend,
    comparison: {
      label: "Gleicher Zeitraum im Vorjahr",
      visitors: sum(priorReports, "visitors"),
      incomeCents: sum(priorReports),
      reports: priorReports.length,
      occupancy: audienceOccupancy(
        sum(priorReports, "visitors"),
        sum(priorReports, "offeredSeats"),
      ),
    },
    seasons: seasons.map((s) => ({
      id: s.id,
      label: s.label,
      start: s.startAt.toISOString().slice(0, 10),
      end: s.endAt.toISOString().slice(0, 10),
    })),
    workload: {
      available: hours.size > 0,
      plannedHours: Math.round([...hours.values()].reduce((a, b) => a + b, 0) * 10) / 10,
      people: hours.size,
      over40Hours: [...hours.values()].filter(
        (h) => h / (Math.max(7, (Date.parse(to) - Date.parse(from)) / 86400000 + 1) / 7) > 40,
      ).length,
    },
  };
}
