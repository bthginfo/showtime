# Showtime: Abnahme

Stand: 10. Oktober 2026. Alle Tests verwenden synthetische Showtime-Daten und neue Ressourcen. Die vorhandene DigitalMask-Installation dient nur als Quellreferenz.

## Automatisierte Prüfungen

| Prüfung                       | Ergebnis                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte-/TypeScript-Prüfung    | 0 Fehler; 44 übernommene Accessibility-/Kompatibilitätswarnungen in 25 Dateien                                                                                       |
| ESLint und Betriebsskripte    | 0 Fehler                                                                                                                                                             |
| Normale Testsuite             | 315 bestanden; 11 bewusst ausstehende Tests: 10 echte DB-Tests nur mit Opt-in und eine bestehende Exportsonderprüfung                                                |
| Echte Entwicklungsintegration | 10 bestanden; nonowner/RLS, Poolreset, fremde IDs/FKs, Transaktionsrollback, beide Zeitarten, Rechteverlust, Ressourcen, Eventwiederholung und mehr als 5.000 Zeilen |
| Browser-/API-Abnahme          | Alle 13 Szenarien bestanden; keine übersprungenen oder instabilen Browsertests                                                                                       |
| Produktionsbuild              | Lokaler Build sowie Git-basierte Vercel-Builds für Produktion und Preview bestanden                                                                                  |
| GitHub CI                     | [Showtime checks](https://github.com/bthginfo/showtime/actions/runs/38069481826) bestanden                                                                           |

Die 13 Browser-/API-Szenarien decken eigene/fremde Arbeitszeiten und Anwesenheit, echte UI-Korrektur und Löschung, private Gruppen, Blob-Dateien, Yjs-Änderungen, DOCX-Export, Tenant-IDOR, Raumkonflikte, kanonische Vorstellungen, Plan-Snapshots, Rechteentzug und ICS, Produktionsbereitschaft, Budgetgrenzen, mobile Bedienung, ablaufende Gäste sowie bewusste Supportweiterleitung und Theatersperren ab. Hinzu kommen persistente Text- und Tabellenbearbeitung in der Oberfläche, typisierte Fachvorgänge in allen 20 Gewerken und der Theaterkern mit Werk, Spielzeit, Vorstellungsserie und Zuordnungserhalt beim Phasenwechsel.

Die Pagination-Prüfung las 5.001 synthetische Datensätze in 17 Seiten mit höchstens 300 Zeilen. Die größte Seite umfasste 127.005 Bytes; insgesamt wurden 2.116.904 Bytes in 1.805 ms übertragen. Das ist eine gemessene Entwicklungsprobe und keine Zusage für beliebige Produktionslast.

## Oberflächenvergleich

Die originale React-Oberfläche wurde aus dem fixierten Quellcommit ausschließlich in einer privaten Showtime-Testkopie gestartet. Beide Frontends erhielten denselben eingefrorenen synthetischen Workspace. Es wurden keine DigitalMask-Zugangsdaten oder Datenbanken verwendet.

Direkte Referenzscreens bei 1440 × 1000 Pixeln im dunklen Modus vergleichen Heute, Produktionen, Kalender, Chat, Hilfe, Aufgaben, Zeiten, Ensemble, Dokumentation, Fundus, Übergaben, Export und Einstellungen. Die vermessenen Hauptflächen teilen Position, Breite, Schriften und Überschriftengröße. Zusätzlich wurden fünf Kernansichten bei 390 Pixeln und der helle Modus auf Laufzeitfehler und horizontalen Überlauf geprüft.

Showtime ergänzt Theater-/Gewerkwechsel, Theaterbetrieb und rechtsabhängige Navigation. Diese Ergänzungen unterscheiden sich bewusst von der ursprünglichen App. Die Referenzmatrix belegt die überprüften Zustände; sie ist keine Behauptung einer pixelweisen Prüfung sämtlicher Dialoge und Datenkombinationen. Die erhaltenen CSS-Dateien und Fachansichten ermöglichen weitere Vergleiche bei späteren Änderungen.

## Wiederherstellung und Betrieb

Eine vollständige verschlüsselte Entwicklungs-Tenantsicherung mit Fachhistorien, Mitgliedschaften, Grants, Produktionen, Planständen, Yjs-Daten, Supportfällen und 15 privaten Dateien wurde in ein neues Theater zurückgespielt. Counts und Datei-SHA-256 sowie die identischen Zustände von 15 Dokumenten, 15 Puffern und 13 Updates wurden geprüft. Werk, Spielzeit, Vorstellungsserie und ihre neu vergebenen Referenzen wurden ebenfalls verifiziert. Bestehende Theater wurden nicht überschrieben.

Cloud-Smokeprüfungen auf [Produktion](https://showtime-bthginfo.vercel.app) und [geschützter Preview](https://showtime-5nq0nrbuf-juliusvingelheim-2692s-projects.vercel.app) haben Anmeldung, Workspace, privaten Dateidownload, persistente Dokumentänderung, DOCX/PDF-Ausgabe, zwanzig durch die echte Queue erzeugte Gewerk-Arbeitsräume und eine echte Browseransicht bestanden. Beide Builds stammen direkt aus dem veröffentlichten Anwendungscode `e5af8ee`; die abschließende Dokumentation ändert diesen Code nicht.

Entwicklung, Preview und Produktion besitzen drei unterschiedliche Datenbankhosts, Blob-Tokens und Authsecrets. Ein Versuch mit den Zugangsdaten der jeweils anderen Cloudumgebung wurde mit 401 abgewiesen. Eigene private Dateien waren erreichbar, Dateien der anderen Umgebung wurden mit 404 abgewiesen. Die für die Cloud-Abnahme erzeugten Produktionen, Facharbeitsräume und Hauskanäle wurden anschließend gezielt entfernt. Das Starttheater enthält keine übernommenen DigitalMask-Daten.

## Grenzen des Erstumfangs

Die zwanzig Gewerke erhalten die im freigegebenen Plan beschriebenen Fachansichten und gemeinsame Dienste. CAD, direkte Licht-/Tonsteuerung, Ticketing, Lohn- und Finanzbuchhaltung, große Medienarchive und SaaS-Abrechnung gehören zu den späteren Integrationen. Es gibt keinen automatischen Altdatenimport.

Die 44 Svelte-Warnungen betreffen überwiegend übernommene Fokus-/Dialogmuster und noch nicht modernisierte Svelte-Kompatibilitätssyntax. Sie sind dokumentiert; „0 Fehler“ bedeutet hier nicht „0 Warnungen“. Ein Test mit synthetischen Daten ersetzt keine Bewertung der tatsächlich geltenden Arbeits- und Tarifregeln oder eine Langzeitmessung des kostenfreien Kontingents.
