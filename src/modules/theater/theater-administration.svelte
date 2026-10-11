<script lang="ts">
  import RuleProfiles from "./rule-profiles.svelte";
  import { moduleById } from "./registry";
  import { rolePermissions } from "@/platform/access";
  import type { Configuration, Configure } from "./types";
  import { roleLabels } from "./types";
  import { roleKeys } from "@/platform/access";
  import { useWorkspace } from "@/components/workspace-context";
  import { Button, Badge } from "@/components/ui";
  import { theaterLabel, theaterInstant } from "@/shared/theater-time";
  export let configuration: Configuration;
  export let configure: Configure;
  export let busy = false;
  export let invitationUrl = "";
  const store = useWorkspace();
  $: workspace = $store.workspace;
  let inviteRole = "employee";
  let grantRole = "employee";
  let grantScope = "department";
  const formData = (event: SubmitEvent) =>
    Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement));
  async function invite(event: SubmitEvent) {
    const data = formData(event);
    data.expiresInDays = Number(data.expiresInDays) as any;
    if (data.role !== "guest") delete data.productionId;
    await configure("invite", data);
  }
  async function grant(event: SubmitEvent) {
    const data = formData(event);
    if (data.scope === "tenant") data.scopeId = null as any;
    else if (data.scope === "production") data.scopeId = data.productionId;
    delete data.productionId;
    data.sensitiveConfirmed = sensitiveAccepted as any;
    if (data.expiresAt)
      data.expiresAt = theaterInstant(
        String(data.expiresAt),
        configuration.settings.timezone,
      ) as any;
    else delete data.expiresAt;
    await configure("grant", data);
  }
  async function settings(event: SubmitEvent) {
    const form = new FormData(event.currentTarget as HTMLFormElement);
    await configure("settings", {
      timezone: String(form.get("timezone")),
      workRules: {
        minimumBreakMinutes: Number(form.get("break")),
        breakAfterHours: Number(form.get("breakAfter")),
        minimumRestHours: Number(form.get("rest")),
        maxDutyHours: Number(form.get("duty")),
        confirmedByTheater: form.get("confirmed") === "on",
      },
      quotas: {
        members: Number(form.get("members")),
        filesBytes: Number(form.get("filesMB")) * 1_000_000,
        uploadsPerUserPerDay: Number(form.get("uploads")),
      },
      requiredReadinessModules: form.getAll("readiness").map(String),
    });
  }
  const scopeName = (scope: string, id: string | null) =>
    scope === "tenant"
      ? "Gesamtes Theater"
      : scope === "department"
        ? configuration.departments.find((d) => d.id === id)?.name || "Gewerk"
        : String(
            workspace.records.productions.find((p) => p.id === id)?.data.title || "Produktion",
          );
  const permissionLabel = (key: string) =>
    ({
      time: "Arbeitszeiten",
      measurements: "Vertrauliche Maße",
      education: "Teilnehmenden- und Einwilligungsdaten",
      budget: "Budgets und Beschaffung",
      personnel: "Personaldaten",
      tenant: "Theatereinrichtung",
      collaboration: "Gewerkabstimmungen",
      production: "Produktionen",
      schedule: "Spiel- und Dienstplan",
      document: "Fachstände und Dokumente",
      cue: "Gemeinsame Vorstellungs-Cues",
      scene: "Gemeinsame Produktionsszenen",
      handover: "Dienstübergaben",
      chat: "Gespräche",
      inventory: "Ressourcen und Bestand",
      task: "Aufgaben",
      leave: "Abwesenheiten",
      availability: "Verfügbarkeit",
      readiness: "Bereitschaft",
      roles: "Rollenvergabe",
      members: "Mitglieder",
      modules: "Module",
      invitations: "Einladungen",
      audit: "Änderungsprotokoll",
    })[key.split(".")[0]] || key;
  $: rolePreview = [
    ...new Set(rolePermissions[grantRole as keyof typeof rolePermissions].map(permissionLabel)),
  ];
  $: sensitive = ["personnel", "costume_specialist", "intendance"].includes(grantRole);
  let sensitiveAccepted = false;
  let memberSearch = "";
  const dateLabel = (value: unknown, withTime = false) =>
    theaterLabel(String(value || ""), configuration.settings.timezone, withTime);
  $: filteredMembers = configuration.members.filter((m) =>
    m.name.toLocaleLowerCase("de").includes(memberSearch.toLocaleLowerCase("de")),
  );
</script>

