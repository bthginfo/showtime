import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import QRCode from "qrcode";
import { auth } from "@/platform/auth";
import { authDb } from "@/platform/db/connections";
import { session } from "@/platform/db/schema";
import { HttpError, route } from "@/platform/http";
import { throttle } from "@/platform/auth/throttle";
import { readAuthInput, isAuthForm } from "@/platform/auth/form-request";
import type { RequestHandler } from "@sveltejs/kit";
async function mfaResponse(request: Request) {
  return route(async () => {
    const body = z
      .object({
        action: z.enum(["enable", "verify", "backup"]),
        password: z.string().max(128).optional(),
        code: z.string().max(100).optional(),
      })
      .strict()
      .parse(await readAuthInput(request));
    await throttle(request, "mfa", 8);
    const previous = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
    if (body.action === "enable" && previous?.user.twoFactorEnabled)
      throw new HttpError(
        409,
        "Ein Authenticator ist bereits eingerichtet. Bestätige den vorhandenen Faktor oder verwende einen Wiederherstellungscode.",
      );
    const result =
      body.action === "enable"
        ? await auth.api.enableTwoFactor({
            body: { password: body.password || "", method: "totp" },
            headers: request.headers,
            asResponse: true,
          })
        : body.action === "backup"
          ? await auth.api.verifyBackupCode({
              body: { code: body.code || "", trustDevice: false },
              headers: request.headers,
              asResponse: true,
            })
          : await auth.api.verifyTOTP({
              body: { code: body.code || "", trustDevice: false },
              headers: request.headers,
              asResponse: true,
            });
    if (!result.ok)
      return Response.json(
        {
          error:
            "Der zweite Faktor konnte nicht bestätigt werden. Prüfe den Code oder dein Passwort.",
        },
        { status: result.status },
      );
    const data = await result.json();
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    });
    const cookieParts = new Map(
      (request.headers.get("cookie") || "")
        .split(";")
        .filter(Boolean)
        .map((s) => {
          const i = s.indexOf("=");
          return [s.slice(0, i).trim(), s.slice(i + 1)];
        }),
    );
    for (const cookie of result.headers.getSetCookie()) {
      headers.append("Set-Cookie", cookie);
      const first = cookie.split(";")[0];
      const i = first.indexOf("=");
      cookieParts.set(first.slice(0, i), first.slice(i + 1));
    }
    if (body.action !== "enable") {
      const sessionHeaders = new Headers(request.headers);
      sessionHeaders.set("cookie", [...cookieParts].map(([k, v]) => k + "=" + v).join("; "));
      const verified = await auth.api.getSession({
        headers: sessionHeaders,
        query: { disableCookieCache: true },
      });
      if (!verified?.user.twoFactorEnabled)
        return Response.json(
          { error: "Die Sitzung konnte nicht bestätigt werden. Melde dich erneut an." },
          { status: 401 },
        );
      await authDb
        .update(session)
        .set({ mfaVerifiedAt: new Date() })
        .where(eq(session.id, verified.session.id));
      // Enrollment/challenge never upgrades old password-only sessions on other devices.
      if (previous && !previous.user.twoFactorEnabled)
        await authDb
          .delete(session)
          .where(and(eq(session.userId, verified.user.id), ne(session.id, verified.session.id)));
      return Response.json({ verified: true }, { headers });
    }
    return Response.json(
      {
        totpURI: data.totpURI,
        qr: await QRCode.toDataURL(data.totpURI, { width: 220, margin: 2 }),
        backupCodes: data.backupCodes,
      },
      { headers },
    );
  });
}
export const POST: RequestHandler = async ({ request }) => {
  const response = await mfaResponse(request);
  if (!isAuthForm(request)) return response;
  const headers = new Headers({
    Location: response.ok
      ? "/"
      : "/login/mfa?error=invalid" +
        (new URL(request.url).searchParams.get("method") === "backup" ? "&method=backup" : ""),
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  });
  for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
};
