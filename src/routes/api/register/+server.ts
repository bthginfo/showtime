import { APIError } from "better-auth/api";
import { z } from "zod";
import { authFeedback, registrationInput } from "@/shared/auth-feedback";
import { auth } from "@/platform/auth";
import { identity } from "@/platform/context";
import { acceptInvitation, invitationScope } from "@/modules/theater/invitations";
import { throttle } from "@/platform/auth/throttle";
import { route, readJson, HttpError } from "@/platform/http";
import type { RequestHandler } from "@sveltejs/kit";
export const POST: RequestHandler = ({ request }) =>
  route(async () => {
    await throttle(request, "register", 5);
    const body = z
      .object({ invitation: z.string().min(32).max(100), existingAccount: z.boolean().optional() })
      .passthrough()
      .parse(await readJson(request));
    await invitationScope(body.invitation);
    let userId: string;
    if (body.existingAccount) {
      userId = (await identity()).id;
    } else {
      const input = registrationInput.safeParse(body);
      if (!input.success) throw new HttpError(400, input.error.issues[0].message);
      const result = await auth.api
        .signUpEmail({
          body: {
            ...input.data,
            username: input.data.username.toLowerCase(),
            email: `${crypto.randomUUID()}@users.showtime.invalid`,
          },
          headers: request.headers,
        })
        .catch((error) => {
          if (error instanceof APIError)
            throw new HttpError(
              error.statusCode || 400,
              authFeedback(error.body?.code, error.statusCode || 400, true),
            );
          throw error;
        });
      userId = result.user.id;
    }
    return Response.json(
      { ok: true, scope: await acceptInvitation(body.invitation, userId) },
      { status: 201 },
    );
  });
