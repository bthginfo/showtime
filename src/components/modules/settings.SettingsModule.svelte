<script lang="ts">
import {memberCan} from "@/shared/access-policy";
import { Check, Copy, KeyRound, Link as LinkIcon, ShieldCheck } from "@lucide/svelte";
import { useWorkspace } from "../workspace-context";
import { Badge, Button, ErrorMessage, Modal, PageHeader, Section } from "../ui";
import { AppearanceCard } from "@/modules/profile/components/appearance-card";
import { WorkingTimeCard } from "@/modules/profile/components/working-time-card";
import { PushCard } from "@/modules/notifications/components/push-card";
import { PasswordInput } from "../password-input";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    navigate?: (module: string) => void;
};
export let navigate: ViewProps["navigate"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, action, busy } = $workspaceStore;
$: ({ workspace, action, busy } = $workspaceStore);
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let notice: string = "";
const setNotice = (next: typeof notice | ((current: typeof notice) => typeof notice)) => { notice = typeof next === "function" ? (next as (current: typeof notice) => typeof notice)(notice) : next; };
let url: string = "";
const setUrl = (next: typeof url | ((current: typeof url) => typeof url)) => { url = typeof next === "function" ? (next as (current: typeof url) => typeof url)(url) : next; };
let reset: {
    name: string;
    code: string;
} | null = null;
const setReset = (next: {
    name: string;
    code: string;
} | null | ((current: {
    name: string;
    code: string;
} | null) => {
    name: string;
    code: string;
} | null)) => { reset = typeof next === "function" ? (next as (current: {
    name: string;
    code: string;
} | null) => {
    name: string;
    code: string;
} | null)(reset) : next; };
let admin = memberCan(workspace.user, 'members.manage');
let run = async (fn: () => Promise<unknown>) => {
    setError("");
    setNotice("");
    try {
        return await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
};
let password = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("newPassword") !== data.get("repeat")) {
        setError("Die neuen Passwörter stimmen nicht überein.");
        return;
    }
    await run(async () => {
        await action("password-change", undefined, {
            currentPassword: data.get("currentPassword"),
            newPassword: data.get("newPassword"),
        });
        form.reset();
        setNotice("Dein Passwort wurde geändert.");
    });
};
let subscription = async () => {
    const result = (await run(() => action("calendar-token"))) as {
        url?: string;
    } | undefined;
    if (result?.url)
        setUrl(new URL(result.url, location.origin).toString());
};

$: admin = memberCan(workspace.user, 'members.manage');




