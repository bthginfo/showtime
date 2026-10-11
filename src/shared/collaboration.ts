import { hasPermission, type Grant } from "@/platform/access";
export const collaborationKinds = {
  feedback: "Feedback erbitten",
  approval: "Freigabe erbitten",
  handover: "Übergabe",
  change: "Änderung abstimmen",
} as const;
export const collaborationStates = {
  review: "Rückmeldung offen",
  changes_requested: "Überarbeitung nötig",
  approved: "Freigegeben",
  acknowledged: "Übernommen",
  cancelled: "Zurückgezogen",
} as const;
export type CollaborationKind = keyof typeof collaborationKinds;
export type CollaborationState = keyof typeof collaborationStates;
export type CollaborationSubject = {
  id: string;
  departmentId?: string;
  activeDepartmentIds?: string[];
  grants?: readonly Grant[];
};
export type CollaborationScope = {
  departmentId: string;
  createdBy: string;
  productionId: string | null;
  data: Record<string, unknown>;
};
export function collaborationSide(
  subject: CollaborationSubject,
  row: CollaborationScope,
  side: "sender" | "recipient",
) {
  const departmentId =
    side === "sender" ? row.departmentId : String(row.data.recipientDepartmentId || "");
  return (
    (subject.activeDepartmentIds || [subject.departmentId]).includes(departmentId) &&
    hasPermission({ id: subject.id, grants: subject.grants || [] }, "document.read", {
      departmentId,
      productionId: row.productionId || undefined,
    })
  );
}
export function collaborationReadable(subject: CollaborationSubject, row: CollaborationScope) {
  return collaborationSide(subject, row, "sender") || collaborationSide(subject, row, "recipient");
}
export function collaborationApprover(subject: CollaborationSubject, row: CollaborationScope) {
  return (
    subject.id !== row.createdBy &&
    collaborationSide(subject, row, "recipient") &&
    (["document.publish", "readiness.manage"] as const).some((permission) =>
      hasPermission({ id: subject.id, grants: subject.grants || [] }, permission, {
        departmentId: String(row.data.recipientDepartmentId),
        productionId: row.productionId || undefined,
      }),
    )
  );
}
export function collaborationOpen(state: string) {
  return state === "review" || state === "changes_requested";
}
export function collaborationContributor(subject: CollaborationSubject, row: CollaborationScope) {
  return (["sender", "recipient"] as const).some(
    (side) =>
      collaborationSide(subject, row, side) &&
      hasPermission({ id: subject.id, grants: subject.grants || [] }, "document.create", {
        departmentId: side === "sender" ? row.departmentId : String(row.data.recipientDepartmentId),
        productionId: row.productionId || undefined,
      }),
  );
}
export type CollaborationEntry = CollaborationScope & {
  id: string;
  title: string;
  status: CollaborationState;
  version: number;
  updatedAt: string;
  canComment: boolean;
  canApprove: boolean;
  canRespond: boolean;
  canRevise: boolean;
  canAttach: boolean;
};
export type CollaborationReply = {
  version: number;
  action: string;
  message: string;
  author: string;
  createdAt: string;
  revision: number;
};
export type CollaborationDetail = {
  entry: CollaborationEntry;
  replies: CollaborationReply[];
  nextVersion: number | null;
  parent: import("./contracts").DomainRecord;
  files: import("./contracts").DomainRecord[];
};
