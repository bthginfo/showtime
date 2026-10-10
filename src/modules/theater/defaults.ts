import { createHash } from "node:crypto";
import { db } from "@/platform/db";
import { records, departments } from "@/platform/db/schema";
import { defaultCalendarCategories } from "@/shared/calendar-categories";
import { defaultDomainCategories } from "@/shared/domain-categories";
import { runWorkerScope } from "@/platform/events/worker";
import type { Context } from "@/platform/context";
export async function seedTenantDefaults(organizationId: string, actorId: string) {
  const context: Context = {
    organizationId,
    departmentId: "",
    organizationName: "",
    departmentName: "",
    user: { id: actorId, name: "Einrichtung", username: "", role: "user", status: "active" },
    grants: [],
  };
  await runWorkerScope(new Request("https://showtime.invalid/setup"), context, async () => {
    const scopes = await db.select().from(departments);
    const entries: (typeof records.$inferInsert)[] = [];
    for (const department of scopes) {
      const defaults = [
        ...defaultCalendarCategories.map((data) => ({
          kind: "calendarCategories" as const,
          data: { ...data },
        })),
        ...defaultDomainCategories.map((data) => ({
          kind: "categories" as const,
          data: { ...data },
        })),
      ];
      for (const { kind, data } of defaults) {
        const id =
          "template:" +
          createHash("sha256")
            .update(
              organizationId +
                department.id +
                kind +
                ("scope" in data ? data.scope : "") +
                data.key,
            )
            .digest("hex");
        entries.push({
          id,
          organizationId,
          departmentId: department.id,
          createdBy: actorId,
          kind,
          data,
        });
      }
      entries.push({
        id:
          "channel:" +
          createHash("sha256")
            .update(organizationId + department.id)
            .digest("hex"),
        organizationId,
        departmentId: department.id,
        createdBy: actorId,
        kind: "conversations",
        data: {
          title: department.name,
          mode: "team",
          scope: "department",
          participantIds: [],
          directKey: "",
          archived: false,
        },
      });
    }
    if (scopes[0])
      entries.push({
        id:
          "channel:" +
          createHash("sha256")
            .update(organizationId + ":house")
            .digest("hex"),
        organizationId,
        departmentId: scopes[0].id,
        createdBy: actorId,
        kind: "conversations",
        data: {
          title: "Hauskanal",
          mode: "team",
          scope: "theater",
          participantIds: [],
          directKey: "",
          archived: false,
        },
      });
    for (let offset = 0; offset < entries.length; offset += 300)
      await db
        .insert(records)
        .values(entries.slice(offset, offset + 300))
        .onConflictDoNothing();
  });
}
