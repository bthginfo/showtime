const NextResponse = Response;
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import { checkAvailability } from "@/modules/reservations/service";

async function legacyPOST(request: Request) {
  return route(async () =>
    NextResponse.json(await checkAvailability(await requireContext(true), await readJson(request))),
  );
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) => legacyPOST(request);
