# Zeitkonto: flexible Wochen und Prüfnachweise

Stand: 12.10.2026. Dieser Bericht beschreibt das verbindliche Wochenmodell und ersetzt vollständig den Tages-Soll-Zwischenentwurf. Die früheren `time-credit`-Prüfungen belegen dieses Modell nicht. Geist, bestehende helle und dunkle Tokens, Lucide und gemeinsame native Bedienelemente bleiben erhalten. Die Anwendungsrevision d1d0443 ist veröffentlicht; ihre konkreten CI-, Deployment- und Produktionsnachweise stehen unten.

## Wochenrechnung

**Wochensaldo = gespeicherte Anwesenheit nach Pausen + persönliche Tagesgutschriften − Wochensoll.** Stunden sind von Montag bis Sonntag frei einteilbar; es gibt keine Tagesquote. Gespeicherte alte `workingDays` begrenzen weder Anwesenheit noch Gutschriften. Produktionsstunden bleiben separat. Buchungen benötigen keine wöchentliche Einreichung oder Freigabe.

| Ansicht          | Berechnung                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gesamt           | Summe ausschließlich abgeschlossener Wochen plus Startsaldo. Die laufende Woche verändert diesen Gesamtstand noch nicht.                                                                                        |
| Laufende Woche   | Volles Wochenziel, bereits erfüllt durch Anwesenheit und Gutschriften, daneben „Noch offen“ (mindestens 0). Ein angezeigter Saldo ist vorläufig; offene Stunden erscheinen nicht als alarmierende Minusstunden. |
| Monat            | Ganze Montag–Sonntag-Wochen, deren Montag im gewählten Monat liegt, einschließlich ihrer Tage im Folgemonat. Künftige Wochen werden noch nicht ausgewertet; eine enthaltene laufende Woche ist vorläufig.       |
| Eigener Zeitraum | Beide Grenzen werden auf vollständige Montag–Sonntag-Wochen erweitert. Woche, Monat und eigener Zeitraum enthalten keinen Startsaldo.                                                                           |

Historische Wochenstunden gelten ab ihrem jeweiligen Änderungsdatum. Beginnt das Konto mitten in einer Woche oder ändert sich der Satz, wird das Wochenziel aus den betreffenden Kalendertagen anteilig mit **jeweiligen Wochenstunden ÷ 7** gebildet. Dies ist eine Übergangsgewichtung, keine Tagesquote. Tage vor dem Kontobeginn werden nicht belastet.

Heute gespeicherte Anwesenheit zählt vollständig nach Pausen, auch wenn ihre Endzeit später am heutigen Tag liegt. Mitternacht wird nach lokalen Kalendertagen der Theaterzeitzone aufgeteilt. Zukünftige Tagesanteile zählen 0; ungespeicherte laufende Timer zählen ebenfalls 0. Zukünftige Anwesenheitszeilen bleiben bearbeitbar und sind als noch nicht im Konto enthalten gekennzeichnet. Zukünftige Produktionszeilen tragen eine gesonderte Produktionskennzeichnung; Produktionsstunden bleiben außerhalb des Zeitkontos.

## Kalendergutschriften

Ein persönlicher, ausdrücklich ganztägiger Eintrag (`allDay: true`, Person zugeordnet) für Urlaub, Feiertag, Feiertagsausgleich oder Krank mit/ohne Attest ergibt **die an diesem Datum geltenden Wochenstunden ÷ 6** zusätzlich zur Anwesenheit. Die vorhandene Kategorie „Krank“ zählt ebenfalls. Jeder Kalendertag kann zählen, auch Sonntag; mehrere passende Einträge am selben Datum ergeben nur eine Gutschrift. Zukunftstage zählen nicht. Abgesagte Termine zählen nicht; ein verknüpfter Urlaubsantrag muss genehmigt sein. Terminenden sind exklusiv.

ABF, Ruhetag, halber freier Tag, nicht ganztägige oder nicht persönlich zugeordnete Einträge und allgemeine bayerische Feiertagshinweise erzeugen keine Gutschrift. Importierte Kategorien verwenden geladene Namensdefinitionen aus dem Gewerk des Termins; ausgeschlossene Systemschlüssel bleiben auch nach Umbenennung ausgeschlossen.

Rechenbeispiel ohne Personenbezug: 15 Stunden Wochenziel, 15 Stunden Anwesenheit und eine Gutschrift von 2,5 Stunden ergeben +2,5 Stunden. Bei 10 Stunden Anwesenheit ergeben dieselben übrigen Werte −2,5 Stunden für die abgeschlossene Woche.

Quellen: [Wochenrechnung und Monatsgrenzen](../src/modules/time-tracking/balance.ts), [Kategorienabgleich](../src/modules/time-tracking/day-credits.ts), [lokale Tageszuordnung](../src/modules/time-tracking/day-markers.ts) und [Berechnungstests](../tests/attendance-balance.test.ts).

