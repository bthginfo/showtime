import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
const text = z.string().trim().max(4000).default("");
const short = z.string().trim().max(200).default("");
const date = z.union([z.iso.datetime({ offset: true }), z.literal("")]).default("");
const ids = z.array(z.string().min(1).max(150)).max(500).default([]);
export const privacyGroups = [
  "employees",
  "actors",
  "contacts",
  "calendar",
  "documents",
  "chat",
  "time",
  "audit",
  "backups",
] as const;
export const rights = [
  "access",
  "correction",
  "erasure",
  "restriction",
  "portability",
  "objection",
] as const;
export const policySchema = z
  .object({
    controller: z.object({ name: short, address: text, contact: short, dpo: short }),
    provider: z
      .object({ name: short, address: text, contact: short })
      .default({ name: "", address: "", contact: "" }),
    rightsContact: short,
    purposes: z
      .array(
        z.object({
          group: z.enum(["employees", "actors", "contacts"]),
          purpose: text,
          basis: text,
          retention: text,
          recipients: text,
          notice: text,
        }),
      )
      .max(3)
      .default([]),
    notice: text,
    worksCouncilReview: text,
    reviewedAt: date,
    publishedAt: date,
  })
  .strict();
export type PrivacyPolicy = z.infer<typeof policySchema>;
export const entrySchemas = {
  request: z.object({
    title: short,
    requestType: z.enum(rights),
    subjectType: z.enum(["account", "actor", "contact"]),
    subjectId: short,
    contact: short,
    receivedAt: date,
    identityVerifiedAt: date,
    decision: text,
    response: text,
    respondedAt: date,
    extensionReason: text,
    extensionNotifiedAt: date,
  }),
  provider: z.object({
    title: short,
    service: text,
    dataGroups: z.array(z.enum(privacyGroups)).default([]),
    storageRegion: short,
    logRegion: short,
    supportRegion: short,
    backupRegion: short,
    transferSafeguards: text,
    contractReference: text,
    subprocessors: text,
    reviewedAt: date,
  }),
  retention: z.object({
    title: short,
    group: z.enum(privacyGroups),
    days: z.number().int().min(1).max(36500).nullable().default(null),
    trigger: z.enum(["last-updated", "contract-ended", "subject-erased"]),
    legalBasis: text,
    approvedAt: date,
    backupDays: z.number().int().min(1).max(36500).nullable().default(null),
  }),
  hold: z.object({ title: short, recordIds: ids, reason: text, until: date }),
  incident: z.object({
    title: short,
    awareAt: date,
    controllerInformedAt: date,
    authorityDecision: z.enum(["pending", "required", "not-required"]).default("pending"),
    decisionReason: text,
    authorityNotifiedAt: date,
    subjectsDecision: z.enum(["pending", "required", "not-required"]).default("pending"),
    subjectsNotifiedAt: date,
    measures: text,
  }),
  document: z.object({
    title: short,
    documentType: z.enum([
      "avv",
      "tom",
      "instruction",
      "dpia",
      "processing",
      "restore",
      "offboarding",
    ]),
    reference: text,
    content: text,
    reviewedAt: date,
  }),
  image: z.object({
    title: short,
    actorId: short,
    source: text,
    legalBasis: text,
    noticeDeliveredAt: date,
    license: text,
    allowedUse: z.enum(["internal", "public", "none"]).default("none"),
    evidence: text,
    expiresAt: date,
    withdrawnAt: date,
  }),
} as const;
export type PrivacyEntryKind = keyof typeof entrySchemas;
export interface PrivacyEntry {
  id: string;
  kind: PrivacyEntryKind;
  ownerId: string | null;
  data: Record<string, unknown>;
  status: string;
  dueAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface PrivacyWorkspace {
  policy: PrivacyPolicy | null;
  policyVersion: number;
  entries: PrivacyEntry[];
  manage: boolean;
  noticeUrl: string;
  noticePublished: boolean;
  healthEnabled: false;
  mfaEnabled: boolean;
  mfaVerified: boolean;
}

/** A calendar month, clamped to its last date; not 30 days. Extensions use the original receipt. */
export function rightsDeadline(receivedAt: string, extension = false, timezone = "Europe/Berlin") {
  const received = new Date(receivedAt);
  if (!Number.isFinite(received.getTime())) throw new Error("Ungültiges Eingangsdatum.");
  const local = formatInTimeZone(received, timezone, "yyyy-MM-dd'T'HH:mm:ss.SSS");
  const date = new Date(local + "Z");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + (extension ? 3 : 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return fromZonedTime(date.toISOString().slice(0, -1), timezone);
}
export function publicationGaps(policy: PrivacyPolicy) {
  const gaps: string[] = [];
  if (!policy.controller.name || !policy.controller.address || !policy.controller.contact)
    gaps.push("Rechtlicher Träger, Anschrift und Datenschutzkontakt");
  if (!policy.rightsContact) gaps.push("Kontakt für Betroffenenanfragen");
  for (const group of ["employees", "actors", "contacts"]) {
    const purpose = policy.purposes.find((p) => p.group === group);
    if (!purpose?.purpose || !purpose.basis || !purpose.retention || !purpose.recipients)
      gaps.push("Zweck, Rechtsgrundlage, Empfänger und Aufbewahrung: " + group);
  }
  if (!policy.reviewedAt || !policy.notice) gaps.push("Geprüfte Datenschutzinformation");
  return gaps;
}
export const clinicalInput = (value: string) =>
  /\b(krank(?:heit)?|attest(?:e)?|allerg(?:ie|ien|y|ies)|diagnos\w*|medizin\w*|sick|medical)\b/iu.test(
    value,
  );
export function nonClinicalPayload(input: Record<string, unknown>): boolean {
  const safe = (value: unknown): boolean =>
    typeof value === "string"
      ? !clinicalInput(value)
      : Array.isArray(value)
        ? value.every(safe)
        : typeof value !== "object" ||
          value === null ||
          nonClinicalPayload(value as Record<string, unknown>);
  return Object.entries(input).every(
    ([key, value]) => !/(diagnos|allerg|attest|krank|sick|medical)/iu.test(key) && safe(value),
  );
}
