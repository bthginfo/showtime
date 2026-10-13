import { request, type APIRequestContext } from "@playwright/test";

/** Network failures must not include Playwright's request log with session cookies. */
export async function privateRequestContext(options: Parameters<typeof request.newContext>[0]) {
  const context = await request.newContext(options);
  const networkMethods = new Set(["fetch", "get", "post", "put", "patch", "delete", "head"]);
  return new Proxy(context, {
    get(target, key) {
      const member = Reflect.get(target, key);
      if (typeof member !== "function") return member;
      if (!networkMethods.has(String(key))) return member.bind(target);
      return async (...args: unknown[]) => {
        try {
          return await member.apply(target, args);
        } catch {
          const path =
            typeof args[0] === "string"
              ? new URL(args[0], "http://127.0.0.1:3100").pathname
              : "request";
          throw new Error(
            `QA ${String(key).toUpperCase()} ${path}: network request failed; private headers omitted.`,
          );
        }
      };
    },
  }) as APIRequestContext;
}
