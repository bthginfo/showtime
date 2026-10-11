<script lang="ts">
  import { theaterLabel } from "@/shared/theater-time";
  import type { Planning, Resource, TheaterRun } from "./types";
  import type { Collection } from "./collections";
  import { useWorkspace } from "@/components/workspace-context";
  import { hasPermission } from "@/platform/access";
  import { Button, Modal } from "@/components/ui";
  import {} from "@/shared/client-api";
  import { theaterInstant } from "@/shared/theater-time";
  import { tradeChoiceLabel } from "@/shared/trade-labels";
  export let planning: Planning;
  export let run: TheaterRun;
  export let busy = false;
  export let more: (collection: Collection) => Promise<void>;
  const store = useWorkspace();
  $: workspace = $store.workspace;
  let editing: Resource | null = null;
  let open = false;
  const allowed = (
    permission: "inventory.manage" | "inventory.reserve",
    departmentId = workspace.department.id,
  ) =>
    hasPermission({ id: workspace.user.id, grants: workspace.user.grants || [] }, permission, {
      departmentId,
    });
  async function save(event: SubmitEvent) {
    const data: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget as HTMLFormElement),
    );
    for (const key of ["capacity", "setupMinutes", "teardownMinutes"])
      data[key] = Number(data[key]);
    if (data.scope === "house") data.departmentId = null;
    delete data.scope;
    try {
      await run("save-resource", {
        ...data,
        ...(editing ? { id: editing.id, expectedVersion: editing.version } : {}),
      });
      open = false;
      editing = null;
    } catch {}
  }
  async function reserve(event: SubmitEvent) {
    const formElement = event.currentTarget as HTMLFormElement;
    const data: Record<string, unknown> = Object.fromEntries(new FormData(formElement));
    data.quantity = Number(data.quantity);
    for (const key of ["startAt", "endAt"])
      data[key] = theaterInstant(String(data[key]), planning.timezone);
    try {
      await run("reserve-resource", data);
      formElement.reset();
    } catch {}
  }
  const dateLabel = (value: string, withTime = false) =>
    theaterLabel(value, planning.timezone, withTime);
</script>

