import type { RecordData } from "@/shared/contracts";
import type { Grant, TheaterRole } from "@/platform/access";
import type { ModuleManifest } from "./registry";
import type { Collection } from "./collections";
export type TradeItem = {
  id: string;
  moduleId: string;
  type: string;
  title: string;
  productionId: string | null;
  performanceId: string | null;
  departmentId: string;
  createdBy: string;
  status: string;
  version: number;
  data: RecordData;
  updatedAt: string;
};
export type Resource = {
  id: string;
  departmentId: string | null;
  name: string;
  type: string;
  capacity: number;
  setupMinutes: number;
  teardownMinutes: number;
  version: number;
};
export type Booking = {
  id: string;
  resourceId: string;
  productionId: string | null;
  activityId: string | null;
  createdBy: string;
  startAt: string;
  endAt: string;
  quantity: number;
  version: number;
};
export type Performance = {
  id: string;
  productionId: string;
  eventId: string;
  curtainAt: string;
  status: string;
  version: number;
  runId: string | null;
};
export type Run = {
  id: string;
  productionId: string;
  label: string;
  startAt: string | null;
  endAt: string | null;
};
export type ProductionMetadata = {
  id: string;
  recordId: string;
  workId: string | null;
  seasonId: string | null;
  stage: string;
  version: number;
};
export type Planning = {
  items: TradeItem[];
  nextCursor: string | null;
  pages: Partial<Record<Collection, string | null>>;
  window: { from: string; to: string };
  modules: { moduleId: string; config: { departmentId?: string }; manifest: ModuleManifest }[];
  departments: { id: string; name: string }[];
  resources: Resource[];
  bookings: Booking[];
  performances: Performance[];
  runs: Run[];
  works: { id: string; title: string; author: string | null; version: number }[];
  seasons: { id: string; label: string; startAt: string; endAt: string }[];
  productionMetadata: ProductionMetadata[];
  scheduleVersions: {
    id: string;
    version: number;
    state: string;
    createdAt: string;
    changedProductionIds: string[];
  }[];
  funding: {
    id: string;
    title: string;
    productionId: string | null;
    department: string;
    costCentre: string;
  }[];
  readiness: {
    moduleId: string;
    departmentId: string;
    label: string;
    required: boolean;
    ready: boolean;
    updatedAt: string | null;
    version: number;
  }[];
};
export type Configuration = {
  departments: { id: string; name: string }[];
  grants: (Grant & { id: string; userId: string })[];
  members: { userId: string; name: string; username: string; status: string }[];
  settings: {
    timezone: string;
    settings: {
      quotas?: { members: number; filesBytes: number; uploadsPerUserPerDay?: number };
      workRules?: Record<string, number | boolean>;
      requiredReadinessModules?: string[];
    };
  };
  modules: { moduleId: string; enabled: boolean; config: { departmentId?: string } }[];
  audit: {
    id: string;
    userId: string;
    action: string;
    recordId: string | null;
    createdAt: string;
  }[];
  events: { id: string; type: string; status: string; attempts: number; availableAt: string }[];
};
export type TheaterRun = (action: string, data: RecordData) => Promise<RecordData>;
export type Configure = (action: string, data: RecordData) => Promise<void>;
export const roleLabels: Record<TheaterRole, string> = {
  employee: "Mitarbeitende",
  team_lead: "Teamleitung",
  production_lead: "Produktionsleitung",
  disposition: "Disposition",
  technical_lead: "Technische Leitung",
  intendance: "Intendanz",
  theater_admin: "Theateradministration",
  personnel: "Personalverwaltung",
  costume_specialist: "Kostüm / Maßdaten",
  guest: "Gast",
};
export const stageLabels: Record<string, string> = {
  concept: "Konzept",
  development: "Vorbereitung",
  workshop: "Werkstätten",
  rehearsal: "Proben",
  "technical-rehearsal": "Technische Probe",
  "dress-rehearsal": "Generalprobe",
  performance: "Spielbetrieb",
  revival: "Wiederaufnahme",
  archived: "Archiv",
};
