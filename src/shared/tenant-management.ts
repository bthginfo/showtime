import { z } from "zod";

export const tenantInput = z.object({
  name: z.string().trim().min(2, "Bitte gib einen Theaternamen ein.").max(150),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(63)
    .regex(
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
      "Die Kennung darf nur kleine Buchstaben, Zahlen und Bindestriche enthalten.",
    ),
});

export function theaterSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63)
    .replace(/-$/g, "");
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status: "active" | "disabled" | "provisioning" | "setup_failed";
  version: number;
  memberCount: number;
  departmentCount: number;
  administratorCount: number;
}

export const tenantStatusLabels: Record<TenantSummary["status"], string> = {
  active: "Aktiv",
  disabled: "Gesperrt",
  provisioning: "Wird eingerichtet",
  setup_failed: "Einrichtung unvollständig",
};
