import { eq, sql, asc } from "drizzle-orm";
import { db } from "@/platform/db";
import {
  tradeItems,
  records,
  tenantSettings,
  mediaUploads,
  integrationReceipts,
} from "@/platform/db/schema";
import { activeSubjects } from "@/platform/worker-subjects";
import { can, type Context } from "@/platform/context";
import { tradeReadable } from "./service";
import { assertProject } from "@/modules/records/repository";
import { HttpError } from "@/platform/http";
import { del } from "@vercel/blob";
export async function theaterReminders(context: Context, now = new Date()) {
  const [settings] = await db.select().from(tenantSettings).limit(1);
  if (settings?.status !== "active") return { notices: 0 };
  context = { ...context, timezone: settings.timezone };
  const { applyDueCastChanges } = await import("./cast-scheduler");
  const castChanges = await applyDueCastChanges(context);
  const rules = (settings.settings.reminderRules || { beforeDays: 2, escalateAfterDays: 2 }) as {
    beforeDays: number;
    escalateAfterDays: number;
  };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: settings.timezone }).format(now),
    threshold = new Date(Date.parse(today + "T00:00Z") + rules.beforeDays * 86400000)
      .toISOString()
      .slice(0, 10);
  const cursor = String(settings.settings.reminderScanAfter || "");
  const items = await db
    .select()
    .from(tradeItems)
    .where(
      sql`${tradeItems.id}>${cursor} and ${tradeItems.status} not in ('done','archived','cancelled','rejected','approved','acknowledged') and (${tradeItems.dueAt}<=${threshold}::date + interval '1 day' or nullif(${tradeItems.data}->>'dueDate','')<=${threshold} or nullif(${tradeItems.data}->>'deadline','')<=${threshold} or nullif(${tradeItems.data}->>'rightsUntil','')<=${threshold} or nullif(${tradeItems.data}->>'nextInspection','')<=${threshold} or nullif(${tradeItems.data}->>'nextService','')<=${threshold} or nullif(${tradeItems.data}->>'consentUntil','')<=${threshold})`,
    )
    .orderBy(asc(tradeItems.id))
    .limit(501);
  // Stable date/version identities make repeated cron delivery idempotent.
  const subjects = await activeSubjects(context.organizationId, context.departmentId);
  let notices = 0;
  for (const item of items.slice(0, 500)) {
    const due = [
      item.data.dueDate,
      item.data.deadline,
      item.data.rightsUntil,
      item.data.nextInspection,
      item.data.nextService,
      item.data.consentUntil,
      item.dueAt &&
        new Intl.DateTimeFormat("sv-SE", { timeZone: settings.timezone }).format(item.dueAt),
    ]
      .map((x) => String(x || ""))
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
      .sort()[0];
    if (!due || due > threshold) continue;
    const escalated = Date.parse(today) - Date.parse(due) > rules.escalateAfterDays * 86400000;
    for (const base of subjects) {
      const subject = {
        ...base,
        departmentId: base.activeDepartmentIds?.includes(item.departmentId)
          ? item.departmentId
          : base.departmentId,
      };
      if (!tradeReadable(subject, item)) continue;
      const target =
        subject.user.id === item.ownerId ||
        subject.user.id === item.createdBy ||
        subject.user.id === item.data._deputyId ||
        (item.type === "collaboration" &&
          subject.activeDepartmentIds?.includes(String(item.data.recipientDepartmentId))) ||
        (escalated && can(subject, "task.manage", item.productionId || "", item.departmentId));
      if (!target) continue;
      try {
        await assertProject(subject, item.productionId);
      } catch (error) {
        if (error instanceof HttpError && [403, 404].includes(error.status)) continue;
        throw error;
      }
      const id = `reminder:${item.id}:${item.version}:${today}:${subject.user.id}`;
      const added = await db
        .insert(records)
        .values({
          id,
          kind: "notifications",
          organizationId: context.organizationId,
          departmentId: subject.departmentId,
          createdBy: item.createdBy,
          ownerId: subject.user.id,
          productionId: item.productionId,
          data: {
            userId: subject.user.id,
            type: escalated ? "deadline-escalation" : "deadline-reminder",
            recordId: item.id,
            title: escalated
              ? "Überfälliger Vorgang braucht Klärung"
              : "Frist im Theaterbetrieb prüfen",
            body: "Öffne den aktuellen Arbeitsstand für Termin und Zuständigkeit.",
            read: false,
            productionId: item.productionId,
            link: `/?module=theater&${item.type === "collaboration" ? "view=collaborations&requestId=" : "itemId="}${encodeURIComponent(item.id)}`,
          },
        })
        .onConflictDoNothing()
        .returning({ id: records.id });
      notices += added.length;
    }
  }
  await db
    .update(tenantSettings)
    .set({
      settings: sql`${tenantSettings.settings} || ${JSON.stringify({ reminderScanAfter: items.length > 500 ? items[499].id : "" })}::jsonb`,
    })
    .where(eq(tenantSettings.organizationId, context.organizationId));
  const expired = await db
    .select()
    .from(mediaUploads)
    .where(sql`${mediaUploads.expiresAt}<${now.toISOString()}`)
    .limit(100);
  for (const upload of expired) {
    if (upload.parts.length) await del(upload.parts.map((p) => p.path));
    await db.delete(mediaUploads).where(eq(mediaUploads.id, upload.id));
  }
  await db
    .delete(integrationReceipts)
    .where(
      sql`${integrationReceipts.operationKey} like 'rate:%' and ${integrationReceipts.createdAt}<${new Date(now.getTime() - 86400000).toISOString()}`,
    );
  const { operatingAlerts } = await import("./operating-alerts");
  const alerts = await operatingAlerts(context, now);
  return {
    notices,
    alerts,
    castChanges,
    limited: items.length > 500,
    expiredUploads: expired.length,
  };
}
