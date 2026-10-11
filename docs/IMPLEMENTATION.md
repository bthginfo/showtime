# Showtime: Umsetzungsstand

Freigabe am 10. Oktober 2026. Ausgangspunkt: DigitalMask `daafd42`. Ziel: `bthginfo/showtime`, eigener SvelteKit-Code und eigenes Vercel-Projekt. Der vollständige Erstumfang steht in [APPROVED-PLAN.md](APPROVED-PLAN.md).

## Etappen

- [x] 0: Unabhängiges Repository und Ressourcen, private Quellreferenz, Auth-/RLS-/Blob-/Queue-Aufbau.
- [x] 1: Tenant-Plattform, scoped Rollen, Einladungen, RLS, transaktionale Outbox und idempotente Consumer.
- [x] 2: Aktive DigitalMask-Oberfläche nach Svelte portiert; direkte Referenzscreens, Kalender, Dokumente und Maskenfunktionen übernommen.
- [x] 3: Gemeinsame Produktionen, Besetzungen, Hausdisposition, Ressourcen, Planstände und hausweite Kommunikation.
- [x] 4: Zwanzig aktivierbare Gewerke mit typisierten Fachansichten, Bereitschaft, Abhängigkeiten und Budgetfreigaben.
- [x] 5: Abschließende Cloud-/Preview-Abnahme, vollständige Restoreprobe, gemessene Pagination und Veröffentlichung des geprüften GitHub-Stands.

Zusätzlich umgesetzt: Alle eigenen gebuchten Arbeitszeiten und Anwesenheiten können bearbeitet und gelöscht werden, einschließlich Timerbuchungen und Buchungen mit inzwischen entzogenem Produktionszugang. Veraltete Änderungen werden abgewiesen. Teamkorrekturen benötigen ausdrücklich die passende Rolle.

Nachtrag: Die 44 Svelte-Warnungen sind behoben. Überflüssige React-Props wurden entfernt, native Bedienelemente und delegierte Kontrollereignisse sauber getrennt, Dialogfokus und Tastaturbedienung geprüft und die Navigation an SvelteKits History-API angebunden. Das bestehende Layout bleibt erhalten.

Auch die übernommene React-Direktive und die Warnung zum großen Browser-Bundle sind bereinigt. Nur der Client-Build erhält zusätzliche Chunks; die Initialisierungsreihenfolge bleibt geschützt. Typprüfung, Lint, Unit-Tests, Browserabnahme der gebauten Anwendung und die veröffentlichte Produktion werden im Nachtrag erneut geprüft.

## Belege

Die separate Infrastruktur besteht aus Vercel-Projekt `showtime`, drei Neon-Free-Projekten und drei privaten Blob-Stores. Entwicklung, Preview und Produktion besitzen eigene Secrets und eingeschränkte Laufzeitrollen. Migrationen reichen bis `0019_massive_reavers`. Migrationsrechte und Verwaltungs-PATs sind aus den Deployments entfernt.

Die Abnahme ist in [ABNAHME.md](ABNAHME.md) dokumentiert. Architektur und verbindliche Rechte stehen in [ARCHITEKTUR.md](ARCHITEKTUR.md), Einrichtung und Wiederherstellung in [BETRIEB.md](BETRIEB.md). Private Testreports, Screenshots, Zugangsdaten und Sicherungen bleiben unter `.local` und werden nicht veröffentlicht.

Alle Etappen des freigegebenen Erstumfangs sind abgeschlossen. Der geprüfte Anwendungscode liegt auf `main`; GitHub CI und die getrennten Vercel-Builds sind bestanden. Die erste Cloud-Abnahme bezog sich auf `e5af8ee`; nach der Warnungsbereinigung wurden CI, Produktionsbuild und Live-Abnahme wiederholt. Das Vercel-Projekt ist mit `bthginfo/showtime` und Produktionsbranch `main` verbunden. Die Anwendung ist unter [Showtime](https://showtime-ingolstadt.vercel.app) erreichbar.

Der bestehende DigitalMask-Checkout, seine Laufzeitkonfiguration, Daten und Deployments werden von dieser Umsetzung nicht verändert. Offene spätere Integrationen sind ausdrücklich vom freigegebenen Erstumfang getrennt.

## Fachausbau vom 11. Oktober

Die nach dem Rollen-/Gewerktest freigegebenen Lücken sind implementiert: 21 Gewerke einschließlich Ausstattung, verknüpfte Fachobjekte, formale fassungsgebundene Abnahme, Lebenszyklus und Historien, Sammelplanung, bestätigungspflichtige Regelprofile, gemeinsame Szenen/Cues, Bestands-/Pflege-/Wartungswirkungen, zukünftige Umbesetzungen, Bereitschaft, Rollenstartseiten und Hilfeübungen. Offene API mit begrenzten widerrufbaren Zugängen, Importvorschau/Feldzuordnung, CSV/JSON, MVR/GDTF-Metadaten, private wiederaufnehmbare Medienuploads und Betriebsübersicht ergänzen die gemeinsame Plattform.

Stadttheater Ingolstadt besitzt zusätzlich die gekennzeichnete Produktion **DEMO · Fachabläufe 2026/27** mit 106 verknüpften Beispieleinträgen und einem eigenen Ausstattung-Demozugang. Bestehende Daten und Passwörter werden nicht geändert. Der neue Umfang, genaue Prüfergebnisse und Grenzen stehen in [AUSBAU-ABNAHME.md](AUSBAU-ABNAHME.md).
