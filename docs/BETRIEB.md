# Betrieb von Showtime

## Ressourcen und Umgebungen

Repository: [bthginfo/showtime](https://github.com/bthginfo/showtime). Produktion: [Showtime](https://showtime-bthginfo.vercel.app). Vercel-Projekt `showtime`, Node.js 24, SvelteKit, Fluid Compute und Region Frankfurt `fra1`. Der vorhandene Vercel-Pro-Tarif wird verwendet.

Production, Preview und Development besitzen jeweils ein eigenes Neon-Free-Projekt, einen eigenen privaten Blob-Store sowie eigene Auth-, Cron- und VAPID-Schlüssel. Die Produktionsdatenbank ist das Neon-Projekt `royal-glade-27927910`. Die Ressourcen sind unabhängig von DigitalMask. Ein Preview-Deployment verwendet seinen eigenen Vercel-Host für Auth und Einladungslinks.

| Umgebung    | Verwendung                                                        |
| ----------- | ----------------------------------------------------------------- |
| Development | Synthetische Integrationstests, Browserabnahme und Restoreproben  |
| Preview     | Geschützte Vorschau mit ausschließlich eigenen Vorschauressourcen |
| Production  | Separates Starttheater; keine Altdatenmigration                   |

Laufzeitvariablen stehen in `.env.example`. Die vier Rollen-URLs, Authsecret, Cronsecret, private Blob-Zugangsdaten und VAPID-Schlüssel gehören in die jeweilige Vercel-Umgebung. Migrationseigentümer und Verwaltungs-PATs gehören nicht in Functions oder Git. `.env*`, `.local` und `.vercel` sind ignoriert.

Die lokale Erstinstallation verwahrt `.local/runtime-<environment>.json`, `.local/.env.owner-<environment>` und `.local/access-<environment>.json`. Die Zugriffdatei enthält den Bootstrap-Zugang und muss privat bleiben. Passwort beim ersten Einsatz ändern. Diese Dateien und der Backupschlüssel sind nicht aus Git rekonstruierbar; separat und verschlüsselt sichern.

## Einrichtung und Release

1. Node.js 24 installieren und `npm ci` ausführen.
2. Ausschließlich neue Showtime-Ressourcen provisionieren. Eigentümervariablen der gewünschten Neon-Umgebung privat unter `.local/.env.owner-<environment>` ablegen; den passenden privaten Blob-Token hinzufügen.
3. `npm run db:migrate -- development` ausführen. Für andere Ziele den Namen ausdrücklich ersetzen. Das Skript wendet Drizzle-Migrationen, RLS-Policies und getrennte Laufzeitrollen an und schreibt nur ignorierte Runtime-Dateien.
4. `npm run bootstrap -- development` einmalig ausführen. Ein neutraler Theaterdatensatz mit zwanzig Gewerken und einem privaten Bootstrap-Zugang entsteht. Keine Schauspieler- oder DigitalMask-Daten werden importiert.
5. `npm run typecheck`, `npm run lint`, `npx tsc --noEmit -p tsconfig.scripts.json`, `npm test` und `npm run build` ausführen. Sicherheits- oder Planungsänderungen zusätzlich gegen die separate Entwicklungsdatenbank und im Browser prüfen.
6. Geprüften Commit veröffentlichen und das separate Vercel-Projekt deployen. Produktion mit `vercel deploy --prod`; Vorschau mit `vercel deploy`. Eigentümervariablen niemals ins Deployment übernehmen.
7. Auf der tatsächlichen Deployment-Adresse Anmeldung, Kontextwechsel, private Datei, Dokumentänderung, PDF-Export und Queue-Folgeaktion prüfen. Ein erfolgreicher Build allein genügt nicht.

CI führt keine Produktionsmigrationen und keinen Bootstrap aus. Additive Migrationen bevorzugen und die Verträglichkeit mit noch laufenden alten Eventversionen prüfen. Vor destruktiven Schemaänderungen ein vollständiges Backup anfertigen. Der Build ergänzt Queue-Trigger, Noto-Schriften, Portraitmodell und dynamisch geladene PDFKit-Schriftmodule in den Function-Bundles.

Das Vercel-Projekt ist mit `bthginfo/showtime` verbunden; `main` ist der Produktionsbranch. Neue Commits werden durch GitHub CI geprüft und lösen die Git-Bereitstellung aus. Der initiale Release wurde zusätzlich ausdrücklich für Produktion und geschützte Preview aus demselben geprüften Git-Commit gebaut und auf beiden Adressen abgenommen.

## Zugänge und Verwaltung

Neue Theater entstehen über die Plattformverwaltung und erhalten einen einmaligen, sieben Tage gültigen Einladungslink für die Theateradministration. Bestehende Konten können die Einladung ebenfalls annehmen. Gewerk- und Gastzugänge vergibt die zuständige Theaterverwaltung; Gastrollen sind an eine Produktion gebunden und können ablaufen. Mitgliedschaften, Rollen und Theatersperren werden bei jedem neuen Zugriff geprüft.

Die Theaterverwaltung konfiguriert Gewerke, Module, Arbeitsregeln, Bereitschaftsanforderungen, Mitglieder, Rollen und Kontingente. Der Anfangsbestand ist neutral. Vor Nutzung der automatischen Planprüfung die tatsächlich geltenden Hausregeln bestätigen. Die übernommene Kalenderdarstellung verwendet Europe/Berlin.

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

Identitäten müssen im Ziel bereits vorhanden sein. Passwörter, Sessions, Einladungen, ICS-Tokens, Push-Abonnements und laufende Timer werden nicht kopiert. Für eine vollständige Wiederherstellung in ein neues Authsystem sind deshalb zusätzlich ein gesicherter Identitätsbestand und neue Einladungen nötig. Die getestete Tenant-Wiederherstellung arbeitet in der isolierten Entwicklungsumgebung.

## Kosten und Kontingente

Neue Datenbanken bleiben auf Neon Free; es wurde kein neuer kostenpflichtiger Datenbank- oder Redis-Tarif gekauft. Private Blob-Speicher, Queue-, Function- und Datenverkehrsnutzung unterliegen den Freikontingenten beziehungsweise der Abrechnung des vorhandenen Vercel-Pro-Kontos. Das ist keine Garantie für kostenlosen Betrieb bei beliebiger Nutzung.

Die Erstinstallation arbeitet ohne Redis. Aktive Live- und Dokumentansichten prüfen PostgreSQL regelmäßig; Hintergrundtabs pausieren, aber dauerhaft aktive Clients können Neon am Einschlafen hindern. Listen sind paginiert, Kalender zeitlich begrenzt, Uploads auf 4 MB pro Datei beschränkt und Exportmengen begrenzt. Die Theaterkontingente sind technische Zugangsgrenzen und ersetzen keine anbieterweiten Budgetalarme. Verbrauch bei wachsender Nutzung im Neon- und Vercel-Dashboard prüfen.
