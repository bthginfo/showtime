# Showtime: Umsetzungsstand

Freigabe am 10. Oktober 2026. Ausgangspunkt: DigitalMask `daafd42`. Ziel: `bthginfo/showtime`, eigener SvelteKit-Code und eigenes Vercel-Projekt. Der vollständige Erstumfang steht in [APPROVED-PLAN.md](APPROVED-PLAN.md).

## Etappen

- [x] 0: Unabhängiges Repository und Ressourcen, private Quellreferenz, Auth-/RLS-/Blob-/Queue-Aufbau.
- [x] 1: Tenant-Plattform, scoped Rollen, Einladungen, RLS, transaktionale Outbox und idempotente Consumer.
- [x] 2: Aktive DigitalMask-Oberfläche nach Svelte portiert; direkte Referenzscreens, Kalender, Dokumente und Maskenfunktionen übernommen.
- [x] 3: Gemeinsame Produktionen, Besetzungen, Hausdisposition, Ressourcen, Planstände und hausweite Kommunikation.
- [x] 4: Zwanzig aktivierbare Gewerke mit typisierten Fachansichten, Bereitschaft, Abhängigkeiten und Budgetfreigaben.
- [ ] 5: Abschließende Cloud-/Preview-Abnahme, vollständige Restoreprobe, gemessene Pagination und Veröffentlichung des geprüften GitHub-Stands.

Zusätzlich umgesetzt: Alle eigenen gebuchten Arbeitszeiten und Anwesenheiten können bearbeitet und gelöscht werden, einschließlich Timerbuchungen und Buchungen mit inzwischen entzogenem Produktionszugang. Veraltete Änderungen werden abgewiesen. Teamkorrekturen benötigen ausdrücklich die passende Rolle.

## Belege

Die separate Infrastruktur besteht aus Vercel-Projekt `showtime`, drei Neon-Free-Projekten und drei privaten Blob-Stores. Entwicklung, Preview und Produktion besitzen eigene Secrets und eingeschränkte Laufzeitrollen. Migrationen reichen bis `0016_showtime-support`. Migrationsrechte und Verwaltungs-PATs sind aus den Deployments entfernt.

Die Abnahme ist in [ABNAHME.md](ABNAHME.md) dokumentiert. Architektur und verbindliche Rechte stehen in [ARCHITEKTUR.md](ARCHITEKTUR.md), Einrichtung und Wiederherstellung in [BETRIEB.md](BETRIEB.md). Private Testreports, Screenshots, Zugangsdaten und Sicherungen bleiben unter `.local` und werden nicht veröffentlicht.

Der bestehende DigitalMask-Checkout, seine Laufzeitkonfiguration, Daten und Deployments werden von dieser Umsetzung nicht verändert. Offene spätere Integrationen sind ausdrücklich vom freigegebenen Erstumfang getrennt.
