import { describe, it, expect } from "vitest";
import type { DomainRecord, Workspace } from "@/shared/contracts";
import { teamChannelLabel, chatAudienceHint } from "@/shared/chat-presentation";

const workspace = {
  organization: { id: "qa" },
  department: { id: "dispo", name: "Disposition" },
  scopes: [
    { organizationId: "qa", departmentId: "sound", departmentName: "Ton" },
    { organizationId: "foreign", departmentId: "unknown", departmentName: "Fremder Name" },
  ],
} as Workspace;
const channel = (departmentId: string, data: Record<string, unknown> = {}): DomainRecord => ({
  id: "qa-channel",
  organizationId: "qa",
  createdBy: "qa",
  createdAt: "",
  updatedAt: "",
  version: 1,
  departmentId,
  kind: "conversations",
  data: { mode: "team", ...data },
});
describe("channel audience presentation", () => {
  it("describes the actual department instead of the reader's workspace", () => {
    expect(teamChannelLabel(channel("sound"), workspace)).toBe("Ton · Gewerkkanal");
    expect(teamChannelLabel(channel("dispo"), workspace)).toBe("Disposition · Gewerkkanal");
    expect(teamChannelLabel(channel("unknown"), workspace)).toBe("Gewerkkanal");
  });
  it("distinguishes house, production and private chat audiences without promising unrestricted access", () => {
    expect(teamChannelLabel(channel("sound", { scope: "theater" }), workspace)).toBe(
      "Theaterkanal · Alle Gewerke",
    );
    expect(chatAudienceHint(channel("sound", { scope: "theater" }), "", workspace)).toBe(
      "Für berechtigte Personen dieses Theaters.",
    );
    expect(chatAudienceHint(undefined, "production", workspace)).toBe(
      "Für das freigegebene Produktionsteam.",
    );
    expect(chatAudienceHint(channel("sound", { mode: "direct" }), "", workspace)).toBe(
      "Nur die Teilnehmenden haben Zugriff.",
    );
  });
});
