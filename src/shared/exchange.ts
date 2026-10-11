import Papa from "papaparse";
import type { Field } from "@/modules/theater/registry";
export function parseExchange(content: string, format: "csv" | "json") {
  if (content.length > 1_000_000) throw new Error("Importdatei darf höchstens 1 MB enthalten.");
  if (format === "json") {
    const parsed = JSON.parse(content);
    if (
      !Array.isArray(parsed) ||
      parsed.some((v) => !v || typeof v !== "object" || Array.isArray(v))
    )
      throw new Error("JSON muss eine Liste von Objekten enthalten.");
    return parsed as Record<string, unknown>[];
  }
  const parsed = Papa.parse<Record<string, string>>(content.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [";", ",", "\t"],
  });
  if (parsed.errors.length)
    throw new Error("CSV konnte nicht gelesen werden: " + parsed.errors[0].message);
  if (parsed.meta.fields?.some((k) => ["__proto__", "prototype", "constructor"].includes(k)))
    throw new Error("Ungültiger Spaltenname.");
  return parsed.data;
}
export function mapExchangeRow(
  row: Record<string, unknown>,
  mapping: Record<string, string>,
  fields: Field[],
) {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (Object.hasOwn(mapping, field.key) && !mapping[field.key]) continue;
    const column = mapping[field.key] || field.key;
    if (row[column] === undefined || row[column] === "") continue;
    const value = row[column];
    result[field.key] =
      field.type === "number"
        ? typeof value === "number"
          ? value
          : Number(String(value).replace(",", "."))
        : field.type === "checkbox"
          ? typeof value === "boolean"
            ? value
            : ["true", "1", "ja"].includes(String(value).toLowerCase())
          : ["members", "trades"].includes(field.type)
            ? Array.isArray(value)
              ? value
              : String(value)
                  .split("|")
                  .map((v) => v.trim())
                  .filter(Boolean)
            : value;
  }
  return result;
}
export function exportCSV(rows: Record<string, unknown>[]) {
  return (
    "\uFEFF" +
    Papa.unparse(
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            Array.isArray(value)
              ? value.join("|")
              : value && typeof value === "object"
                ? JSON.stringify(value)
                : value,
          ]),
        ),
      ),
      { delimiter: ";", newline: "\r\n", escapeFormulae: true },
    )
  );
}
export function iCalendar(
  events: { id: string; title: string; start: string; end: string; version: number }[],
  now = new Date(),
) {
  const stamp = (date: string) =>
    new Date(date)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const escape = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const fold = (line: string) => {
    const lines = [];
    let part = "",
      bytes = 0;
    for (const char of line) {
      const length = new TextEncoder().encode(char).length;
      if (bytes + length > 74) {
        lines.push(part);
        part = " ";
        bytes = 1;
      }
      part += char;
      bytes += length;
    }
    lines.push(part);
    return lines.join("\r\n");
  };
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Showtime//Theater API 1.0//DE",
      "CALSCALE:GREGORIAN",
      ...events.flatMap((event) => [
        "BEGIN:VEVENT",
        "UID:" + escape(event.id) + "@showtime",
        "DTSTAMP:" + stamp(now.toISOString()),
        "DTSTART:" + stamp(event.start),
        "DTEND:" + stamp(event.end),
        "SEQUENCE:" + event.version,
        "CLASS:PRIVATE",
        "SUMMARY:" + escape(event.title),
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
