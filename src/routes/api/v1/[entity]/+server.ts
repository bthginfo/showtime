import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { requireContext, can, requirePermission } from "@/platform/context";
import { route, readJson, HttpError } from "@/platform/http";
import { requireIntegrationScope } from "@/platform/integration-auth";
import { repeatable } from "@/modules/theater/integrations";
import { theaterWorkspace, saveTradeItem } from "@/modules/theater/service";
import { readableTrade } from "@/modules/theater/operations";
import { moduleById } from "@/modules/theater/registry";
import { recordPage } from "@/modules/records/pages";
import { saveRecord, assertRead } from "@/modules/records/service";
import { findRecord, serialize } from "@/modules/records/repository";
import { collectionPage } from "@/modules/theater/collections";
const reads = [
  "productions",
  "actors",
  "characters",
  "casting",
  "tasks",
  "events",
  "materials",
] as const;
const writes = ["actors", "characters", "casting", "tasks", "events", "materials"] as const;
export const GET: RequestHandler = ({ url, params }) =>
  route(async () => {
    const context = await requireContext();
    const entity = z
      .enum(["trade-items", "records", "calendar", "time", "finance", "resources", "performances"])
      .parse(params.entity);
    const id = url.searchParams.get("id"),
      productionId = url.searchParams.get("productionId") || undefined,
      cursor = url.searchParams.get("cursor") || undefined;
    const window = {
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    };
    if (entity === "trade-items" || entity === "finance") {
      requireIntegrationScope(entity === "finance" ? "finance:read" : "trade:read");
      if (entity === "finance") requirePermission(context, "budget.read", productionId);
      if (id) {
        const item = await readableTrade(context, id);
        if (
          entity === "finance" &&
          !["budget", "purchase", "procurement", "contract"].includes(item.type)
        )
          throw new HttpError(404, "Dieser Eintrag gehört nicht zum Finanzexport.");
        return Response.json(item);
      }
      const planning = await theaterWorkspace(context, productionId, cursor, window),
        moduleId = url.searchParams.get("moduleId"),
        type = url.searchParams.get("type");
      return Response.json({
        entries: planning.items.filter(
          (i) =>
            (!moduleId || i.moduleId === moduleId) &&
            (!type || i.type === type) &&
            (entity !== "finance" ||
              ["budget", "purchase", "procurement", "contract"].includes(i.type)),
        ),
        nextCursor: planning.nextCursor,
        timezone: planning.timezone,
      });
    }
    if (entity === "resources" || entity === "performances") {
      requireIntegrationScope(entity === "resources" ? "resources:read" : "calendar:read");
      return Response.json(await collectionPage(context, entity, cursor, productionId, window));
    }
    requireIntegrationScope(
      entity === "time" ? "time:read" : entity === "calendar" ? "calendar:read" : "records:read",
    );
    const kind =
      entity === "time"
        ? z.enum(["time", "attendance"]).parse(url.searchParams.get("kind") || "time")
        : entity === "calendar"
          ? "events"
          : z.enum(reads).parse(url.searchParams.get("kind"));
    if (id) {
      const item = await findRecord(context, id, kind);
      await assertRead(context, item);
      return Response.json(serialize(item));
    }
    return Response.json(
      await recordPage(context, kind, { cursor, from: window.from, to: window.to, productionId }),
    );
  });
export const POST: RequestHandler = ({ request, params }) =>
  route(async () => {
    const context = await requireContext();
    const entity = z.enum(["trade-items", "records", "ticketing", "calendar"]).parse(params.entity);
    const body = await readJson(request),
      key = z
        .string()
        .min(8)
        .max(100)
        .regex(/^[A-Za-z0-9_-]+$/)
        .parse(request.headers.get("idempotency-key"));
    if (entity === "trade-items" || entity === "ticketing") {
      requireIntegrationScope(entity === "ticketing" ? "ticketing:write" : "trade:write");
      const input =
        entity === "ticketing"
          ? { ...body, moduleId: "front-of-house", type: "audience-report", status: "done" }
          : body;
      const feature = moduleById(String(input.moduleId))?.features.find((f) => f.id === input.type);
      if (!feature || !can(context, feature.permission, input.productionId))
        throw new HttpError(403, "Keine aktuelle Berechtigung für diese Fachfunktion.");
      const result = await repeatable(context, entity + ":" + key, input, async () => {
        const item = await saveTradeItem(context, input);
        return { id: item.id };
      });
      return Response.json(await readableTrade(context, String(result.id)), { status: 201 });
    }
    requireIntegrationScope(entity === "calendar" ? "calendar:write" : "records:write");
    const input = z
      .object({
        kind: z.enum(writes),
        id: z.string().optional(),
        expectedVersion: z.number().int().positive().optional(),
        data: z.record(z.string(), z.unknown()),
      })
      .parse(entity === "calendar" ? { ...body, kind: "events" } : body);
    const permission =
      input.kind === "events"
        ? "schedule.manage"
        : input.kind === "tasks"
          ? "task.create"
          : input.kind === "materials"
            ? "inventory.manage"
            : input.kind === "casting"
              ? "casting.manage"
              : "production.manage";
    requirePermission(context, permission, String(input.data.productionId || ""));
    const result = await repeatable(context, entity + ":" + key, input, async () => {
      const item = await saveRecord(
        context,
        input.kind,
        input.data,
        input.id,
        input.expectedVersion,
      );
      return { id: item.id };
    });
    const saved = await findRecord(context, String(result.id), input.kind);
    await assertRead(context, saved);
    return Response.json(serialize(saved), { status: 201 });
  });
