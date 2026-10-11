import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import {
  readinessState,
  tradeHistory,
  lifecycle,
  followups,
  readinessPolicy,
  batchPlan,
} from "@/modules/theater/operations";
export const GET: RequestHandler = ({ url }) =>
  route(async () =>
    Response.json(
      url.searchParams.has("readiness")
        ? await readinessState(
            await requireContext(),
            z.string().min(1).parse(url.searchParams.get("readiness")),
            url.searchParams.get("performanceId") || undefined,
          )
        : await tradeHistory(
            await requireContext(),
            z.string().min(1).parse(url.searchParams.get("id")),
            url.searchParams.has("before")
              ? z.coerce.number().int().positive().parse(url.searchParams.get("before"))
              : undefined,
          ),
    ),
  );
export const POST: RequestHandler = ({ request }) =>
  route(async () => {
    const context = await requireContext(),
      body = z
        .object({
          action: z.enum([
            "lifecycle",
            "followups",
            "readiness-policy",
            "batch-preview",
            "batch-apply",
          ]),
          data: z.unknown(),
        })
        .parse(await readJson(request));
    return Response.json(
      await (body.action === "lifecycle"
        ? lifecycle(context, body.data)
        : body.action === "followups"
          ? followups(context, body.data)
          : body.action === "readiness-policy"
            ? readinessPolicy(context, body.data)
            : batchPlan(context, body.data, body.action === "batch-apply")),
    );
  });