<section class="surface">
  <h2>Einrichtung des Theaters</h2>
  <p>
    Die folgenden Schritte machen Zugänge und Zuständigkeiten nachvollziehbar. Unbestätigte
    Dienstregeln bleiben unwirksam.
  </p>
  <ol>
    <li>
      Aktive Gewerke: {configuration.modules.filter((m) => m.enabled).length} · Räume und Geräte unter
      Ressourcen anlegen.
    </li>
    <li>
      Team: {configuration.members.filter((m) => m.status === "active").length} aktive Personen. Rollen
      vor der Zuweisung prüfen.
    </li>
    <li>Regelprofile und erforderliche Gewerke gemeinsam bestätigen.</li>
  </ol>
  {#if configuration.settings.settings.setupCompletedAt}<Badge
      >Einrichtung abgeschlossen am {dateLabel(
        configuration.settings.settings.setupCompletedAt,
      )}</Badge
    >{:else}<Button
      disabled={busy}
      onClick={() => void configure("settings", { setupComplete: true })}
      >Einrichtung als geprüft abschließen</Button
    >{/if}
</section>
<section class="surface">
  <h2>Gewerke und Module</h2>
  {#each configuration.modules as activation (activation.moduleId)}<div class="form-grid">
      <label class="check-label"
        ><input
          type="checkbox"
          checked={activation.enabled}
          disabled={busy}
          on:change={(e) =>
            void configure("module", {
              moduleId: activation.moduleId,
              enabled: e.currentTarget.checked,
            })}
        />{moduleById(activation.moduleId)?.label || activation.moduleId}</label
      ><label
        >Gewerk<select
          value={activation.config.departmentId || ""}
          disabled={busy}
          on:change={(e) =>
            void configure("module", {
              moduleId: activation.moduleId,
              enabled: activation.enabled,
              departmentId: e.currentTarget.value,
            })}
          >{#each configuration.departments as department (department.id)}<option
              value={department.id}>{department.name}</option
            >{/each}</select
        ></label
      >
    </div>{/each}
  <form
    class="form-grid"
    on:submit|preventDefault={(e) => void configure("department", formData(e))}
  >
    <label>Neues Gewerk<input name="name" minlength="2" maxlength="100" required /></label><button
      class="button"
      disabled={busy}>Gewerk hinzufügen</button
    >
  </form>
</section>
<section class="surface">
  <h2>Person einladen</h2>
  <p class="small muted">
    Sensible Zusatzrollen für Personal, Maße und Intendanz werden nach dem Beitritt mit einer
    begründeten Bestätigung vergeben.
  </p>
  <form class="form-grid" on:submit|preventDefault={(e) => void invite(e)}>
    <label
      >Gewerk<select name="departmentId"
        >{#each configuration.departments as d (d.id)}<option value={d.id}>{d.name}</option
          >{/each}</select
      ></label
    ><label
      >Rolle<select name="role" bind:value={inviteRole}
        >{#each roleKeys.filter((role) => !["personnel", "costume_specialist", "intendance"].includes(role)) as role (role)}<option
            value={role}>{roleLabels[role]}</option
          >{/each}</select
      ></label
    ><label
      >Einladung gültig (Tage)<input
        name="expiresInDays"
        type="number"
        min="1"
        max="30"
        value="7"
        required
      /></label
    >{#if inviteRole === "guest"}<label
        >Produktion<select name="productionId" required
          >{#each workspace.records.productions as p (p.id)}<option value={p.id}
              >{String(p.data.title)}</option
            >{/each}</select
        ></label
      >
      <p class="small muted">
        Der Gastzugang endet mit dem Ablaufdatum dieser Einladung.
      </p>{/if}<button class="button primary" disabled={busy}>Einladung erstellen</button>
  </form>
  {#if invitationUrl}<label>Einmaliger Einladungslink<input readonly value={invitationUrl} /></label
    >{/if}
</section>
<section class="surface">
  <h2>Mitglieder und Rechte</h2>
  <p>
    Rollen gelten für das Theater, ein Gewerk oder eine Produktion. Private Chats bleiben auf ihre
    Teilnehmenden begrenzt.
  </p>
  <label
    >Team durchsuchen<input
      type="search"
      bind:value={memberSearch}
      placeholder="Name eingeben"
    /></label
  >{#each filteredMembers as member (member.userId)}<details class="member-access">
      <summary
        >{member.name} · {member.status === "active"
          ? "Aktiv"
          : member.status === "disabled"
            ? "Deaktiviert"
            : "Wartend"} · {configuration.grants
          .filter((g) => g.userId === member.userId)
          .map((g) => roleLabels[g.role])
          .join(", ")}</summary
      >
      <article>
        <h3>
          {member.name}
          <Badge
            >{member.status === "active"
              ? "Aktiv"
              : member.status === "disabled"
                ? "Deaktiviert"
                : "Wartend"}</Badge
          >
        </h3>
        {#if member.userId !== workspace.user.id}<Button
            disabled={busy}
            onClick={() =>
              void configure("member", {
                userId: member.userId,
                status: member.status === "active" ? "disabled" : "active",
              })}>{member.status === "active" ? "Zugang deaktivieren" : "Zugang aktivieren"}</Button
          >{/if}
        <ul>
          {#each configuration.grants.filter((g) => g.userId === member.userId) as g (g.id)}<li>
              {roleLabels[g.role]} · {scopeName(g.scope, g.scopeId)}{g.expiresAt
                ? " · bis " + dateLabel(g.expiresAt, true)
                : ""}{#if !(g.role === "theater_admin" && g.userId === workspace.user.id)}<Button
                  variant="danger-ghost"
                  disabled={busy}
                  onClick={() => void configure("grant-revoke", { id: g.id })}
                  >Rolle entziehen</Button
                >{/if}
            </li>{/each}
        </ul>
      </article>
    </details>{/each}
  <form class="form-grid" on:submit|preventDefault={(e) => void grant(e)}>
    <label
      >Person<select name="userId" required
        >{#each configuration.members as member (member.userId)}<option value={member.userId}
            >{member.name}</option
          >{/each}</select
      ></label
    ><label
      >Rolle<select name="role" bind:value={grantRole}
        >{#each roleKeys as role (role)}<option value={role}>{roleLabels[role]}</option
          >{/each}</select
      ></label
    ><label
      >Geltungsbereich<select name="scope" bind:value={grantScope}
        ><option value="department">Gewerk</option><option value="production">Produktion</option
        ><option value="tenant">Gesamtes Theater</option></select
      ></label
    >{#if grantScope === "department"}<label
        >Gewerk<select name="scopeId" required
          >{#each configuration.departments as d (d.id)}<option value={d.id}>{d.name}</option
            >{/each}</select
        ></label
      >{:else if grantScope === "production"}<label
        >Produktion<select name="productionId" required
          >{#each workspace.records.productions as p (p.id)}<option value={p.id}
              >{String(p.data.title)}</option
            >{/each}</select
        ></label
      >{/if}
    <aside class="full">
      <strong>Vorschau dieser Zusatzrolle</strong>
      <p>{rolePreview.join(" · ")}</p>
      <p class="small muted">
        Der Geltungsbereich begrenzt diese Rechte. Vorhandene Rollen ergänzen sie; private Gespräche
        bleiben auf Teilnehmende beschränkt. Theateradministration allein öffnet keine privaten
        Fachdaten.
      </p>
    </aside>
    {#if sensitive}<label class="full"
        >Begründung für den sensiblen Zugriff<textarea
          name="sensitiveReason"
          required
          minlength="10"
          maxlength="2000"
          placeholder="Aufgabe und Zuständigkeit im Theater"></textarea></label
      ><label class="check-label full"
        ><input type="checkbox" bind:checked={sensitiveAccepted} required />Der sensible
        Zusatzbereich und die Zuständigkeit wurden geprüft.</label
      >{/if}<label
      >Ablaufdatum (optional)<input
        name="expiresAt"
        type="datetime-local"
        required={grantRole === "guest"}
      /></label
    ><button class="button primary" disabled={busy}>Rolle zuweisen</button>
  </form>
</section>
<section class="surface">
  <h2>Hausregeln und Kontingente</h2>
  <form class="form-grid" on:submit|preventDefault={(e) => void settings(e)}>
    <label>Zeitzone<input name="timezone" value={configuration.settings.timezone} required /></label
    ><label
      >Max. Dienstdauer (Stunden)<input
        type="number"
        name="duty"
        min="1"
        max="24"
        step="0.5"
        value={Number(configuration.settings.settings.workRules?.maxDutyHours || 8)}
        required
      /></label
    ><label
      >Ruhezeit (Stunden)<input
        type="number"
        name="rest"
        min="0"
        max="24"
        step="0.5"
        value={Number(configuration.settings.settings.workRules?.minimumRestHours || 0)}
        required
      /></label
    ><label
      >Pause (Minuten)<input
        type="number"
        name="break"
        min="0"
        max="180"
        value={Number(configuration.settings.settings.workRules?.minimumBreakMinutes || 0)}
        required
      /></label
    ><label
      >Pause ab Dienstdauer (Stunden)<input
        type="number"
        name="breakAfter"
        min="1"
        max="24"
        step="0.5"
        value={Number(configuration.settings.settings.workRules?.breakAfterHours || 6)}
        required
      /></label
    ><label class="check-label"
      ><input
        type="checkbox"
        name="confirmed"
        checked={configuration.settings.settings.workRules?.confirmedByTheater === true}
      />Diese Planungsregeln sind durch das Theater bestätigt.</label
    ><label
      >Mitgliederkontingent<input
        type="number"
        name="members"
        min="1"
        max="2000"
        value={configuration.settings.settings.quotas?.members || 500}
        required
      /></label
    ><label
      >Dateikontingent (MB)<input
        type="number"
        name="filesMB"
        min="1"
        max="1000"
        value={(configuration.settings.settings.quotas?.filesBytes || 250_000_000) / 1_000_000}
        required
      /></label
    ><label
      >Uploads pro Person / 24 Stunden<input
        type="number"
        name="uploads"
        min="1"
        max="1000"
        value={configuration.settings.settings.quotas?.uploadsPerUserPerDay || 200}
        required
      /></label
    >
    <fieldset class="form-multi full">
      <legend>Erforderliche Gewerke vor Generalprobe und Spielbetrieb</legend
      >{#each configuration.modules.filter((m) => m.enabled) as module (module.moduleId)}<label
          class="check-label"
          ><input
            type="checkbox"
            name="readiness"
            value={module.moduleId}
            checked={(
              configuration.settings.settings.requiredReadinessModules || [
                "stage",
                "lighting",
                "sound",
                "costume",
                "makeup",
                "props",
                "stage-management",
              ]
            ).includes(module.moduleId)}
          />{moduleById(module.moduleId)?.label || module.moduleId}</label
        >{/each}
    </fieldset>
    <button class="button primary" disabled={busy}>Hausregeln speichern</button>
  </form>
</section>
<RuleProfiles {configuration} {configure} {busy} />
<section class="surface">
  <h2>Fristen und Eskalation</h2>
  <form
    class="form-grid"
    on:submit|preventDefault={(e) => {
      const f = new FormData(e.currentTarget as HTMLFormElement);
      void configure("settings", {
        reminderRules: {
          beforeDays: Number(f.get("beforeDays")),
          escalateAfterDays: Number(f.get("escalateAfterDays")),
        },
      });
    }}
  >
    <label
      >Vor Frist erinnern (Tage)<input
        type="number"
        name="beforeDays"
        min="0"
        max="30"
        value={configuration.settings.settings.reminderRules?.beforeDays ?? 2}
        required
      /></label
    ><label
      >Nach Frist an Leitung eskalieren (Tage)<input
        type="number"
        name="escalateAfterDays"
        min="0"
        max="30"
        value={configuration.settings.settings.reminderRules?.escalateAfterDays ?? 2}
        required
      /></label
    ><button class="button" disabled={busy}>Erinnerungsregeln speichern</button>
  </form>
  <p class="small muted">
    Nachrichten erscheinen in der Anwendung. Nur aktuell berechtigte Verantwortliche, Vertretungen
    und Leitungen erhalten sie.
  </p>
</section>
<details class="surface admin-diagnostics">
  <summary>Ereignisverarbeitung ({configuration.events.length})</summary>
  {#each configuration.events as event (event.id)}<p>
      {event.type} · {(
        {
          pending: "Ausstehend",
          queued: "Versendet",
          processing: "In Verarbeitung",
          done: "Verarbeitet",
          failed: "Fehlgeschlagen",
        } as Record<string, string>
      )[event.status] || event.status} · {event.attempts} Versuche{#if event.status === "failed"}<Button
          disabled={busy}
          onClick={() => void configure("event-retry", { id: event.id })}>Erneut verarbeiten</Button
        >{/if}
    </p>{/each}
</details>
<details class="surface admin-diagnostics">
  <summary>Änderungsprotokoll ({configuration.audit.length})</summary>
  <table>
    <thead><tr><th>Zeit</th><th>Person</th><th>Aktion</th></tr></thead><tbody
      >{#each configuration.audit as entry (entry.id)}<tr
          ><td>{dateLabel(entry.createdAt, true)}</td><td
            >{configuration.members.find((m) => m.userId === entry.userId)?.name ||
              entry.userId}</td
          ><td>{entry.action}</td></tr
        >{/each}</tbody
    >
  </table>
</details>

<style>
  .admin-diagnostics summary {
    cursor: pointer;
    min-height: 44px;
    font-weight: 600;
  }
  .admin-diagnostics[open] summary {
    margin-bottom: 20px;
  }
  .admin-diagnostics {
    overflow: auto;
  }
</style>
