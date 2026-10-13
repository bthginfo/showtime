import type { WorkingTimeSettings } from "./working-time";
export const recordKinds = [
  "productions",
  "actors",
  "characters",
  "casting",
  "maskPlans",
  "sprints",
  "tasks",
  "events",
  "leave",
  "time",
  "looks",
  "templates",
  "messages",
  "materials",
  "reservations",
  "shiftSwaps",
  "handovers",
  "notifications",
  "timesheets",
  "files",
  "feedback",
  "attendance",
  "calendarCategories",
  "conversations",
  "people",
  "categories",
] as const;
export type RecordKind = (typeof recordKinds)[number];
export type Role = "superadmin" | "admin" | "user";
export const accentPalettes = ["green", "lavender", "peach", "sky", "rose", "sand"] as const;
export type AccentPalette = (typeof accentPalettes)[number];
export interface ProfilePreferences {
  accentPalette: AccentPalette;
  onboardingVersion: number;
  workingTime?: WorkingTimeSettings;
}
export const onboardingVersion = 1;
export type RecordData = Record<string, unknown>;
export interface ProductionContact {
  id: string;
  role: string;
  type: "external" | "makeup";
  name: string;
  memberId: string;
  personId?: string;
}
export const contactsValue = (value: unknown): ProductionContact[] =>
  Array.isArray(value)
    ? value.filter(
        (contact): contact is ProductionContact =>
          contact !== null &&
          typeof contact === "object" &&
          typeof contact.id === "string" &&
          typeof contact.role === "string" &&
          (contact.type === "external" || contact.type === "makeup") &&
          typeof contact.name === "string" &&
          typeof contact.memberId === "string",
      )
    : [];
export interface DomainRecord {
  id: string;
  kind: RecordKind;
  organizationId: string;
  departmentId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  data: RecordData;
}
export interface Member {
  activeDepartmentIds?: string[];
  departmentId?: string;
  id: string;
  name: string;
  username: string;
  role: Role;
  status: "pending" | "active" | "disabled";
  preferences?: ProfilePreferences;
  permissions?: import("@/platform/access").Permission[];
  grants?: import("@/platform/access").Grant[];
}
export interface Workspace {
  calendarProductions?: CalendarProductionReference[];
  timezone?: string;
  currentModuleId?: string;
  pages?: Partial<Record<RecordKind, string | null>>;
  scopes?: {
    organizationId: string;
    organizationName: string;
    departmentId: string;
    departmentName: string;
    status: string;
  }[];
  platformAdmin?: boolean;
  modules?: string[];
  live?: { channel: string; ticket: string; expiresAt: number; cursor: string } | null;
  user: Member;
  organization: { id: string; name: string };
  department: { id: string; name: string };
  members: Member[];
  records: Record<RecordKind, DomainRecord[]>;
  timer: { id: string; data: RecordData } | null;
  attendanceTimer?: { id: string; data: RecordData } | null;
  projectHours: Record<string, number>;
}
/** Calendar labels are not permission to open a production's internal records. */
export interface CalendarProductionReference {
  id: string;
  data: { title: string; color: string; season?: string; premiere?: string };
}
export interface ApiError {
  error: string;
  details?: unknown;
}
export interface ActionRequest {
  action: string;
  id?: string;
  data?: RecordData;
}
export const textValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
export const numberValue = (value: unknown, fallback = 0) =>
  typeof value === "number" ? value : fallback;
export const listValue = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
