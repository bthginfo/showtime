import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations, departments, records, user } from "./schema";
import type { Grant, TheaterRole } from "../access";
import type { WorkingTimeSettings } from "@/shared/working-time";
const tenant = () =>
  text("organization_id")
    .notNull()
    .default(sql.raw("current_setting('app.tenant_id', true)"))
    .references(() => organizations.id);
const id = () => text("id").primaryKey().default(sql.raw("gen_random_uuid()::text"));
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const scopeFK = (t: any) =>
  foreignKey({
    columns: [t.organizationId, t.departmentId],
    foreignColumns: [departments.organizationId, departments.id],
  });
export const privacyPolicies = pgTable("privacy_policies", {
  organizationId: tenant().primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  publishedData: jsonb("published_data").$type<Record<string, unknown>>(),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").references(() => user.id),
  updatedAt: updated(),
});
export const privacyEntries = pgTable(
  "privacy_entries",
  {
    id: id(),
    organizationId: tenant(),
    kind: text("kind").notNull(),
    ownerId: text("owner_id").references(() => user.id),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("open"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("privacy_entries_tenant_kind").on(t.organizationId, t.kind),
    foreignKey({
      columns: [t.organizationId, t.ownerId],
      foreignColumns: [tenantMembers.organizationId, tenantMembers.userId],
    }),
  ],
);
/** Content-free tombstones survive backup restoration; never store erased payloads here. */
export const privacyErasureLedger = pgTable(
  "privacy_erasure_ledger",
  {
    id: id(),
    organizationId: tenant(),
    recordId: text("record_id").notNull(),
    requestId: text("request_id").notNull(),
    erasedAt: created(),
  },
  (t) => [uniqueIndex("privacy_erasure_record").on(t.organizationId, t.recordId)],
);
/** Only deliberately forwarded support content is visible to platform operators. */
export const supportRequests = pgTable(
  "support_requests",
  {
    id: id(),
    organizationId: tenant(),
    sourceRecordId: text("source_record_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("new"),
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("support_source_idx").on(t.organizationId, t.sourceRecordId),
    foreignKey({
      columns: [t.organizationId, t.sourceRecordId],
      foreignColumns: [records.organizationId, records.id],
    }).onDelete("cascade"),
  ],
);
export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: id(),
    organizationId: tenant(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    status: text("status").$type<"pending" | "active" | "disabled">().notNull().default("pending"),
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("tenant_member_identity").on(t.organizationId, t.userId)],
);
export const permissionGrants = pgTable(
  "permission_grants",
  {
    id: id(),
    organizationId: tenant(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: text("role").$type<TheaterRole>().notNull(),
    scope: text("scope").$type<Grant["scope"]>().notNull(),
    scopeId: text("scope_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    index("grant_subject").on(t.organizationId, t.userId),
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [tenantMembers.organizationId, tenantMembers.userId],
    }),
  ],
);
export const platformAdmins = pgTable("platform_admins", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  createdAt: created(),
});
export const tenantProfiles = pgTable(
  "tenant_profiles",
  {
    id: id(),
    organizationId: tenant(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    workingTime: jsonb("working_time").$type<WorkingTimeSettings>(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("tenant_profile_identity").on(t.organizationId, t.userId),
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [tenantMembers.organizationId, tenantMembers.userId],
    }),
  ],
);
export const tenantSettings = pgTable("tenant_settings", {
  organizationId: tenant().primaryKey(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  permissionVersion: integer("permission_version").notNull().default(1),
  liveRevision: integer("live_revision").notNull().default(1),
  updatedAt: updated(),
});
export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    organizationId: tenant(),
    tokenHash: text("token_hash").notNull().unique(),
    departmentId: text("department_id").notNull(),
    role: text("role").$type<TheaterRole>().notNull().default("employee"),
    productionId: text("production_id"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedBy: text("used_by").references(() => user.id),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    scopeFK(t),
    foreignKey({
      columns: [t.organizationId, t.productionId],
      foreignColumns: [records.organizationId, records.id],
    }),
  ],
);
export const moduleActivations = pgTable(
  "module_activations",
  {
    id: id(),
    organizationId: tenant(),
    moduleId: text("module_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    version: integer("version").notNull().default(1),
  },
  (t) => [uniqueIndex("module_tenant").on(t.organizationId, t.moduleId)],
);
export const theaterWorks = pgTable(
  "theater_works",
  {
    id: id(),
    organizationId: tenant(),
    title: text("title").notNull(),
    author: text("author"),
    version: integer("version").notNull().default(1),
    createdAt: created(),
  },
  (t) => [uniqueIndex("work_scope").on(t.organizationId, t.id)],
);
export const theaterSeasons = pgTable(
  "theater_seasons",
  {
    id: id(),
    organizationId: tenant(),
    label: text("label").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("season_scope").on(t.organizationId, t.id)],
);
export const theaterProductions = pgTable(
  "theater_productions",
  {
    id: id(),
    organizationId: tenant(),
    recordId: text("record_id").notNull(),
    workId: text("work_id"),
    seasonId: text("season_id"),
    stage: text("stage").notNull().default("concept"),
    budgetCents: integer("budget_cents").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("production_scope").on(t.organizationId, t.id),
    uniqueIndex("production_record").on(t.organizationId, t.recordId),
    foreignKey({
      columns: [t.organizationId, t.recordId],
      foreignColumns: [records.organizationId, records.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.workId],
      foreignColumns: [theaterWorks.organizationId, theaterWorks.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.seasonId],
      foreignColumns: [theaterSeasons.organizationId, theaterSeasons.id],
    }),
  ],
);
export const productionRuns = pgTable(
  "production_runs",
  {
    id: id(),
    organizationId: tenant(),
    productionId: text("production_id").notNull(),
    label: text("label").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("run_scope").on(t.organizationId, t.id),
    foreignKey({
      columns: [t.organizationId, t.productionId],
      foreignColumns: [records.organizationId, records.id],
    }),
  ],
);
export const performances = pgTable(
  "performances",
  {
    id: id(),
    organizationId: tenant(),
    productionId: text("production_id").notNull(),
    runId: text("run_id"),
    eventId: text("event_id").notNull(),
    curtainAt: timestamp("curtain_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("planned"),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("performance_scope").on(t.organizationId, t.id),
    uniqueIndex("performance_event").on(t.organizationId, t.eventId),
    foreignKey({
      columns: [t.organizationId, t.productionId],
      foreignColumns: [records.organizationId, records.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.eventId],
      foreignColumns: [records.organizationId, records.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.runId],
      foreignColumns: [productionRuns.organizationId, productionRuns.id],
    }),
  ],
);
export const venueResources = pgTable(
  "venue_resources",
  {
    id: id(),
    organizationId: tenant(),
    departmentId: text("department_id"),
    name: text("name").notNull(),
    type: text("type").notNull(),
    capacity: integer("capacity").notNull().default(1),
    setupMinutes: integer("setup_minutes").notNull().default(0),
    teardownMinutes: integer("teardown_minutes").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: created(),
  },
  (t) => [uniqueIndex("resource_scope").on(t.organizationId, t.id), scopeFK(t)],
);
export const resourceBookings = pgTable(
  "resource_bookings",
  {
    id: id(),
    organizationId: tenant(),
    resourceId: text("resource_id").notNull(),
    productionId: text("production_id"),
    activityId: text("activity_id"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("booking_window").on(t.organizationId, t.resourceId, t.startAt, t.endAt),
    foreignKey({
      columns: [t.organizationId, t.resourceId],
      foreignColumns: [venueResources.organizationId, venueResources.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.productionId],
      foreignColumns: [records.organizationId, records.id],
    }),
  ],
);
export const scheduleVersions = pgTable(
  "schedule_versions",
  {
    id: id(),
    organizationId: tenant(),
    version: integer("version").notNull(),
    state: text("state").$type<"draft" | "approved" | "published">().notNull().default("draft"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    publishedBy: text("published_by").references(() => user.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [uniqueIndex("schedule_version_identity").on(t.organizationId, t.version)],
);
export const tradeItems = pgTable(
  "trade_items",
  {
    id: id(),
    organizationId: tenant(),
    departmentId: text("department_id").notNull(),
    productionId: text("production_id"),
    performanceId: text("performance_id"),
    moduleId: text("module_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"),
    ownerId: text("owner_id").references(() => user.id),
    startAt: timestamp("start_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("trade_item_scope").on(t.organizationId, t.id),
    index("trade_item_list").on(
      t.organizationId,
      t.departmentId,
      t.moduleId,
      t.productionId,
      t.updatedAt,
    ),
    scopeFK(t),
    foreignKey({
      columns: [t.organizationId, t.productionId],
      foreignColumns: [records.organizationId, records.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.performanceId],
      foreignColumns: [performances.organizationId, performances.id],
    }),
  ],
);
export const tradeItemHistory = pgTable(
  "trade_item_history",
  {
    id: id(),
    organizationId: tenant(),
    itemId: text("item_id").notNull(),
    version: integer("version").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("trade_item_revision").on(t.organizationId, t.itemId, t.version),
    foreignKey({
      columns: [t.organizationId, t.itemId],
      foreignColumns: [tradeItems.organizationId, tradeItems.id],
    }),
  ],
);
export const eventReceipts = pgTable(
  "event_receipts",
  {
    id: id(),
    organizationId: tenant(),
    eventId: text("event_id").notNull(),
    handler: text("handler").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("event_handler_receipt").on(t.organizationId, t.eventId, t.handler)],
);
export const documentBuffers = pgTable(
  "document_buffers",
  {
    fileId: text("file_id").primaryKey(),
    organizationId: tenant(),
    state: text("state").notNull(),
    baseRevision: integer("base_revision").notNull().default(0),
    revision: integer("revision").notNull().default(0),
    pendingBytes: integer("pending_bytes").notNull().default(0),
    dirty: boolean("dirty").notNull().default(false),
    updatedAt: updated(),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.fileId],
      foreignColumns: [records.organizationId, records.id],
    }).onDelete("cascade"),
  ],
);
export const documentUpdates = pgTable(
  "document_updates",
  {
    id: id(),
    organizationId: tenant(),
    fileId: text("file_id").notNull(),
    revision: integer("revision").notNull(),
    updateBase64: text("update").notNull(),
    clientId: text("client_id").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("document_update_revision").on(t.organizationId, t.fileId, t.revision),
    foreignKey({
      columns: [t.organizationId, t.fileId],
      foreignColumns: [records.organizationId, records.id],
    }).onDelete("cascade"),
  ],
);
export const apiAccess = pgTable(
  "api_access",
  {
    id: id(),
    organizationId: tenant(),
    departmentId: text("department_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    scopeFK(t),
    uniqueIndex("api_access_scope").on(t.organizationId, t.id),
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [tenantMembers.organizationId, tenantMembers.userId],
    }),
  ],
);
export const integrationReceipts = pgTable(
  "integration_receipts",
  {
    id: id(),
    organizationId: tenant(),
    accessId: text("access_id"),
    operationKey: text("operation_key").notNull(),
    requestHash: text("request_hash").notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("integration_operation").on(t.organizationId, t.operationKey),
    foreignKey({
      columns: [t.organizationId, t.accessId],
      foreignColumns: [apiAccess.organizationId, apiAccess.id],
    }),
  ],
);
export const mediaUploads = pgTable(
  "media_uploads",
  {
    id: id(),
    organizationId: tenant(),
    departmentId: text("department_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    itemId: text("item_id").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    parts: jsonb("parts")
      .$type<{ index: number; path: string; size: number; sha256: string }[]>()
      .notNull()
      .default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedFileId: text("completed_file_id"),
    createdAt: created(),
  },
  (t) => [
    scopeFK(t),
    foreignKey({
      columns: [t.organizationId, t.userId],
      foreignColumns: [tenantMembers.organizationId, tenantMembers.userId],
    }),
    foreignKey({
      columns: [t.organizationId, t.itemId],
      foreignColumns: [tradeItems.organizationId, tradeItems.id],
    }),
    foreignKey({
      columns: [t.organizationId, t.completedFileId],
      foreignColumns: [records.organizationId, records.id],
    }),
  ],
);
export const recoveryChecks = pgTable("recovery_checks", {
  id: id(),
  organizationId: tenant(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  digest: text("digest"),
  recordCount: integer("record_count").notNull().default(0),
  createdAt: created(),
});
