import { z } from "zod";
import { readJson, route } from "@/platform/http";
import { authorizedDocumentTicket } from "@/modules/documents/authorization";
import { readDocumentState } from "@/modules/documents/storage";

async function legacyPOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { ticket, sinceRevision } = z
      .object({
        ticket: z.string().max(2500),
        sinceRevision: z.number().int().nonnegative().max(2_000_000_000).optional(),
      })
      .parse(await readJson(request));
    const { id } = await params;
    const claims = await authorizedDocumentTicket(ticket, request.headers.get("cookie") || "", id);
    return Response.json(await readDocumentState(claims, sinceRevision), {
      headers: { "Cache-Control": "no-store" },
    });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) =>
  legacyPOST(request, { params: Promise.resolve(params as never) });
