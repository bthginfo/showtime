# Showtime: Kacheln und gezielte Aufgaben

Prüfstand: 12. Oktober 2026. Die zuvor kombinierte Werke-/Spielzeitenform mit Listen wurde in erkennbare Aufgaben und eigene Objektansichten aufgeteilt. Die Änderung folgt dem ausdrücklichen Wunsch nach einer einfacheren Oberfläche im bestehenden DigitalMask-Design. Die Nutzerreferenz `.impeccable/review/tiles-user-rejected.png` bleibt der Vergleich für die abgelehnte Anordnung.

## Was sich in der Bedienung geändert hat

Der Spielplan beginnt mit sieben Aufgaben: **Vorstellungen**, **Termine verschieben**, **Plan prüfen & veröffentlichen**, **Werke**, **Spielzeiten**, **Produktionsphasen** und **Vorstellungsserien**. Nach der Auswahl erscheinen die passenden Objekte und Aktionen. Formulare öffnen sich erst über eine bewusste Aktion; optionale Angaben und benötigte Zeitraumfilter sind aufklappbar. Eine Rückkehraktion führt zur Auswahl zurück.

| Bereich                          | Umsetzung und verfügbare Aktionen                                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Werke und Spielzeiten            | Eigene Kataloge mit Titel, Urheberangabe beziehungsweise Zeitraum; anlegen und einer Produktion zuordnen.                                                                              |
| Produktionsphasen                | Werk, Spielzeit und Phase zusammen erkennen und die bestehende Zuordnung ändern.                                                                                                       |
| Serien und Vorstellungen         | Serien anlegen; Vorstellungen anlegen und bearbeiten, einschließlich vorhandener Serien- und Pausenangaben. Serien erhalten keine unbelegte Bearbeitungsaktion.                        |
| Weitere Planung                  | Gemeinsames Verschieben und die bestehenden Schritte für Planentwurf, Prüfung und Veröffentlichung in getrennten Arbeitsbereichen.                                                     |
| Alle 22 Gewerke                  | Fachfunktionen als auswählbare Kacheln; die Auswahl trägt den Text „Geöffnet“ und ein Häkchen. Der Fokus geht zum Arbeitsstand; „Andere Funktion wählen“ führt zur Auswahlüberschrift. |
| Startseite, Ressourcen, Kontakte | Direkte Aufgabenlinks, eigener Ressourcen-/Reservierungsbereich und Kontaktkacheln mit tatsächlicher Detailnavigation.                                                                 |

