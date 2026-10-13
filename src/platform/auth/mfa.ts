import { auth } from "./index";
import { currentRequest } from "@/platform/request";
import { HttpError } from "@/platform/http";
export async function requireMfa() {
  const state = await auth.api.getSession({
    headers: currentRequest().request.headers,
    query: { disableCookieCache: true },
  });
  if (!state?.user.twoFactorEnabled)
    throw new HttpError(
      403,
      "Für diese Verwaltung ist ein zweiter Faktor erforderlich. Richte ihn unter Datenschutz & Sicherheit ein.",
      { code: "MFA_SETUP_REQUIRED", next: "/?module=privacy&tab=security" },
    );
  const verified = state.session.mfaVerifiedAt;
  if (!verified || Date.now() - new Date(verified).getTime() > 12 * 3600000)
    throw new HttpError(
      403,
      "Bitte bestätige deinen zweiten Faktor erneut unter Datenschutz & Sicherheit.",
      { code: "MFA_VERIFICATION_REQUIRED", next: "/?module=privacy&tab=security" },
    );
  return state;
}
