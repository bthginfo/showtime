import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/platform/db";
import {
  privacyPolicies,
  privacyEntries,
  privacyErasureLedger,
  tenantSettings,
  tenantMembers,
  tenantProfiles,
  records,
  user,
  recordOperations,
} from "@/platform/db/schema";
import { can, requirePermission, type Context } from "@/platform/context";
import { auditChange, emit, scheduleEvents } from "@/platform/events";
import { HttpError } from "@/platform/http";
import { requireMfa } from "@/platform/auth/mfa";
import { safeRecordColumns } from "./read-projection";
import {
  policySchema,
  entrySchemas,
  rightsDeadline,
  publicationGaps,
  nonClinicalPayload,
  type PrivacyEntryKind,
  type PrivacyWorkspace,
} from "./model";

const serializeEntry = (row: typeof privacyEntries.$inferSelect) => ({
  ...row,
  kind: row.kind as PrivacyEntryKind,
  dueAt: row.dueAt?.toISOString() || null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
export async function privacyWorkspace(context: Context): Promise<PrivacyWorkspace> {
  const manage = can(context, "privacy.read", undefined, "");
  let mfaVerified = false;
  try {
    await requireMfa();
    mfaVerified = true;
  } catch (error) {
    if (!(error instanceof HttpError && error.status === 403)) throw error;
  }
  const [policies, entries, settings, account] = await Promise.all([
    db.select().from(privacyPolicies).limit(1),
    db
      .select()
      .from(privacyEntries)
      .where(
        manage && mfaVerified
          ? undefined
          : and(eq(privacyEntries.kind, "request"), eq(privacyEntries.ownerId, context.user.id)),
      )
      .orderBy(desc(privacyEntries.createdAt))
      .limit(500),
    db.select({ slug: tenantSettings.slug }).from(tenantSettings).limit(1),
    db
      .select({ enabled: user.twoFactorEnabled })
      .from(user)
      .where(eq(user.id, context.user.id))
      .limit(1),
  ]);
  const data = manage && mfaVerified ? policies[0]?.data : policies[0]?.publishedData;
  let policy = data ? policySchema.parse(data) : null;
  if (policy && !(manage && mfaVerified)) policy = { ...policy, worksCouncilReview: "" };
  // Staff see published information and their requests, never internal drafts/vendor assessments.
  return {
    policy,
    policyVersion: policies[0]?.version || 0,
    entries: entries.map(serializeEntry),
    manage: can(context, "privacy.manage", undefined, ""),
    noticeUrl: "/privacy/" + encodeURIComponent(settings[0]?.slug || ""),
    noticePublished: !!policies[0]?.publishedData,
    healthEnabled: false,
    mfaEnabled: account[0]?.enabled === true,
    mfaVerified,
  };
}
export async function savePrivacy(context: Context, input: unknown) {
  const body = z
    .object({
      action: z.enum([
        "policy",
        "entry",
        "subject-export",
        "erasure-preview",
        "retention-preview",
        "provider-drafts",
        "erase",
      ]),
      id: z.string().max(150).optional(),
      version: z.number().int().min(0).default(0),
      kind: z
        .enum(["request", "provider", "retention", "hold", "incident", "document", "image"])
        .optional(),
      status: z
        .enum(["open", "review", "answered", "closed", "verified", "withdrawn"])
        .default("open"),
      data: z.record(z.string(), z.unknown()).default({}),
    })
    .strict()
    .parse(input);
  const manager = can(context, "privacy.manage", undefined, "");
  const ownRequest =
    body.action === "entry" &&
    body.kind === "request" &&
    !body.id &&
    (!body.data.subjectId || body.data.subjectId === context.user.id) &&
    (!body.data.subjectType || body.data.subjectType === "account");
  if (!ownRequest) {
    if (!manager)
      throw new HttpError(403, "Diese Verwaltung benötigt die theaterweite Datenschutzrolle.");
    requirePermission(context, "privacy.manage");
    await requireMfa();
  }
  if (body.action === "subject-export") return subjectExport(context, body.id || "");
  if (body.action === "erasure-preview") return erasurePreview(context, body.id || "");
  if (body.action === "retention-preview") return retentionPreview(context, body.id || "");
  if (body.action === "provider-drafts") return providerDrafts(context);
  if (body.action === "erase") return executeErasure(context, body.id || "", body.data);
  return db.transaction(async (tx) => {
    if (body.action === "policy") {
      const data = policySchema.parse(body.data);
      if (data.publishedAt && publicationGaps(data).length)
        throw new HttpError(
          400,
          "Vor der Veröffentlichung fehlen: " + publicationGaps(data).join("; "),
        );
      const [current] = await tx.select().from(privacyPolicies).limit(1).for("update");
      if ((current?.version || 0) !== body.version)
        throw new HttpError(409, "Die Datenschutzangaben wurden geändert. Lade sie neu.");
      const saved = current
        ? await tx
            .update(privacyPolicies)
            .set({
              data,
              ...(data.publishedAt ? { publishedData: data } : {}),
              version: current.version + 1,
              updatedBy: context.user.id,
              updatedAt: new Date(),
            })
            .where(eq(privacyPolicies.organizationId, context.organizationId))
            .returning()
        : await tx
            .insert(privacyPolicies)
            .values({
              organizationId: context.organizationId,
              data,
              publishedData: data.publishedAt ? data : null,
              updatedBy: context.user.id,
            })
            .returning();
      await auditChange(
        tx,
        context,
        data.publishedAt ? "privacy.notice-published" : "privacy.policy-updated",
      );
      return saved[0];
    }
    const kind = body.kind!;
    if (!kind) throw new HttpError(400, "Bitte wähle den Vorgang.");
    const data = entrySchemas[kind].parse(body.data) as Record<string, unknown>;
    if (["request", "image"].includes(kind) && !nonClinicalPayload(data))
      throw new HttpError(
        400,
        "Bitte keine Gesundheitsgründe oder medizinischen Dokumente speichern. Beschreibe nur den organisatorischen Vorgang.",
      );
    if (!data.title) throw new HttpError(400, "Bitte gib einen Titel an.");
    const [current] = body.id
      ? await tx
          .select()
          .from(privacyEntries)
          .where(eq(privacyEntries.id, body.id))
          .limit(1)
          .for("update")
      : [];
    if (body.id && (!current || current.kind !== kind))
      throw new HttpError(404, "Vorgang nicht gefunden.");
    if (current && current.version !== body.version)
      throw new HttpError(409, "Dieser Vorgang wurde geändert. Lade ihn neu.");
    let ownerId: string | null = current?.ownerId || context.user.id;
    let dueAt: Date | null = null;
    if (kind === "request") {
      data.receivedAt = current?.data.receivedAt || data.receivedAt || new Date().toISOString();
      if (!manager || ownRequest) {
        data.subjectType = "account";
        data.subjectId = context.user.id;
        data.receivedAt = new Date().toISOString();
        data.identityVerifiedAt = new Date().toISOString();
        data.extensionReason = "";
        data.extensionNotifiedAt = "";
        data.decision = "";
        data.response = "";
        data.respondedAt = "";
      }
      if (data.subjectType === "account") {
        const [member] = await tx
          .select({ id: tenantMembers.userId })
          .from(tenantMembers)
          .where(eq(tenantMembers.userId, String(data.subjectId)))
          .limit(1);
        if (!member)
          throw new HttpError(400, "Die betroffene Person gehört nicht zu diesem Theater.");
        ownerId = member.id;
      } else {
        const [subject] = await tx
          .select({ id: records.id })
          .from(records)
          .where(
            and(
              eq(records.id, String(data.subjectId)),
              eq(records.kind, data.subjectType === "actor" ? "actors" : "people"),
            ),
          )
          .limit(1);
        if (!subject) throw new HttpError(400, "Bitte wähle eine Person dieses Theaters.");
        ownerId = null;
      }
      const extension = !!data.extensionReason;
      if (
        extension &&
        (!data.extensionNotifiedAt ||
          Date.parse(String(data.extensionNotifiedAt)) >
            rightsDeadline(String(data.receivedAt), false, context.timezone).getTime())
      )
        throw new HttpError(
          400,
          "Eine Verlängerung benötigt eine begründete Mitteilung innerhalb der ursprünglichen Monatsfrist.",
        );
      dueAt = rightsDeadline(String(data.receivedAt), extension, context.timezone);
      if (
        !ownRequest &&
        ["answered", "closed"].includes(body.status) &&
        (!data.identityVerifiedAt || !data.decision || !data.response || !data.respondedAt)
      )
        throw new HttpError(
          400,
          "Identitätsprüfung, Entscheidung und dokumentierte Antwort fehlen.",
        );
    }
    if (kind === "incident") {
      if (!data.awareAt) throw new HttpError(400, "Wann wurde der Vorfall bekannt?");
      data.awareAt = current?.data.awareAt || data.awareAt;
      dueAt = new Date(Date.parse(String(data.awareAt)) + 72 * 3600000);
      if (
        body.status === "closed" &&
        (!data.controllerInformedAt ||
          !data.decisionReason ||
          data.authorityDecision === "pending" ||
          data.subjectsDecision === "pending" ||
          (data.authorityDecision === "required" && !data.authorityNotifiedAt) ||
          (data.subjectsDecision === "required" && !data.subjectsNotifiedAt))
      )
        throw new HttpError(
          400,
          "Für den Abschluss fehlen die Information des Theaters oder dokumentierte Meldeentscheidungen.",
        );
    }
    if (
      kind === "retention" &&
      (data.approvedAt || body.status === "verified") &&
      (!data.approvedAt || !data.days || !data.legalBasis)
    )
      throw new HttpError(
        400,
        "Eine bestätigte Aufbewahrung benötigt Datum, Frist und Rechtsgrundlage.",
      );
    if (kind === "document" && body.status === "verified" && (!data.reference || !data.reviewedAt))
      throw new HttpError(
        400,
        "Ein geprüfter Nachweis benötigt eine Fundstelle und ein Prüfdatum.",
      );
    if (
      kind === "provider" &&
      body.status === "verified" &&
      (!data.contractReference ||
        !data.storageRegion ||
        !data.logRegion ||
        !data.supportRegion ||
        !data.backupRegion ||
        !data.reviewedAt)
    )
      throw new HttpError(400, "Vertrag, Prüfung und alle Verarbeitungsregionen fehlen.");
    if (
      kind === "image" &&
      data.allowedUse !== "none" &&
      (!data.legalBasis || !data.license || !data.evidence || !data.noticeDeliveredAt)
    )
      throw new HttpError(
        400,
        "Eine Bildfreigabe benötigt Rechtsgrundlage, Informationsnachweis, Lizenz und Beleg.",
      );
    if (kind === "image") {
      const [actor] = await tx
        .select({ id: records.id })
        .from(records)
        .where(and(eq(records.id, String(data.actorId)), eq(records.kind, "actors")))
        .limit(1);
      if (!actor)
        throw new HttpError(400, "Bitte wähle einen vorhandenen Schauspieler dieses Theaters.");
    }
    const status = !manager || ownRequest ? "open" : body.status;
    const [saved] = current
      ? await tx
          .update(privacyEntries)
          .set({
            data,
            status,
            dueAt,
            ownerId,
            version: current.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(privacyEntries.id, current.id))
          .returning()
      : await tx
          .insert(privacyEntries)
          .values({ kind, data, status, dueAt, ownerId, organizationId: context.organizationId })
          .returning();
    await auditChange(
      tx,
      context,
      "privacy." + kind + "." + (current ? "updated" : "created"),
      saved.id,
    );
    await emit(tx, context, "PrivacyEntryChangedV1", {
      recordId: saved.id,
      version: saved.version,
      kind,
    });
    scheduleEvents();
    return serializeEntry(saved);
  });
}
async function verifiedRequest(context: Context, id: string) {
  const [request] = await db
    .select()
    .from(privacyEntries)
    .where(and(eq(privacyEntries.id, id), eq(privacyEntries.kind, "request")))
    .limit(1);
  if (!request || !request.data.identityVerifiedAt)
    throw new HttpError(409, "Die Anfrage muss zuerst identifiziert werden.");
  return request;
}
async function erasurePreview(context: Context, id: string) {
  const request = await verifiedRequest(context, id);
  if (request.data.requestType !== "erasure")
    throw new HttpError(400, "Diese Anfrage betrifft keine Löschung.");
  const target = String(request.data.subjectId);
  const candidates = await db
    .select({
      id: records.id,
      kind: records.kind,
      departmentId: records.departmentId,
      version: records.version,
      title: sql<string>`CASE WHEN showtime_medical_category('',coalesce(${records.data}->>'title','')) THEN 'Persönlicher Eintrag' ELSE coalesce(nullif(${records.data}->>'title',''),${records.data}->>'name','Persönlicher Eintrag') END`,
      date: sql<string>`coalesce(${records.data}->>'date',${records.data}->>'start','')`,
    })
    .from(records)
    .where(
      request.data.subjectType === "account"
        ? and(
            inArray(records.kind, ["time", "attendance", "leave"]),
            sql`${records.data}->>'userId'=${target}`,
          )
        : eq(records.id, target),
    )
    .limit(101);
  const holds = await db
    .select()
    .from(privacyEntries)
    .where(
      and(eq(privacyEntries.kind, "hold"), inArray(privacyEntries.status, ["open", "verified"])),
    );
  return {
    requestId: id,
    candidates: candidates.slice(0, 100).map((r) => ({
      ...r,
      held: holds.some(
        (h) =>
          (!h.data.until || Date.parse(String(h.data.until)) > Date.now()) &&
          (h.data.recordIds as string[]).includes(r.id),
      ),
    })),
    more: candidates.length > 100,
    reviewRequired: [
      "Gemeinsam genutzte Inhalte und gesetzliche Aufbewahrung prüfen",
      "Entscheidung dokumentieren",
      "Personenbezogene Profile, Kommunikation, Dokumente und Zuordnungen separat beurteilen",
      "Backups und lokale Kopien nach dem Löschplan behandeln",
    ],
    accountDeleted: false,
  };
}
async function retentionPreview(context: Context, id: string) {
  const [rule] = await db
    .select()
    .from(privacyEntries)
    .where(and(eq(privacyEntries.id, id), eq(privacyEntries.kind, "retention")))
    .limit(1);
  if (!rule || rule.status !== "verified" || !rule.data.approvedAt || !rule.data.days)
    throw new HttpError(409, "Bestätige zuerst Rechtsgrundlage und Aufbewahrungsfrist.");
  if (rule.data.trigger !== "last-updated")
    return {
      candidates: [],
      reviewRequired:
        "Diese Regel benötigt eine bestätigte Vertrags- oder Löschentscheidung als Beginn der Frist.",
    };
  const groups: Record<string, string[]> = {
    employees: [],
    actors: ["actors"],
    contacts: ["people"],
    calendar: ["events", "leave"],
    documents: ["files", "looks", "templates"],
    chat: ["messages", "conversations"],
    time: ["time", "attendance"],
    audit: [],
    backups: [],
  };
  const kinds = groups[String(rule.data.group)] || [];
  const cutoff = new Date(Date.now() - Number(rule.data.days) * 86400000);
  const rows = kinds.length
    ? await db
        .select({
          id: records.id,
          kind: records.kind,
          version: records.version,
          updatedAt: records.updatedAt,
        })
        .from(records)
        .where(
          and(
            inArray(records.kind, kinds as any),
            sql`${records.updatedAt}<${cutoff.toISOString()}`,
          ),
        )
        .limit(101)
    : [];
  await db.transaction((tx) => auditChange(tx, context, "privacy.retention-preview", id));
  return {
    candidates: rows.slice(0, 100),
    more: rows.length > 100,
    cutoff,
    reviewRequired:
      "Vorschau, keine automatische Löschung. Abhängigkeiten, Aufbewahrungssperren, Versionen, Dateien und Backups müssen vor der Freigabe geprüft werden.",
  };
}
async function providerDrafts(context: Context) {
  const presets = [
    {
      title: "Vercel",
      service: "Hosting, Functions, private Blob-Dateien, Queue-Pointer und Betriebsprotokolle",
      contractReference: "https://vercel.com/legal/dpa",
    },
    {
      title: "Neon",
      service: "PostgreSQL: Theaterdaten, Berechtigungen, Dokumentzustände und Echtzeitpuffer",
      contractReference: "https://neon.com/dpa",
    },
    {
      title: "Web-Push-Dienste",
      service:
        "Geräteendpunkte und allgemeine Mitteilungshinweise; die Anbieter hängen vom verwendeten Browser ab",
      contractReference: "Anbieter und Bedingungen der Theatergeräte prüfen",
    },
  ];
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.organizationId + ":privacy-providers"}))`,
    );
    const existing = await tx
      .select()
      .from(privacyEntries)
      .where(eq(privacyEntries.kind, "provider"));
    let added = 0;
    for (const preset of presets) {
      if (existing.some((e) => e.data.title === preset.title)) continue;
      await tx.insert(privacyEntries).values({
        organizationId: context.organizationId,
        kind: "provider",
        ownerId: context.user.id,
        status: "review",
        data: entrySchemas.provider.parse(preset),
      });
      added++;
    }
    await auditChange(tx, context, "privacy.provider-drafts");
    return { added, drafts: true };
  });
}
async function subjectExport(context: Context, id: string) {
  const request = await verifiedRequest(context, id);
  const subjectId = String(request.data.subjectId);
  const rows = await db
    .select(safeRecordColumns(context))
    .from(records)
    .where(
      request.data.subjectType === "account"
        ? and(
            inArray(records.kind, ["time", "attendance", "leave", "events"]),
            sql`(${records.data}->>'userId'=${subjectId} OR (${records.kind}='events' AND ${records.data}->'participantIds' ? ${subjectId}))`,
          )
        : eq(records.id, subjectId),
    );
  const profiles =
    request.data.subjectType === "account"
      ? await db
          .select({ workingTime: tenantProfiles.workingTime })
          .from(tenantProfiles)
          .where(eq(tenantProfiles.userId, subjectId))
      : [];
  await auditChange(db as any, context, "privacy.subject-export-reviewed", id);
  return {
    theater: context.organizationName,
    generatedAt: new Date().toISOString(),
    subjectId,
    profile: profiles[0] || null,
    records: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      data:
        r.kind === "events"
          ? { ...r.data, participantIds: [subjectId], actorIds: [], imageIds: [] }
          : r.data,
    })),
    reviewRequired:
      "Vor Weitergabe auf Rechte anderer Personen prüfen. Private Kommunikation, Dateien und fremde Angaben sind nicht Teil dieses Auszugs.",
  };
}
async function executeErasure(context: Context, id: string, data: Record<string, unknown>) {
  const request = await verifiedRequest(context, id);
  if (
    request.data.requestType !== "erasure" ||
    !request.data.decision ||
    data.confirmation !== "GEPRÜFTE DATEN LÖSCHEN"
  )
    throw new HttpError(
      400,
      "Eine geprüfte Löschentscheidung und die ausdrückliche Bestätigung fehlen.",
    );
  const ids = z.array(z.string().min(1)).min(1).max(100).parse(data.recordIds);
  const holds = await db
    .select()
    .from(privacyEntries)
    .where(
      and(eq(privacyEntries.kind, "hold"), inArray(privacyEntries.status, ["open", "verified"])),
    );
  if (
    holds.some(
      (hold) =>
        (!hold.data.until || Date.parse(String(hold.data.until)) > Date.now()) &&
        (hold.data.recordIds as string[]).some((id) => ids.includes(id)),
    )
  )
    throw new HttpError(409, "Eine aktive Aufbewahrungssperre verhindert diese Löschung.");
  const { deleteRecord } = await import("@/modules/records/service");
  return db.transaction(async (tx) => {
    const rows = await tx
      .select(safeRecordColumns(context))
      .from(records)
      .where(inArray(records.id, ids))
      .for("update");
    if (
      rows.length !== ids.length ||
      rows.some((r) =>
        request.data.subjectType === "account"
          ? r.data.userId !== request.data.subjectId ||
            !["time", "attendance", "leave"].includes(r.kind)
          : r.id !== request.data.subjectId,
      )
    )
      throw new HttpError(
        403,
        "Die Auswahl enthält keine ausschließlich zu dieser Anfrage gehörenden Daten.",
      );
    for (const row of rows) {
      // Existing record/file dependencies and permissions still apply. Privacy rights
      // never silently add production, private-chat or personnel edit privileges.
      await deleteRecord(context, row.kind, row.id, { transaction: tx, version: row.version });
      await tx.delete(recordOperations).where(eq(recordOperations.recordId, row.id));
      await tx
        .insert(privacyErasureLedger)
        .values({ recordId: row.id, requestId: request.id, organizationId: context.organizationId })
        .onConflictDoNothing();
    }
    await auditChange(tx, context, "privacy.erasure-executed", id);
    return {
      erased: ids.length,
      pending: [
        "Verknüpfte oder gemeinsam genutzte Inhalte prüfen",
        "Datei-Löschereignisse kontrollieren",
        "Browserkopien und Backup-Aufbewahrung prüfen",
      ],
      accountDeleted: false,
    };
  });
}
