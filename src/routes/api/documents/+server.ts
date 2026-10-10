import { z } from "zod";
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import { recordKinds } from "@/shared/contracts";
import { createSharedDocument } from "@/modules/documents/create";

async function legacyPOST(request: Request) {
  return route(async () => {
    const context = await requireContext(true);
    const input = z
      .object({
        recordKind: z.enum(recordKinds),
        recordId: z.string().min(1).max(200),
        name: z.string().trim().min(1).max(160),
        format: z.enum(["text", "sheet"]),
      })
      .parse(await readJson(request));
    return Response.json(await createSharedDocument(context, input), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) => legacyPOST(request);
