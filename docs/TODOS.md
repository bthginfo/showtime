# Showtime: Aufgaben und spätere Erweiterungen

Der verbindliche Erstumfang und seine Umsetzung stehen in [APPROVED-PLAN.md](APPROVED-PLAN.md) und [IMPLEMENTATION.md](IMPLEMENTATION.md). Die früheren DigitalMask-Aufgabenlisten sind durch diesen Showtime-Stand ersetzt.

## Release-Abschluss

- [x] SvelteKit-Übernahme und bestehende Maskenfunktionen.
- [x] Tenant-Isolation, scoped Rechte, private Kommunikation und aktuelle Zugangsprüfung.
- [x] Theaterkern, Disposition, Räume, veröffentlichte Planstände und Bereitschaft.
- [x] Zwanzig modular konfigurierte Gewerke mit Fachansichten.
- [x] Bearbeiten und Löschen eigener Arbeits- und Anwesenheitsbuchungen.
- [x] Bewusste Supportweiterleitung und Plattformverwaltung für Theatersperren.
- [x] Getrennte Entwicklungs-, Vorschau- und Produktionsressourcen.
- [x] Finale Cloud-, Restore- und Paginationprüfung sowie GitHub-/Vercel-Veröffentlichung abgeschlossen.
- [x] Alle 44 Svelte-Warnungen behoben; Tastatur, Dialogfokus und SvelteKit-Navigation nachgeprüft.

## Erweiterung vom 11. Oktober

- [x] Theateranlage mit unmittelbarer eigener Zuordnung oder Einladung, überprüfbarem Einrichtungsstand und wiederholbarer Reparatur.
- [x] Eigenständige Plattformverwaltung mit Suche, Statusfilter, Details und mobiler Darstellung.
- [x] Stadttheater Ingolstadt mit getrennter DigitalMask-Kopie und 31 individuellen Demo-Zugängen.
- [x] Sicherer POST für Auth-Formulare auch ohne JavaScript; Bereinigung alter Login-Queryparameter.
- [x] Anfragen zwischen Gewerken mit privater Anlage, Feedback, Überarbeitung, Vier-Augen-Freigabe und aktuellem Rechteentzug.
- [x] Hausübersicht für die Intendanz und tatsächliche Besucher-/Kassenberichte des Vorderhauses.
- [x] Eigener Leitfaden und pausierbarer geführter Einstieg für alle zwanzig Gewerke.
- [x] DigitalMask-Gestaltungsstandard dokumentiert, mobile neue Arbeitsflächen im Browser geprüft.

## Fachtest nach Abschluss der Umsetzung

- [x] Rollen-/Gewerkprüfung begonnen, nachdem die offenen Umsetzungsaufgaben veröffentlicht waren; Ergebnisse in [ROLLEN-GEWERKE-TEST.md](ROLLEN-GEWERKE-TEST.md).
- [x] Kernfunktion in allen zwanzig Gewerken über die echte Entwicklungs-API angelegt, bearbeitet und gegen veraltete Änderungen geprüft.
- [x] Nichtverfügbarkeit an der lokalen Mitternachtsgrenze korrigiert, einschließlich exklusivem Dienstende.
- [x] Zusammenhängende Dienste für die Höchstdauer pro beteiligter Person zusammenführen; drei Fragmente und getrennte Personen durch echte API-Tests abgesichert.
- [x] Mobile Navigation verwendet die wirksamen Rollenrechte des Seitenmenüs.
- [x] Rückmeldung Maske → Kostüm über den echten Produktions-Queue-Consumer bestätigt.

Die anschließend freigegebenen P1/P2/P3-Ausbaupunkte sind umgesetzt. Fachreferenzen, formale Freigaben, KBB-Abstimmungsrechte, rollenbezogene Startseiten und der weitere Umfang sind in [AUSBAU-ABNAHME.md](AUSBAU-ABNAHME.md) mit passenden Prüfungen dokumentiert. [AUSBAU-ARBEITSPLAN.md](AUSBAU-ARBEITSPLAN.md) enthält die vollständige Umsetzungsliste.

## Spätere Erweiterungen außerhalb der Erstfreigabe

- Produktabhängige Anbindungen an noch nicht gewählte Hersteller. Offene API, CSV/JSON, iCalendar, MVR/GDTF-Metadaten und neutrale Adapterprofile sind implementiert.
- SaaS-Abrechnung und optional eigene Datenbanken für besonders abgeschottete Theater.
- Redis-Transport bei passendem kostenfreien oder ausdrücklich genehmigtem Tarif und höherer Live-Last.
- Medienarchive oberhalb der vorhandenen Quoten und 64-MB-Dateigrenze. Versionierte private Medien sowie Tournee-/Vertragsstände sind implementiert.
- Übernommene Svelte-Kompatibilitätssyntax bei späteren Funktionsänderungen schrittweise modernisieren, mit Referenzvergleich der betroffenen Ansichten.
