<script lang="ts">
  import { useWorkspace } from "@/components/workspace-context";
  import { Button, Badge, ErrorMessage } from "@/components/ui";
  import type { Configuration, Configure } from "./types";
  import type { WorkRuleProfile } from "@/shared/work-rule-profiles";
  export let configuration: Configuration;
  export let configure: Configure;
  export let busy = false;
  const store = useWorkspace();
  let editing = false,
    error = "",
    id = "",
    name = "",
    memberIds: string[] = [],
    actorIds: string[] = [];
  let maxDutyHours = 8,
    minimumRestHours = 11,
    minimumBreakMinutes = 30,
    breakAfterHours = 6,
    maxWeeklyHours = 40,
    maxConsecutiveDays = 6,
    confirmed = false;
  $: profiles = configuration.settings.settings.workRuleProfiles || [];
  function edit(profile?: WorkRuleProfile) {
    id = profile?.id || crypto.randomUUID();
    name = profile?.name || "";
    memberIds = [...(profile?.memberIds || [])];
    actorIds = [...(profile?.actorIds || [])];
    maxDutyHours = profile?.rules.maxDutyHours || 8;
    minimumRestHours = profile?.rules.minimumRestHours ?? 11;
    minimumBreakMinutes = profile?.rules.minimumBreakMinutes ?? 30;
    breakAfterHours = profile?.rules.breakAfterHours || 6;
    maxWeeklyHours = profile?.rules.maxWeeklyHours || 40;
    maxConsecutiveDays = profile?.rules.maxConsecutiveDays || 6;
    confirmed = profile?.rules.confirmedByTheater === true;
    editing = true;
    error = "";
  }
  async function save() {
    try {
      await configure("settings", {
        workRuleProfiles: [
          ...profiles.filter((p) => p.id !== id),
          {
            id,
            name,
            memberIds,
            actorIds,
            rules: {
              maxDutyHours,
              minimumRestHours,
              minimumBreakMinutes,
              breakAfterHours,
              maxWeeklyHours,
              maxConsecutiveDays,
              confirmedByTheater: confirmed,
            },
          },
        ],
      });
      editing = false;
    } catch (e) {
      error = (e as Error).message;
    }
  }
</script>

<section class="surface">
  <div class="section-heading">
    <h2>Regelprofile für Beschäftigtengruppen</h2>
    <Button onClick={() => edit()}>Profil anlegen</Button>
  </div>
  <p>
    Jede Person gehört höchstens einem Profil an. Unbestätigte Profile wirken noch nicht auf die
    Planung. Die vorgeschlagenen Zahlen sind Eingabehilfen und müssen anhand der örtlichen
    Vereinbarungen geprüft werden.
  </p>
  <ErrorMessage message={error} />
  {#each profiles as profile (profile.id)}<article class="notification-row">
      <div>
        <h3>
          {profile.name}
          <Badge>{profile.rules.confirmedByTheater ? "Bestätigt" : "Noch zu prüfen"}</Badge>
        </h3>
        <p class="small muted">
          {profile.memberIds.length + profile.actorIds.length} Zuordnungen · {profile.rules
            .maxDutyHours} Stunden je zusammenhängendem Dienst · {profile.rules.maxWeeklyHours ||
            "–"} Stunden je Kalenderwoche
        </p>
      </div>
      <Button disabled={busy} onClick={() => edit(profile)}>Profil bearbeiten</Button>
    </article>{/each}
  {#if !profiles.length}<p class="muted">
      Noch keine gruppenspezifischen Regeln. Bis zur Bestätigung greifen nur bereits bestätigte
      Hausregeln.
    </p>{/if}
  {#if editing}<form class="form-grid" on:submit|preventDefault={() => void save()}>
      <label
        >Profilname<input
          bind:value={name}
          required
          maxlength="100"
          placeholder="z. B. Technischer Dienst"
        /></label
      ><label
        >Max. Dienstdauer (Stunden)<input
          type="number"
          min="1"
          max="24"
          step="0.5"
          bind:value={maxDutyHours}
          required
        /></label
      ><label
        >Ruhezeit (Stunden)<input
          type="number"
          min="0"
          max="48"
          step="0.5"
          bind:value={minimumRestHours}
          required
        /></label
      ><label
        >Pause (Minuten)<input
          type="number"
          min="0"
          max="180"
          bind:value={minimumBreakMinutes}
          required
        /></label
      ><label
        >Pause ab (Stunden)<input
          type="number"
          min="1"
          max="24"
          step="0.5"
          bind:value={breakAfterHours}
          required
        /></label
      ><label
        >Max. Wochenstunden<input
          type="number"
          min="1"
          max="168"
          step="0.5"
          bind:value={maxWeeklyHours}
          required
        /></label
      ><label
        >Max. aufeinanderfolgende Diensttage<input
          type="number"
          min="1"
          max="31"
          bind:value={maxConsecutiveDays}
          required
        /></label
      >
      <fieldset class="form-multi full">
        <legend>Teammitglieder</legend
        >{#each configuration.members.filter((m) => m.status === "active") as m (m.userId)}<label
            class="check-label"
            ><input type="checkbox" bind:group={memberIds} value={m.userId} />{m.name}</label
          >{/each}
      </fieldset>
      <fieldset class="form-multi full">
        <legend>Ensemble / Gäste</legend
        >{#each $store.workspace.records.actors as person (person.id)}<label class="check-label"
            ><input type="checkbox" bind:group={actorIds} value={person.id} />{String(
              person.data.name || "Ensemblemitglied",
            )}</label
          >{/each}
      </fieldset>
      <label class="check-label full"
        ><input type="checkbox" bind:checked={confirmed} />Die zuständige Theaterleitung hat dieses
        Profil geprüft und bestätigt. Es wird damit verbindlich bei Planungsänderungen geprüft.</label
      >
      <div class="button-row full">
        <button class="button primary" disabled={busy}>Profil speichern</button><Button
          onClick={() => (editing = false)}>Abbrechen</Button
        >
      </div>
    </form>{/if}
</section>
