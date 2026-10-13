const NextResponse = Response;
import { auth } from "@/platform/auth";
import { HttpError, route } from "@/platform/http";
import { readAuthInput, authFormResponse, isAuthForm } from "@/platform/auth/form-request";
import { authFeedback, loginInput } from "@/shared/auth-feedback";
import { throttle } from "@/platform/auth/throttle";
async function legacyPOST(request: Request) {
  return route(async () => {
    const input = loginInput.safeParse(await readAuthInput(request));
    if (!input.success) throw new HttpError(400, input.error.issues[0].message);
    const body = { ...input.data, username: input.data.username.toLowerCase() };
    await throttle(request, "login", 10);
    const response = await auth.api.signInUsername({
      body,
      headers: request.headers,
      asResponse: true,
    });
    if (response.ok) return response;
    const failure = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: authFeedback(failure.code, response.status) },
      { status: response.status },
    );
  });
}

import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = async ({ request }) => {
  const response = await legacyPOST(request);
  if (response.ok && isAuthForm(request)) {
    const body = await response
      .clone()
      .json()
      .catch(() => ({}));
    if (body.twoFactorRedirect) {
      const headers = new Headers({
        Location: "/login/mfa",
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      });
      for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
      return new Response(null, { status: 303, headers });
    }
  }
  return authFormResponse(request, response, "login");
};