</script>


      <PageHeader title="Einstellungen" ></PageHeader>
      <ErrorMessage message={error}></ErrorMessage>
      {#if notice}<p class="success-message" role="status">
          <Check size={16}></Check>
          {notice}
        </p>{/if}
      <div class="settings-grid">
        <WorkingTimeCard></WorkingTimeCard>
        {#key workspace.user.id}<AppearanceCard></AppearanceCard>{/key}
        {#key `push:${workspace.user.id}`}<PushCard onOpenHelp={navigate ? () => navigate("/?module=help&guide=push") : undefined}></PushCard>{/key}
        <Section title="Dein Profil">
          <div class="panel-content profile">
            <span class="avatar large-avatar">
              {workspace.user.name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")}
            </span>
            <div>
              <h3>{workspace.user.name}</h3>
              <p class="muted">@{workspace.user.username}</p>
              <Badge tone="green">
                {workspace.user.role === "superadmin"
    ? "Superadmin"
    : workspace.user.role === "admin"
        ? "Admin"
        : "Teammitglied"}
              </Badge>
            </div>
          </div>
        </Section>
        <Section title="Passwort ändern">
          <form class="panel-content" method="POST" action="/api/actions" on:submit={password}>
            <PasswordInput label="Aktuelles Passwort" name="currentPassword" autoComplete="current-password" required></PasswordInput>
            <PasswordInput label="Neues Passwort" name="newPassword" autoComplete="new-password" minLength={10} required placeholder="Mindestens 10 Zeichen"></PasswordInput>
            <PasswordInput label="Neues Passwort wiederholen" name="repeat" autoComplete="new-password" minLength={10} required></PasswordInput>
            <Button variant="primary" type="submit" disabled={busy}>
              <KeyRound size={16}></KeyRound>
              Passwort speichern
            </Button>
          </form>
        </Section>
        <Section title="Outlook & andere Kalender">
          <div class="panel-content">
            <p class="muted">
              Abonniere deinen persönlichen Dienstplan in Outlook, Apple Kalender oder einer anderen
              Kalender-App. Der Link erlaubt Zugriff auf deine Termine.
            </p>
            <Button onClick={() => void subscription()} disabled={busy}>
              <LinkIcon size={16}></LinkIcon>
              Kalenderlink erstellen / anzeigen
            </Button>
            {#if url}<div class="subscription">
                <input readonly aria-label="Kalenderabonnement URL" value={url} />
                <Button onClick={() => void run(async () => {
    await navigator.clipboard.writeText(url);
    setNotice("Kalenderlink kopiert.");
})}>
                  <Copy size={15}></Copy>
                  Kopieren
                </Button>
                <a class="button secondary" href={url}>
                  ICS öffnen
                </a>
              </div>{/if}
            <p class="small muted">
              In Outlook: Kalender hinzufügen → Aus dem Internet abonnieren. Bestehende Abonnements
              werden nach Widerruf ungültig.
            </p>
            <Button variant="danger-ghost" onClick={() => {
    if (confirm("Kalenderlink widerrufen? Bestehende Abonnements verlieren ihren Zugriff."))
        void run(async () => {
            await action("calendar-token", undefined, { revoke: true });
            setUrl("");
            setNotice("Kalenderlink widerrufen.");
        });
}}>
              Link widerrufen
            </Button>
          </div>
        </Section>
      </div>
      {#if admin}<section class="panel margin-top">
          <header class="panel-heading">
            <div>
              <h2>Team & Berechtigungen</h2>
              <p class="small muted">
                Registrierungen freigeben, Zugänge verwalten und Passwörter zurücksetzen.
              </p>
            </div>
            <ShieldCheck size={20} className="accent"></ShieldCheck>
          </header>
          <div class="table-scroll">
            <table class="team-admin-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Zugang</th>
                  <th>Rolle</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {#each workspace.members as member (member.id)}<tr>
                    <td>
                      <strong>{member.name}</strong>
                      <span class="small muted">@{member.username}</span>
                    </td>
                    <td data-label="Zugang">
                      <Badge tone={member.status === "active"
    ? "green"
    : member.status === "pending"
        ? "coral"
        : "neutral"}>
                        {member.status === "active"
    ? "Aktiv"
    : member.status === "pending"
        ? "Freigabe ausstehend"
        : "Deaktiviert"}
                      </Badge>
                    </td>
                    <td data-label="Rolle">
                      {#if workspace.user.role === "superadmin" && member.id !== workspace.user.id}<select aria-label={`Rolle von ${member.name}`} disabled={busy} value={member.role} on:change={(event) => void run(() => action("member-update", member.id, { role: event.currentTarget.value }))}>
                          <option value="user">Teammitglied</option>
                          <option value="admin">Admin</option>
                          <option value="superadmin">Superadmin</option>
                        </select>{:else}{member.role === "superadmin" ? ("Superadmin") : member.role === "admin" ? ("Admin") : ("Teammitglied")}{/if}
                    </td>
                    <td data-label="Aktionen">
                      <div class="inline-actions">
                        {#if member.id !== workspace.user.id}
                            {#if member.status !== "active"}<Button disabled={busy} onClick={() => void run(() => action("member-update", member.id, { status: "active" }))}>
                                Freigeben
                              </Button>{:else}<Button disabled={busy} onClick={() => {
    if (confirm(`Zugang für ${member.name} deaktivieren?`))
        void run(() => action("member-update", member.id, { status: "disabled" }));
}}>
                                Deaktivieren
                              </Button>{/if}
                            <Button disabled={busy} onClick={() => void run(async () => {
    const result = (await action("password-reset", member.id)) as {
        code: string;
    };
    setReset({ name: member.name, code: result.code });
})}>
                              Passwort zurücksetzen
                            </Button>
                          {/if}
                      </div>
                    </td>
                  </tr>{/each}
              </tbody>
            </table>
          </div>
        </section>{/if}
      {#if reset}{@const activeReset=reset}<Modal title={`Passwort zurücksetzen · ${activeReset.name}`} onClose={() => setReset(null)}>
          <p class="muted">
            Gib diesen Wiederherstellungscode persönlich an {activeReset.name} weiter. Der Code ist
            vertraulich und wird hier nur einmal angezeigt.
          </p>
          <label>
            Wiederherstellungscode
            <input readonly value={activeReset.code} />
          </label>
          <footer class="dialog-footer">
            <Button onClick={() => void navigator.clipboard.writeText(activeReset.code)}>
              <Copy size={15}></Copy>
              Kopieren
            </Button>
            <Button variant="primary" onClick={() => setReset(null)}>
              Schließen
            </Button>
          </footer>
        </Modal>{/if}