## Bedienung und Berechtigungen

Anwesenheit, Produktion und Gutschriften bleiben getrennt beschriftet. Die aktuelle Woche zeigt einen nativen Fortschritt mit „Erfüllt“ und „Noch offen“, unabhängig von der im Verlauf gewählten Woche. Fehlende Wochenvorgaben erhalten einen ausdrücklichen Einrichtungszustand. „So wird gerechnet“ öffnet eine native Erklärung mit mindestens 44 px Zielhöhe und begrenztem Lesemaß; Hauptsummen bleiben sichtbar.

Eigene frühere Anwesenheits- und Produktionsbuchungen bleiben mit Versionsprüfung bearbeitbar. Löschen verlangt Bestätigung; Abbrechen erhält die Buchung und sendet keine Löschanfrage. Eine Änderung berechnet die betroffenen Wochen sofort neu. Berechtigte Teamaktionen ändern den Buchungseigentümer nicht.

Beschäftigte können ihr eigenes datiertes Wochensoll pflegen; es bleibt persönlich über ihre aktiven Gewerke hinweg. Die Pflege fremder Profile und das Löschen historischer Sollzeiteinträge benötigen serverseitig frisch geprüfte `time.team.manage`- oder `personnel.manage`-Rechte im aktuellen Fachbereich. Zusätzlich muss die Zielperson in diesem Fachbereich aktiv zugeordnet sein: Pending oder Disabled werden auch bei einem anderen aktiven Gewerk abgewiesen. Eigene Zeitrechte allein erlauben keine Historienlöschung. Die [Profiländerung](../src/modules/profile/service.ts) prüft Theater, Person, aktive Fachbereichszugehörigkeit und erwartete Version; neue datierte Sätze erhalten die übrige Historie. Konfigurationsverwaltung oder das Plattformflag ersetzen keine Zeitberechtigung. Die vorhandene, begrenzte Tenantprofil-Abfrage und Berechnung mit geladenen Daten benötigen keinen zusätzlichen Datenbankaufruf.

## Neue Prüfnachweise

| Nachweis                                                                            | Aktuell bestätigtes Ergebnis                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Finaler voller Unit-Lauf](../.local/weekly-time-unit-full.json)                    | 442 bestanden, 0 fehlgeschlagen; 16 umgebungsabhängige Tests im normalen Lauf übersprungen. Die echte DEV-Integration ist ein zusätzlicher Nachweis.                                                                                                                                  |
| [Reale DEV-Integration](../.local/weekly-time-integration.json)                     | 15/15 bestanden. Der neue [Regressionstest](../tests/tenancy/platform.integration.test.ts) bestätigt aktive Pflege und anschließend Pending/Disabled mit einem anderen aktiven Gewerk: Änderung und Historienlöschung jeweils 403, Profil unverändert.                                |
| [Echte Wochen-Browserabläufe](../.local/weekly-time-browser-evidence.json)          | `success: true`, 28 bestanden: eigene und berechtigte Teamänderungen, historische Profile, verweigerte fremde Eingriffe, vergangene Buchungen, Bestätigungs-/Abbruchfälle, Wochen-/Monatsgrenzen, heutige gespeicherte Zeiten, Zukunftsausschluss und Responsive-Verhalten.           |
| [Gewerke-Einstiege](../.local/weekly-time-guilds-evidence.json)                     | `success: true`, 23 bestanden: tatsächliche gemeinsame Zeitbereich-Einstiege in alle 22 Gewerke und kein Skriptfehler im gezielten Abschlusslauf.                                                                                                                                     |
| [Finale Renderprüfung](../.local/weekly-time-render-evidence.json)                  | `success: true`, 5 bestanden: Erklärung geöffnet/geschlossen, 44-px-Ziel, kein horizontaler Überlauf bei 390/810 px und keine Laufzeit-Skriptfehler.                                                                                                                                  |
| [Stabile helle Aufnahme](../.local/weekly-time-light-evidence.json)                 | `success: true`; neuer Browserkontext von Beginn an hell, ohne unmittelbar fotografierten Theme-Wechsel. Das helle Mobilbild wurde durch den unveränderten Capture ersetzt.                                                                                                           |
| [Finale Zukunftszeile (DEV)](../.local/weekly-time-future-production-evidence.json) | `success: true`, ein echter abschließender Browsercheck mit korrekt produktionsbezogener Zukunftszeile.                                                                                                                                                                               |
| Sequentielle Pipeline                                                               | [Typecheck](../.local/weekly-time-typecheck.log) 0 Fehler/0 Warnungen, [Lint](../.local/weekly-time-lint.log) Exit 0, [Build](../.local/weekly-time-build.log) Exit 0. Windows-Adapterhinweise zu Abhängigkeiten bleiben vorhanden; der Build wird nicht als warnungsfrei bezeichnet. |
| Secret Scan                                                                         | 887 versionierte Dateien, 65 Client-Dateien und 139 private Prüfwerte untersucht; 0 Lecks gefunden.                                                                                                                                                                                   |