{#if planning.resourceBlocks.length}<section class="surface">
    <h2>Technische Sperren & betroffene Termine</h2>
    <p>
      Offene Sperren verhindern neue Belegungen. Bereits geplante Termine bleiben zur Klärung
      sichtbar.
    </p>
    {#each planning.resourceBlocks as block (block.itemId)}<article>
        <strong
          >{planning.resources.find((r) => r.id === block.resourceId)?.name ||
            "Gesperrte Ressource"}</strong
        >
        <p>
          <a href={"/?module=theater&itemId=" + encodeURIComponent(block.itemId)}>{block.title}</a>
        </p>
        {#each planning.bookings.filter((b) => b.resourceId === block.resourceId) as booking (booking.id)}<p
            class="small"
          >
            Betroffene Belegung: {dateLabel(booking.startAt, true)}{#if booking.activityId}
              · <a href={"/?module=calendar&record=" + booking.activityId}>Termin klären</a>{/if}
          </p>{/each}
      </article>{/each}
  </section>{/if}
<section class="surface">
  <div class="section-heading">
    <h2>Bühnen, Räume und Ausstattung</h2>
    {#if allowed("inventory.manage")}<Button
        variant="primary"
        onClick={() => {
          editing = null;
          open = true;
        }}>Ressource anlegen</Button
      >{/if}
  </div>
  <div class="table-wrap">
    <table>
      <thead
        ><tr><th>Ressource</th><th>Art</th><th>Kapazität</th><th>Auf- / Abbau</th><th></th></tr
        ></thead
      ><tbody
        >{#each planning.resources as resource (resource.id)}<tr
            ><td
              >{resource.name}<span class="small muted">
                · {resource.departmentId
                  ? planning.departments.find((d) => d.id === resource.departmentId)?.name
                  : "Hausweit"}</span
              ></td
            ><td>{tradeChoiceLabel(resource.type)}</td><td>{resource.capacity}</td><td
              >{resource.setupMinutes} / {resource.teardownMinutes} Min.</td
            ><td
              >{#if allowed("inventory.manage", resource.departmentId || workspace.department.id)}<Button
                  disabled={busy}
                  onClick={() => {
                    editing = resource;
                    open = true;
                  }}>Bearbeiten</Button
                >{/if}</td
            ></tr
          >{/each}</tbody
      >
    </table>
  </div>
  {#if planning.pages.resources}<Button disabled={busy} onClick={() => void more("resources")}
      >Weitere Ressourcen laden</Button
    >{/if}
</section>
{#if allowed("inventory.reserve")}<section class="surface">
    <h2>Ressource reservieren</h2>
    <form class="form-grid" on:submit|preventDefault={(e) => void reserve(e)}>
      <label
        >Ressource<select name="resourceId" required
          >{#each planning.resources as r (r.id)}<option value={r.id}>{r.name}</option
            >{/each}</select
        ></label
      ><label
        >Produktion<select name="productionId"
          ><option value="">Ohne Produktion</option
          >{#each workspace.records.productions as p (p.id)}<option value={p.id}
              >{String(p.data.title)}</option
            >{/each}</select
        ></label
      ><label>Beginn<input name="startAt" type="datetime-local" required /></label><label
        >Ende<input name="endAt" type="datetime-local" required /></label
      ><label>Menge<input name="quantity" type="number" min="1" value="1" required /></label><button
        class="button primary"
        disabled={busy}>Reservieren</button
      >
    </form>
  </section>{/if}
<section class="surface">
  <h2>Belegungen</h2>
  <p class="small muted">Auf- und Abbauzeiten sind in den reservierten Zeiträumen enthalten.</p>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus enables arrow-key scrolling of this named table region.) -->
  <div class="table-wrap" tabindex="0" role="region" aria-label="Belegungen: Tabelle">
    <table>
      <thead><tr><th>Ressource</th><th>Zeitraum</th><th>Menge</th><th>Aktionen</th></tr></thead
      ><tbody
        >{#each planning.bookings as booking (booking.id)}<tr
            ><td
              >{planning.resources.find((r) => r.id === booking.resourceId)?.name ||
                "Ressource"}</td
            ><td>{dateLabel(booking.startAt, true)} – {dateLabel(booking.endAt, true)}</td><td
              >{booking.quantity}</td
            ><td
              >{#if booking.activityId}<a href={"/?module=calendar&record=" + booking.activityId}
                  >Zugehörigen Termin öffnen</a
                >{:else if booking.createdBy === workspace.user.id || allowed("inventory.manage")}<Button
                  disabled={busy}
                  onClick={() =>
                    void run("schedule", {
                      action: "cancel-booking",
                      id: booking.id,
                      expectedVersion: booking.version,
                    }).catch(() => {})}>Freigeben</Button
                >{/if}</td
            ></tr
          >{/each}</tbody
      >
    </table>
  </div>
  {#if planning.pages.bookings}<Button disabled={busy} onClick={() => void more("bookings")}
      >Weitere Belegungen laden</Button
    >{/if}
</section>
{#if open}<Modal
    title={editing ? "Ressource bearbeiten" : "Ressource anlegen"}
    onClose={() => {
      open = false;
      editing = null;
    }}
    ><form class="form-grid" on:submit|preventDefault={(e) => void save(e)}>
      <label>Name<input name="name" value={editing?.name || ""} required maxlength="150" /></label
      ><label
        >Art<select name="type" value={editing?.type || "stage"}
          >{#each [["stage", "Bühne"], ["rehearsal-room", "Probenraum"], ["studio", "Studio"], ["equipment", "Ausstattung"], ["vehicle", "Fahrzeug"], ["storage", "Lager"]] as [id, label]}<option
              value={id}>{label}</option
            >{/each}</select
        ></label
      ><label
        >Kapazität<input
          name="capacity"
          type="number"
          min="1"
          max="10000"
          value={editing?.capacity || 1}
          required
        /></label
      ><label
        >Aufbau (Min.)<input
          name="setupMinutes"
          type="number"
          min="0"
          max="1440"
          value={editing?.setupMinutes || 0}
        /></label
      ><label
        >Abbau (Min.)<input
          name="teardownMinutes"
          type="number"
          min="0"
          max="1440"
          value={editing?.teardownMinutes || 0}
        /></label
      >{#if !editing && allowed("inventory.manage", "")}<label
          >Geltungsbereich<select name="scope"
            ><option value="department">{workspace.department.name}</option><option value="house"
              >Gesamtes Theater</option
            ></select
          ></label
        >{/if}
      <div class="dialog-footer full">
        <Button disabled={busy} onClick={() => (open = false)}>Abbrechen</Button><button
          class="button primary"
          disabled={busy}>Speichern</button
        >
      </div>
    </form></Modal
  >{/if}
