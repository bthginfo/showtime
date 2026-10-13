import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, twoFactor } from "better-auth/plugins";
import { authDb } from "@/platform/db/connections";
import * as schema from "@/platform/db/schema";
import { usernamePattern } from "@/shared/auth-feedback";
import { applicationURL } from "@/platform/application-url";
export const auth = betterAuth({
  appName: "Showtime",
  baseURL: applicationURL(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(authDb, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
  plugins: [
    twoFactor({ issuer: "Showtime", totpOptions: { digits: 6, period: 30 } }),
    username({
      minUsernameLength: 3,
      maxUsernameLength: 32,
      usernameValidator: (value) => usernamePattern.test(value),
    }),
  ],
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/username": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  session: {
    additionalFields: { mfaVerifiedAt: { type: "date", required: false, input: false } },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
});
