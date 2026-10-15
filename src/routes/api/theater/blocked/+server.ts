import type { RequestHandler } from "@sveltejs/kit";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { requireContext, requirePermission } from "@/platform/context";
import { route } from "@/platform/http";
import { db } from "@/platform/db";
import { tradeItems } from "@/platform/db/schema";
import { decodePosition, encodePosition } from "@/platform/pagination";
import { readReferences } from "@/modules/records/pages";
import { tradeReadable } from "@/modules/theater/service";
import { moduleById } from "@/modules/theater/registry";

export const GET: RequestHandler = ({ url }) =>
  route(async () => {
    const context = await requireContext();
    requirePermission(context, "budget.read");
    const refs = await readReferences(context);
    const cursor = decodePosition(url.searchParams.get("cursor"), context, "leadership-blocked");
    const rows = await db
      .select()
      .from(tradeItems)
      .where(
        and(
          eq(tradeItems.organizationId, context.organizationId),
          eq(tradeItems.status, "blocked"),
          sql`${tradeItems.type} <> 'workspace'`,
          cursor ? lt(tradeItems.id, cursor[1]) : undefined,
        ),
      )
      .orderBy(desc(tradeItems.id))
      .limit(101);
    return Response.json(
      {
        entries: rows
          .slice(0, 100)
          .filter(
            (row) =>
              (!row.productionId || refs.projectIds.has(row.productionId)) &&
              tradeReadable(context, row),
          )
          .map((row) => ({
            id: row.id,
            title: row.title,
            moduleId: row.moduleId,
            type: row.type,
            productionId: row.productionId,
            department: moduleById(row.moduleId)?.department || row.moduleId,
            production: String(
              refs.projects.find((p) => p.id === row.productionId)?.data.title ||
                "Ohne Produktionszuordnung",
            ),
          })),
        nextCursor:
          rows.length > 100
            ? encodePosition(
                ["1970-01-01T00:00:00.000Z", rows[99].id],
                context,
                "leadership-blocked",
              )
            : null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
