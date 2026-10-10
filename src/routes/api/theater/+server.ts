import type { RequestHandler } from "@sveltejs/kit";
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import {
  theaterWorkspace,
  saveTradeItem,
  approvePurchase,
  saveResource,
  reserveResource,
  scheduleAction,
} from "@/modules/theater/service";
import { z } from "zod";
import { collections, collectionPage } from "@/modules/theater/collections";
export const GET: RequestHandler = ({ url }) =>
  route(async () => {
    const context = await requireContext(),
      productionId = url.searchParams.get("productionId") || undefined,
      cursor = url.searchParams.get("cursor") || undefined,
      window = {
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
      };
    const collection = url.searchParams.get("collection");
    return Response.json(
      collection
        ? await collectionPage(
            context,
            z.enum(collections).parse(collection),
            cursor,
            productionId,
            window,
          )
        : await theaterWorkspace(context, productionId, cursor, window),
    );
  });
export const POST: RequestHandler = ({ request }) =>
  route(async () => {
    const context = await requireContext(),
      body = z
        .object({
          action: z.enum([
            "save-item",
            "approve-purchase",
            "save-resource",
            "reserve-resource",
            "schedule",
          ]),
          data: z.unknown(),
        })
        .parse(await readJson(request));
    const result =
      body.action === "save-item"
        ? await saveTradeItem(context, body.data)
        : body.action === "save-resource"
          ? await saveResource(context, body.data)
          : body.action === "reserve-resource"
            ? await reserveResource(context, body.data)
            : body.action === "schedule"
              ? await scheduleAction(context, body.data)
              : await (async () => {
                  const data = z
                    .object({
                      id: z.string(),
                      expectedVersion: z.number().int(),
                      decision: z.enum(["approved", "rejected"]),
                    })
                    .parse(body.data);
                  return approvePurchase(context, data.id, data.expectedVersion, data.decision);
                })();
    return Response.json(result, { status: 201 });
  });
