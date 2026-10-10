import { requireContext } from "@/platform/context";
import { assertOrigin, route } from "@/platform/http";
import { openDocument } from "@/modules/documents/service";

async function legacyPOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    assertOrigin(request);
    const context = await requireContext(true);
    const { id } = await params;
    return Response.json(await openDocument(context, id, request.headers.get("cookie") || ""), {
      headers: { "Cache-Control": "no-store" },
    });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) =>
  legacyPOST(request, { params: Promise.resolve(params as never) });
