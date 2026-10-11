import type { RequestHandler } from "@sveltejs/kit";
import { requireContext } from "@/platform/context";
import { route, readJson } from "@/platform/http";
import { importExchange, exportExchange } from "@/modules/theater/exchange";
export const GET: RequestHandler = ({ url }) =>
  route(async () => exportExchange(await requireContext(), url.searchParams));
export const POST: RequestHandler = ({ request }) =>
  route(async () =>
    Response.json(await importExchange(await requireContext(), await readJson(request))),
  );