Die gemeinsamen `WorkTiles` unterscheiden Links und Auswahlbuttons. Objektkacheln zeigen echte Daten und nur verfügbare Aktionen; eingeblendete Zahlen heißen ausdrücklich „angezeigt“. Vergleichstabellen, Kalender und zeitlich geordnete Kommunikation behalten ihre aufgabengerechte Darstellung. Kacheln bündeln jeweils ein Objekt oder eine Aufgabe, wie in [USWDS: Card](https://designsystem.digital.gov/components/card/) beschrieben. Ihre Grenzen bei vergleichendem Scannen berücksichtigt die [NN/g-Erläuterung zu Cards](https://www.nngroup.com/articles/cards-component/).

## Gestaltungs- und Verhaltensregeln

Die lokale Geist-Schrift, vorhandene helle und dunkle Tokens, Lucide-Symbole und gemeinsamen `Button`-, `Modal`-, `Empty`- und `ErrorMessage`-Komponenten bleiben die Grundlage. Die geprüften Kacheltitel verwenden 15px, Beschreibungen 13px und Status-/Zahlentext 12px; kompakte mobile Fachkacheltitel verwenden 14px. Der bestehende Radius beträgt 12px. Daraus entsteht kein zusätzliches Farbsystem pro Gewerk.

Objektgitter verwenden `auto-fill` mit einer Mindestbreite von 320px, begrenzt auf die verfügbare Breite. Einzelne Spielzeiten, Produktionsphasen und Kontakte bleiben dadurch kompakte Objekte. Lange Titel dürfen umbrechen; mobile Objektansichten stehen einspaltig. Bedienelemente besitzen 44px Touchflächen, sichtbaren Tastaturfokus und eine passende Fokus-Rückkehr. Die gemeinsame Kachelkomponente verwendet vorhandenes 160ms Farb-/Rahmenfeedback und berücksichtigt reduzierte Bewegung.

Fehler bleiben im offenen Formular und erhalten Eingaben. Beim tatsächlich ausgelösten Reservierungskonflikt ergänzt die Meldung die Ursache um „Wähle einen anderen Zeitraum oder eine andere Ressource.“ Die bestehenden Berechtigungen, Mandantengrenzen, optimistischen Versionen, Seitenladefunktionen, API-/Event-Verträge und Exportwege bleiben Grundlage der Aktionen.

Quellbelege: `src/components/work-tiles.svelte`, `src/shared/workspace-tiles.ts`, `src/modules/theater/schedule-workspace.svelte`, `resource-workspace.svelte`, `theater-module.svelte`, `theater-operations.css` sowie `src/modules/people/components/people.module.css`. Die vorhandenen typisierten Einstiegskomponenten binden die gemeinsamen Arbeitsbereiche ein.

## Tatsächlich geprüfte Abläufe

Die GUI-Prüfung verwendete einen bestehenden berechtigten Admin und ausschließlich synthetische Daten im eigenen DEV-Theater. Drei Werke, eine Spielzeit und eine Serie wurden gespeichert; Werk und Spielzeit wurden einer Produktion zugeordnet. Ein ungültiger Spielzeit-Zeitraum wurde nativ blockiert und anschließend korrigiert. Eine Vorstellung wurde angelegt, bearbeitet und erneut geladen; 100 Minuten, „Bestätigt“, Serie und 15 Minuten Pause blieben erhalten.

Eine Ressource mit Kapazität eins und eine Reservierung wurden angelegt. Die zweite Reservierung im selben Zeitraum löste einen echten serverseitigen HTTP-409-Konflikt aus; Beginn, Ende, Menge und Produktionszuordnung blieben erhalten. Die Freigabebestätigung wurde geöffnet und abgebrochen, eine endgültige Freigabe wurde in diesem GUI-Durchgang nicht ausgeführt. Ein Kontakt ohne Benutzerzugang wurde gespeichert und dessen Detailansicht geöffnet.

Die tatsächliche GUI-Auswahl wurde in allen 22 Gewerken geprüft. Dabei wurden 159 angebotene Fachkacheln gerendert und je Gewerk die letzte Fachkachel angeklickt: genau eine Auswahl aktiv, Fokus am passenden Arbeitsstand und bei 1280px kein horizontaler Seitenüberlauf. Die Detaildaten stehen in der lokal ignorierten `.local/ux-tiles-trades-confirm.json`. Dies belegt nicht die vollständige Prüfung aller 159 Formulare.

| Automatisierte Prüfung            | Belegter Stand                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Unit-Tests                        | 408 bestanden; 15 umgebungsgebundene Fälle im Unit-Lauf übersprungen.                                               |
| Echte DEV-Integration             | 14 bestanden, einschließlich nonowner-RLS, Mandantentrennung, Rechte, Outbox/Idempotenz und Reservierungskapazität. |
| Planung/Zusammenarbeit über API   | 13 API-only-Playwright-Abläufe bestanden, ohne übersprungene oder instabile Fälle.                                  |
| Typecheck, Lint, Skript-Typecheck | Letzter Quellstand erneut bestanden: Typecheck mit 0 Fehlern/0 Warnungen, Lint und Skript-Typecheck jeweils Exit 0. |
| Produktionsbuild                  | Zwei lokale Builds vor der letzten UI-Korrektur bestanden. Der CI-Build des finalen Commits ist noch offen.         |

Die unabhängige Schlussprüfung forderte drei Korrekturen: explizite fünf Vertragszusagen samt belegter Ausnahme vom FORM-Roll und eigener QUALITY-BAR-Karte, stabile Einzelobjektbreiten und einen konkreten nächsten Schritt beim Reservierungskonflikt. Diese wurden als ein Paket korrigiert und mit erneuerten nativen Aufnahmen bestätigt. Die anschließende eingegrenzte Bestätigung lautet `disposition: ship`, `remaining: clear` für diese drei Punkte. Sie ist keine Garantie für die gesamte Anwendung. Richtung, Kalibrierung und Prüfabläufe stehen lokal in `.local/ux-tiles-direction.md`, `.local/ux-tiles-quality-bar.md` und `.local/ux-tiles-evidence.md`; die Verfeinerung ersetzt den bestehenden Produkt- oder Designvertrag nicht.

## Native Bildbelege

Die folgenden Pfade sind relativ zum Repository. Die Aufnahmen liegen im ignorierten Verzeichnis `.impeccable/review/` und gehören nicht zum veröffentlichten Quellcode. Es sind unveränderte native Browseraufnahmen. Ältere Aufnahmen ohne `final` sind nur dort maßgeblich, wo sie unten ausdrücklich genannt sind.

| Aufnahme                                                                                               | Geprüfter Zustand                                                                        |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `.impeccable/review/tiles-user-rejected.png`                                                           | Vom Nutzer abgelehnte kombinierte Form-/Listenanordnung.                                 |
| `.impeccable/review/tiles-overview-1547-final.jpg`                                                     | Sieben unmittelbare Spielplanaufgaben ohne vorgelagerte Filter.                          |
| `.impeccable/review/tiles-works-1547-final.jpg`                                                        | Gespeicherte Werke, langer Titel und fehlende optionale Urheberangabe.                   |
| `.impeccable/review/tiles-works-390-dark.jpg`                                                          | Dunkle mobile Werkansicht mit Zuordnungsaktionen.                                        |
| `.impeccable/review/tiles-seasons-1547-final.jpg`                                                      | Kompakte einzelne Spielzeit mit Beginn, Ende und Zuordnung.                              |
| `.impeccable/review/tiles-phase-1547-final.jpg`                                                        | Kompakte persistierte Werk-/Spielzeitzuordnung und Phase.                                |
| `.impeccable/review/tiles-makeup-390-final.jpg`                                                        | Mobile Maske-Fachauswahl nach der Rückkehr; zur Auswahl gescrollt.                       |
| `.impeccable/review/tiles-performance-core-390-final.jpg`                                              | Aktualisierte Vorstellung und Fokus auf aktiviertem Datumsfeld.                          |
| `.impeccable/review/tiles-performance-edit-390-final.jpg`                                              | Geöffnete optionale Serien-/Pausenangaben; innerhalb des Formulars gescrollt.            |
| `.impeccable/review/tiles-resources-390-final.jpg`, `.impeccable/review/tiles-resources-768-final.jpg` | Native Auswahl Katalog/Reservierungen und gespeicherte Ressource.                        |
| `.impeccable/review/tiles-bookings-390-final.jpg`                                                      | Reservierung sichtbar, Zeitraumfilter zunächst geschlossen und separat bedient.          |
| `.impeccable/review/tiles-reservation-conflict-390.jpg`                                                | Nach Korrektur erneut ausgelöster Konflikt mit nächstem Schritt und erhaltenen Eingaben. |
| `.impeccable/review/tiles-contacts-1280-dark.jpg`                                                      | Nach Breitenkorrektur kompakte Kontaktkachel mit Detailnavigation.                       |

## Offene Prüfgrenzen

Die Aufnahmen und ausgewählten Abläufe decken 390, 768, 1280 und 1547px sowie helle und dunkle Darstellung ab; nicht jeder Zustand wurde in jeder Kombination geprüft. Eine Studie mit technisch unerfahrenen Menschen oder gemessene Usabilitywerte liegen nicht vor. Nicht alle Formulare und Beschäftigtenrollen wurden getestet; aus den erfolgreichen Prüfungen folgt keine vollständige Fehlerfreiheitsgarantie.

Beim Erstellen dieses Berichts sind der CI-Build des finalen Commits, 17 geplante Live-API-Prüfungen und die abschließende Produktions-GUI-Prüfung noch offen. Die Dokumentation beansprucht daher keine erfolgte Produktionsabnahme. Ungeprüfte Zustände und frühere, nicht betroffene Gestaltungsabweichungen werden nicht zu neuen Designregeln erklärt oder mit dieser Änderung als behoben ausgewiesen.
