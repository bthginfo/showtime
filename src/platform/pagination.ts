import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import type { Context } from "./context";
import { HttpError } from "./http";
const tuple = z.tuple([z.iso.datetime(), z.string().min(1).max(100)]);
export type PagePosition = z.infer<typeof tuple>;
function key() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Cursor encryption needs auth secret");
  return createHash("sha256")
    .update("showtime-cursor-v1:" + secret)
    .digest();
}
function scope(ctx: Context, purpose: string) {
  return Buffer.from(`${ctx.organizationId}:${ctx.user.id}:${ctx.departmentId}:${purpose}`);
}
export function encodePosition(position: PagePosition, ctx: Context, purpose: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(scope(ctx, purpose));
  const body = Buffer.concat([cipher.update(JSON.stringify(position), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function decodePosition(
  cursor: string | null | undefined,
  ctx: Context,
  purpose: string,
): PagePosition | null {
  if (!cursor) return null;
  try {
    const bytes = Buffer.from(z.string().min(40).max(700).parse(cursor), "base64url"),
      decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAAD(scope(ctx, purpose));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const value = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    return tuple.parse(JSON.parse(value.toString("utf8")));
  } catch {
    throw new HttpError(400, "Ungültige oder nicht zu diesem Bereich gehörende Seitenmarkierung.");
  }
}
