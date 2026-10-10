# Showtime

Ein gemeinsamer Arbeitsraum für den gesamten Theaterbetrieb: SvelteKit, getrennte Theaterdaten, fachliche Ereignisse und zwanzig konfigurierbare Gewerke. Showtime übernimmt die aktiven DigitalMask-Funktionen aus Quellstand `daafd42` und erweitert sie um Hausdisposition, Ressourcen, Vorbereitungsstände und Theaterverwaltung.

## Anwendung

- [Showtime öffnen](https://showtime-ingolstadt.vercel.app)
- [Architektur und Rechte](docs/ARCHITEKTUR.md)
- [Betrieb, Migrationen und verschlüsselte Wiederherstellung](docs/BETRIEB.md)
- [Abnahme und bekannte Grenzen](docs/ABNAHME.md)
- [Freigegebener Umfang und Recherche](docs/APPROVED-PLAN.md)

Die vorhandenen Maskenansichten behalten ihre CSS-Tokens, Layouts und Gestaltung. Ein Theater- und Gewerkwechsel, die Ansicht „Theaterbetrieb“ und fachliche Rechte ergänzen diese Oberfläche. Eigene Arbeitszeiten und Anwesenheiten lassen sich nach dem Buchen bearbeiten und löschen, einschließlich manuell erfasster und aus Timern entstandener Buchungen. Versionsprüfungen verhindern das Überschreiben neuerer Korrekturen.

## Entwicklung

Node.js 24 und npm verwenden. Eine eigene Entwicklungsdatenbank und ein eigener privater Blob-Store sind erforderlich; keine Zugangsdaten oder Daten von DigitalMask übernehmen.

```sh
npm ci
# .env.example als Vorlage für ausschließlich eigene Entwicklungsressourcen nutzen
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Die App läuft lokal auf `http://127.0.0.1:3100`. Für Provisionierung, Migration und Bootstrap siehe die Betriebsanleitung. Laufzeitrollen besitzen weder Tabellen noch `BYPASSRLS`; Eigentümer-Zugangsdaten gehören ausschließlich in lokale, ignorierte Betriebsdateien.

## Aufbau

`src/routes` enthält SvelteKit-Eingänge, `src/components` die gemeinsamen Svelte-Komponenten. Fachlogik liegt in `src/modules`, Infrastruktur und Rechte in `src/platform`, gemeinsame Verträge in `src/shared`. `src/modules/theater/registry.ts` beschreibt die Gewerke und ihre typisierten Fachfunktionen. SQL-Migrationen liegen in `drizzle`.

Ein Command schreibt seine verbindliche Änderung und das Ereignis gemeinsam. Vercel Queues verarbeitet anschließend Benachrichtigungen und Folgearbeiten; PostgreSQL-Outbox und Verarbeitungsbelege ermöglichen Wiederholung und Recovery. Dokumentänderungen bleiben über PostgreSQL und Yjs dauerhaft erhalten. Live-Signale verwenden autorisierte SSE-Verbindungen und laden aktuelle Inhalte über die API nach.

## Prüfungen

Die normale Testsuite benötigt keine Cloud-Zugangsdaten. Echte RLS-, Pool-, Event- und Paginationstests sind ausdrücklich auf die separate Entwicklungsumgebung begrenzt:

```sh
# PowerShell
$env:SHOWTIME_INTEGRATION='development'
npx vitest run tests/tenancy/platform.integration.test.ts
# Laufenden Entwicklungsserver und lokale Bootstrap-Zugangsdaten vorausgesetzt:
npm run test:e2e
```

Entwicklung, Preview und Produktion verwenden jeweils eigene Neon-Free-Datenbanken, Blob-Stores und Secrets. Redis ist optional; die Erstinstallation arbeitet ohne zusätzliches Redis-Abonnement. Queue- und Function-Nutzung fällt unter die Abrechnung des vorhandenen Vercel-Pro-Kontos. Es gibt keinen automatischen Import realer DigitalMask-Daten.
