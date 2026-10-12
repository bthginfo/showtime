import { describe, expect, it } from "vitest";
import {
  activeWorkplaceScopes,
  pickerOrganization,
  workplaceSwitchPolicy,
} from "@/shared/workplace-switch";
import type { WorkplaceScope } from "@/shared/workplace-switch";
import type { Workspace } from "@/shared/contracts";

const scope = (
  organizationId: string,
  departmentId: string,
  status = "active",
): WorkplaceScope => ({
  organizationId,
  organizationName: organizationId,
  departmentId,
  departmentName: departmentId,
  status,
});
const workspace = (scopes: WorkplaceScope[], platformAdmin = false) =>
  ({
    organization: { id: "home", name: "QA Theater" },
    scopes,
    platformAdmin,
    user: { id: "qa", name: "QA", username: "qa", role: "admin", status: "active" },
  }) as Pick<Workspace, "organization" | "scopes" | "platformAdmin" | "user">;

describe("workplace choices follow membership and platform role", () => {
  it("does not promote a legacy role label to platform administration", () => {
    const ordinary = workspace([scope("home", "makeup")]);
    ordinary.user.role = "superadmin";
    expect(workplaceSwitchPolicy(ordinary).canSwitchTheater).toBe(false);
  });
  it("has no switching control for one trade, including theater administrators", () => {
    expect(workplaceSwitchPolicy(workspace([scope("home", "makeup")])).canSwitch).toBe(false);
  });
  it("lets multi-trade staff switch only among their current theater's trades", () => {
    const policy = workplaceSwitchPolicy(
      workspace([scope("home", "makeup"), scope("home", "costume"), scope("other", "sound")]),
    );
    expect(policy.canSwitch).toBe(true);
    expect(policy.canSwitchTheater).toBe(false);
    expect(policy.scopes.map((entry) => entry.departmentId)).toEqual(["makeup", "costume"]);
  });
  it("does not mistake another theater membership for another own trade", () => {
    expect(
      workplaceSwitchPolicy(workspace([scope("home", "makeup"), scope("other", "sound")]))
        .canSwitch,
    ).toBe(false);
  });
  it("ignores disabled and duplicate memberships", () => {
    const scopes = [
      scope("home", "makeup"),
      scope("home", "makeup"),
      scope("home", "costume", "disabled"),
    ];
    expect(activeWorkplaceScopes(scopes)).toHaveLength(1);
    expect(workplaceSwitchPolicy(workspace(scopes)).canSwitch).toBe(false);
  });
  it("keeps the theater switch available for a verified platform superadmin", () => {
    const policy = workplaceSwitchPolicy(
      workspace([scope("home", "makeup"), scope("other", "sound")], true),
    );
    expect(policy.canSwitchTheater).toBe(true);
    expect(policy.canSwitch).toBe(true);
    expect(policy.scopes).toHaveLength(2);
  });
  it("locks a regular picker to the current theater even with a foreign pending selection", () => {
    const scopes = [scope("home", "makeup"), scope("other", "sound")];
    expect(pickerOrganization(scopes, false, "home", "home", "other")).toBe("home");
    expect(pickerOrganization(scopes, true, "home", "home", "other")).toBe("other");
  });
  it("never guesses a theater for a regular account with ambiguous legacy affiliations", () => {
    const scopes = [scope("home", "makeup"), scope("other", "sound")];
    expect(pickerOrganization(scopes, false)).toBe("");
    expect(pickerOrganization(scopes, false, "", "home")).toBe("home");
    expect(pickerOrganization([scope("home", "makeup")], false)).toBe("home");
  });
  it("does not replace a revoked current theater with a foreign singleton membership", () => {
    expect(pickerOrganization([scope("other", "sound")], false, "home", "", "")).toBe("");
  });
  it("does not replace a revoked current theater with a foreign cookie hint", () => {
    expect(pickerOrganization([scope("other", "sound")], false, "home", "other", "other")).toBe("");
  });
});
