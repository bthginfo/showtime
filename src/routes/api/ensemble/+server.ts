const NextResponse = Response;
import { z } from "zod";
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import { ensemblePreview, importEnsemble } from "@/modules/ensemble/service";
import { repairActorPortraits } from "@/modules/files/actor-portraits";
import { seasonSchema } from "@/modules/records/schemas";
async function legacyGET(request: Request) {
  return route(async () => {
    const season = seasonSchema
      .optional()
      .parse(new URL(request.url).searchParams.get("season") || undefined);
    return NextResponse.json(await ensemblePreview(await requireContext(true), season));
  });
}
async function legacyPOST(request: Request) {
  return route(async () => {
    const context = await requireContext(true);
    const input = z
      .union([
        z
          .object({
            sourceIds: z
              .array(z.string().regex(/^\d{1,10}$/))
              .min(1)
              .max(4),
            season: seasonSchema.optional(),
          })
          .strict(),
        z.object({ actorIds: z.array(z.string().uuid()).min(1).max(4) }).strict(),
      ])
      .parse(await readJson(request));
    return NextResponse.json(
      "sourceIds" in input
        ? await importEnsemble(context, input.sourceIds, input.season)
        : await repairActorPortraits(context, input.actorIds),
    );
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request, params }) => legacyGET(request);
export const POST: RequestHandler = ({ request, params }) => legacyPOST(request);
