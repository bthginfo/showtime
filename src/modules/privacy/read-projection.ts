import { getTableColumns, sql, type SQL } from "drizzle-orm";
import { records } from "@/platform/db/schema";
import { can, type Context } from "@/platform/context";
import type { RecordData } from "@/shared/contracts";

/** PostgreSQL projects legacy clinical reasons before a Vercel function receives a row. */
export function safeRecordData(context?: Context): SQL<RecordData> {
  const teamTime = context?.grants
    ? can(context, "time.team.read") || can(context, "personnel.read")
    : false;
  return sql<RecordData>`showtime_safe_record_data(${records.kind}, ${records.data}, ${records.departmentId}, ${context?.user.id || ""}, ${teamTime && !!context ? context.departmentId : ""})`;
}
export function safeRecordColumns(context?: Context) {
  return { ...getTableColumns(records), data: safeRecordData(context) };
}
export function safeCategoryPredicate() {
  return sql`(${records.kind}<>'calendarCategories' OR NOT showtime_medical_category(coalesce(${records.data}->>'key',''),coalesce(${records.data}->>'name','')))`;
}
