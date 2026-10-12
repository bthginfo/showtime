# Showtime: Kacheln und gezielte Aufgaben

Prüfstand: 12. Oktober 2026. Die zuvor kombinierte Werke-/Spielzeitenform mit Listen wurde in erkennbare Aufgaben und eigene Objektansichten aufgeteilt. Die Änderung folgt dem ausdrücklichen Wunsch nach einer einfacheren Oberfläche im bestehenden DigitalMask-Design. Die Nutzerreferenz `.impeccable/review/tiles-user-rejected.png` bleibt der Vergleich für die abgelehnte Anordnung.

Die Kachelimplementierung ist mit Commit `ad0ed9c1e24ef2e61e0e6c6296c0782386732c2f` veröffentlicht und anhand der unten genannten CI-, API- und GUI-Belege abgenommen. Eine anschließend entdeckte mobile Silbentrennung ist zusätzlich in DEV geprüft; diese Nachkorrektur gehört noch nicht zu dieser Produktionsabnahme.

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

| Automatisierte Prüfung            | Belegter Stand                                                                                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit-Tests                        | 408 bestanden; 15 umgebungsgebundene Fälle im Unit-Lauf übersprungen.                                                                                                                                                   |
| Echte DEV-Integration             | 14 bestanden, einschließlich nonowner-RLS, Mandantentrennung, Rechte, Outbox/Idempotenz und Reservierungskapazität.                                                                                                     |
| Planung/Zusammenarbeit über API   | 13 API-only-Playwright-Abläufe bestanden, ohne übersprungene oder instabile Fälle.                                                                                                                                      |
| Typecheck, Lint, Skript-Typecheck | Für `ad0ed9c` jeweils Exit 0; Svelte-Typeprüfung mit 0 Fehlern und 0 Warnungen.                                                                                                                                         |
| Produktionsbuild                  | Zwei frühere lokale Builds bestanden; anschließend [CI für `ad0ed9c`](https://github.com/bthginfo/showtime/actions/runs/38226735535) vollständig erfolgreich, einschließlich des Builds dieses Implementierungscommits. |
| Produktions-API                   | 17 von 17 Prüfungen erfolgreich, explizit gegen `ad0ed9c`; `.local/ux-cloud-api-evidence.json` enthält SHA, Umgebung `production` und `success: true`.                                                                  |
| HTTPS-Assets                      | Fünf HTTPS-Assetprüfungen einschließlich TLS erfolgreich; Exit 0.                                                                                                                                                       |

Die unabhängige Schlussprüfung forderte drei Korrekturen: explizite fünf Vertragszusagen samt belegter Ausnahme vom FORM-Roll und eigener QUALITY-BAR-Karte, stabile Einzelobjektbreiten und einen konkreten nächsten Schritt beim Reservierungskonflikt. Diese wurden als ein Paket korrigiert und mit erneuerten nativen Aufnahmen bestätigt. Die anschließende eingegrenzte Bestätigung lautet `disposition: ship`, `remaining: clear` für diese drei Punkte. Sie ist keine Garantie für die gesamte Anwendung. Richtung, Kalibrierung und Prüfabläufe stehen lokal in `.local/ux-tiles-direction.md`, `.local/ux-tiles-quality-bar.md` und `.local/ux-tiles-evidence.md`; die Verfeinerung ersetzt den bestehenden Produkt- oder Designvertrag nicht.

## Produktionsabnahme und anschließende QA-Korrektur

Die Vercel-Bereitstellung von `ad0ed9c` erreichte `READY`. Die Zuordnung des korrekten Showtime-Projekts und des Alias [showtime-ingolstadt.vercel.app](https://showtime-ingolstadt.vercel.app) zu dieser Version wurde per CLI geprüft. CI, 17 Produktions-API-Prüfungen und fünf HTTPS-Assetprüfungen sind damit abgeschlossene Belege für diesen Commit. Die zuvor bestandenen 14 DEV-Integrations- und 13 API-only-Planungs-/Zusammenarbeitsprüfungen wurden nicht erneut ausgeführt; die Backend-Verträge sind unverändert.

Auf der tatsächlichen Produktionsoberfläche wurden die neuen Dashboard-Schnelleinstiege, sieben Spielplanaufgaben, drei vorhandene DEMO-Werkkarten und eine kompakte Spielzeit geprüft. Der Zuordnungsdialog wurde geöffnet und abgebrochen. Die Spielzeit blieb bei 1547px und 390px ohne horizontalen Seitenüberlauf lesbar. In Disposition wurde „Gastspiel / Tournee“ gewählt: genau eine Auswahl aktiv, Fokus an der passenden Überschrift und anschließend Rückkehr zur Auswahlüberschrift. Diese GUI-Abnahme verwendete vorhandene Daten und beschränkte Formularaktionen auf Öffnen und Abbrechen.

Danach fiel auf dem mobilen Gerät der Wortumbruch „Produktionsmeilenst/ein“ auf. Die einzige anschließende Quellcodekorrektur ergänzt `hyphens: auto` für Kacheltitel in der gemeinsamen `WorkTiles`-Komponente; `lang="de"` bestand bereits. Eine neue native DEV-QA-Aufnahme zeigt „Produktionsmeilen-/stein“ in einer Touchfläche von 167,5 × 96,1875px. Daten und Beschriftungen bleiben gleich. Die unabhängige Bestätigung dieser einzelnen Lesbarkeitskorrektur lautet erneut `disposition: ship`, `remaining: clear`.

Der Bericht und diese CSS-Nachkorrektur werden gemeinsam in einem Folgecommit veröffentlicht. Die CI- und Live-Belege für `ad0ed9c` werden deshalb nicht als Produktionsnachweis der späteren Silbentrennung ausgegeben.

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
| `.impeccable/review/tiles-live-overview-1547.jpg`                                                      | Produktionsversion `ad0ed9c`: sieben Spielplanaufgaben.                                  |
| `.impeccable/review/tiles-live-works-1547.jpg`                                                         | Produktionsversion `ad0ed9c`: drei vorhandene DEMO-Werkkarten.                           |
| `.impeccable/review/tiles-live-season-1547.jpg`                                                        | Produktionsversion `ad0ed9c`: kompakte einzelne Spielzeit am Desktop.                    |
| `.impeccable/review/tiles-live-season-390.jpg`                                                         | Produktionsversion `ad0ed9c`: mobile Spielzeit ohne horizontalen Seitenüberlauf.         |
| `.impeccable/review/tiles-live-trade-before-hyphen-390.jpg`                                            | Archivierter Produktionszustand vor der nachgelagerten Silbentrennungskorrektur.         |
| `.impeccable/review/tiles-hyphen-dev-390.jpg`                                                          | Ausschließlich DEV-QA: korrekt getrenntes langes Kachelwort nach der CSS-Nachkorrektur.  |

## Prüfgrenzen

Die Aufnahmen und ausgewählten Abläufe decken 390, 768, 1280 und 1547px sowie helle und dunkle Darstellung ab; nicht jeder Zustand wurde in jeder Kombination geprüft. Eine Studie mit technisch unerfahrenen Menschen oder gemessene Usabilitywerte liegen nicht vor. Nicht alle Formulare und Beschäftigtenrollen wurden getestet; aus den erfolgreichen Prüfungen folgt keine vollständige Fehlerfreiheitsgarantie.

Die Implementierungsabnahme von `ad0ed9c` ist mit den dokumentierten Prüfungen abgeschlossen. Für die nachfolgende Silbentrennung liegen DEV-QA und die eingegrenzte unabhängige Bestätigung vor; ihre Veröffentlichung folgt mit diesem Bericht. Ungeprüfte Zustände und frühere, nicht betroffene Gestaltungsabweichungen werden nicht zu neuen Designregeln erklärt oder mit dieser Änderung als behoben ausgewiesen.
