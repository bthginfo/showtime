import { sql } from "drizzle-orm";
import { controlDb } from "@/platform/db/connections";
import { requirePlatformAdmin } from "./tenants";
export async function platformHealth() {
  await requirePlatformAdmin();
  const result = await controlDb.execute(sql`select * from showtime_platform_health()`);
  return {
    generatedAt: new Date().toISOString(),
    entries: [...result].map((row) => ({
      organizationId: row.organization_id,
      health: row.health,
    })),
    database: "reachable",
    alerts: [
      "Queue älter als 30 Minuten oder fehlgeschlagene Ereignisse prüfen.",
      "Fehlender Wiederherstellungstest wird ausdrücklich als fehlender Nachweis ausgewiesen.",
    ],
  };
}
