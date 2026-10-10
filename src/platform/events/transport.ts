import { send } from "@vercel/queue";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, lte, or, sql } from "drizzle-orm";
import { db } from "@/platform/db";
import { outbox, departments } from "@/platform/db/schema";
import { currentRequest, requestScope } from "@/platform/request";
import { tenantTransaction } from "@/platform/db/tenant";
import { processEvents } from "./index";
import type { Context } from "@/platform/context";
export type EventPointer = {
  organizationId: string;
  eventId: string;
  schemaVersion: 1;
  signature: string;
};
const signature = (org: string, event: string) =>
  createHmac("sha256", process.env.CRON_SECRET || "")
    .update(`${org}:${event}:1`)
    .digest("hex");
export function validPointer(pointer: EventPointer) {
  if (
    !process.env.CRON_SECRET ||
    pointer.schemaVersion !== 1 ||
    typeof pointer.organizationId !== "string" ||
    typeof pointer.eventId !== "string" ||
    typeof pointer.signature !== "string"
  )
    return false;
  const a = Buffer.from(signature(pointer.organizationId, pointer.eventId));
  const b = Buffer.from(pointer.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function publishEvents() {
  const context = currentRequest().context!;
  if (!process.env.VERCEL) {
    return processEvents();
  }
  const events = await db
    .select()
    .from(outbox)
    .where(
      and(
        or(
          eq(outbox.status, "pending"),
          eq(outbox.status, "queued"),
          eq(outbox.status, "processing"),
        ),
        lte(outbox.availableAt, new Date()),
      ),
    )
    .limit(20);
  for (const event of events) {
    const pointer: EventPointer = {
      organizationId: context.organizationId,
      eventId: event.id,
      schemaVersion: 1,
      signature: signature(context.organizationId, event.id),
    };
    await send("showtime-domain-events", pointer, {
      region: "fra1",
      idempotencyKey: `${event.id}:${event.attempts}`,
      retentionSeconds: 86400,
    });
    await db
      .update(outbox)
      .set({ status: "queued", availableAt: new Date(Date.now() + 120_000) })
      .where(and(eq(outbox.id, event.id), eq(outbox.status, event.status)));
  }
  return { published: events.length };
}
export async function consumeEvent(pointer: EventPointer, request: Request) {
  if (!validPointer(pointer)) throw new Error("Invalid event pointer");
  const context: Context = {
    organizationId: pointer.organizationId,
    departmentId: "",
    organizationName: "",
    departmentName: "",
    user: { id: "worker", name: "Worker", username: "", role: "user", status: "active" },
    grants: [],
  };
  const { runWorkerScope } = await import("./worker");
  return runWorkerScope(request, context, async () => {
    const [event] = await db.select().from(outbox).where(eq(outbox.id, pointer.eventId)).limit(1);
    if (!event) return;
    context.departmentId = event.departmentId;
    context.user.id = String(event.payload.actorId);
    await db.execute(
      sql`select set_config('app.department_id',${context.departmentId},true),set_config('app.user_id',${context.user.id},true)`,
    );
    await processEvents(pointer.eventId);
  });
}
