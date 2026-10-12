<script lang="ts">
  import { tick } from "svelte";
  import { Boxes, Building2, CalendarDays, Plus } from "@lucide/svelte";
  import { theaterLabel, theaterInstant } from "@/shared/theater-time";
  import { ApiFailure } from "@/shared/client-api";
  import type { Planning, Resource, Booking, TheaterRun } from "./types";
  import type { Collection } from "./collections";
  import { useWorkspace } from "@/components/workspace-context";
  import { hasPermission } from "@/platform/access";
  import { Button, Badge, Modal, Empty, ErrorMessage } from "@/components/ui";
  import { tradeChoiceLabel } from "@/shared/trade-labels";
  export let planning: Planning;
  export let run: TheaterRun;
  export let busy = false;
  export let more: (collection: Collection) => Promise<void>;
  export let productionId = "";
  export let area: "catalog" | "bookings" = "catalog";
  const store = useWorkspace();
  $: workspace = $store.workspace;
  let heading: HTMLHeadingElement;
  let editing: Resource | null = null;
  let open = false,
    reserving = false,
    saving = false;
  let releasing: Booking | null = null;
  let formError = "",
    search = "";
  let resourceId = "",
    reservationProduction = "",
    reservationStart = "";
  const allowed = (
    permission: "inventory.manage" | "inventory.reserve",
    departmentId = workspace.department.id,
    pid = "",
  ) =>
    hasPermission({ id: workspace.user.id, grants: workspace.user.grants || [] }, permission, {
      departmentId,
      productionId: pid,
    });
  const canReserve = (resource: Resource) =>
    allowed("inventory.reserve", resource.departmentId || workspace.department.id) ||
    workspace.records.productions.some((p) =>
      allowed("inventory.reserve", resource.departmentId || workspace.department.id, p.id),
    );
  $: resources = planning.resources.filter(
    (r) =>
      !search.trim() ||
      r.name.toLocaleLowerCase("de").includes(search.trim().toLocaleLowerCase("de")),
  );
  $: reservable = planning.resources.filter(canReserve);
  $: selectedResource = planning.resources.find((r) => r.id === resourceId);
  $: canReserveWithoutProduction =
    !!selectedResource &&
    allowed("inventory.reserve", selectedResource.departmentId || workspace.department.id);
  $: reserveProductions = selectedResource
    ? workspace.records.productions.filter((p) =>
        allowed(
          "inventory.reserve",
          selectedResource.departmentId || workspace.department.id,
          p.id,
        ),
      )
    : [];
  const dateLabel = (value: string, withTime = false) =>
    theaterLabel(value, planning.timezone, withTime);
  const resourceName = (id: string) =>
    planning.resources.find((r) => r.id === id)?.name || "Ressource";
  async function choose(next: typeof area) {
    area = next;
    await tick();
    heading?.focus();
  }
  function openResource(resource?: Resource) {
    editing = resource || null;
    formError = "";
    open = true;
  }
  function selectResource(id: string) {
    resourceId = id;
    const resource = planning.resources.find((r) => r.id === id);
    if (!resource) return;
    const department = resource.departmentId || workspace.department.id;
    reservationProduction =
      productionId && allowed("inventory.reserve", department, productionId)
        ? productionId
        : allowed("inventory.reserve", department)
          ? ""
          : workspace.records.productions.find((p) =>
              allowed("inventory.reserve", department, p.id),
            )?.id || "";
  }
  function reserveResource(resource?: Resource) {
    selectResource(resource?.id || reservable[0]?.id || "");
    formError = "";
    reservationStart = "";
    reserving = true;
  }
  async function save(event: SubmitEvent) {
    if (saving || busy) return;
    const data: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget as HTMLFormElement),
    );
    for (const key of ["capacity", "setupMinutes", "teardownMinutes"])
      data[key] = Number(data[key]);
    if (data.scope === "house") data.departmentId = null;
    delete data.scope;
    formError = "";
    saving = true;
    try {
      await run("save-resource", {
        ...data,
        ...(editing ? { id: editing.id, expectedVersion: editing.version } : {}),
      });
      open = false;
      editing = null;
    } catch (error) {
      formError = error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
    } finally {
      saving = false;
    }
  }
  async function reserve(event: SubmitEvent) {
    if (saving || busy) return;
    const data: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget as HTMLFormElement),
    );
    formError = "";
    try {
      if (!reservable.some((r) => r.id === data.resourceId))
        throw new Error(
          "Diese Ressource kann aktuell nicht reserviert werden. Wähle eine andere Ressource.",
        );
      if (String(data.endAt) <= String(data.startAt))
        throw new Error("Das Ende muss nach dem Beginn liegen.");
      data.quantity = Number(data.quantity);
      for (const key of ["startAt", "endAt"])
        data[key] = theaterInstant(String(data[key]), planning.timezone);
      saving = true;
      await run("reserve-resource", data);
      reserving = false;
      area = "bookings";
      await tick();
      heading?.focus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reservieren fehlgeschlagen.";
      formError =
        error instanceof ApiFailure && error.status === 409
          ? `${message} Wähle einen anderen Zeitraum oder eine andere Ressource.`
          : message;
    } finally {
      saving = false;
    }
  }
  async function release() {
    if (!releasing || saving || busy) return;
    formError = "";
    saving = true;
    try {
      await run("schedule", {
        action: "cancel-booking",
        id: releasing.id,
        expectedVersion: releasing.version,
      });
      releasing = null;
    } catch (error) {
      formError = error instanceof Error ? error.message : "Freigeben fehlgeschlagen.";
    } finally {
      saving = false;
    }
  }
