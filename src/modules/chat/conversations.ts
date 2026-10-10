import { and, eq, sql } from "drizzle-orm";
import {can,type Context} from "@/platform/context";
import type { Transaction } from "@/platform/db";
import { records } from "@/platform/db/schema";
import { HttpError } from "@/platform/http";
import { listValue, type RecordData } from "@/shared/contracts";

/** Theater/department channels and explicitly invited private conversations. */
export async function prepareConversation(
  context: Context,
  data: RecordData,
  tx: Transaction,
  existing?: typeof records.$inferSelect,
) {
  if (existing && existing.data.mode !== data.mode)
    throw new HttpError(400, "Die Chatart kann nicht geändert werden.");
  if(existing&&existing.data.mode==='team'&&(existing.data.scope||'department')!==data.scope)throw new HttpError(400,'Der Kanalbereich kann nicht geändert werden.');
  if (data.mode === "team") {
    if(!can(context,'chat.channels.manage',undefined,data.scope==='theater'?'':existing?.departmentId||context.departmentId))throw new HttpError(403,'Dir fehlt die Berechtigung zur Kanalverwaltung in diesem Bereich.');
    if (!String(data.title || "").trim())
      throw new HttpError(400, "Bitte gib dem Teamkanal einen Namen.");
    data.title = String(data.title).trim();
    data.participantIds = [];
    data.directKey = "";
    return;
  }
  data.participantIds = Array.from(
    new Set([...listValue(data.participantIds), existing?.createdBy || context.user.id]),
  );
  const participants = listValue(data.participantIds);
  if (participants.length < 2 || participants.length > 100)
    throw new HttpError(
      400,
      "Bitte wähle mindestens eine weitere Person und höchstens 100 Teilnehmer.",
    );
  if (data.mode !== "direct") {
    data.directKey = "";
    return;
  }
  if (participants.length !== 2)
    throw new HttpError(400, "Ein Direktchat hat genau zwei Teilnehmer.");
  data.directKey = [...participants].sort().join(":");
  if (existing && existing.data.directKey !== data.directKey)
    throw new HttpError(400, "Die Teilnehmer eines Direktchats können nicht geändert werden.");
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":direct-chat:" + data.directKey}))`,
  );
  if (!existing) {
    const [duplicate] = await tx
      .select()
      .from(records)
      .where(
        and(
          eq(records.organizationId, context.organizationId),
          eq(records.kind, "conversations"),
          sql`${records.data}->>'directKey'=${String(data.directKey)}`,
        ),
      )
      .limit(1);
    return duplicate;
  }
}
