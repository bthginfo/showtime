# Betrieb von Showtime

## Ressourcen und Umgebungen

Repository: [bthginfo/showtime](https://github.com/bthginfo/showtime). Produktion: [Showtime](https://showtime-ingolstadt.vercel.app). Vercel-Projekt `showtime`, Node.js 24, SvelteKit, Fluid Compute und Region Frankfurt `fra1`. Der vorhandene Vercel-Pro-Tarif wird verwendet.

Der Produktionsalias ist `showtime-ingolstadt.vercel.app`. `APP_URL` und `BETTER_AUTH_URL` zeigen in Production auf diese HTTPS-Adresse. Für den vorherigen Alias `showtime-bthginfo.vercel.app` ist bei Vercel eine Weiterleitung mit Status 308 auf die neue Adresse konfiguriert.

Production, Preview und Development besitzen jeweils ein eigenes Neon-Free-Projekt, einen eigenen privaten Blob-Store sowie eigene Auth-, Cron- und VAPID-Schlüssel. Die Produktionsdatenbank ist das Neon-Projekt `royal-glade-27927910`. Die Ressourcen sind unabhängig von DigitalMask. Ein Preview-Deployment verwendet seinen eigenen Vercel-Host für Auth und Einladungslinks.

| Umgebung    | Verwendung                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------ |
| Development | Synthetische Integrationstests, Browserabnahme und Restoreproben                                 |
| Preview     | Geschützte Vorschau mit ausschließlich eigenen Vorschauressourcen                                |
| Production  | Eigene Showtime-Theater einschließlich der ausdrücklich beauftragten getrennten Ingolstadt-Kopie |

Laufzeitvariablen stehen in `.env.example`. Die vier Rollen-URLs, Authsecret, Cronsecret, private Blob-Zugangsdaten und VAPID-Schlüssel gehören in die jeweilige Vercel-Umgebung. Migrationseigentümer und Verwaltungs-PATs gehören nicht in Functions oder Git. `.env*`, `.local` und `.vercel` sind ignoriert.

Die lokale Erstinstallation verwahrt `.local/runtime-<environment>.json`, `.local/.env.owner-<environment>` und `.local/access-<environment>.json`. Die Zugriffdatei enthält den Bootstrap-Zugang und muss privat bleiben. Passwort beim ersten Einsatz ändern. Diese Dateien und der Backupschlüssel sind nicht aus Git rekonstruierbar; separat und verschlüsselt sichern.

## Einrichtung und Release

1. Node.js 24 installieren und `npm ci` ausführen.
2. Ausschließlich neue Showtime-Ressourcen provisionieren. Eigentümervariablen der gewünschten Neon-Umgebung privat unter `.local/.env.owner-<environment>` ablegen; den passenden privaten Blob-Token hinzufügen.
3. `npm run db:migrate -- development` ausführen. Für andere Ziele den Namen ausdrücklich ersetzen. Das Skript wendet Drizzle-Migrationen, RLS-Policies und getrennte Laufzeitrollen an und schreibt nur ignorierte Runtime-Dateien.
4. `npm run bootstrap -- development` einmalig ausführen. Ein neutraler Theaterdatensatz mit 21 Gewerken und einem privaten Bootstrap-Zugang entsteht. Keine Schauspieler- oder DigitalMask-Daten werden durch den Bootstrap importiert.
5. `npm run typecheck`, `npm run lint`, `npx tsc --noEmit -p tsconfig.scripts.json`, `npm test` und `npm run build` ausführen. Sicherheits- oder Planungsänderungen zusätzlich gegen die separate Entwicklungsdatenbank und im Browser prüfen.
6. Geprüften Commit veröffentlichen und das separate Vercel-Projekt deployen. Produktion mit `vercel deploy --prod`; Vorschau mit `vercel deploy`. Eigentümervariablen niemals ins Deployment übernehmen.
7. Auf der tatsächlichen Deployment-Adresse Anmeldung, Kontextwechsel, private Datei, Dokumentänderung, PDF-Export und Queue-Folgeaktion prüfen. Ein erfolgreicher Build allein genügt nicht.

CI führt keine Produktionsmigrationen und keinen Bootstrap aus. Additive Migrationen bevorzugen und die Verträglichkeit mit noch laufenden alten Eventversionen prüfen. Vor destruktiven Schemaänderungen ein vollständiges Backup anfertigen. Der Build ergänzt Queue-Trigger, Noto-Schriften, Portraitmodell und dynamisch geladene PDFKit-Schriftmodule in den Function-Bundles.

Das Vercel-Projekt ist mit `bthginfo/showtime` verbunden; `main` ist der Produktionsbranch. Neue Commits werden durch GitHub CI geprüft und lösen die Git-Bereitstellung aus. Der initiale Release wurde zusätzlich ausdrücklich für Produktion und geschützte Preview aus demselben geprüften Git-Commit gebaut und auf beiden Adressen abgenommen.

## Zugänge und Verwaltung

Neue Theater entstehen über die Plattformverwaltung und erhalten einen einmaligen, sieben Tage gültigen Einladungslink für die Theateradministration. Bestehende Konten können die Einladung ebenfalls annehmen. Gewerk- und Gastzugänge vergibt die zuständige Theaterverwaltung; Gastrollen sind an eine Produktion gebunden und können ablaufen. Mitgliedschaften, Rollen und Theatersperren werden bei jedem neuen Zugriff geprüft.

Die Theaterverwaltung konfiguriert Gewerke, Module, Arbeitsregeln, Bereitschaftsanforderungen, Mitglieder, Rollen und Kontingente. Der Anfangsbestand ist neutral. Vor Nutzung der automatischen Planprüfung die tatsächlich geltenden Hausregeln bestätigen. Planung und Darstellung verwenden die konfigurierte Theaterzeitzone; Ingolstadt verwendet Europe/Berlin.

Die Plattformverwaltung bearbeitet ausschließlich bewusst eingereichte Supportanfragen. Sie kann Theater sperren und wieder freigeben. Private Chats, Dateien, Personalangaben und sonstige Fachinhalte werden dadurch nicht global freigegeben.

## Ereignisse und Fehler

Normale Writes schicken die dauerhafte Outbox über Vercel Queues an den separaten Consumer. Queuezustellung kann sich wiederholen; der Datenbankbeleg verhindert doppelte Fachwirkungen. Wenn Versand oder Consumer ausfallen, bleibt der Auftrag in PostgreSQL erhalten.

`/api/cron` benötigt `Authorization: Bearer CRON_SECRET` und läuft alle 15 Minuten. Dieses Recoveryintervall begrenzt regelmäßige Datenbank-Wakeups; es ersetzt die sofortige normale Queuezustellung nicht. Fehlerstatus, Versuche und tenantgebundenes Audit sind in der Theaterverwaltung sichtbar. Fehlgeschlagene Events dort erst nach Ursachenbehebung erneut starten. Logs enthalten Fehlerklasse, technische Codes und Stackpositionen, keine SQL-Werte, Passwörter, Sitzungen oder privaten Nachrichtentexte.

## Verschlüsseltes Backup und Wiederherstellung

Ein fachlicher JSON-Export ersetzt keine vollständige Sicherung. `scripts/tenant-backup.ts` sichert einen Tenant mit wiederholbarem DB-Snapshot, Fachhistorien, Eventbelegen, Yjs-Zuständen und allen referenzierten privaten Blob-Dateien. Dateiprüfsummen werden geprüft. Das Archiv ist gzip-komprimiert und mit AES-256-GCM verschlüsselt.

```powershell
# Nur das ausdrücklich gewählte Showtime-Ziel verwenden.
npx tsx --tsconfig tsconfig.scripts.json scripts/tenant-backup.ts backup development THEATER-ID .local/theater-backup.showtime
npx tsx --tsconfig tsconfig.scripts.json scripts/tenant-backup.ts restore development .local/theater-backup.showtime 'Restore Test' restore-test
```

Beim ersten Backup entsteht ein zufälliger 32-Byte-Schlüssel in `.local/backup-key`. Mit `SHOWTIME_BACKUP_KEY_FILE` lässt sich ein eigenes privates Schlüsselziel wählen. Archiv und Schlüssel getrennt und geschützt sichern. Das Werkzeug überschreibt kein vorhandenes Archiv und keinen bestehenden Tenant.

Restore erzeugt ein neues Theater, neue Objekt-IDs und neue private Dateipfade. Referenzen, Counts und Datei-SHA-256 werden geprüft. Während der Wiederherstellung ist das neue Theater gesperrt; erst nach erfolgreicher Prüfung wird es aktiviert. Bei Fehlern bleibt der Zwischenstand gesperrt. Ausstehende alte Events werden zur kontrollierten Prüfung zurückgehalten, damit der Restore keine ungewollten Nebenwirkungen auslöst.

Die Wiederherstellung erfolgt innerhalb derselben ausdrücklich ausgewählten Umgebung. Identitäten müssen dort bereits vorhanden sein; ein Wechsel zwischen Umgebungen verlangt eine gesondert geprüfte Identitätszuordnung. Passwörter, Sessions, Einladungen, ICS-Tokens, Push-Abonnements, unvollständige Medienuploads und laufende Timer werden nicht kopiert. Wiederhergestellte API-Zugänge sind widerrufen, Wiederholschlüssel erhalten einen eigenen Namensraum und Undo-Belege werden ungültig. Regelprofile, fachliche Freigaben, Bereitschaft und deren Ausnahmen verlangen eine erneute Bestätigung. Frühere Freigaben und Ausnahmen bleiben als historische Belege sichtbar. Die kopierten Blob-Dateien werden vor Aktivierung erneut heruntergeladen und per SHA-256 geprüft.

Die Fachausbau-Migrationen `0017` bis `0019` ergänzen FORCED-RLS-geschützte Integrations-, Upload- und Recoverytabellen, Ausstattung sowie den zusammengesetzten Upload-Mitgliedschaftsschlüssel. Sie sind additiv und für Entwicklung, Preview und Produktion ausgeführt. Private Nachweise und die neue verschlüsselte Ingolstadt-Sicherung liegen ausschließlich unter `.local`.

`scripts/seed-theater-expansion.ts <environment> <tenant-id> <authorized-username> --apply` ergänzt eine gekennzeichnete synthetische Fachproduktion und verknüpfte Beispiele. Der ausführende Plattformzugang braucht bereits explizite Theateradministrations- und Produktionsleitungsrollen. Das Skript behält bestehende Passwörter bei, erzeugt nur fehlende Gewerk-Demozugänge und speichert private Checkpoints; erneute Ausführung erzeugt keine zweite Beispielproduktion.

## Kosten und Kontingente

Neue Datenbanken bleiben auf Neon Free; es wurde kein neuer kostenpflichtiger Datenbank- oder Redis-Tarif gekauft. Private Blob-Speicher, Queue-, Function- und Datenverkehrsnutzung unterliegen den Freikontingenten beziehungsweise der Abrechnung des vorhandenen Vercel-Pro-Kontos. Das ist keine Garantie für kostenlosen Betrieb bei beliebiger Nutzung.

Die Erstinstallation arbeitet ohne Redis. Aktive Live- und Dokumentansichten prüfen PostgreSQL regelmäßig; Hintergrundtabs pausieren, aber dauerhaft aktive Clients können Neon am Einschlafen hindern. Listen sind paginiert, Kalender zeitlich begrenzt und Exportmengen begrenzt. Normale Uploads bleiben auf 4 MB beschränkt; private Fachanlagen erlauben bis 64 MB in wiederaufnehmbaren 2-MB-Teilen. Die theaterbezogenen Speicher-, Mitglieder- und Uploadkontingente werden bei der Speicherung geprüft. Die Plattformübersicht zeigt aggregierten Verbrauch, Queuezustand sowie bestätigte Backup-/Restore-Belege. Fehlgeschlagene oder länger als 30 Minuten ausstehende Ereignisse und 80 Prozent Dateiverbrauch erzeugen interne Alarme an aktuell berechtigte Theateradministrationen. Diese technischen Grenzen ersetzen keine anbieterweiten Budgetalarme; Verbrauch im Neon- und Vercel-Dashboard prüfen.

## Offene API und Fachbetrieb

Der öffentliche Vertrag liegt unter `/api/v1/openapi.json`, die Erläuterungen und Vorlagen unter `/schnittstellen`. API-Zugänge sind an Theater, Gewerk, Person und explizite Scopes gebunden, laufen spätestens nach 90 Tagen ab und prüfen bei jeder Anfrage die aktuellen Rechte. Pro Zugang gelten 120 Anfragen pro Minute; auch abgewiesene fachliche Anfragen werden gezählt. Drosselung antwortet mit 429 und `Retry-After`. Schreibende Integrationsaufrufe benötigen einen Wiederholschlüssel; derselbe Schlüssel mit anderem Inhalt wird abgewiesen.

Importe verwenden begrenzte CSV-/JSON-Dateien mit Feldzuordnung, Vorschau und Zeilenfehlern. MVR-/GDTF-Archive werden auf Größen, XML und Gerätemetadaten geprüft. Verbindliche Hersteller-, Steuer- oder Lohnverträge werden damit nicht vorausgesetzt. Details: [OFFENE-SCHNITTSTELLEN.md](OFFENE-SCHNITTSTELLEN.md).

Arbeitsregeln wirken erst nach ausdrücklicher Bestätigung des Theaters. Gemeinsame Produktionsszenen und Vorstellungs-Cues besitzen eigene Leserechte; private Teilnehmer-, Maß-, Personal- und Gesprächsdaten behalten ihre gesonderten Grenzen. Freigaben beziehen sich auf Inhalt, Referenzen und Dateifassung des geprüften Standes. Änderungen verlangen erneute Abnahme. Archiv, Nachfolgestände, Bestandsbewegungen und Wartungsfolgen behalten ihre Historien.

## Offline-Seite und Wiederverbindung

Der bereitgestellte Service Worker liegt in `static/sw.js`. Seine Regressionstests müssen diese Datei prüfen; `public/` ist die historische Referenz und wird nicht für Showtime ausgeliefert. `showtime-shell-v7` erneuert den öffentlichen Offline-Cache. Authentifizierte Seiten und API-Antworten werden weiterhin nicht darin gespeichert.

Navigation verwendet einen verfügbaren Netzwerk-Preload oder einen frischen Abruf und wiederholt einen vorübergehend fehlgeschlagenen Abruf einmal. Nur ein anhaltender Netzwerkfehler öffnet die Offline-Seite; HTTP-Fehler werden nicht durch Offline-HTML verdeckt. Die Ersatzantwort ist nicht im HTTP-Cache speicherbar.

Die Offline-Seite prüft den öffentlichen, nicht gecachten Marker `/connection.txt`. Bei wieder verfügbarer Verbindung kehrt sie zum ursprünglichen Arbeitsbereich zurück. Unfertige Eingaben verhindern den automatischen Wechsel; ein manueller Wechsel verlangt in diesem Fall eine Bestätigung. Pro Sitzung gibt es höchstens einen automatischen Rückkehrversuch, bis eine reguläre App-Seite geladen wurde. Damit entsteht keine Neuladeschleife. Anmeldung und Arbeitsraum aktualisieren den Service Worker über das gemeinsame Layout.

Geräteentwürfe bleiben ausdrücklich unzugeordnet und verwenden aus Kompatibilitätsgründen ihren bisherigen lokalen Schlüssel. Unter „Zeit buchen“ können sie nach Anmeldung nur durch die bewusste Übernahme in das angezeigte Konto und Theater zu Kontoeinträgen werden. Kontogebundene Entwürfe behalten ihren Theater-/Personen-Namensraum. Ein veralteter Browserstand lässt sich mit „Verbindung erneut prüfen“ oder einem vollständigen Neuladen aktualisieren; dafür keine lokalen Entwürfe oder Browserdaten löschen.
