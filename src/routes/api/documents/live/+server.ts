import { eq } from "drizzle-orm";
import { requireContext } from "@/platform/context";
import { db } from "@/platform/db";
import { documentBuffers } from "@/platform/db/schema";
import { documentChannel, verifyDocumentTicket } from "@/modules/documents/ticket";
import { authorizedDocumentTicket } from "@/modules/documents/authorization";
import { revisionStream } from "@/platform/realtime/stream";
import { route } from "@/platform/http";
import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request, url }) =>
  route(async () => {
    const context = await requireContext();
    const claims = verifyDocumentTicket(
      url.searchParams.get("ticket") || "",
      request.headers.get("cookie") || "",
    );
    return revisionStream(
      request,
      context,
      documentChannel(claims.fileId),
      "document.changed",
      async () => {
        await authorizedDocumentTicket(
          url.searchParams.get("ticket") || "",
          request.headers.get("cookie") || "",
          claims.fileId,
        );
        const [row] = await db
          .select()
          .from(documentBuffers)
          .where(eq(documentBuffers.fileId, claims.fileId))
          .limit(1);
        return row?.revision || 0;
      },
    );
  });