</script>

<div class="segmented resource-switch" role="group" aria-label="Ressourcenansicht">
  <button
    type="button"
    aria-pressed={area === "catalog"}
    class:active={area === "catalog"}
    on:click={() => void choose("catalog")}>Räume & Ausstattung</button
  >
  <button
    type="button"
    aria-pressed={area === "bookings"}
    class:active={area === "bookings"}
    on:click={() => void choose("bookings")}>Reservierungen</button
  >
</div>
<section class="catalog-section">
  <div class="section-heading">
    <div>
      <h2 bind:this={heading} tabindex="-1">
        {area === "catalog" ? "Räume & Ausstattung" : "Reservierungen"}
      </h2>
      <p class="muted">
        {area === "catalog"
          ? "Finde die passende Ressource und reserviere sie für euren Einsatz."
          : "Auf- und Abbauzeiten sind im reservierten Zeitraum enthalten."}
      </p>
    </div>
    {#if area === "catalog" && allowed("inventory.manage")}<Button
        variant="primary"
        disabled={busy}
        onClick={() => openResource()}><Plus size={16} />Ressource anlegen</Button
      >{/if}
    {#if area === "bookings" && reservable.length}<Button
        variant="primary"
        disabled={busy}
        onClick={() => reserveResource()}><Plus size={16} />Reservierung anlegen</Button
      >{/if}
  </div>
  {#if area === "catalog"}
    <label class="catalog-search"
      >Räume und Ausstattung suchen<input
        type="search"
        bind:value={search}
        placeholder="Name suchen …"
      /></label
    >
    <div class="catalog-grid">
      {#each resources as resource (resource.id)}<article class="catalog-card">
          <div class="catalog-card-heading">
            {#if resource.type === "equipment" || resource.type === "vehicle"}<Boxes
                size={22}
              />{:else}<Building2 size={22} />{/if}<Badge>{tradeChoiceLabel(resource.type)}</Badge>
          </div>
          <h3>{resource.name}</h3>
          <p class="small muted">
            {resource.departmentId
              ? planning.departments.find((d) => d.id === resource.departmentId)?.name || "Gewerk"
              : "Für das gesamte Theater"}
          </p>
          <dl class="catalog-facts">
            <div>
              <dt>Kapazität</dt>
              <dd>{resource.capacity.toLocaleString("de-DE")}</dd>
            </div>
            <div>
              <dt>Aufbau / Abbau</dt>
              <dd>{resource.setupMinutes} / {resource.teardownMinutes} Minuten</dd>
            </div>
          </dl>
          <div class="catalog-card-actions">
            {#if canReserve(resource)}<Button
                disabled={busy}
                onClick={() => reserveResource(resource)}>Reservieren</Button
              >{/if}{#if allowed("inventory.manage", resource.departmentId || workspace.department.id)}<Button
                disabled={busy}
                onClick={() => openResource(resource)}>Bearbeiten</Button
              >{/if}
          </div>
        </article>{:else}<Empty
          title={search ? "Keine passende Ressource" : "Noch keine Räume oder Ausstattung"}
          description={search
            ? "Versuche einen anderen Namen oder setze die Suche zurück."
            : "Lege Räume, Bühnen oder gemeinsam verwendete Ausstattung an."}
          action={search ? "Suche zurücksetzen" : undefined}
          onAction={() => (search = "")}
        />{/each}
    </div>
    {#if planning.pages.resources}<Button disabled={busy} onClick={() => void more("resources")}
        >Weitere Ressourcen laden</Button
      >{/if}
  {:else}
    <div class="catalog-grid">
      {#each [...planning.bookings].sort( (a, b) => a.startAt.localeCompare(b.startAt) ) as booking (booking.id)}{@const resource =
          planning.resources.find((r) => r.id === booking.resourceId)}
        <article class="catalog-card">
          <CalendarDays size={22} />
          <h3>{resourceName(booking.resourceId)}</h3>
          <dl class="catalog-facts">
            <div>
              <dt>Beginn</dt>
              <dd>{dateLabel(booking.startAt, true)}</dd>
            </div>
            <div>
              <dt>Ende</dt>
              <dd>{dateLabel(booking.endAt, true)}</dd>
            </div>
            <div>
              <dt>Menge</dt>
              <dd>{booking.quantity}</dd>
            </div>
          </dl>
          {#if booking.productionId}<p class="small muted">
              {String(
                workspace.records.productions.find((p) => p.id === booking.productionId)?.data
                  .title || "Produktion",
              )}
            </p>{/if}
          <div class="catalog-card-actions">
            {#if booking.activityId}<a
                class="button secondary"
                href={"/?module=calendar&record=" + booking.activityId}>Termin öffnen</a
              >
            {:else if booking.createdBy === workspace.user.id || allowed("inventory.manage", resource?.departmentId || workspace.department.id, booking.productionId || "")}<Button
                disabled={busy}
                onClick={() => {
                  releasing = booking;
                  formError = "";
                }}>Reservierung freigeben</Button
              >{/if}
          </div>
        </article>
      {:else}<Empty
          title="Keine Reservierungen in dieser Auswahl"
          description="Wähle einen anderen Zeitraum oder reserviere eine Ressource für euren nächsten Einsatz."
        />{/each}
    </div>
    {#if planning.pages.bookings}<Button disabled={busy} onClick={() => void more("bookings")}
        >Weitere Reservierungen laden</Button
      >{/if}
  {/if}
</section>

{#if open}<Modal
    title={editing ? "Ressource bearbeiten" : "Ressource anlegen"}
    onClose={() => (open = false)}
    initialFocus="input"
  >
    <form
      class="form-grid"
      aria-busy={saving}
      on:submit|preventDefault={(event) => void save(event)}
    >
      <label class="full"
        >Name<input name="name" value={editing?.name || ""} required maxlength="150" /></label
      ><label
        >Art<select name="type" value={editing?.type || "stage"}
          >{#each [["stage", "Bühne"], ["rehearsal-room", "Probenraum"], ["studio", "Studio"], ["equipment", "Ausstattung"], ["vehicle", "Fahrzeug"], ["storage", "Lager"]] as [id, label]}<option
              value={id}>{label}</option
            >{/each}</select
        ></label
      >
      <label
        >Kapazität<input
          name="capacity"
          type="number"
          min="1"
          max="10000"
          value={editing?.capacity ?? 1}
          required
        /></label
      >
      <details class="form-disclosure full">
        <summary>Aufbau, Abbau und Geltungsbereich</summary>
        <div class="form-grid">
          <label
            >Aufbau (Min.)<input
              name="setupMinutes"
              type="number"
              min="0"
              max="1440"
              value={editing?.setupMinutes ?? 0}
            /></label
          ><label
            >Abbau (Min.)<input
              name="teardownMinutes"
              type="number"
              min="0"
              max="1440"
              value={editing?.teardownMinutes ?? 0}
            /></label
          >{#if !editing && allowed("inventory.manage", "")}<label class="full"
              >Geltungsbereich<select name="scope"
                ><option value="department">{workspace.department.name}</option><option
                  value="house">Gesamtes Theater</option
                ></select
              ></label
            >{/if}
        </div>
      </details>
      <div class="full"><ErrorMessage message={formError} /></div>
      <div class="dialog-footer full">
        <Button disabled={saving} onClick={() => (open = false)}>Abbrechen</Button><Button
          type="submit"
          variant="primary"
          disabled={busy || saving}>{saving ? "Wird gespeichert …" : "Speichern"}</Button
        >
      </div>
    </form>
  </Modal>{/if}
{#if reserving}<Modal
    title="Reservierung anlegen"
    onClose={() => (reserving = false)}
    initialFocus="select"
  >
    <form
      class="form-grid"
      aria-busy={saving}
      on:submit|preventDefault={(event) => void reserve(event)}
    >
      <label class="full"
        >Ressource<select
          name="resourceId"
          bind:value={resourceId}
          on:change={() => selectResource(resourceId)}
          required
          >{#if !reservable.some((r) => r.id === resourceId)}<option value=""
              >Ressource wählen …</option
            >{/if}{#each reservable as resource (resource.id)}<option value={resource.id}
              >{resource.name}</option
            >{/each}</select
        ></label
      >
      <label
        >Beginn<input
          name="startAt"
          type="datetime-local"
          bind:value={reservationStart}
          required
        /></label
      ><label
        >Ende<input
          name="endAt"
          type="datetime-local"
          min={reservationStart || undefined}
          required
        /></label
      ><label>Menge<input name="quantity" type="number" min="1" value="1" required /></label>
      <label
        >Produktion<select
          name="productionId"
          bind:value={reservationProduction}
          required={!canReserveWithoutProduction}
          >{#if canReserveWithoutProduction}<option value="">Ohne Produktion</option>{:else}<option
              value="">Produktion wählen …</option
            >{/if}{#each reserveProductions as p (p.id)}<option value={p.id}
              >{String(p.data.title)}</option
            >{/each}</select
        ></label
      >
      <p class="small muted full">
        Die Verfügbarkeit wird beim Speichern geprüft. Nutze für Aufbau und Abbau den gesamten
        benötigten Zeitraum.
      </p>
      <div class="full"><ErrorMessage message={formError} /></div>
      <div class="dialog-footer full">
        <Button disabled={saving} onClick={() => (reserving = false)}>Abbrechen</Button><Button
          type="submit"
          variant="primary"
          disabled={busy || saving}>{saving ? "Wird reserviert …" : "Reservieren"}</Button
        >
      </div>
    </form>
  </Modal>{/if}
{#if releasing}<Modal title="Reservierung freigeben?" onClose={() => (releasing = null)}>
    <p>
      {resourceName(releasing.resourceId)} · {dateLabel(releasing.startAt, true)} – {dateLabel(
        releasing.endAt,
        true,
      )}
    </p>
    <p class="muted">Dieser Zeitraum wird wieder verfügbar. Der Eintrag wird entfernt.</p>
    <ErrorMessage message={formError} />
    <div class="dialog-footer">
      <Button disabled={saving} onClick={() => (releasing = null)}>Abbrechen</Button><Button
        variant="primary"
        disabled={busy || saving}
        onClick={() => void release()}>{saving ? "Wird freigegeben …" : "Freigeben"}</Button
      >
    </div>
  </Modal>{/if}
