# Showtime: Abnahme

Aktueller Fachausbau: [AUSBAU-ABNAHME.md](AUSBAU-ABNAHME.md) dokumentiert den am 11. Oktober anschließend freigegebenen Umfang mit 21 Gewerken, 368 Unit-, zwölf Datenbank- und 28 API-Tests, neuen Demoabläufen und Wiederherstellungsprüfung. Die folgenden Abschnitte halten die früheren Abnahmen fest.

Stand: 10. Oktober 2026. Alle Tests verwenden synthetische Showtime-Daten und neue Ressourcen. Die vorhandene DigitalMask-Installation dient nur als Quellreferenz.

## Automatisierte Prüfungen

| Prüfung                       | Ergebnis                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte-/TypeScript-Prüfung    | 0 Fehler und 0 Warnungen; alle 44 übernommenen Warnungen behoben                                                                                                     |
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

Der Produktionsalias wurde anschließend auf [Showtime Ingolstadt](https://showtime-ingolstadt.vercel.app) umgestellt. Die Produktions-URLs für Authentifizierung und erzeugte Links wurden angepasst. HTTPS, Anmeldung, Session und Workspace wurden unter dem neuen Alias erneut geprüft; die Anmeldeseite wurde zusätzlich im eingebauten Browser geöffnet. Auch die HTTPS-Weiterleitung der bisherigen Adresse wurde nach der Bereitstellung bestätigt: Status 308 auf den neuen Host bei unverändertem Pfad und erhaltenen Queryparametern.

## Grenzen des Erstumfangs

Die zwanzig Gewerke erhalten die im freigegebenen Plan beschriebenen Fachansichten und gemeinsame Dienste. CAD, direkte Licht-/Tonsteuerung, Ticketing, Lohn- und Finanzbuchhaltung, große Medienarchive und SaaS-Abrechnung gehören zu den späteren Integrationen. Der am 11. Oktober ausdrücklich beauftragte Altdatenimport erzeugt eine getrennte Kopie; er ist kein automatischer Synchronisationsdienst.

Ein Test mit synthetischen Daten ersetzt keine Bewertung der tatsächlich geltenden Arbeits- und Tarifregeln oder eine Langzeitmessung des kostenfreien Kontingents. Die Tastatur- und Mausprüfung lief in Chromium mit emulierten Viewports; physische Touchgeräte und ein vollständiger Screenreader-Durchlauf waren nicht Bestandteil dieses Nachtrags.

## Nachtrag vom 11. Oktober: Ingolstadt, Sicherheit und Zusammenarbeit

Die Produktionsinstanz unter dem neuen Alias hat 532 Prüfungen mit allen 31 Demo-Zugängen bestanden. Dazu gehören alle zwanzig Fachmodule, tatsächliche Rollen- und Tenantgrenzen, geschützte Originaldateien, Zeitbuchungen mit Bearbeiten/Löschen und die Sichtbarkeit privater Gespräche. Sechs zusätzliche Demo-Abstimmungen zeigen Freigabe, Feedback, Überarbeitung, eine überfällige Änderung und eine abgeschlossene Übergabe. Die Figurinenabstimmung enthält eine private PDF-Anlage. Ein ausdrücklich als DEMO gekennzeichneter Besucherbericht ergibt 82 % Auslastung aus 328 Besuchenden bei 400 Plätzen.

Eine zusätzliche Prüfung mit elf erfolgreichen Assertions hat auf der Live-Instanz zwei native POST-Anmeldungen sowie eine neue Kostüm-Rückmeldung an Maske geprüft: Das über die API veröffentlichte Ereignis wurde vom echten Vercel-Queue-Consumer abgeschlossen und erzeugte die sichtbare Benachrichtigung beim berechtigten empfangenden Gewerk. Der Prüfer hat den Consumer nicht selbst ausgeführt.

Beim tatsächlichen Browserdurchlauf wurde außerdem ein gemeinsamer Navigationsfehler behoben: Native SvelteKit-Links aktualisieren jetzt alle Abfragen des Arbeitsbereichs. Der Hilfelink und der Rückweg öffnen ohne Reload die passende sichtbare Ansicht; die Adresse und der angezeigte Fachbereich bleiben synchron.

Auch der PDF-Dialog wurde anhand einer tatsächlichen Anlagenansicht korrigiert. Die mobile Umschaltung verdrängt auf dem Desktop keine PDF-/Notizenspalte mehr. Schreibgeschützte Anlagen bieten keine Speichern- oder Notizanlegeaktion an und fordern auch im Leerzustand nicht zum Bearbeiten auf. Eine eigene, erst beim Öffnen geladene [PDF.js-Vorschau](https://mozilla.github.io/pdf.js/examples/) zeigt die Originalseiten unabhängig vom eingebauten Browser-PDF-Plugin. Zwei synthetische Seiten, Vor-/Zurück, Seitentext, Desktop und 390-Pixel-Viewport wurden im Browser geprüft; im mobilen Dialog betrugen Seite und Dialog jeweils 390 Pixel, die Zeichenfläche blieb darin. Seitenwechsel setzt die Vorschau an den Anfang; die Größenanpassung läuft außerhalb des ResizeObserver-Zyklus.

Auf ausdrücklichen Auftrag wurde **Stadttheater Ingolstadt** als eigener Tenant mit zwanzig Gewerken angelegt. Der DigitalMask-Snapshot stammt vom 11. Oktober, 06:39 UTC. Übernommen wurden 1.698 Datensätze, sieben Benutzeridentitäten, 103 private Dateien und vier native Dokumentstände. Alle kopierten Dateien wurden heruntergeladen und anhand ihres SHA-256-Werts mit der Quelle verglichen. Die Quelle blieb unverändert. Sitzungen, Tokens und Push-Abonnements wurden nicht kopiert; historische abgeschlossene Ereignisse werden nicht erneut ausgeführt. Private Direktgespräche behalten ausschließlich ihre ursprünglichen Teilnehmenden. Ihre zusammengesetzten Schlüssel wurden nach dem ID-Wechsel ebenfalls angepasst.

31 getrennte Demo-Zugänge decken zehn Theaterrollen, zwanzig Gewerkleitungen und einen Plattform-Superadmin ab. Der Superadmin besitzt keine automatische Theaterzuordnung. Drei synthetische Produktionen, Fachbeispiele, Bereitschaft, eigene Zeitbuchungen, Haus-/Gewerk-/Privatchats und ein gemeinsames Office-Dokument sind vorhanden. Namen und Daten der Beispiele tragen „DEMO“. Die individuellen Passwörter stehen ausschließlich in der ignorierten lokalen Zugangsdatei, nicht im Repository oder in einem öffentlich sichtbaren Hilfeartikel.

| Prüfung                                        | Ergebnis                                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aktuelle vollständige Unit-Suite               | 332 bestanden, 0 fehlgeschlagen; 11 bewusst ausstehend wie zuvor                                                                                                    |
| Echte Neon-Integration                         | 10 bestanden, 0 fehlgeschlagen                                                                                                                                      |
| Neue API-Abläufe gegen die Entwicklungsinstanz | 15 bestanden, keine übersprungenen oder instabilen Tests: 5 Plattform, 4 Anmeldung, 6 Zusammenarbeit/KPIs                                                           |
| Fachmodule                                     | Alle zwanzig aktiven Gewerke laden mit ihrem eigenen Modul und validierten Formularverträgen                                                                        |
| Anmeldung ohne JavaScript                      | Erfolgreicher POST mit Session-Cookies und 303; Fehlversuche, fremde Herkunft und GET-Fallback geprüft                                                              |
| Anfragen und Anlagen                           | Wiederholung, fremdes Gewerk, Selbstfreigabe, Feedback, Überarbeitung, veraltete Version, echte private PDF-Datei und unveränderlicher Abschluss geprüft            |
| Aktuelle Rechte                                | Entzogene Mitgliedschaft sperrt eine bereits geöffnete Anfrage und deren Dateilink                                                                                  |
| Besucherberichte                               | Reale Vorstellungsreferenz, doppelte Berichte, unplausible Zahlen, KPI-Berechnung und Zugriffsgrenzen geprüft                                                       |
| Oberfläche                                     | Neue Arbeitsflächen im echten Chromium-Browser; Desktop und 390-Pixel-Mobilansicht; sichtbarer Fokus, gewerkspezifischer Einstieg, Formulare und fehlende KPI-Daten |
| Mobile Überläufe                               | Anfrageformular und Dashboard: Seitenbreite innerhalb des Viewports, keine überlaufenden Eingabefelder                                                              |
| Svelte/TypeScript, ESLint, Betriebsskripte     | 0 Fehler; Svelte-Prüfung mit 0 Warnungen                                                                                                                            |
| Schutz vor veröffentlichten Geheimnissen       | Quell-/Runtime-Zugänge, Demo-Passwörter und erzeugte Client-Assets geprüft; kein Treffer                                                                            |

Die Login-, Registrierungs- und Passwortformulare geben Zugangsdaten auch vor der JavaScript-Aktivierung per POST weiter. Auth-Seiten und Antworten tragen `no-store` und `no-referrer`. Alte sensible Login-Queryparameter werden entfernt. Bereits entstandene Browserhistorie oder frühere externe Logs lassen sich dadurch nicht rückwirkend bereinigen; dort verwendete Passwörter müssen geändert werden. Ein ungenutzter alter Admin-Einladungslink, der während einer Diagnose ausgegeben wurde, wurde sofort widerrufen und die Ungültigkeit geprüft.

Zusätzlich wurden `cookie` auf 0.7.2 und `source-map-js` auf 1.2.2 aktualisiert. Die bekannten [Cookie-Prüfungsprobleme](https://github.com/advisories/GHSA-pxg6-pf52-xh8x) und die [Source-Map-Denial-of-Service-Lücke](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) sind damit im Lockfile behoben. Die verbleibenden drei mittelgradigen npm-Audit-Meldungen betreffen Mammoths CLI-Abhängigkeit argparse/sprintf-js. Für [sprintf-js ist kein Patch veröffentlicht](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). Die Anwendung ruft ausschließlich die Dokumentkonvertierung aus Mammoths Bibliothek auf und übergibt keine Formatstrings an diesen CLI-Pfad; `npm audit fix --force` würde eine fachlich ungeeignete alte Mammoth-Version installieren und wurde deshalb nicht ausgeführt. Das ist eine dokumentierte Abhängigkeitsgrenze, keine Behauptung einer lückenfreien Anwendung.

Recherche, Abläufe, Hilfe und KPI-Definitionen stehen in [GEWERKE-ABLAEUFE.md](GEWERKE-ABLAEUFE.md); der einheitliche Gestaltungsstandard steht in [DESIGN.md](../DESIGN.md). Physische Touchgeräte, vollständige Screenreader-Abnahme und Langzeitlast bleiben zusätzliche Prüfungen. Eine absolute Bugfreiheit oder pixelgenaue Gleichheit aller Zustände wird nicht aus diesen Tests abgeleitet.

## Nachträglicher Fachtest aus Rollen- und Gewerksicht

Nach Veröffentlichung der offenen Umsetzungsaufgaben wurde die zusätzliche Rollen-/Gewerkprüfung durchgeführt. Alle zwanzig Gewerke bestanden Anlegen, Bearbeiten und den Konflikt einer veralteten Version über die echte Entwicklungs-API. Die Ergebnisse einschließlich fachlicher Ausbaulücken stehen in [ROLLEN-GEWERKE-TEST.md](ROLLEN-GEWERKE-TEST.md).

Zwei nachgestellte Planungsfehler wurden korrigiert: Nichtverfügbarkeit wird in der eingestellten Theaterzeitzone mit exklusivem Dienstende verglichen. Direkt anschließende Dienste werden vor der Prüfung der bestätigten Höchstdauer pro Person zusammengeführt. Eine Kette aus drei Diensten zählt vollständig; Dienste verschiedener Personen werden nicht vermischt. Fünf neue permanente API-Regressionstests gegen die echte Entwicklungsdatenbank bestanden ohne Auslassung oder Wiederholung. Elf zusätzliche Unit-Tests decken auch den Zeitwechsel, eine weitere Zeitzone, Grenzwerte und die erforderliche Bestätigung der Regeln ab.

Die vollständige Unit-Suite umfasst damit **343 bestandene Tests, null Fehler und dieselben elf bewusst ausstehenden Tests**. Die tatsächliche Neon-Integration besteht erneut mit zehn Tests. Svelte/TypeScript meldet null Fehler und null Warnungen; ESLint besteht ebenfalls. Die mobile Navigation wurde auf dieselben wirksamen Rollenrechte wie das Seitenmenü begrenzt.

Die Live-Prüfung der Rückrichtung Maske → Kostüm bestätigte den echten Queue-Consumer und genau eine passende Benachrichtigung für die ursprüngliche Kostümleitung. Dieser Ablauf war somit kein verbleibender Rückmeldungsfehler. Der Fachtestbericht unterscheidet korrigierte Fehler von offenen Fach-/UX-Erweiterungen und nennt die tatsächlich geprüften Szenarien.
