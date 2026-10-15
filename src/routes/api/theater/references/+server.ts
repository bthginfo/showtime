import type { RequestHandler } from "@sveltejs/kit";
import { requireContext } from "@/platform/context";
import { route } from "@/platform/http";
import { tradeReferences } from "@/modules/theater/references";

export const GET: RequestHandler = ({ url }) =>
  route(async () =>
    Response.json(
      await tradeReferences(await requireContext(), {
        ...Object.fromEntries(url.searchParams),
        ids: url.searchParams.getAll("id"),
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    ),
  );
