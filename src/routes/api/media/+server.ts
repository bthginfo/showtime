import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { requireContext } from "@/platform/context";
import { route, readJson, assertOrigin } from "@/platform/http";
import { initMedia, mediaPart, finishMedia } from "@/modules/files/media";
export const POST: RequestHandler = ({ request }) =>
  route(async () => {
    const body = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("init"), data: z.unknown() }),
        z.object({ action: z.literal("finish"), id: z.string() }),
      ])
      .parse(await readJson(request));
    const context = await requireContext();
    return Response.json(
      await (body.action === "init"
        ? initMedia(context, body.data)
        : finishMedia(context, body.id)),
      { status: 201 },
    );
  });
export const PUT: RequestHandler = ({ request, url }) =>
  route(async () => {
    assertOrigin(request);
    const id = z.string().min(1).parse(url.searchParams.get("id")),
      index = z.coerce.number().int().min(0).max(31).parse(url.searchParams.get("part"));
    return Response.json(
      await mediaPart(
        await requireContext(),
        id,
        index,
        new Uint8Array(await request.arrayBuffer()),
      ),
    );
  });
