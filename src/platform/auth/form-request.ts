import { HttpError, assertOrigin, readJson } from "@/platform/http";
import type { AuthFormKind } from "@/shared/auth-form-feedback";

export function isAuthForm(request: Request) {
  return (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ===
    "application/x-www-form-urlencoded"
  );
}

/** Native forms and hydrated clients share validation, throttling and authentication. */
export async function readAuthInput(request: Request) {
  if (!isAuthForm(request)) return readJson(request);
  assertOrigin(request);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Diese Anfrage ist nicht zulässig.");
  const raw = await request.text();
  if (raw.length > 16_384) throw new HttpError(413, "Die Anfrage ist zu groß.");
  const params = new URLSearchParams(raw);
  const body: Record<string, string> = Object.create(null);
  for (const [key, value] of params) {
    if (Object.hasOwn(body, key)) throw new HttpError(400, "Ungültige Anfrage.");
    body[key] = value;
  }
  return body;
}

/** Redirect with fixed feedback codes only; credentials never enter Location headers. */
export function authFormResponse(
  request: Request,
  response: Response,
  kind: AuthFormKind,
  invitation?: string,
) {
  if (!isAuthForm(request) || response.status === 403) return response;
  const destination = new URL(
    kind === "register" && !response.ok ? "/register" : "/login",
    request.url,
  );
  if (response.ok) {
    if (kind === "login") destination.pathname = "/";
    else
      destination.searchParams.set("status", kind === "register" ? "registered" : "password-reset");
  } else {
    destination.searchParams.set(
      "error",
      response.status === 429
        ? "rate-limit"
        : kind === "register"
          ? "registration"
          : kind === "reset-password"
            ? "reset"
            : response.status < 500
              ? "invalid"
              : "unavailable",
    );
    if (kind === "register" && invitation && /^[A-Za-z0-9_-]{32,100}$/.test(invitation))
      destination.searchParams.set("invitation", invitation);
  }
  const headers = new Headers({
    Location: destination.pathname + destination.search,
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  });
  if (response.ok) {
    for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 303, headers });
}
