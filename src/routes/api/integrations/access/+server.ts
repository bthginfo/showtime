import type { RequestHandler } from "@sveltejs/kit";
import { requireContext } from "@/platform/context";
import { route, readJson } from "@/platform/http";
import { accessList, accessAction } from "@/modules/theater/integrations";
export const GET: RequestHandler = () =>
  route(async () => Response.json({ entries: await accessList(await requireContext()) }));
export const POST: RequestHandler = ({ request }) =>
  route(async () =>
    Response.json(await accessAction(await requireContext(), await readJson(request))),
  );
