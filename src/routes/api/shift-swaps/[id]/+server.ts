import { z } from "zod";
const NextResponse = Response;
import { requireContext } from "@/platform/context";
import { readJson, route } from "@/platform/http";
import { decideShiftSwap } from "@/modules/shift-swaps/service";

async function legacyPOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () =>
    NextResponse.json(
      await decideShiftSwap(
        await requireContext(true),
        z
          .string()
          .min(1)
          .max(100)
          .parse((await params).id),
        await readJson(request),
      ),
    ),
  );
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) =>
  legacyPOST(request, { params: Promise.resolve(params as never) });