Die neuen unveränderten PNGs zeigen [Woche Desktop](../.impeccable/review/weekly-time-week-desktop.png), [Woche Mobil](../.impeccable/review/weekly-time-week-mobile.png), [Konto Mobil](../.impeccable/review/weekly-time-account-mobile.png), [helles Konto Mobil](../.impeccable/review/weekly-time-account-light-mobile.png) und [810-px-Woche](../.impeccable/review/weekly-time-week-810.png). Die Gesamtprüfung umfasst 390, 810 und 1440 px in der bestehenden hellen und dunklen Darstellung.

## Veröffentlichung und Produktionsstand

Der unabhängige [Finish-Review](../.local/weekly-time-finish-review.md) bestätigt `disposition: ship`; alle drei tatsächlichen Findings sind geschlossen.

Die Anwendungsrevision [d1d04438515e235797560dbd0dc8c61b2c7c33a1](https://github.com/bthginfo/showtime/commit/d1d04438515e235797560dbd0dc8c61b2c7c33a1) hat [CI-Lauf 38303183648](https://github.com/bthginfo/showtime/actions/runs/38303183648) mit `completed / success` bestanden. Deployment `dpl_23S4gx7w8mvzeYsJ64U1ohRm5LPS` im Showtime-Projekt `prj_NVqwzf1z2gsqfCggxnhq0wwI6Abc` ist für genau diese Quellrevision `READY`. Der [API-Aliasnachweis](../.local/weekly-time-source-alias-proof.json) bestätigt [showtime-ingolstadt.vercel.app](https://showtime-ingolstadt.vercel.app) exakt für dieses Deployment.

Die [Cloud-Prüfung](../.local/ux-cloud-api-evidence.json) dieser Revision ist erfolgreich mit 18 Checks: echte Queue und 22 Arbeitsbereiche, private Originaldateien, native DOCX-/PDF-Dokumente sowie verweigerter Zugriff aus einem fremden Theater. Die [Edge-Prüfung](../.local/offline-edge-production-evidence.json) bestätigt fünf TLS-verifizierte Endpunkte.

Auch die native Live-Oberfläche wurde tatsächlich durchgeklickt: drei getrennte Zeitarten, ausdrücklicher Zustand bei fehlender eigener Konfiguration und bei einer berechtigt ausgewählten Person korrektes Wochensoll, „Erfüllt“/„Noch offen“ und abgeschlossene Gesamtsumme. Personenbezogene Werte und private Screenshotdetails werden hier nicht veröffentlicht.

Der [Produktions-Backfill](../.local/time-credit-production-categories-evidence.json) ist erfolgreich: 22 Gewerke, 86 neue und zwei bereits vorhandene Kategorien; bestehende Daten wurden nicht überschrieben. Er umfasst „Feiertag“, „Feiertagsausgleich“, „Krank mit Attest“ und „Krank ohne Attest“.

Die [geschützte Profilanwendung](../.local/weekly-time-personal-production-evidence.json) ist nach dem bestätigten READY-/Aliasstand erfolgreich: sieben eindeutig bestätigte reale Maske-Teammitglieder, vier datiert angepasste und drei bereits passende Profile, Gültigkeit ab 12.10.2026, Historie erhalten. Namen und personenbezogene Stundenwerte werden nicht in Git übernommen.

Diese Anwendungs-, CI-, API- und Produktionsnachweise gelten für `d1d04438515e235797560dbd0dc8c61b2c7c33a1`. Die anschließende Text-/Berichtrevision enthält diesen Bericht und eine einzelne Klarstellung: Kalenderkennzeichen sind keine Anwesenheitsbuchungen; bezahlte Ganztage zählen separat als Tagesgutschrift. Backend, Tests und Berechnung bleiben dabei unverändert. Diese Folgerevision erhält eine eigene CI-/READY-/Alias-/Live-Prüfung; deren noch unbekannte Revisionswerte werden nicht aus dem Anwendungsbeleg abgeleitet.

## Nachweisgrenzen

JSON-/Lognachweise in `.local` und Bilder in `.impeccable` sind lokal ignorierte Dateien, keine über Git veröffentlichten Artefakte. Die Nachweislinks funktionieren im lokalen Prüfcheckout; die verlinkten Dateien werden nicht mit dem Bericht auf GitHub bereitgestellt. Gewerke-Einstiege belegen keine vollständigen Buchungs- und Rollenvarianten für jedes Gewerk. Es gibt keine Anfänger-Usability-Studie oder allgemeine Fehlerfreiheitszusage. Dieser Dokumentationsschritt verändert ausschließlich diesen Bericht.
