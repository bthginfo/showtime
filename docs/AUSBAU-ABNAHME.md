# Abnahme des Fachausbaus

Stand: 11. Oktober 2026. Dieser Nachtrag dokumentiert die Umsetzung der freigegebenen Lücken aus [ROLLEN-GEWERKE-TEST.md](ROLLEN-GEWERKE-TEST.md). Der ursprüngliche Bericht bleibt als Ausgangsbefund erhalten. Maßgeblich für den neuen Umfang sind [AUSBAU-ARBEITSPLAN.md](AUSBAU-ARBEITSPLAN.md) und die nachstehend tatsächlich ausgeführten Prüfungen.

## Umgesetzter Umfang

Die Plattform besitzt jetzt **21 Gewerke**, einschließlich eines eigenen Bereichs für Ausstattung/Bühnenbild. Gemeinsame Personen-, Figuren-, Szenen-, Geräte-, Raum-, Fachstands- und Dateireferenzen werden innerhalb des Theaters geprüft. Gemeinsame Szenen und Cues haben eigene Leserechte; daraus entsteht kein Zugriff auf private Maße, Teilnehmende, Personalangaben oder andere Fachstände.

Abstimmungen verwenden getrennte Rechte für Anlegen, Kommentieren, Anlagen, Antworten und Freigabe. Die reine KBB-Rolle kann diese Schritte ohne allgemeines Dokumentanlegerecht ausführen. Vier-Augen-Freigaben belegen den konkreten Inhalt samt referenzierten Fassungen und Dateiversionen. Jede relevante Änderung verlangt erneute Abnahme. Archiv, Abbruch, Wiederherstellung, Fassungsvergleich und Nachfolgestände sind nachvollziehbar; verbindliche Bestands- und Finanzbelege bleiben erhalten.

Mitarbeitende und Leitungen erhalten priorisierte Aufgaben, Dienste und offene Rückmeldungen. Gast- und Personalstartseiten verwenden ihre tatsächlichen Rechte. Die Intendanz sieht Berichtsabdeckung, Besucherentwicklung, Saison-/Zeitraumvergleich, Kostenprognose und geplante Personenstunden. Fehlende Daten bleiben erkennbar; geplante Stunden sind keine Lohnabrechnung.

Bestätigte Beschäftigtengruppenprofile prüfen Dienstdauer, Ruhezeit und aufeinanderfolgende Tage. Abwesenheit und eingeschränkte Verfügbarkeit wirken in der Theaterzeitzone. Neue Profile bleiben bis zur ausdrücklichen Bestätigung unwirksam. Sammelplanung bietet eine Vorschau und anschließend eine atomare Übernahme; Änderungen eines beteiligten Standes verhindern veraltete Übernahmen. Bereitschaft bezieht sich auf Produktion bzw. Vorstellung, Fachfassung, Abnahmen, offene Aufgaben und begründete Ausnahmen.

| Gewerk                 | Ergänzte Fachabläufe                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Disposition/KBB        | Sammel-/Serienplanung, Szenarien, verknüpfte Vorstellungen, Tournee-/Vertragsstände, Umbesetzungen mit Wirksamkeitsdatum |
| Regie                  | Szenenfassungen, Probenberichte, Änderungen und verteilte Folgeaufträge                                                  |
| Dramaturgie            | Text-/Redaktionsfassungen, Lektorat, Rechtefristen, Freigaben                                                            |
| Ensemble               | Tageszettel, Personen-/Figurenzuordnung, Aushilfen, verfügbare Zeitfenster                                               |
| Inspizienz             | Gemeinsamer Cue-Stand, Bestätigungen, Druck/Offline-Ausgabe, Vorfälle                                                    |
| Bühne                  | Anlagen, private Zeichnungen, Qualifikationen, Prüfungen und Ressourcensperren                                           |
| Licht                  | Gerätebezug, DMX-Adressbereiche/Konflikte, Fokuschecklisten, MVR/GDTF-Metadaten                                          |
| Ton                    | Personen-/Mikrofonbezug, Kanal-/Frequenzkonflikte, Ersatzgeräte und Routingfassung                                       |
| Video                  | Versionierte private Medien, Cue-/Dateibezug, technische Parameter und Rechte                                            |
| Werkstätten            | Stücklisten, Bestand/Bestellung, Kapazitäten, Arbeitsschritte und Übergabe                                               |
| Kostüm                 | Personen-/Figurenbezug, geschützte Maße, Anproben, Wechsel- und Pflegepläne                                              |
| Maske                  | Besetzungs-/Perückenbezug, Pflegefolgen und Aufgaben aus Umbesetzungen                                                   |
| Requisite              | Verbrauch, bestandsgesicherte Leihe, Rückgabe, Checks und Reparaturfolge                                                 |
| Chor/Orchester         | Gruppen/Personen, Dienste, Aushilfen, Qualifikationen und Notenstände                                                    |
| Ballett                | Studio-/Personenbezug, Raumeignung, Szenenvarianten und geschützte Verfügbarkeit                                         |
| Vorderhaus             | Briefings, Besetzung, Gruppenbedarf, Vorfälle und korrigierbare Berichte                                                 |
| Presse/Marketing       | Redaktion, Assets, verbindliche Abnahme, Rechte und Veröffentlichungsstände                                              |
| Theaterpädagogik       | Gruppenbuchung, Personal/Raum, Kapazität und begrenzte private Einwilligungsdaten                                        |
| Verwaltung             | Bestellungen, Lieferungen, Rechnungsbelege, Kostenstelle, Prognose und Austausch                                         |
| Haustechnik/IT         | Assets, Wartungsserien, Zuständigkeit, Eskalation und Sperren                                                            |
| Ausstattung/Bühnenbild | Entwürfe, Modell-/Bauprobe, Abgaben und formale Abstimmung mit Maske                                                     |

