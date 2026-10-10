import { requireContext } from "@/platform/context";
import { db } from "@/platform/db";
import { tenantSettings } from "@/platform/db/schema";
import { verifyLiveTicket } from "@/platform/realtime/ticket";
import { revisionStream } from "@/platform/realtime/stream";
import { route, HttpError } from "@/platform/http";
import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request, url }) =>
  route(async () => {
    const context = await requireContext();
    const channel = `dm:changes:${context.departmentId}`;
    if (
      !verifyLiveTicket(url.searchParams.get("ticket") || "", request.headers.get("cookie") || "", [
        channel,
      ])
    )
      throw new HttpError(401, "Live-Zugang abgelaufen.");
    return revisionStream(request, context, channel, "workspace.changed", async () => {
      const [row] = await db.select().from(tenantSettings).limit(1);
      return row?.liveRevision || 0;
    });
  });
