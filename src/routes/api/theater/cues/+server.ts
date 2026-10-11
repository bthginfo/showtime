import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { requireContext } from "@/platform/context";
import { route, HttpError } from "@/platform/http";
import { db } from "@/platform/db";
import { tradeItems } from "@/platform/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { tradeReadable } from "@/modules/theater/service";
import { assertProject, findRecord } from "@/modules/records/repository";
import { moduleById } from "@/modules/theater/registry";
import { offlineCueHtml } from "@/modules/theater/offline";
import { exportCSV } from "@/shared/exchange";
export const GET: RequestHandler = ({ url }) =>
  route(async () => {
    const context = await requireContext(),
      id = z.string().min(1).parse(url.searchParams.get("productionId"));
    await assertProject(context, id);
    const production = await findRecord(context, id, "productions");
    const items = await db
      .select()
      .from(tradeItems)
      .where(and(eq(tradeItems.productionId, id), eq(tradeItems.type, "cue")))
      .orderBy(asc(tradeItems.id))
      .limit(2001);
    if (items.length > 2000) throw new HttpError(413, "Wähle einen kleineren Cue-Bestand.");
    const rows = items
      .filter((i) => tradeReadable(context, i) && !["archived", "cancelled"].includes(i.status))
      .sort((a, b) => Number(a.data.sequence || 0) - Number(b.data.sequence || 0))
      .map((i) => ({
        title: i.title,
        version: i.version,
        module: moduleById(i.moduleId)?.label || i.moduleId,
        sequence: i.data.sequence ?? "",
        trigger: i.data.trigger ?? "",
        action: i.data.action || i.data.look || i.data.notes || i.data.projection || "",
      }));
    const csv = url.searchParams.get("format") === "csv";
    return new Response(
      csv
        ? exportCSV(rows)
        : offlineCueHtml(String(production.data.title), rows, new Date().toISOString()),
      {
        headers: {
          "Content-Type": csv ? "text/csv;charset=utf-8" : "text/html;charset=utf-8",
          "Content-Disposition": `attachment; filename="showtime-cues.${csv ? "csv" : "html"}"`,
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
      },
    );
  });
