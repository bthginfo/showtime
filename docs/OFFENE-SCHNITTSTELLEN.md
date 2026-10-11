# Offene Schnittstellen und Austauschformate

Recherche und Nutzerentscheidung vom 11. Oktober 2026. Es steht noch kein Ticketing-, Lohn-, Finanz-, CAD- oder Konsolenprodukt fest. Die Umsetzung erhält deshalb ein versioniertes API und kontrollierte Import-/Exportwege mit Feldzuordnung. Der offene Datenvertrag wird von konkreten Herstelleradaptern getrennt.

## Marktbezug

[EVENTIM.Inhouse](https://www.eventim-inhouse.de/produkte/ticketing) richtet sich ausdrücklich an Theater-/Opern-/Konzerthäuser und beschreibt Finanzschnittstellen. Seine detaillierte Anwenderdokumentation ist zugangsbeschränkt. Daraus lässt sich kein öffentlich verifizierter Inhouse-API-Vertrag ableiten. Showtime verwendet einen eigenen Besucher-/Vorstellungsvertrag; herstellerspezifische Feldzuordnungen können daran anschließen.

[DATEV beschreibt ASCII-/CSV-Austausch sowie eigene Datenservices für Lohn](https://www.datev.de/web/de/unternehmen/loesungen/lohn-und-personal/lohn-und-gehaltsabrechnung/schnittstellen). Die [Formatübersicht](https://www.datev.de/dnlexom/v2/content/documents/1080789/pdf) unterscheidet verschiedene Import-/Exportzwecke. Ein beliebiges CSV ist deshalb nicht automatisch eine geprüfte DATEV-Schnittstelle. Showtime liefert überprüfbare Stunden-/Kosten-/Belegdaten und konfigurierbare Spaltenprofile; eine vollständige Buchungs-/Lohnberechnung wird nicht aus Zeitdaten erfunden.

[GDTF und MVR](https://gdtf-share.com/help/developers/) sind offene Formate für Geräte und die gemeinsame Szene der Veranstaltungstechnik. [Offizielle Entwicklerwerkzeuge](https://github.com/mvrdevelopment/tools) stellen unter anderem die GDTF-1.2-/MVR-1.6-Schemata bereit. Die passende Austauschgrenze umfasst Gerätemetadaten, Patch und eine versionierte technische Szene. Zeichnungs-/Geometriedateien bleiben zusätzlich private Originalanlagen; Showtime wird dadurch nicht zu einer CAD- oder Konsolensteuerung.

## Verbindliche Implementierungsanforderungen

- API `/api/v1` mit öffentlich lesbarer Vertragsdokumentation, privaten tenantgebundenen Daten, expliziten Scopes, befristeten widerrufbaren Zugängen und aktuellen Benutzer-/Mitgliedschaftsprüfungen.
- Geschützte CSV-/JSON-Importe mit Spaltenzuordnung, Vorschau, Zeilenfehlern, klaren Referenzzuordnungen und wiederholbarer Verarbeitung. Keine stille Zuordnung namensgleicher Personen oder fremder Theater-IDs.
- Export mit deutscher bzw. neutraler Zahlen-/Datumsdarstellung, sicherer CSV-Ausgabe und bestätigter Auswahl sensibler Bereiche. Tabellenformeln werden beim Export entschärft.
- Kalenderdaten im iCalendar-Format; private Fach-/Personalinformationen werden entsprechend den Zugriffsrechten begrenzt.
- Ticketing-Vertrag: Vorstellungsbezug, Platzkontingent, tatsächliche Besucher, Kartenarten und Geldbetrag; bestehende Plausibilitäts-/Doppelberichtprüfungen bleiben wirksam.
- Zeit-/Finanzvertrag: geprüfte Buchungen, Freigabestand, Kostenstelle, Originalbelegbezug und Geldbeträge. Profilzuordnung statt stiller Steuer-/Lohnannahmen.
- Showtechnik-Vertrag: Geräte, Adressbereich, Kanal, Fassung und private Anlagen. MVR/GDTF-Metadaten und CSV-/JSON-Patchaustausch werden geprüft; ein Import schaltet keine Bühnenanlage.
- Große Medien, CAD und Tournee-/Vertragsanlagen erhalten die gleichen privaten Dateigrenzen, Versionsnachweise und Kontingente wie andere Fachunterlagen.

## Implementierte Wege und Grenzen

Die öffentlich lesbare Oberfläche `/schnittstellen` stellt Profile, Spaltenvorlagen und Erläuterungen bereit. Der OpenAPI-3.1-Vertrag liegt unter `/api/v1/openapi.json`. Private Zugänge entstehen in **Theaterbetrieb → Schnittstellen**, verlangen `tenant.configure` und sind an eine berechtigte Person, deren aktuelles Gewerk und explizite Scopes gebunden. Sie laufen spätestens nach 90 Tagen ab; der geheime Wert wird einmalig gezeigt und nur als Hash gespeichert. Widerruf und entzogene Mitgliedschaft wirken auf den nächsten Aufruf.

| Weg                          | Verhalten                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/v1/{entity}`           | Berechtigte, paginierte Produktionen, Szenen/Fachstände, Ressourcen, Personenbezüge, Zeitdaten und Finanzbelege; Ticketing nutzt den geprüften Vorstellungsbericht |
| `/api/v1/exchange`           | Geschützter CSV-/JSON-Austausch; schreibende Aufrufe mit `Idempotency-Key`                                                                                         |
| `/api/integrations/exchange` | Sitzungsgebundene Vorschau/Übernahme mit Feldzuordnung und Fehlern je Zeile, identische fachliche Validierung wie manuelle Eingabe                                 |
| `/api/integrations/showtech` | MVR/GDTF-Metadatenvorschau für den Licht-Patch; importierte private Originale bleiben Anlagen                                                                      |
| Bestehender Kalenderexport   | iCalendar mit tatsächlichen Zugriffsgrenzen; kein automatischer Schreibzugriff auf fremde Kalender                                                                 |
| `/api/media`                 | Private, wiederaufnehmbare Fachanlagen mit Inhaltsprüfung und aktuellen Elternrechten                                                                              |

Imports akzeptieren höchstens 100 Zeilen und 1 MB Inhalt. Die Vorschau läuft in einer zurückgerollten Transaktion; fehlerhafte Übernahmen speichern keine Teilmenge. Externe IDs und Wiederholbelege verhindern doppelte Anlage; aktuelle Versions- und Referenzprüfungen bleiben wirksam. Export ist auf 2.000 Fachstände begrenzt, begrenzt sensible Bereiche und entschärft Tabellenformeln. API-Drosselung: 120 Anfragen pro Zugang und Minute, 429 mit `Retry-After`; fachlich abgewiesene Anfragen zählen mit.

MVR/GDTF-Vorschauen begrenzen Archive auf 4 MB, XML-Metadaten auf 2 MB und Geräte bzw. Modi auf 100. DTD-/Entitätsdefinitionen werden abgewiesen. Patch-/DMX-Konflikte werden fachlich geprüft. Geometrie, komplettes Rigging, proprietäre Konsolenprogramme und die Fernsteuerung einer Bühnenanlage werden nicht importiert oder ausgeführt.

Die neutralen Profile stehen in `src/shared/adapter-profiles.ts`. DATEV-Kontierung, EVENTIM-Zugriff und vollständige Herstellerdatenservices erfordern die später gewählten Zielprodukte, Vertragsbedingungen und Zugangsdaten. Der Austauschweg ist implementiert und geprüft; eine Herstellerzertifizierung wird nicht unterstellt. Prüfung und begrenzte Lastprobe: [AUSBAU-ABNAHME.md](AUSBAU-ABNAHME.md).
