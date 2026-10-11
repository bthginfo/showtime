import { eq, sql, and } from "drizzle-orm";
import { db } from "@/platform/db";
import { outbox, records, tenantSettings } from "@/platform/db/schema";
import { can, type Context } from "@/platform/context";
import { activeSubjects } from "@/platform/worker-subjects";
/** Internal, aggregated operating alerts. Never includes private document or event contents. */
export async function operatingAlerts(context: Context, now = new Date()) {
  const [settings] = await db.select().from(tenantSettings).limit(1);
  if (settings?.status !== "active") return 0;
  const [events] = await db
    .select({
      failed: sql<number>`count(*) filter (where ${outbox.status}='failed')::int`,
      stuck: sql<number>`count(*) filter (where ${outbox.status} in ('pending','queued','processing') and ${outbox.createdAt}<${new Date(now.getTime() - 1800000).toISOString()})::int`,
    })
    .from(outbox);
  const [files] = await db
    .select({ bytes: sql<number>`coalesce(sum((${records.data}->>'size')::bigint),0)::float8` })
    .from(records)
    .where(eq(records.kind, "files"));
  const quota = Number(
    (settings.settings.quotas as { filesBytes?: number })?.filesBytes || 250_000_000,
  );
  const alarms = [
    ...(events.failed ? ["failed-events"] : []),
    ...(events.stuck ? ["stuck-events"] : []),
    ...(Number(files.bytes) >= quota * 0.8 ? ["file-quota"] : []),
  ];
  if (!alarms.length) return 0;
  const subjects = await activeSubjects(context.organizationId, context.departmentId);
  let count = 0;
  for (const subject of subjects) {
    if (!can(subject, "tenant.configure") || !can(subject, "audit.read")) continue;
    for (const alarm of alarms) {
      const id = `operating-alert:${alarm}:${now.toISOString().slice(0, 10)}:${subject.user.id}`;
      const added = await db
        .insert(records)
        .values({
          id,
          organizationId: context.organizationId,
          departmentId: subject.departmentId,
          kind: "notifications",
          ownerId: subject.user.id,
          createdBy: subject.user.id,
          data: {
            type: "operating-alert",
            userId: subject.user.id,
            title:
              alarm === "file-quota"
                ? "Dateikontingent fast erreicht"
                : "Ereignisverarbeitung prüfen",
            body: "Die Betriebsübersicht zeigt den aktuellen aggregierten Zustand.",
            link: "/?module=theater&view=administration",
            read: false,
          },
        })
        .onConflictDoNothing()
        .returning({ id: records.id });
      count += added.length;
    }
  }
  return count;
}
