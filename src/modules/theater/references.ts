import { and, desc, eq, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/platform/db";
import {
  moduleActivations,
  performances,
  records,
  tradeItems,
  venueResources,
} from "@/platform/db/schema";
import { can, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { decodePosition, encodePosition } from "@/platform/pagination";
import { assertProject } from "@/modules/records/repository";
import { readReferences, rowReadable } from "@/modules/records/pages";
import { safeCategoryPredicate, safeRecordColumns } from "@/modules/privacy/read-projection";
import { moduleById, type Field } from "./registry";
import { tradeReadable } from "./service";

export type ReferenceOption = { id: string; label: string; detail?: string };
export type ReferencePage = {
  entries: ReferenceOption[];
  selected: ReferenceOption[];
  nextCursor: string | null;
};

/** Minimal, freshly authorized selectors, independent of the workspace's loaded pages/window. */
export async function tradeReferences(context: Context, input: unknown): Promise<ReferencePage> {
  const body = z
    .object({
      moduleId: z.string().max(80),
      type: z.string().max(80),
      field: z.string().max(80),
      productionId: z.string().max(100).optional(),
      q: z.string().trim().max(200).default(""),
      cursor: z.string().max(2000).optional(),
      ids: z.array(z.string().max(100)).max(200).default([]),
    })
    .parse(input);
  const feature = moduleById(body.moduleId)?.features.find((f) => f.id === body.type);
  const field: Field | undefined =
    body.field === "dependencyIds" && feature && !feature.private
      ? { key: "dependencyIds", label: "Erforderliche Vorarbeiten", type: "trades" }
      : feature?.fields.find((f) => f.key === body.field);
  if (
    !feature ||
    !field ||
    !["trade", "trades", "resource", "record", "performance"].includes(field.type)
  )
    throw new HttpError(400, "Diese Auswahl ist nicht verfügbar.");
  await assertProject(context, body.productionId);
  const [activation] = await db
    .select()
    .from(moduleActivations)
    .where(
      and(
        eq(moduleActivations.organizationId, context.organizationId),
        eq(moduleActivations.moduleId, body.moduleId),
        eq(moduleActivations.enabled, true),
      ),
    )
    .limit(1);
  if (
    !activation ||
    !can(
      context,
      feature.permission,
      body.productionId,
      ["budget", "purchase"].includes(body.type)
        ? context.departmentId
        : String(activation.config.departmentId || context.departmentId),
    )
  )
    throw new HttpError(403, "Keine Berechtigung für diese Fachauswahl.");
  const refs = await readReferences(context);
  const purpose = `trade-reference:${body.moduleId}:${body.type}:${body.field}:${body.productionId || ""}:${body.q}`;
  const cursor = decodePosition(body.cursor, context, purpose);
  const pattern = "%" + body.q.replace(/[\\%_]/g, "\\$&") + "%";
  const permitted = (id: string | null) => !id || refs.projectIds.has(id);
  const matchesProduction = (
    column: typeof tradeItems.productionId | typeof records.productionId,
  ) => (body.productionId ? or(isNull(column), eq(column, body.productionId)) : isNull(column));

  async function scan(selected: boolean) {
    const pageFilter = (
      column:
        | typeof tradeItems.id
        | typeof records.id
        | typeof venueResources.id
        | typeof performances.id,
    ) => (selected ? inArray(column, body.ids) : cursor ? lt(column, cursor[1]) : undefined);
    const limit = selected ? 200 : 51;
    if (field!.type === "trade" || field!.type === "trades") {
      const rows = await db
        .select()
        .from(tradeItems)
        .where(
          and(
            eq(tradeItems.organizationId, context.organizationId),
            field!.key === "dependencyIds"
              ? body.productionId
                ? eq(tradeItems.productionId, body.productionId)
                : isNull(tradeItems.productionId)
              : matchesProduction(tradeItems.productionId),
            pageFilter(tradeItems.id),
            field!.sourceTypes?.length
              ? inArray(tradeItems.type, field!.sourceTypes)
              : sql`${tradeItems.type} not in ('workspace','collaboration')`,
            field!.key !== "sourceItemId" && !selected
              ? sql`${tradeItems.status} not in ('archived','cancelled')`
              : undefined,
            body.q && !selected ? ilike(tradeItems.title, pattern) : undefined,
          ),
        )
        .orderBy(desc(tradeItems.id))
        .limit(limit);
      return {
        rows,
        options: rows
          .filter(
            (row) =>
              permitted(row.productionId) &&
              tradeReadable(context, row) &&
              (feature!.private ||
                !moduleById(row.moduleId)?.features.find((f) => f.id === row.type)?.private),
          )
          .map((row) => ({
            id: row.id,
            label: row.title,
            detail: row.productionId ? "Zur Produktion" : "Allgemeiner Bestand",
          })),
      };
    }
    if (field!.type === "resource") {
      const rows = await db
        .select()
        .from(venueResources)
        .where(
          and(
            eq(venueResources.organizationId, context.organizationId),
            pageFilter(venueResources.id),
            body.q && !selected ? ilike(venueResources.name, pattern) : undefined,
          ),
        )
        .orderBy(desc(venueResources.id))
        .limit(limit);
      return {
        rows,
        options: rows
          .filter((row) =>
            can(context, "inventory.read", undefined, row.departmentId || context.departmentId),
          )
          .map((row) => ({ id: row.id, label: row.name })),
      };
    }
    if (field!.type === "performance") {
      const rows = await db
        .select()
        .from(performances)
        .where(
          and(
            eq(performances.organizationId, context.organizationId),
            pageFilter(performances.id),
            body.productionId ? eq(performances.productionId, body.productionId) : undefined,
            !selected ? sql`${performances.status} <> 'cancelled'` : undefined,
            body.type === "audience-report" && !selected
              ? sql`${performances.curtainAt} <= now()`
              : undefined,
            body.q && !selected
              ? or(
                  ilike(sql`${performances.curtainAt}::text`, pattern),
                  inArray(
                    performances.productionId,
                    refs.projects
                      .filter((p) =>
                        String(p.data.title || "")
                          .toLocaleLowerCase("de")
                          .includes(body.q.toLocaleLowerCase("de")),
                      )
                      .map((p) => p.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(performances.id))
        .limit(limit);
      return {
        rows,
        options: rows
          .filter(
            (row) => permitted(row.productionId) && can(context, "schedule.read", row.productionId),
          )
          .map((row) => ({
            id: row.id,
            label: new Intl.DateTimeFormat("de-DE", {
              timeZone: context.timezone || "Europe/Berlin",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(row.curtainAt),
            detail: String(
              refs.projects.find((p) => p.id === row.productionId)?.data.title || "Vorstellung",
            ),
          })),
      };
    }
    if (!field!.source) throw new HttpError(400, "Die Referenzart fehlt.");
    const rows = await db
      .select(safeRecordColumns(context))
      .from(records)
      .where(
        and(
          eq(records.organizationId, context.organizationId),
          eq(records.kind, field!.source),
          safeCategoryPredicate(),
          matchesProduction(records.productionId),
          pageFilter(records.id),
          sql`${records.data}->>'pendingDeletionOperation' is null`,
          body.q && !selected
            ? ilike(sql`coalesce(${records.data}->>'title',${records.data}->>'name','')`, pattern)
            : undefined,
        ),
      )
      .orderBy(desc(records.id))
      .limit(limit);
    const options: ReferenceOption[] = [];
    for (const row of rows) {
      if (!rowReadable(context, row, refs)) continue;
      const parentId = String(row.data.recordId || "");
      if (row.kind === "files" && parentId.startsWith("trade-files:")) {
        const [parent] = await db
          .select()
          .from(tradeItems)
          .where(
            and(
              eq(tradeItems.organizationId, context.organizationId),
              eq(tradeItems.id, parentId.slice(12)),
            ),
          )
          .limit(1);
        if (!parent || !permitted(parent.productionId) || !tradeReadable(context, parent)) continue;
      }
      options.push({ id: row.id, label: String(row.data.title || row.data.name || "Eintrag") });
    }
    return { rows, options };
  }
  const page = await scan(false);
  const selected = body.ids.length ? (await scan(true)).options : [];
  const first = new Set(page.rows.slice(0, 50).map((row) => row.id));
  return {
    entries: page.options.filter((option) => first.has(option.id)),
    selected,
    nextCursor:
      page.rows.length > 50
        ? encodePosition(["1970-01-01T00:00:00.000Z", page.rows[49].id], context, purpose)
        : null,
  };
}
