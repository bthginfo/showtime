import { createHash } from "node:crypto";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/platform/db";
import { tradeItems, moduleActivations } from "@/platform/db/schema";
import { can, type Context } from "@/platform/context";
import { HttpError } from "@/platform/http";
import { requireIntegrationScope } from "@/platform/integration-auth";
import { moduleById, validateFeature } from "./registry";
import { saveTradeItem, tradeReadable } from "./service";
import { assertProject } from "@/modules/records/repository";
import { repeatable } from "./integrations";
import { parseExchange, mapExchangeRow, exportCSV } from "@/shared/exchange";
export async function importExchange(context: Context, input: unknown) {
  requireIntegrationScope("trade:write");
  const body = z
    .object({
      action: z.enum(["preview", "apply"]),
      operationId: z.uuid(),
      moduleId: z.string(),
      type: z.string(),
      productionId: z.string().optional(),
      format: z.enum(["csv", "json"]),
      content: z.string().max(1_000_000),
      mapping: z.record(z.string(), z.string().max(200)).default({}),
      previewHash: z.string().optional(),
    })
    .parse(input);
  const feature = moduleById(body.moduleId)?.features.find((f) => f.id === body.type);
  if (!feature || !can(context, feature.permission, body.productionId))
    throw new HttpError(403, "Keine Importberechtigung für diese Fachfunktion.");
  if (["stock-movement", "readiness", "qualification"].includes(body.type))
    throw new HttpError(
      400,
      "Diese verbindlichen Vorgänge werden einzeln über ihren Fachablauf gebucht.",
    );
  await assertProject(context, body.productionId);
  let rows: Record<string, unknown>[];
  try {
    rows = parseExchange(body.content, body.format);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Import konnte nicht gelesen werden.",
    );
  }
  if (!rows.length || rows.length > 100)
    throw new HttpError(
      400,
      "Wähle eine Datei mit 1–100 Zeilen. Größere Datenbestände lassen sich in mehreren Paketen übertragen.",
    );
  const previewHash = createHash("sha256")
    .update(
      JSON.stringify({
        ...body,
        action: undefined,
        operationId: undefined,
        previewHash: undefined,
      }),
    )
    .digest("hex");
  if (body.action === "apply" && body.previewHash !== previewHash)
    throw new HttpError(
      409,
      "Erstelle zunächst eine Vorschau dieser unveränderten Importdatei und Zuordnung.",
    );
  const mapped = rows.map((row, index) => ({
    row: index + 1,
    title: String(row[body.mapping.title || "title"] || ""),
    data: mapExchangeRow(row, body.mapping, feature.fields),
    externalId: String(row[body.mapping.externalId || "externalId"] || ""),
    id: row[body.mapping.id || "id"] ? String(row[body.mapping.id || "id"]) : undefined,
    expectedVersion: row[body.mapping.expectedVersion || "expectedVersion"]
      ? Number(row[body.mapping.expectedVersion || "expectedVersion"])
      : undefined,
  }));
  const errors: { row: number; error: string }[] = [],
    entries: { row: number; id: string; title: string }[] = [];
  class Preview extends Error {}
  try {
    await db.transaction(async (tx) => {
      for (const row of mapped) {
        try {
          await tx.transaction(async () => {
            validateFeature(body.moduleId, body.type, row.data);
            const proposal = {
              moduleId: body.moduleId,
              type: body.type,
              productionId: body.productionId,
              title: row.title,
              data: row.data,
              status: "draft",
              id: row.id,
              expectedVersion: row.expectedVersion,
            };
            const rowHash = createHash("sha256").update(JSON.stringify(proposal)).digest("hex");
            const externalKey =
              "exchange:" +
              body.moduleId +
              ":" +
              body.type +
              ":" +
              (row.id ? row.id + ":" + row.expectedVersion : row.externalId || rowHash);
            const result = await repeatable(context, externalKey, proposal, async () => {
              const saved = await saveTradeItem(context, proposal);
              return { id: saved.id };
            });
            const [current] = await db
              .select()
              .from(tradeItems)
              .where(eq(tradeItems.id, String(result.id)))
              .limit(1);
            if (!current || !tradeReadable(context, current))
              throw new HttpError(403, "Der frühere Importstand ist nicht mehr zugänglich.");
            entries.push({ row: row.row, id: current.id, title: current.title });
          });
        } catch (error) {
          errors.push({
            row: row.row,
            error:
              error instanceof HttpError
                ? error.message
                : "Bitte prüfe Titel, Werte und Referenz-IDs dieser Zeile.",
          });
        }
      }
      if (body.action === "preview") throw new Preview();
      if (errors.length)
        throw new HttpError(
          400,
          "Der Import wurde nicht übernommen. Korrigiere die angegebenen Zeilen.",
          { errors },
        );
    });
  } catch (error) {
    if (!(error instanceof Preview)) throw error;
  }
  return {
    previewHash,
    columns: Object.keys(rows[0]),
    rows: mapped.map((r) => ({ row: r.row, title: r.title, data: r.data })),
    errors,
    entries: body.action === "apply" ? entries : [],
    imported: body.action === "apply" ? entries.length : 0,
  };
}
export async function exportExchange(context: Context, params: URLSearchParams) {
  requireIntegrationScope("trade:read");
  const moduleId = z.string().min(1).parse(params.get("moduleId")),
    type = z.string().min(1).parse(params.get("type")),
    format = z.enum(["csv", "json"]).parse(params.get("format") || "csv"),
    productionId = params.get("productionId") || undefined;
  const feature = moduleById(moduleId)?.features.find((f) => f.id === type);
  if (!feature) throw new HttpError(400, "Unbekannter Fachablauf.");
  if (["participant", "measurements"].includes(type)) {
    const [activation] = await db
      .select()
      .from(moduleActivations)
      .where(eq(moduleActivations.moduleId, moduleId))
      .limit(1);
    const permission = type === "participant" ? "education.participants.read" : "measurements.read";
    if (
      !can(context, permission, productionId || "", String(activation?.config.departmentId || ""))
    )
      throw new HttpError(403, "Keine Berechtigung für den geschützten Export.");
  }
  if (feature.private && params.get("sensitiveConfirmed") !== "true")
    throw new HttpError(400, "Bestätige ausdrücklich den Export dieses geschützten Fachbereichs.");
  await assertProject(context, productionId);
  const rows = await db
    .select()
    .from(tradeItems)
    .where(
      and(
        eq(tradeItems.moduleId, moduleId),
        eq(tradeItems.type, type),
        productionId ? eq(tradeItems.productionId, productionId) : undefined,
      ),
    )
    .limit(2001);
  if (rows.length > 2000)
    throw new HttpError(
      413,
      "Begrenze den Export auf eine Produktion oder verwende die paginierte API.",
    );
  const visible = [];
  for (const item of rows) {
    if (!tradeReadable(context, item)) continue;
    try {
      await assertProject(context, item.productionId);
    } catch (error) {
      if (error instanceof HttpError && [403, 404].includes(error.status)) continue;
      throw error;
    }
    visible.push({
      id: item.id,
      expectedVersion: item.version,
      title: item.title,
      status: item.status,
      productionId: item.productionId,
      ...Object.fromEntries(
        feature.fields.filter((f) => !f.managed).map((f) => [f.key, item.data[f.key] ?? ""]),
      ),
    });
  }
  return new Response(format === "json" ? JSON.stringify(visible, null, 2) : exportCSV(visible), {
    headers: {
      "Content-Type":
        format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="showtime-${moduleId}-${type}.${format}"`,
    },
  });
}
