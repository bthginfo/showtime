import { describe, expect, it } from "vitest";
import { workspaceHome, hasLeadershipOverview } from "@/shared/workspace-home";
import type { Workspace } from "@/shared/contracts";
import type { Grant } from "@/platform/access";
const workspace = (
  moduleId: string,
  grants: Grant[],
): Pick<Workspace, "currentModuleId" | "department" | "user"> => ({
  currentModuleId: moduleId,
  department: { id: "current", name: "Beliebiger Name" },
  user: { id: "person", name: "QA", username: "qa", role: "user", status: "active", grants },
});
describe("home follows the selected trade", () => {
  const leadership: Grant = { role: "intendance", scope: "tenant", scopeId: null };
  it("never replaces another trade home for a user with a global leadership role", () => {
    for (const moduleId of ["disposition", "makeup", "lighting", "administration", "ensemble"]) {
      expect(workspaceHome(workspace(moduleId, [leadership]))).toBe("trade");
      expect(hasLeadershipOverview(workspace(moduleId, [leadership]))).toBe(false);
    }
  });
  it("requires both the selected Intendanz module and fresh budget access", () => {
    expect(workspaceHome(workspace("intendance", [leadership]))).toBe("intendance");
    expect(
      workspaceHome(
        workspace("intendance", [{ ...leadership, scope: "department", scopeId: "other" }]),
      ),
    ).toBe("trade");
    expect(
      workspaceHome(
        workspace("intendance", [{ ...leadership, expiresAt: "2000-01-01T00:00:00Z" }]),
      ),
    ).toBe("trade");
    expect(
      workspaceHome(
        workspace("intendance", [{ role: "theater_admin", scope: "tenant", scopeId: null }]),
      ),
    ).toBe("administration");
  });
  it("does not turn unrelated trades into a personnel dashboard", () => {
    const personnel: Grant = { role: "personnel", scope: "tenant", scopeId: null };
    expect(workspaceHome(workspace("administration", [personnel]))).toBe("personnel");
    expect(workspaceHome(workspace("disposition", [personnel, leadership]))).toBe("trade");
  });
});
