import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/platform/db";
import {
  tradeItems,
  moduleActivations,
  performances,
  theaterProductions,
  tenantSettings,
} from "@/platform/db/schema";
import { can, requirePermission, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { readReferences } from "@/modules/records/pages";
import { defaultRequired } from "./readiness";
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
  const projectIds = projects.map((project) => project.id),
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
  const required = Array.isArray(settings?.settings.requiredReadinessModules)
    ? (settings.settings.requiredReadinessModules as string[])
    : defaultRequired;
  const activeRequired = modules.filter((module) => required.includes(module.moduleId));
  const productionRows = projects
    .map((project) => {
      const ready = new Set(
        items
          .filter(
            (item) =>
              item.productionId === project.id &&
              item.type === "workspace" &&
              ["ready", "done"].includes(item.status),
          )
          .map((item) => item.moduleId),
      );
      const missing = activeRequired
        .filter((module) => !ready.has(module.moduleId))
        .map((module) => moduleById(module.moduleId)?.label || module.moduleId);
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
  const budgets = visible.filter(
    (item) =>
      item.type === "budget" &&
      item.status === "published" &&
      can(context, "budget.read", item.productionId || "", item.departmentId),
  );
  const purchases = visible.filter(
    (item) =>
      item.type === "purchase" &&
      can(context, "budget.read", item.productionId || "", item.departmentId),
  );
  const sum = (rows: typeof items, key = "amountCents") =>
    rows.reduce((total, item) => total + Number(item.data[key] || 0), 0);
  const plannedCents = sum(budgets),
    committedCents = sum(purchases.filter((item) => item.status === "approved"));
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
  };
}
