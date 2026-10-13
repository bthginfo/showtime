import { requireContext } from "@/platform/context";
import { route, readJson } from "@/platform/http";
import { privacyWorkspace, savePrivacy } from "@/modules/privacy/service";
import type { RequestHandler } from "@sveltejs/kit";
export const GET: RequestHandler = () =>
  route(async () => Response.json(await privacyWorkspace(await requireContext())));
export const POST: RequestHandler = ({ request }) =>
  route(async () =>
    Response.json(await savePrivacy(await requireContext(), await readJson(request))),
  );
