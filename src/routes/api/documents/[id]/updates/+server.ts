import { z } from "zod";
import { readJson, route } from "@/platform/http";
import { authorizedDocumentTicket } from "@/modules/documents/authorization";
import { appendDocumentUpdate } from "@/modules/documents/storage";
import { notifyDocument } from "@/modules/documents/live";

async function legacyPOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const input = z
      .object({
        ticket: z.string().max(2500),
        update: z.string().max(350_000),
        sinceRevision: z.number().int().nonnegative().max(2_000_000_000).default(0),
      })
      .parse(await readJson(request));
    const { id } = await params;
    const claims = await authorizedDocumentTicket(
      input.ticket,
      request.headers.get("cookie") || "",
      id,
    );
    const result = await appendDocumentUpdate(claims, input.update, input.sinceRevision);
    notifyDocument(id, result.revision);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) =>
  legacyPOST(request, { params: Promise.resolve(params as never) });
