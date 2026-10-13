import type { Handle } from "@sveltejs/kit";
import { waitUntil } from "@vercel/functions";
import { requestScope } from "./platform/request";
import { requireContext } from "./platform/context";
import { tenantTransaction } from "./platform/db/tenant";
import { HttpError } from "./platform/http";
import { cleanAuthLocation } from "./shared/auth-form-feedback";
import { integrationRate } from "./modules/theater/integrations";
import { requireMfa } from "./platform/auth/mfa";

const publicAPI =
  /^\/api\/(?:v1\/openapi\.json$|login|logout|register|reset-password|auth(?:\/|$)|cron$|calendar\/|realtime$|documents\/live$|events\/consume$|platform\/(?:(?:scopes|switch|support|health)$|tenants(?:\/|$)))/;
class FailedResponse {
  constructor(public response: Response) {}
}

export const handle: Handle = async ({ event, resolve }) => {
  const authentication =
    event.url.pathname === "/login" ||
    event.url.pathname === "/login/mfa" ||
    event.url.pathname === "/register" ||
    /^\/api\/(?:login|register|reset-password|auth)(?:\/|$)/.test(event.url.pathname);
  const decorate = (response: Response) => {
    if (authentication || event.url.pathname.startsWith("/api/"))
      response.headers.set("Cache-Control", "private, no-store");
    if (response.status === 429) response.headers.set("Retry-After", "60");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", authentication ? "no-referrer" : "same-origin");
    return response;
  };
  const cleanLocation = cleanAuthLocation(event.url);
  if (cleanLocation && (event.request.method === "GET" || event.request.method === "HEAD"))
    return decorate(new Response(null, { status: 303, headers: { Location: cleanLocation } }));
  const scope = { request: event.request, after: [] as (() => Promise<unknown> | void)[] };
  return requestScope.run(scope, async () => {
    try {
      const protectedAPI =
        event.url.pathname.startsWith("/api/") && !publicAPI.test(event.url.pathname);
      const context = protectedAPI ? await requireContext() : undefined;
      if (
        context &&
        /^\/api\/platform\/(configuration|roles|members|invitations|modules)(?:\/|$)/.test(
          event.url.pathname,
        )
      )
        await requireMfa();
      // Commit the meter independently: rejected input must not refund an API request.
      if (context && requestScope.getStore()?.integration)
        await tenantTransaction(context, () => integrationRate(context));
      const response = context
        ? await tenantTransaction(context, async () => {
            const result = await resolve(event);
            if (result.status >= 400) throw new FailedResponse(result);
            return result;
          })
        : await resolve(event);
      if (scope.after.length) {
        const tasks = async () => {
          for (const task of scope.after) {
            try {
              if (context) await tenantTransaction(context, async () => task(), true);
              else await task();
            } catch (error) {
              console.error("Deferred work failed", {
                name: error instanceof Error ? error.name : "unknown",
              });
            }
          }
        };
        if (process.env.VERCEL) waitUntil(tasks());
        else await tasks();
      }
      return decorate(response);
    } catch (error) {
      if (error instanceof FailedResponse) return decorate(error.response);
      if (error instanceof HttpError)
        return decorate(
          Response.json({ error: error.message, ...error.extra }, { status: error.status }),
        );
      console.error("Request scope failed", {
        name: error instanceof Error ? error.name : "unknown",
      });
      return decorate(
        Response.json({ error: "Die Anfrage konnte nicht verarbeitet werden." }, { status: 500 }),
      );
    }
  });
};
