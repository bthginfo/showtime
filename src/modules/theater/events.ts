import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  moduleActivations,
  tradeItems,
  outbox,
  records,
  scheduleVersions,
  performances,
  departments,
} from "@/platform/db/schema";
import type { Transaction } from "@/platform/db";
import { moduleById } from "./registry";
export async function handleTheaterEvent(tx: Transaction, event: typeof outbox.$inferSelect) {
  const modules = await tx
    .select()
    .from(moduleActivations)
    .where(
      and(
        eq(moduleActivations.organizationId, event.organizationId),
        eq(moduleActivations.enabled, true),
      ),
    );
  if (event.type === "ProductionCreatedV1") {
    const [production] = await tx
      .select()
      .from(records)
      .where(eq(records.id, String(event.payload.recordId)))
      .limit(1);
    if (!production) return;
    for (const module of modules) {
      if (!module.config.departmentId) continue;
      await tx
        .insert(tradeItems)
        .values({
          id: `workspace:${production.id}:${module.moduleId}`,
          organizationId: event.organizationId,
          departmentId: String(module.config.departmentId),
          productionId: production.id,
          moduleId: module.moduleId,
          type: "workspace",
          title: "Produktionsvorbereitung",
          status: "draft",
          data: { checks: [], dependencyIds: [] },
          createdBy: String(event.payload.actorId),
        })
        .onConflictDoNothing();
    }
  }
  if (event.type === "DepartmentReadinessChangedV1") {
    const [source] = await tx
      .select()
      .from(tradeItems)
      .where(eq(tradeItems.id, String(event.payload.recordId)))
      .limit(1);
    if (!source || source.version !== event.payload.version || !source.productionId) return;
    const id = `workspace:${source.productionId}:${source.moduleId}`;
    await tx
      .insert(tradeItems)
      .values({
        id,
        organizationId: event.organizationId,
        departmentId: source.departmentId,
        productionId: source.productionId,
        moduleId: source.moduleId,
        type: "workspace",
        title: "Produktionsvorbereitung",
        status: source.data.ready === true ? "ready" : "blocked",
        data: { sourceItemId: source.id, sourceVersion: source.version },
        createdBy: source.createdBy,
      })
      .onConflictDoUpdate({
        target: tradeItems.id,
        set: {
          status: source.data.ready === true ? "ready" : "blocked",
          data: { sourceItemId: source.id, sourceVersion: source.version },
          version: source.version,
          updatedAt: source.updatedAt,
        },
      });
  }
  let targets: string[] = [];
  let title = "";
  let productionIds: string[] = [];
  if (event.type === "SchedulePublishedV1") {
    const [version] = await tx
      .select()
      .from(scheduleVersions)
      .where(eq(scheduleVersions.id, String(event.payload.recordId)))
      .limit(1);
    if (!version || version.state !== "published") return;
    const changes = Array.isArray(version.snapshot.changedProductionIds)
      ? (version.snapshot.changedProductionIds as string[])
      : [];
    productionIds = changes;
    targets = modules.map((m) => m.moduleId);
    title = "Veröffentlichten Dienst- und Vorstellungsplan prüfen";
  }
  if (
    [
      "CastAssignmentChangedV1",
      "PerformanceRescheduledV1",
      "ShowReportPublishedV1",
      "TradeItemChangedV1",
    ].includes(event.type)
  ) {
    if (event.type === "CastAssignmentChangedV1") {
      const [source] = await tx
        .select()
        .from(records)
        .where(eq(records.id, String(event.payload.recordId)))
        .limit(1);
      if (!source || source.version !== event.payload.version) return;
      targets = ["makeup", "costume", "sound", "stage-management"];
      title = "Umbesetzung prüfen";
    }
    if (event.type === "PerformanceRescheduledV1") {
      const [source] = await tx
        .select()
        .from(performances)
        .where(eq(performances.id, String(event.payload.recordId)))
        .limit(1);
      if (!source || source.version !== event.payload.version) return;
      targets = modules.map((m) => m.moduleId);
      title = "Vorstellungsänderung prüfen";
    }
    if (event.type === "ShowReportPublishedV1" || event.type === "TradeItemChangedV1") {
      const [source] = await tx
        .select()
        .from(tradeItems)
        .where(eq(tradeItems.id, String(event.payload.recordId)))
        .limit(1);
      if (
        !source ||
        source.version !== event.payload.version ||
        ["measurements", "availability", "purchase", "budget"].includes(source.type)
      )
        return;
      const names = String(source.data.targetDepartments || "")
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!names.length) return;
      const teams = await tx.select().from(departments);
      targets = modules
        .filter(
          (m) =>
            names.includes(m.moduleId) ||
            names.includes(String(m.config.departmentId)) ||
            names.includes(moduleById(m.moduleId)?.department || "") ||
            names.includes(teams.find((d) => d.id === m.config.departmentId)?.name || ""),
        )
        .map((m) => m.moduleId);
      title =
        event.type === "ShowReportPublishedV1"
          ? "Vorstellungsbericht nachbereiten"
          : "Änderungsauftrag prüfen";
    }
    productionIds = event.payload.productionId ? [String(event.payload.productionId)] : [];
  }
  for (const productionId of productionIds) {
    for (const module of modules.filter((m) => targets.includes(m.moduleId))) {
      if (!module.config.departmentId) continue;
      await tx
        .insert(records)
        .values({
          id:
            "impact:" +
            createHash("sha256")
              .update(event.id + productionId + module.moduleId)
              .digest("hex"),
          kind: "tasks",
          organizationId: event.organizationId,
          departmentId: String(module.config.departmentId),
          createdBy: String(event.payload.actorId),
          productionId,
          data: {
            title,
            description: "Aktuelle freigegebene Planung in Showtime prüfen.",
            status: "todo",
            productionId,
            assigneeIds: [],
            due: "",
            sourceEventId: event.id,
          },
        })
        .onConflictDoNothing();
    }
  }
}
