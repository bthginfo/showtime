import { z } from "zod";
import { readJson, route } from "@/platform/http";
import { authorizedDocumentTicket } from "@/modules/documents/authorization";
import { checkpointDocument } from "@/modules/documents/service";

async function legacyPOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { ticket } = z.object({ ticket: z.string().max(2500) }).parse(await readJson(request));
    const { id } = await params;
    const claims = await authorizedDocumentTicket(ticket, request.headers.get("cookie") || "", id);
    return Response.json(await checkpointDocument(id, claims.departmentId, claims), {
      headers: { "Cache-Control": "no-store" },
    });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) =>
  legacyPOST(request, { params: Promise.resolve(params as never) });
