const NextResponse = Response;
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import { createShiftSwap } from "@/modules/shift-swaps/service";

async function legacyPOST(request: Request) {
  return route(async () =>
    NextResponse.json(await createShiftSwap(await requireContext(true), await readJson(request)), {
      status: 201,
    }),
  );
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) => legacyPOST(request);
