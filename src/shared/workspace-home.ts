import { hasPermission } from "@/platform/access";
import type { Workspace } from "./contracts";

/** The selected workplace determines the home; additional roles never override it. */
export function workspaceHome(
  workspace: Pick<Workspace, "currentModuleId" | "department" | "user">,
) {
  const subject = { id: workspace.user.id, grants: workspace.user.grants || [] };
  const scope = { departmentId: workspace.department.id };
  if (workspace.currentModuleId === "intendance" && hasPermission(subject, "budget.read", scope))
    return "intendance";
  if (
    workspace.currentModuleId === "administration" &&
    hasPermission(subject, "personnel.read", scope)
  )
    return "personnel";
  if (
    !hasPermission(subject, "production.read", scope) &&
    hasPermission(subject, "tenant.configure", scope)
  )
    return "administration";
  return "trade";
}

export function hasLeadershipOverview(
  workspace: Pick<Workspace, "currentModuleId" | "department" | "user">,
) {
  return workspaceHome(workspace) === "intendance";
}
