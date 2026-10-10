const NextResponse = Response;
import { requireContext } from "@/platform/context";
import { route } from "@/platform/http";
async function legacyGET() {
  return route(async () =>
    NextResponse.json((await requireContext()).user, {
      headers: { "Cache-Control": "private, no-store" },
    }),
  );
}

import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = ({ request, params }) => legacyGET();
