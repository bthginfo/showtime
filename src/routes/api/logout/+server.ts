import { auth } from "@/platform/auth";
import { assertOrigin, route } from "@/platform/http";
async function legacyPOST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    return auth.api.signOut({ headers: request.headers, asResponse: true });
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, params }) => legacyPOST(request);
