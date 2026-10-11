export const htmlEscape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export function offlineCueHtml(
  production: string,
  rows: {
    title: string;
    version: number;
    module: string;
    sequence: unknown;
    trigger: unknown;
    action: unknown;
  }[],
  createdAt: string,
) {
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${htmlEscape(production)} · Cue-Stand</title><style>body{font:16px system-ui;max-width:1100px;margin:24px auto;padding:0 16px;color:#18211f}table{border-collapse:collapse;width:100%}td,th{padding:12px;text-align:left;border:1px solid #ccd3d0;white-space:pre-wrap}p{line-height:1.6}@media print{body{font-size:11pt}thead{display:table-header-group}tr{break-inside:avoid}}</style><h1>${htmlEscape(production)} · Cue-Stand</h1><p>Persönlicher Druck-/Offline-Auszug vom ${htmlEscape(createdAt)}. Nur die beim Export zugänglichen Fach-Cues. Keine Live-Aktualisierung: Vor jeder Vorstellung den aktuellen, freigegebenen Stand mit der Inspizienz abgleichen. Diese Datei enthält Theaterdaten; geschützt aufbewahren und nach Verwendung löschen.</p><table><thead><tr><th>Nr.</th><th>Gewerk / Fassung</th><th>Cue</th><th>Auslöser</th><th>Aktion</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${htmlEscape(row.sequence)}</td><td>${htmlEscape(row.module)} · ${row.version}</td><td>${htmlEscape(row.title)}</td><td>${htmlEscape(row.trigger)}</td><td>${htmlEscape(row.action)}</td></tr>`).join("")}</tbody></table><p>Showtime · ${rows.length} Cues · Dieser Auszug ist unveränderlich und funktioniert ohne Netzwerk, Schriften oder Skripte.</p></html>`;
}
