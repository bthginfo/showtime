import { getTableColumns, sql } from "drizzle-orm";
import { scheduleVersions } from "@/platform/db/schema";
export function safeScheduleColumns() {
  return { ...getTableColumns(scheduleVersions), snapshot: sql<Record<string, unknown>>`showtime_safe_snapshot(${scheduleVersions.snapshot})` };
}
