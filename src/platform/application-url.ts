export function applicationURL() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL)
    return "https://" + process.env.VERCEL_URL;
  return process.env.APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3100";
}
