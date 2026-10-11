<script lang="ts">
  import { theaterLabel } from "@/shared/theater-time";
  import { onMount } from "svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { api, post } from "@/shared/client-api";
  import { Button, Badge, ErrorMessage } from "@/components/ui";
  import { hasPermission } from "@/platform/access";
  import type { Planning } from "./types";
  import { theaterInstant } from "@/shared/theater-time";
  export let planning: Planning;
  export let productionId = "";
  export let onChanged: () => Promise<void>;
  const store = useWorkspace();
  let policyVersion = 0;
  let performanceId = "",
    states: Planning["readiness"] = [],
    required: string[] = [],
    waivers: { moduleId: string; reason: string; expiresAt: string; approvedBy?: string }[] = [],
    error = "",
    busy = false,
    editing = false,
    waiveModule = "",
    waiveReason = "",
    waiveUntil = "";
  $: subject = { id: $store.workspace.user.id, grants: $store.workspace.user.grants || [] };
  $: mayConfigure =
    hasPermission(subject, "production.manage", { productionId, departmentId: "" }) ||
    hasPermission(subject, "readiness.manage", { productionId, departmentId: "" });
  $: mayWaive = hasPermission(subject, "readiness.manage", { productionId, departmentId: "" });
  async function load() {
    if (!productionId) return;
    busy = true;
    error = "";
    try {
      const result = await api<{
        states: typeof states;
        policy: { required: string[]; waivers: typeof waivers; version: number } | null;
      }>(
        "/api/theater/operations?readiness=" +
          encodeURIComponent(productionId) +
          (performanceId ? "&performanceId=" + encodeURIComponent(performanceId) : ""),
      );
      states = result.states;
      policyVersion = result.policy?.version || 0;
      required = result.policy?.required || states.filter((s) => s.required).map((s) => s.moduleId);
      waivers = result.policy?.waivers || [];
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  onMount(() => void load());
  function addWaiver() {
    const instant = theaterInstant(waiveUntil, planning.timezone);
    if (!waiveModule || waiveReason.trim().length < 10 || !instant) {
      error = "Wähle ein Gewerk, eine Begründung und ein gültiges Ablaufdatum.";
      return;
    }
    waivers = [
      ...waivers.filter((w) => w.moduleId !== waiveModule),
      { moduleId: waiveModule, reason: waiveReason, expiresAt: instant },
    ];
    waiveReason = "";
  }
  async function save() {
    busy = true;
    error = "";
    try {
      await post("/api/theater/operations", {
        action: "readiness-policy",
        data: {
          productionId,
          expectedVersion: policyVersion,
          performanceId: performanceId || undefined,
          required,
          waivers: waivers
            .filter((w) => required.includes(w.moduleId))
            .map(({ moduleId, reason, expiresAt }) => ({ moduleId, reason, expiresAt })),
        },
      });
      editing = false;
      await onChanged();
      await load();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  const dateLabel = (value: string, withTime = false) =>
    theaterLabel(value, planning.timezone, withTime);
</script>

<section class="surface">
  <div class="section-heading">
    <h2>Bereitschaft der Gewerke</h2>
    {#if productionId}<Button disabled={busy} onClick={() => void load()}
        >Aktuellen Stand laden</Button
      >{/if}
  </div>
  <ErrorMessage message={error} />
  {#if !productionId}<p>
      Wähle eine Produktion, um ihre geprüften Fachstände und Anforderungen zu sehen.
    </p>{:else}<label
      >Geltungsbereich<select bind:value={performanceId} on:change={() => void load()}
        ><option value="">Gesamte Produktion</option
        >{#each planning.performances.filter((p) => p.productionId === productionId && p.status !== "cancelled") as show (show.id)}<option
            value={show.id}>Vorstellung {dateLabel(show.curtainAt, true)}</option
          >{/each}</select
      ></label
    >
    <div class="table-wrap">
      <table>
        <thead><tr><th>Gewerk</th><th>Anforderung</th><th>Stand</th><th>Prüfung</th></tr></thead
        ><tbody
          >{#each states as state (state.moduleId)}<tr
              ><td>{state.label}</td><td>{state.required ? "Erforderlich" : "Optional"}</td><td
                ><Badge
                  >{state.waiver
                    ? "Begründete Ausnahme"
                    : state.stale
                      ? "Fassung verändert"
                      : state.ready
                        ? "Bereit"
                        : "Offen"}</Badge
                >{#if state.waiver}<p class="small">
                    {state.waiver.reason} · bis {dateLabel(state.waiver.expiresAt, true)}
                  </p>{/if}</td
              ><td>{state.updatedAt ? dateLabel(state.updatedAt, true) : "Noch nicht bestätigt"}</td
              ></tr
            >{/each}</tbody
        >
      </table>
    </div>
    <p class="small muted">
      Die Leitung bestätigt Bereitschaft im jeweiligen Gewerk. Änderungen an einem geprüften
      Fachstand öffnen sie erneut. Eine Ausnahme wird zeitlich begrenzt dokumentiert und ersetzt
      keinen technischen Sicherheitsnachweis.
    </p>
    {#if mayConfigure}<Button onClick={() => (editing = !editing)}
        >{editing ? "Vorgaben schließen" : "Anforderungen & Ausnahmen bearbeiten"}</Button
      >{/if}
    {#if editing}<form on:submit|preventDefault={() => void save()}>
        <fieldset class="form-multi">
          <legend>Erforderliche Gewerke für diesen Geltungsbereich</legend
          >{#each planning.modules as m (m.moduleId)}<label class="check-label"
              ><input type="checkbox" bind:group={required} value={m.moduleId} />{m.manifest
                .label}</label
            >{/each}
        </fieldset>
        {#each waivers as waiver (waiver.moduleId)}<p>
            {planning.modules.find((m) => m.moduleId === waiver.moduleId)?.manifest.label}: {waiver.reason}
            · {dateLabel(waiver.expiresAt, true)}{#if mayWaive}<Button
                onClick={() => (waivers = waivers.filter((w) => w.moduleId !== waiver.moduleId))}
                >Ausnahme entfernen</Button
              >{/if}
          </p>{/each}
        {#if mayWaive}<fieldset class="form-grid">
            <legend>Ausnahme begründen</legend><label
              >Gewerk<select bind:value={waiveModule}
                ><option value="">Bitte wählen</option
                >{#each planning.modules.filter( (m) => required.includes(m.moduleId) ) as m (m.moduleId)}<option
                    value={m.moduleId}>{m.manifest.label}</option
                  >{/each}</select
              ></label
            ><label
              >Gültig bis ({planning.timezone})<input
                type="datetime-local"
                bind:value={waiveUntil}
              /></label
            ><label class="full"
              >Begründung<textarea bind:value={waiveReason} maxlength="2000"></textarea></label
            ><Button onClick={addWaiver}>Ausnahme zur Vorschau hinzufügen</Button>
          </fieldset>{/if}<button class="button primary" disabled={busy}
          >Vorgaben verbindlich speichern</button
        >
      </form>{/if}{/if}
</section>