Fristen und überfällige Aufgaben erzeugen wiederholsichere Erinnerungen bzw. Eskalationen an aktuell berechtigte Personen. Pflege-, Prüf- und Wartungsfolgen bleiben mit dem Ursprungsstand verbunden. Eine zukünftige Umbesetzung ändert die aktuelle Besetzung erst zum Wirksamkeitsdatum; die Umsetzung prüft dann erneut die Berechtigung. Betroffene Gewerke erhalten referenzierte Folgeaufgaben.

## Offene Integration und Betrieb

Der öffentliche Vertrag steht unter `/api/v1/openapi.json`, Erläuterungen und CSV-Vorlagen unter `/schnittstellen`. Die Oberfläche bietet API-Zugänge, Feldzuordnung, Importvorschau, Zeilenfehler und kontrollierte Übernahme. Zugänge sind gehasht, befristet, widerrufbar und an Theater, Gewerk, Person und Scopes gebunden. Aktuelle Rollen gelten auch für Integrationen. Schreibvorgänge verlangen Wiederholschlüssel; abweichender Inhalt mit gleichem Schlüssel wird abgewiesen.

Es existieren neutrale Adapterprofile für Ticketing/Kasse, Finanzbelege, Lohnvorbereitung, Licht/CAD-Metadaten und Ton. CSV/JSON, iCalendar und begrenzte MVR/GDTF-Metadaten sind Austauschwege. Ohne festgelegtes Zielprodukt wird keine zertifizierte DATEV-/EVENTIM-Anbindung oder direkte CAD-/Konsolensteuerung behauptet. Recherche und konkrete Verträge: [OFFENE-SCHNITTSTELLEN.md](OFFENE-SCHNITTSTELLEN.md).

Private Medienanlagen erlauben wiederaufnehmbare Uploads bis 64 MB in 2-MB-Teilen mit Größen-, Quoten-, Rechte- und SHA-256-Prüfung. Die Betriebsübersicht zeigt Verbrauch, Queuezustand, Datenbankerreichbarkeit und Backup-/Restore-Belege. Dateiverbrauch ab 80 Prozent sowie fehlgeschlagene bzw. länger als 30 Minuten ausstehende Ereignisse erzeugen interne Betriebsalarme.

## Tatsächliche technische Prüfung

| Prüfung                              | Ergebnis                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Vollständige Unit-Suite              | **368 bestanden, 0 fehlgeschlagen**; 13 bewusst übersprungen, darunter die separat ausgeführten Datenbanktests                           |
| Echte Neon-Entwicklungsintegration   | **12/12 bestanden**, einschließlich FORCED RLS, zusammengesetzter Fremdschlüssel, Zukunftsbesetzung und Pagination über 5.001 Datensätze |
| Neue Ausbau-API-Suite                | **15/15 bestanden**, keine Auslassung und kein Wiederholungserfolg                                                                       |
| Bestehende Abstimmungs-/Planungs-API | **13/13 bestanden**, einschließlich Entzug aktueller Rechte und unveränderter Freigabebelege                                             |
| Svelte/TypeScript                    | **0 Fehler, 0 Warnungen**                                                                                                                |
| ESLint und Betriebsskripte           | Bestanden                                                                                                                                |
| Produktionsbuild                     | Bestanden, einschließlich Queue-Consumer und Export-Schriftdateien                                                                       |

