import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
/** JS Date loses PostgreSQL microseconds; cursors must retain the exact sort value. */
export function pageTimestamp(column: AnyPgColumn) {
  return sql<string>`to_char(${column} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}
