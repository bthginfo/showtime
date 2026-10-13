import { and, eq, desc, sql } from "drizzle-orm";
import { db, type Transaction } from "@/platform/db";
import { privacyEntries, records } from "@/platform/db/schema";
import { HttpError } from "@/platform/http";
/** New external portraits require a fresh internal-use permission; revocation wins. */
export async function assertPortraitRights(
  actor: typeof records.$inferSelect,
  tx: Transaction | typeof db,
) {
  if (!actor.data.portraitSourceUrl) return;
  const [entry] = await tx
    .select()
    .from(privacyEntries)
    .where(
      and(eq(privacyEntries.kind, "image"), sql`${privacyEntries.data}->>'actorId'=${actor.id}`),
    )
    .orderBy(desc(privacyEntries.updatedAt))
    .limit(1);
  if (
    !entry ||
    entry.status !== "verified" ||
    entry.data.allowedUse === "none" ||
    entry.data.withdrawnAt ||
    (entry.data.expiresAt && Date.parse(String(entry.data.expiresAt)) <= Date.now())
  )
    throw new HttpError(
      403,
      "Für dieses importierte Foto müssen die Bildrechte zuerst geprüft werden. Öffne Datenschutz & Sicherheit → Personen & Bilder.",
    );
}