Die neuen API-Szenarien verwenden echte Entwicklungsdatenbank und privaten Blob-Speicher. Sie prüfen Bestands-/Leihwirkungen, unveränderliche Belege, CSV-Vorschau ohne Seiteneffekt, Wiederholschutz, DMX-/Tonkonflikte, eingeschränkte gemeinsame Szenen, Pädagogik-Datenschutz/Kapazität, Lebenszyklus, bestätigte Dienstprofile, Sammelplanung, Bereitschaft, Dateifassung/Freigabe, wiederaufnehmbare private Uploads, Offline-Cues, API-Widerruf, Wartung, Pflege und wirksam werdende Umbesetzungen. Ein fremdes Theater und aktuelle entzogene Rechte wurden ausdrücklich abgewiesen.

Eine begrenzte Lastprobe mit **20 Abrufen bei vier gleichzeitigen Anfragen** bestand vollständig: Median 1.152 ms, P95 1.801 ms, Maximum 1.927 ms. Dies ist eine Entwicklungsstichprobe, keine Kapazitäts- oder SLA-Zusage. Die separate Drosselprüfung bestätigt 120 Anfragen pro Minute und 429 mit `Retry-After`; auch fachlich abgewiesene Aufrufe werden gezählt.

## Wiederherstellung

Ein synthetisches Theater mit 21 Gewerken, 171 Fachständen, Historien, Integrationsbelegen, Mitgliedschaften und drei Dateireferenzen wurde verschlüsselt gesichert und in ein neues Theater derselben Entwicklungsumgebung wiederhergestellt. Die zwei unterschiedlichen privaten Blob-Dateien wurden nach dem Kopieren tatsächlich heruntergeladen und per SHA-256 geprüft. Dateieltern und Fachreferenzen bleiben gültig; die Quelldaten bleiben unverändert.

Im wiederhergestellten Theater gibt es keine aktiven API-Schlüssel, ursprünglichen Wiederholschlüssel, wirksamen Freigaben, bestätigten Dienstprofile oder übernommenen Bereitschaftsfreigaben. Frühere Ausnahmen werden als historische Daten behalten und müssen neu bestätigt werden. Das geprüfte Testtheater wurde anschließend deaktiviert. Zwei aufeinanderfolgende Erinnerungsläufe erzeugten keine Doppelmeldungen; interne Betriebsalarme wurden ebenfalls wiederholsicher geprüft.

Der frühere vollständige Restoretest mit **15 nativen Yjs-Dokumenten** bleibt zusätzlich in [ABNAHME.md](ABNAHME.md) dokumentiert. Der neue synthetische Ausbau-Restore enthält keine nativen Yjs-Dokumente und wird nicht als erneute Yjs-Laufzeitprüfung ausgegeben. Wiederherstellungsgrenzen und Schlüsselverwaltung: [BETRIEB.md](BETRIEB.md).

## Browser und Gestaltung

Der DigitalMask-Gestaltungsstandard bleibt die Grundlage: Geist, vorhandene Farben, Flächen, Buttons, Formulare und Lucide-Symbole. Impeccable wurde für Bedienbarkeit, Zustände, Hierarchie und mobile Prüfung angewendet. Einführungen sind je Gewerk pausierbar; der Hilfebereich bietet rollenbezogene Übungen. Theaterbereich und Produktionsfilter bleiben nach Neuladen erhalten.

Die Abschlussprüfung verwendet Chromium mit **1.440 × 1.000** und **390 × 844** Pixeln. Geprüft wurden Fachdetails/Fassungsvergleich, echte private Anlagen mit gerenderter PDF-Seite und Seitentext, Einführungsfortschritt, Produktionsfilter, Vor-/Zurücknavigation, Abstimmungen und Theaterverwaltung. Im mobilen Detaildialog betrugen Inhalts- und Scrollbreite jeweils 341 Pixel innerhalb des 390-Pixel-Viewports; sichtbare Buttons hatten zugängliche Namen. Der PDF-Dialog hielt Seite und Inhalt bei 390 Pixeln. Die Verwaltung hielt ihre Inhalte innerhalb des Viewports; Theater- und Betriebsdatensuche begrenzten die 65 synthetischen Entwicklungstheater auf den passenden Treffer. Umfangreiche Diagnose-/Auditlisten sind geschlossen, bis sie gezielt geöffnet werden. In der Abschlussrunde entstanden keine neuen Browserfehler; frühere HMR-Meldungen während der Entwicklung sind nicht als Produktionsfehler ausgegeben.

