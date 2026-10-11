import { describe, expect, it } from "vitest";
import { approvalContentHash, verifiedApproval } from "@/modules/theater/approval";
const source = {
  moduleId: "marketing",
  type: "campaign",
  title: "Premiere",
  productionId: "play",
  data: { copy: "Text", channel: "Web", dependencyIds: ["artwork"] },
};
describe("formal approval of the exact source", () => {
  it("ignores field order and server approval metadata", () => {
    expect(approvalContentHash(source)).toBe(
      approvalContentHash({
        ...source,
        data: {
          dependencyIds: ["artwork"],
          channel: "Web",
          copy: "Text",
          approval: "approved",
          _approval: {},
        },
      }),
    );
  });
  it("accepts a verified original and rejects changed title, content or production", () => {
    const approved = {
      ...source,
      data: {
        ...source.data,
        _approval: {
          contentHash: approvalContentHash(source),
          approvedBy: "reviewer",
          approvedAt: "2026-10-11T10:00:00Z",
        },
      },
    };
    expect(verifiedApproval(approved)).toBe(true);
    expect(verifiedApproval({ ...approved, title: "Neue Premiere" })).toBe(false);
    expect(verifiedApproval({ ...approved, productionId: "other" })).toBe(false);
    expect(
      verifiedApproval({ ...approved, data: { ...approved.data, copy: "Anderer Text" } }),
    ).toBe(false);
  });
  it("does not turn a manually set flag into verified approval", () => {
    expect(verifiedApproval({ ...source, data: { ...source.data, approval: "approved" } })).toBe(
      false,
    );
  });
});
