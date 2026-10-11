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

Die im Fachtest ermittelten weiteren P1/P2/P3-Ausbaupunkte sind **offen** und im Bericht je Rolle und Gewerk beschrieben. Sie sind keine als erledigt gekennzeichneten Funktionen. Dazu gehören insbesondere durchgehende Fachreferenzen, formale Fachfreigaben, KBB-Abstimmungsrechte und rollenbezogene Startseiten.

## Spätere Erweiterungen außerhalb der Erstfreigabe

- Anbieterabhängige Schnittstellen für Ticketing, CAD, Buchhaltung, Lohn und Showtechnik.
- SaaS-Abrechnung und optional eigene Datenbanken für besonders abgeschottete Theater.
- Redis-Transport bei passendem kostenfreien oder ausdrücklich genehmigtem Tarif und höherer Live-Last.
- Große Medienarchive und Tournee-/Vertragsverwaltung.
- Übernommene Svelte-Kompatibilitätssyntax bei späteren Funktionsänderungen schrittweise modernisieren, mit Referenzvergleich der betroffenen Ansichten.
