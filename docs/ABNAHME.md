# Showtime: Abnahme

Stand: 10. Oktober 2026. Alle Tests verwenden synthetische Showtime-Daten und neue Ressourcen. Die vorhandene DigitalMask-Installation dient nur als Quellreferenz.

## Automatisierte Prüfungen

| Prüfung                       | Ergebnis                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte-/TypeScript-Prüfung    | 0 Fehler und 0 Warnungen; alle 44 übernommenen Warnungen behoben                                                                                                      |
| ESLint und Betriebsskripte    | 0 Fehler                                                                                                                                                             |
| Normale Testsuite             | 316 bestanden; 11 bewusst ausstehende Tests: 10 echte DB-Tests nur mit Opt-in und eine bestehende Exportsonderprüfung                                                |
| Echte Entwicklungsintegration | 10 bestanden; nonowner/RLS, Poolreset, fremde IDs/FKs, Transaktionsrollback, beide Zeitarten, Rechteverlust, Ressourcen, Eventwiederholung und mehr als 5.000 Zeilen |
| Browser-/API-Abnahme          | Alle 15 Szenarien bestanden; keine übersprungenen oder instabilen Browsertests                                                                                       |
| Produktionsbuild              | Lokaler Build sowie Git-basierte Vercel-Builds für Produktion und Preview bestanden                                                                                  |
| GitHub CI                     | [Showtime checks](https://github.com/bthginfo/showtime/actions/workflows/ci.yml) bestanden                                                                           |

Die Browser-/API-Szenarien decken eigene/fremde Arbeitszeiten und Anwesenheit, echte UI-Korrektur und Löschung, private Gruppen, Blob-Dateien, Yjs-Änderungen, DOCX-Export, Tenant-IDOR, Raumkonflikte, kanonische Vorstellungen, Plan-Snapshots, Rechteentzug und ICS, Produktionsbereitschaft, Budgetgrenzen, mobile Bedienung, ablaufende Gäste sowie bewusste Supportweiterleitung und Theatersperren ab. Hinzu kommen persistente Text- und Tabellenbearbeitung in der Oberfläche, typisierte Fachvorgänge in allen 20 Gewerken und der Theaterkern mit Werk, Spielzeit, Vorstellungsserie und Zuordnungserhalt beim Phasenwechsel. Zwei weitere Szenarien prüfen Such- und Dokumentdialoge, Fokus-Rückgabe, Escape, mobile Menüs, Kalender-Scrollen, Browser-Zurück/Vorwärts, Tastatur- und Mausplatzierung von Maskenplanblöcken und Enter im eingebetteten Kontaktformular. Es tritt keine SvelteKit-History-Warnung auf.

Die Pagination-Prüfung las 5.001 synthetische Datensätze in 17 Seiten mit höchstens 300 Zeilen. Die größte Seite umfasste 127.005 Bytes; insgesamt wurden 2.116.904 Bytes in 1.805 ms übertragen. Das ist eine gemessene Entwicklungsprobe und keine Zusage für beliebige Produktionslast.

Die Build-Warnungen zur übernommenen React-Direktive und zum großen Browser-Bundle wurden ebenfalls behoben. Das Browser-Bundle wird unter Beibehaltung der Modulinitialisierung aufgeteilt; die größte JavaScript-Datei sank von rund 2.155 kB auf 162 kB. Der Server-Build behält seine bisherige Aufteilung. Zusätzlich wurden die benötigten Runtime-Peers installiert. Der lokale Vercel-Dateitracer nennt weiterhin optionale Sharp-Binaries anderer Betriebssysteme und optionale native WebSocket-Beschleuniger. Diese Hinweise wurden nicht unterdrückt und sind keine Svelte- oder Laufzeitfehler. Die gebaute Anwendung wurde separat gegen die Entwicklungsressourcen geprüft; für den lokalen HTTP-Preview war ausschließlich dessen Prozess als Entwicklungsumgebung gestartet.

## Oberflächenvergleich

Die originale React-Oberfläche wurde aus dem fixierten Quellcommit ausschließlich in einer privaten Showtime-Testkopie gestartet. Beide Frontends erhielten denselben eingefrorenen synthetischen Workspace. Es wurden keine DigitalMask-Zugangsdaten oder Datenbanken verwendet.

Direkte Referenzscreens bei 1440 × 1000 Pixeln im dunklen Modus vergleichen Heute, Produktionen, Kalender, Chat, Hilfe, Aufgaben, Zeiten, Ensemble, Dokumentation, Fundus, Übergaben, Export und Einstellungen. Die vermessenen Hauptflächen teilen Position, Breite, Schriften und Überschriftengröße. Zusätzlich wurden fünf Kernansichten bei 390 Pixeln und der helle Modus auf Laufzeitfehler und horizontalen Überlauf geprüft.

Showtime ergänzt Theater-/Gewerkwechsel, Theaterbetrieb und rechtsabhängige Navigation. Diese Ergänzungen unterscheiden sich bewusst von der ursprünglichen App. Die Referenzmatrix belegt die überprüften Zustände; sie ist keine Behauptung einer pixelweisen Prüfung sämtlicher Dialoge und Datenkombinationen. Die erhaltenen CSS-Dateien und Fachansichten ermöglichen weitere Vergleiche bei späteren Änderungen.

Nach der Warnungsbereinigung ergab der erneute Vergleich mit den vorherigen Showtime-Screens in zwölf Ansichten exakt null abweichende Pixel. Die Einstellungsseite erhielt inzwischen zusätzliche synthetische Testmitglieder und wurde dadurch länger; sie zählt deshalb nicht als pixelgleicher Gesamtscreen. Mobile Menüs, Dokumentdialog und Maskenplan wurden zusätzlich aufgenommen und visuell geprüft.

## Wiederherstellung und Betrieb

Eine vollständige verschlüsselte Entwicklungs-Tenantsicherung mit Fachhistorien, Mitgliedschaften, Grants, Produktionen, Planständen, Yjs-Daten, Supportfällen und 15 privaten Dateien wurde in ein neues Theater zurückgespielt. Counts und Datei-SHA-256 sowie die identischen Zustände von 15 Dokumenten, 15 Puffern und 13 Updates wurden geprüft. Werk, Spielzeit, Vorstellungsserie und ihre neu vergebenen Referenzen wurden ebenfalls verifiziert. Bestehende Theater wurden nicht überschrieben.

Die erste Cloud-Abnahme auf [Produktion](https://showtime-bthginfo.vercel.app) und [geschützter Preview](https://showtime-5nq0nrbuf-juliusvingelheim-2692s-projects.vercel.app) hat Anmeldung, Workspace, privaten Dateidownload, persistente Dokumentänderung, DOCX/PDF-Ausgabe, zwanzig durch die echte Queue erzeugte Gewerk-Arbeitsräume und eine echte Browseransicht bestanden. Diese Abnahme bezog sich auf den veröffentlichten Anwendungscode `e5af8ee`. Nach der Warnungsbereinigung wurden Cloud-Ablauf und Dialogfokus auf der neuen Produktion erneut geprüft.

Entwicklung, Preview und Produktion besitzen drei unterschiedliche Datenbankhosts, Blob-Tokens und Authsecrets. Ein Versuch mit den Zugangsdaten der jeweils anderen Cloudumgebung wurde mit 401 abgewiesen. Eigene private Dateien waren erreichbar, Dateien der anderen Umgebung wurden mit 404 abgewiesen. Die für die Cloud-Abnahme erzeugten Produktionen, Facharbeitsräume und Hauskanäle wurden anschließend gezielt entfernt. Das Starttheater enthält keine übernommenen DigitalMask-Daten.

Der Produktionsalias wurde anschließend auf [Showtime Ingolstadt](https://showtime-ingolstadt.vercel.app) umgestellt. Die Produktions-URLs für Authentifizierung und erzeugte Links wurden angepasst. HTTPS, Anmeldung, Workspace und die Weiterleitung der bisherigen Adresse wurden unter dem neuen Alias erneut geprüft.

## Grenzen des Erstumfangs

Die zwanzig Gewerke erhalten die im freigegebenen Plan beschriebenen Fachansichten und gemeinsame Dienste. CAD, direkte Licht-/Tonsteuerung, Ticketing, Lohn- und Finanzbuchhaltung, große Medienarchive und SaaS-Abrechnung gehören zu den späteren Integrationen. Es gibt keinen automatischen Altdatenimport.

Ein Test mit synthetischen Daten ersetzt keine Bewertung der tatsächlich geltenden Arbeits- und Tarifregeln oder eine Langzeitmessung des kostenfreien Kontingents. Die Tastatur- und Mausprüfung lief in Chromium mit emulierten Viewports; physische Touchgeräte und ein vollständiger Screenreader-Durchlauf waren nicht Bestandteil dieses Nachtrags.
