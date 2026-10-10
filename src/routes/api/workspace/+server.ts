const NextResponse = Response;
import { requireContext } from "@/platform/context";
import { route } from "@/platform/http";
import { getWorkspace } from "@/modules/records/workspace";
import { createLiveTicket } from "@/platform/realtime/ticket";
import { liveConfigured } from "@/platform/realtime";
async function legacyGET(request: Request) {
  return route(async () => {
    const context = await requireContext();
    const live = liveConfigured()
      ? createLiveTicket(context.departmentId, request.headers.get("cookie") || "")
      : null;
    return NextResponse.json(
      { ...(await getWorkspace(context)), live },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request, params }) => legacyGET(request);
