import type { RequestHandler } from "@sveltejs/kit";
import { requireContext } from "@/platform/context";
import { route } from "@/platform/http";
import { leadershipOverview } from "@/modules/theater/overview";
export const GET: RequestHandler = ({ url }) =>
  route(async () =>
    Response.json(
      await leadershipOverview(await requireContext(), {
        from:
          url.searchParams.get("from") ||
          new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        to:
          url.searchParams.get("to") ||
          new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      }),
    ),
  );
