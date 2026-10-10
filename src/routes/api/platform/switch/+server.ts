import { z } from "zod";
import { identity, availableScopes } from "@/platform/context";
import { route, readJson, HttpError } from "@/platform/http";
import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request, cookies }) =>
  route(async () => {
    const person = await identity();
    const input = z
      .object({ organizationId: z.string(), departmentId: z.string() })
      .parse(await readJson(request));
    const scopes = await availableScopes(person.id);
    if (
      !scopes.some(
        (s) =>
          s.organizationId === input.organizationId &&
          s.departmentId === input.departmentId &&
          s.status === "active",
      )
    )
      throw new HttpError(403, "Keine aktive Mitgliedschaft für diesen Bereich.");
    cookies.set("showtime.scope", `${input.organizationId}:${input.departmentId}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return Response.json({ ok: true });
  });
