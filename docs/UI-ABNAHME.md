# UI-Abnahme: Dashboard und gemeinsame Arbeitsflächen

Stand: 11. Oktober 2026. Dokumentiert sind die freigegebenen UI-Verfeinerungen im bestehenden DigitalMask/Showtime-System. `DESIGN.md` bleibt die verbindliche Gestaltungsquelle; Backend-, Mandanten- und Zugriffslogik wurden in diesem Umfang nicht geändert.

## Umgesetzte Änderungen

- Die Intendanz/Hausübersicht führt von offenen Abstimmungen über Publikum und Budget zu Bereitschaft, Arbeitslast und Produktionen. Die Aufmerksamkeitsleiste verlinkt konkrete nächste Schritte.
- Das Monatsdiagramm schaltet zwischen Besuchern, Einnahmen und Auslastung. Beschriftete Achsen, Berichtsabdeckung und eine aufklappbare Wertetabelle machen die Daten nachvollziehbar. Ein einzelner Monat wird ausdrücklich als einzelner Beobachtungspunkt erklärt; fehlende Berichte bleiben fehlend. Einnahmenwerte in Diagrammbeschriftungen, zugänglichen Titeln und Tabelle behalten zwei Nachkommastellen. Der Fall 1.337 Cent → 13,37 € ist durch einen Unit-Test belegt.
- Budget und voraussichtliche Bindung verwenden beschriftete Balken. Bereitschaft unterscheidet bestätigte, offene und noch unkonfigurierte Anforderungen. Produktionszeilen lassen sich suchen und nach Bereitschaft filtern und öffnen die zugehörige Produktion.
- Gemeinsame Theaterstile werden im Root-Layout geladen. Panels besitzen 24 px Innenabstand am Desktop und 18 px mobil; Fließtext in Rollenstartseiten, Tagesprioritäten und Fachstand-Snapshots hat eigene Innenabstände. Mobile Filter nutzen die volle Breite, Formulare reihen ihre Felder untereinander, breite Tabellen scrollen im eigenen Container. Die mobile Dialogfußzeile hält „Abbrechen“ und „Speichern“ beim Scrollen sichtbar. Fachstand-Snapshots verwenden die gemeinsame Anzeige für deutsche Datumswerte und verständliche Referenznamen.

## Abgleich mit der bestehenden Gestaltung

`DESIGN.md` und die lokale Richtung `.local/ui-dashboard-direction.md` wurden mit `globals.css`, den beiden Theaterstylesheets, den gemeinsamen Dialogstilen sowie Diagramm- und Fachstandanzeige verglichen. Geist, die vorhandenen Hell-/Dunkel-Tokens für Flächen, Text, Grünakzent und Rahmen, der bestehende Kartenradius (12 px), Lucide-Symbole und die gemeinsame Navigation bleiben erkennbar. Status und fehlende Werte besitzen Text zusätzlich zur Farbe.

Die Dokumentationsstichprobe sichtete die aktuellen Aufnahmen `dashboard-desktop-final.jpg`, `dashboard-desktop-dark.jpg`, `dashboard-revenue-mobile-final.jpg`, `trade-card-mobile-final.jpg` und `trade-dialog-mobile.jpg`. Geprüft wurden Hierarchie, Flächen, Typografie, Rahmen, Innenabstände, Umbruch und die Einbindung in die vorhandene Navigation. Das Ergebnis stimmt im geprüften Umfang mit dem bestehenden System überein. Der unabhängige Finish-Review akzeptierte die Designausrichtung der ursprünglichen 13 Aufnahmen; seine anschließende Freigabe bezog sich ausschließlich auf die korrigierte Centdarstellung. Der einmalige Designdetektor lieferte `[]`.

Vorhandene Dokumentationslücken: `PRODUCT.md` und `.impeccable/design.json` fehlen, `DESIGN.md` besitzt keine maschinenlesbare Token-Frontmatter. Diese Baseline-Lücken werden hier festgehalten und innerhalb der freigegebenen Verfeinerung weder repariert noch als neue Gestaltungsregeln übernommen. `DESIGN.md` und vorhandene `.impeccable`-Dateien bleiben unangetastet.

## Tatsächlicher Prüfumfang

Alle Browserbelege verwenden synthetische Showtime-Entwicklungsdaten. Die Viewports waren 1280 × 900 (Desktop), 390 × 844 (mobil) und 1634 × 1000 (gelieferte Nutzergröße); Messwerte ohne vertikale Scrollleiste betragen teilweise 1265 beziehungsweise 375 px.

| Prüfung                       | Belegtes Ergebnis                                                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gewerke am Desktop            | 21 vorhandene Entwicklungsarbeitsbereiche, 157 Formularvarianten geöffnet und abgebrochen; keine überbreiten Felder oder Dialoge, keine Speicherung.                                                                          |
| Gemeinsame mobile Oberflächen | Ressourcen, Spielplan, Bereitschaft, Integrationen, Zugänge und Zusammenarbeitsdetail stichprobenweise geprüft.                                                                                                               |
| Bestehende Funktionen         | Zeit buchen, Kommunikation, Kalender, Produktionen, Fundus und Hilfe am Desktop und mobil auf Seitengeometrie geprüft; keine vollständige Funktionsabnahme dieser Module.                                                     |
| Spielplantabelle mobil        | Ursprüngliche Seitenbreite 428 statt 375 px korrigiert. Abschließend 375 px Seitenbreite; 540 px Tabelle innerhalb eines 309 px Scrollcontainers. Drei echte ArrowRight-Tastendrücke bewegten den Container von 0 auf 115 px. |
| Mobile Dialoge                | Ressource mit 6 Feldern, Vorstellung mit 30 Feldern und Probe mit 34 Feldern passen in den Dialog; Abbrechen geprüft.                                                                                                         |
| Dashboard-Bedienung           | Zeitraumvorgaben und benutzerdefinierter Zeitraum, Fehler mit Erhalt vorheriger Daten, Kennzahlenwechsel, Wertetabelle, Bereitschaftsfilter, leerer Suchtreffer und Produktionsnavigation geprüft.                            |
| Finale lokale Technikprüfung  | Typecheck: 0 Fehler, 0 Warnungen. Lint: Exit 0. Unit-Tests: 395 bestanden, 0 fehlgeschlagen, 13 durch Umgebungsvoraussetzungen gesperrt. Produktionsbuild: Exit 0. `git diff --check`: sauber.                                |

Lokale Prüfberichte: `.local/ui-trade-checks.json`, `.local/ui-common-checks.json`, `.local/ui-dashboard-unit.json` und `.local/ui-dashboard-design-detect.json`. Bildbelege einschließlich der aktuellen Einnahmenaufnahmen liegen unter `.impeccable/review/`; Berichte und Bilder sind ignorierte lokale Artefakte und werden nicht mit diesem Dokument versioniert.

Die Abnahme gilt für die genannten Änderungen und Stichproben. Sie belegt weder pixelgenaue Gleichheit mit DigitalMask noch alle Rollen, Datenstände und Kombinationen. Reale Rechte, Mandantentrennung, private Dateiablage sowie Veröffentlichung und Cloud-Smoke sind durch diesen UI-Durchlauf nicht abgenommen; die 13 gesperrten Tests bleiben ausdrücklich offen.