Die Bildschirmfotos und technischen Einzelreports liegen privat unter `.local`; sie enthalten synthetische Testdaten. Eine pixelweise Gleichheit aller neuen Ansichten mit DigitalMask ist keine sinnvolle Abnahmebehauptung: Die ursprünglichen Referenzansichten bleiben in der bestehenden Vergleichsmatrix dokumentiert, während neue Fachfunktionen dem gleichen Standard folgen.

## Veröffentlichung und Live-Prüfung

Der Fachausbau wurde mit Anwendungscode `375b04ce7a3d4623f007ebba9be248b03c9a5890` auf `main` veröffentlicht. [GitHub CI](https://github.com/bthginfo/showtime/actions/runs/38146438436) bestand vollständig. Produktion `dpl_87c3FBR2rp5xtvPGH7x7U2KGyc3X` und geschützte Preview `dpl_8ALcbBjtJbA49xLDDBs3SHHjntXz` wurden aus demselben Commit erfolgreich gebaut. Der Produktionsalias ist [Showtime Ingolstadt](https://showtime-ingolstadt.vercel.app).

**19 Live-Prüfungen in Produktion** bestätigten Anmeldung, 21 aktive Gewerke, den Ausstattung-Demozugang mit geprüftem Modellstand, öffentlichen OpenAPI-Vertrag, persistenten nativen Dokumentstand, private Originaldatei, tatsächliche DOCX-/PDF-Exporte, verweigerten Zugriff aus einem anderen Theater, scoped API, Wiederholschutz, abgewiesenen geänderten Inhalt und Widerruf. Die echte Vercel-Queue erzeugte alle 21 Arbeitsräume einer neuen synthetischen Produktion; der Prüfer führte den Consumer nicht selbst aus. **Acht zusätzliche Prüfungen auf der geschützten Preview** bestätigten ihre getrennte Identität, OpenAPI, private Datei/Exporte, API-Widerruf und ebenfalls alle 21 echten Queue-Arbeitsräume. Deployment Protection blieb aktiv; der Test verwendete ein kurzlebiges Token des eigenen Vercel-Projekts.

Die synthetischen Testproduktionen und Dokumentkanäle wurden archiviert, die Testaufgabe abgeschlossen und alle Test-API-Zugänge widerrufen. Bestehende Geschäftsdaten wurden durch die Cloud-Prüfung nicht geändert. Eine neue verschlüsselte Produktionssicherung enthält 106 anhand ihres Inhalts geprüfte private Dateien.

Im tatsächlichen Live-Browser wurden Gastnavigation, Personalstart mit erreichbaren Teamzeiten und das Intendanz-Dashboard geprüft. Verwaltungs-/Schnittstellenreiter werden zusätzlich auf `tenant.configure` begrenzt, damit Gewerke und Intendanz dort keine unzugänglichen Hauptaktionen sehen. Der anschließende kleine UI-Nachtrag verändert keine Backend-, Datenbank- oder API-Verträge.

## Praktische Grenzen

Stadttheater Ingolstadt enthält die zusätzliche Produktion **DEMO · Fachabläufe 2026/27** mit **106 verknüpften Beispieleinträgen** in allen 21 Gewerken. Ein neuer Ausstattung-Zugang ergänzt die bestehenden Demo-Konten; bestehende Passwörter bleiben erhalten. Die private lokale Zugangsdatei enthält jetzt 32 Demo-Konten einschließlich des reinen Plattform-Demozugangs. Die neue verschlüsselte Produktionssicherung und deren Schlüssel bleiben außerhalb des Repositorys.

Der freigegebene Stand liegt auf `bthginfo/showtime` und dem getrennten Vercel-Projekt. Die ignorierten Releasebelege halten Deployment-ID und Commit fest; diese Datei enthält keine Secrets oder privaten API-Antworten.

Die implementierten Ausbaupunkte sind überprüfbar; **absolute Fehlerfreiheit oder „100 Prozent“ Theaterbetriebsabdeckung wird nicht zugesagt**. Tests mit realen Beschäftigten, physischen Touchgeräten und einem vollständigen Screenreader-Durchlauf sind eine organisatorische Abnahme. Tatsächliche Arbeits-/Tarifprofile müssen vom Theater bestätigt werden. Herstellerspezifische Verbindungen benötigen die später gewählten Produkte und deren Zugangsdaten. SaaS-Abrechnung war kein Teil dieser Fachausbauliste.

Es wurde kein zusätzlicher bezahlter Datenbanktarif gekauft. Datenbanken bleiben auf Neon Free; Blob-, Queue-, Function- und Datenverkehrsnutzung unterliegen dem vorhandenen Vercel-Pro-Konto. Kontingente und interne Alarme ersetzen keine Langzeitmessung der Anbieterabrechnung.
