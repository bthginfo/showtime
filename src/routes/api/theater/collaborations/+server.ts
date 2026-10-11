import { z } from "zod";
import type { RequestHandler } from "@sveltejs/kit";
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import {
  collaborationList,
  collaborationDetail,
  createCollaboration,
  replyCollaboration,
} from "@/modules/theater/collaborations";
export const GET: RequestHandler = ({ url }) =>
  route(async () => {
    const context = await requireContext();
    return Response.json(
      url.searchParams.get("id")
        ? await collaborationDetail(
            context,
            z.string().min(1).max(100).parse(url.searchParams.get("id")),
            z.coerce
              .number()
              .int()
              .min(0)
              .max(1_000_000)
              .parse(url.searchParams.get("afterVersion") || 0),
          )
        : await collaborationList(
            context,
            url.searchParams.get("productionId") || undefined,
            z.coerce
              .number()
              .int()
              .min(0)
              .max(100_000)
              .parse(url.searchParams.get("offset") || 0),
          ),
    );
  });
export const POST: RequestHandler = ({ request }) =>
  route(async () => {
    const context = await requireContext();
    const body = z
      .object({ action: z.enum(["create", "reply"]), data: z.unknown() })
      .parse(await readJson(request));
    return Response.json(
      body.action === "create"
        ? await createCollaboration(context, body.data)
        : await replyCollaboration(context, body.data),
      { status: 201 },
    );
  });
