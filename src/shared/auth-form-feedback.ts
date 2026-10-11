export type AuthFormKind = "login" | "register" | "reset-password";

export function authFormFeedback(params: URLSearchParams) {
  const error = params.get("error");
  if (error === "rate-limit") return "Zu viele Versuche. Bitte warte eine Minute.";
  if (error === "invalid")
    return "Benutzername oder Passwort stimmt nicht. Bitte prüfe deine Eingaben.";
  if (error === "registration")
    return "Der Zugang konnte nicht erstellt werden. Prüfe deine Eingaben und die Einladung.";
  if (error === "reset")
    return "Das Passwort konnte nicht zurückgesetzt werden. Prüfe den Code und versuche es erneut.";
  if (error === "unavailable")
    return "Die Anmeldung ist gerade nicht möglich. Bitte versuche es erneut.";
  return "";
}

export function authFormNotice(params: URLSearchParams) {
  if (params.get("status") === "registered")
    return "Dein Zugang ist eingerichtet. Melde dich jetzt mit deinem Benutzernamen an.";
  if (params.get("status") === "password-reset")
    return "Dein Passwort wurde geändert. Melde dich mit dem neuen Passwort an.";
  return "";
}

const credentialFields = new Set([
  "username",
  "password",
  "pw",
  "pass",
  "currentpassword",
  "newpassword",
  "repeat",
  "code",
  "email",
  "name",
]);

/** Discard accidental credential query fields before rendering an authentication page. */
export function cleanAuthLocation(url: URL): string | null {
  if (url.pathname !== "/login" && url.pathname !== "/register") return null;
  const clean = new URL(url);
  let changed = false;
  for (const key of [...clean.searchParams.keys()]) {
    if (credentialFields.has(key.toLowerCase())) {
      clean.searchParams.delete(key);
      changed = true;
    }
  }
  return changed ? clean.pathname + clean.search : null;
}
