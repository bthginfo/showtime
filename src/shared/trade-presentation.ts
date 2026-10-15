import type { Feature } from "@/modules/theater/registry";
import { primaryTradeFields } from "./trade-form-presentation";

const descriptions: Record<string, string> = {
  readiness: "Geprüften Stand bestätigen und offene Punkte festhalten.",
  asset: "Geräte und Fundusteile mit Standort und Bestand finden.",
  "stock-movement": "Zugang, Verbrauch, Ausleihe oder Rückgabe buchen.",
  qualification: "Befähigung und Gültigkeit für den Einsatz nachweisen.",
  cue: "Einsatz, Reihenfolge und ausführendes Gewerk abstimmen.",
  "cue-edition": "Fach-Cues zu einer gemeinsamen Fassung verbinden.",
  patch: "Geräte, DMX-Adressen und Fokus zuordnen.",
  channel: "Besetzung, Mikrofon, Kanal und Frequenz zuordnen.",
  "routing-edition": "Kanäle zu einem geprüften Routingstand verbinden.",
  "rehearsal-report": "Beobachtungen und Änderungen aus der Probe weitergeben.",
  "show-report": "Vorstellung dokumentieren und Folgeschritte festhalten.",
  scene: "Textfassung, Wege und Aktionen für die Szene festhalten.",
  availability: "Verfügbarkeit und mögliche Einsatzzeiten eintragen.",
  "daily-sheet": "Tag, Besetzung und Hinweise zusammenstellen.",
  costume: "Besetzung, Figur und Fundusteil zusammenbringen.",
  "quick-change": "Kostümwechsel und Assistenz für den Ablauf planen.",
  preparation: "Besetzung, Figur und Perücke für den Einsatz vorbereiten.",
  "scene-prop": "Requisiten und Rückstellung für eine Szene prüfen.",
  loan: "Artikel ausleihen und die Rückgabe verbuchen.",
  "audience-report": "Besucher und Einnahmen einer gespielten Vorstellung erfassen.",
  briefing: "Vorstellung, Dienstbesetzung und Publikumsbedarf abstimmen.",
  purchase: "Bedarf anmelden und zur Entscheidung weitergeben.",
  procurement: "Bestellung, Lieferung und Rechnungsstand verfolgen.",
  budget: "Budgetrahmen und verfügbare Mittel einer Produktion pflegen.",
  incident: "Störung, Zuständigkeit und nächsten Schritt festhalten.",
  maintenance: "Anlage prüfen und Wartung dokumentieren.",
  decision: "Entscheidung, Verantwortung und Termin festhalten.",
  goal: "Ziel, Kennzahl und Fortschritt im Blick behalten.",
  design: "Entwurf, Fassung und Umsetzung mit den Gewerken abstimmen.",
};
export const tradeFeatureGroup = (id: string) =>
  ["asset", "stock-movement", "qualification", "device-profile", "maintenance-series"].includes(id)
    ? "Bestände & Nachweise"
    : id === "readiness"
      ? "Bereitschaft"
      : "Facharbeit";
export const tradeFeatureDescription = (feature: Feature) =>
  descriptions[feature.id] ||
  primaryTradeFields(feature.fields)
    .slice(0, 3)
    .map((f) => f.label)
    .join(" · ");

/** Display actual operational inputs before legacy notes or long descriptions. */
export function tradeSummaryFields(feature: Feature, data: Record<string, unknown>) {
  const keys: Record<string, string[]> = {
    patch: ["fixture", "dmxUniverse", "dmxAddress", "footprint"],
    channel: ["actorId", "assetId", "channelNumber", "frequencyMHz"],
    cue: ["sequence", "scene", "department", "trigger"],
    "scene-prop": ["assetId", "scene", "preset", "resetChecked"],
    readiness: ["ready", "blockers", "performanceId"],
    media: ["fileId", "rightsUntil", "codec", "durationSeconds"],
    "asset-edition": ["revision", "rightsUntil", "channel", "approval"],
  };
  const populated = (key: string) =>
    data[key] !== undefined &&
    data[key] !== "" &&
    data[key] !== null &&
    (!Array.isArray(data[key]) || (data[key] as unknown[]).length > 0);
  const preferred = (keys[feature.id] || []).flatMap((key) =>
    feature.fields.filter((field) => field.key === key),
  );
  const primary = [
    ...preferred,
    ...primaryTradeFields(feature.fields).filter((f) => !preferred.includes(f)),
  ];
  return [...primary, ...feature.fields.filter((f) => !primary.includes(f) && f.primary !== false)]
    .filter((f) => populated(f.key))
    .slice(0, 4);
}
