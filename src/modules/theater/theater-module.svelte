<script lang="ts">
  import { onMount } from "svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { PageHeader, Button, ErrorMessage, Modal, Empty, Badge } from "@/components/ui";
  import { api, post, dateLabel, localDate, shiftDate } from "@/shared/client-api";
  import { hasPermission, type Permission } from "@/platform/access";
  import ScopePicker from "@/components/scope-picker.svelte";
  import type { Planning, TradeItem, Configuration } from "./types";
  import type { Collection } from "./collections";
  import TradeFields from "./trade-fields.svelte";
  import TheaterResources from "./theater-resources.svelte";
  import TheaterSchedule from "./theater-schedule.svelte";
  import TheaterAdministration from "./theater-administration.svelte";
  import TheaterCollaborations from "./theater-collaborations.svelte";
  import TheaterOverview from "./theater-overview.svelte";
  import TradeGuide from "@/modules/help/components/trade-guide.svelte";
  import "./theater-operations.css";
  export let initialView = "trade";
  export let productionId = "";
  export let requestId = "";
  const store = useWorkspace();
  $: workspace = $store.workspace;
  let view = [
    "trade",
    "resources",
    "schedule",
    "readiness",
    "administration",
    "collaborations",
    "overview",
  ].includes(initialView)
    ? initialView
    : "trade";
  let planning: Planning | null = null;
  let error = "";
  let busy = false;
  let selectedProduction = productionId;
  let collaborationSource: TradeItem | null = null;
  let selectedModule = "";
  let selectedFeature = "";
  let editor: TradeItem | null = null;
  let editing = false;
  let title = "";
  let status = "draft";
  let fields: Record<string, unknown> = {};
  let dependencies: string[] = [];
  let invitationUrl = "";
  let configuration: Configuration | null = null;
  let from = shiftDate(localDate(), -14);
  let to = shiftDate(localDate(), 120);
  $: modules =
    planning?.modules.filter(
      (m) =>
        m.config.departmentId === workspace.department.id ||
        (m.moduleId === "administration" && allowed("budget.request")),
    ) || [];
  $: selected = modules.find((m) => m.moduleId === selectedModule) || modules[0];
  $: feature =
    selected?.manifest.features.find((f) => f.id === selectedFeature) ||
    selected?.manifest.features[0];
  $: items =
    planning?.items.filter(
      (i) => i.type !== "workspace" && i.moduleId === selected?.moduleId && i.type === feature?.id,
    ) || [];
  $: views = [
    ...(allowed("budget.read") ? [["overview", "Hausübersicht"]] : []),
    ["trade", "Mein Gewerk"],
    ["collaborations", "Zusammenarbeit"],
    ["resources", "Ressourcen"],
    ["schedule", "Spielplan"],
    ["readiness", "Bereitschaft"],
    ["administration", "Theater & Zugänge"],
  ];
  const itemStatus: Record<string, string> = {
    draft: "Entwurf",
    review: "Zur Prüfung",
    published: "Veröffentlicht",
    ready: "Bereit",
    done: "Erledigt",
    blocked: "Blockiert",
    approved: "Genehmigt",
    rejected: "Abgelehnt",
  };
  const allowed = (
    permission: Permission,
    productionId = selectedProduction,
    departmentId = workspace.department.id,
  ) =>
    hasPermission({ id: workspace.user.id, grants: workspace.user.grants || [] }, permission, {
      departmentId,
      productionId,
    });
  function query(extra: Record<string, string> = {}) {
    const params = new URLSearchParams({ from, to, ...extra });
    if (selectedProduction) params.set("productionId", selectedProduction);
    return "/api/theater?" + params.toString();
  }
  async function load() {
    busy = true;
    error = "";
    try {
      planning = await api<Planning>(query());
      if (!selectedModule || !modules.some((m) => m.moduleId === selectedModule))
        selectedModule =
          planning.modules.find((m) => m.config.departmentId === workspace.department.id)
            ?.moduleId || "";
      const selectedManifest = planning.modules.find(
        (module) => module.moduleId === selectedModule,
      )?.manifest;
      if (!selectedManifest?.features.some((feature) => feature.id === selectedFeature))
        selectedFeature = selectedManifest?.features[0]?.id || "";
      if (allowed("tenant.configure"))
        configuration = await api<Configuration>("/api/platform/configuration");
    } catch (e) {
      error = e instanceof Error ? e.message : "Laden fehlgeschlagen.";
    } finally {
      busy = false;
    }
  }
  onMount(() => {
    void load();
  });
  function start(item?: TradeItem) {
    editor = item || null;
    if (item) {
      selectedModule = item.moduleId;
      selectedFeature = item.type;
      selectedProduction = item.productionId || "";
    } else selectedFeature = feature?.id || "";
    const contract = planning?.modules
      .find((m) => m.moduleId === selectedModule)
      ?.manifest.features.find((f) => f.id === selectedFeature);
    title = item?.title || "";
    status = item?.status || (feature?.id === "audience-report" ? "done" : "draft");
    fields = Object.fromEntries(
      (contract?.fields || [])
        .filter((f) => item?.data[f.key] !== undefined)
        .map((f) => [f.key, item!.data[f.key]]),
    );
    dependencies = Array.isArray(item?.data.dependencyIds)
      ? (item.data.dependencyIds as string[])
      : [];
    editing = true;
  }
  async function run(action: string, data: Record<string, unknown>) {
    busy = true;
    error = "";
    try {
      const saved = await post<Record<string, unknown>>("/api/theater", { action, data });
      await $store.refresh();
      await load();
      return saved;
    } catch (e) {
      error = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
      throw e;
    } finally {
      busy = false;
    }
  }
  async function save() {
    if (!selected || !feature) return;
    try {
      await run("save-item", {
        id: editor?.id,
        expectedVersion: editor?.version,
        moduleId: selected.moduleId,
        type: feature.id,
        title,
        status,
        productionId: selectedProduction || undefined,
        data: fields,
        dependencyIds: dependencies,
      });
      editing = false;
    } catch {}
  }
  async function configure(action: string, data: Record<string, unknown>) {
    busy = true;
    error = "";
    try {
      const saved = await post<{ url?: string }>("/api/platform/configuration", { action, data });
      if (saved.url) invitationUrl = saved.url;
      await $store.refresh();
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : "Änderung fehlgeschlagen.";
    } finally {
      busy = false;
    }
  }
  async function more(collection: Collection) {
    if (!planning?.pages[collection]) return;
    busy = true;
    error = "";
    try {
      const next = await api<{ entries: Planning[Collection]; nextCursor: string | null }>(
        query({ collection, cursor: planning.pages[collection]! }),
      );
      planning = {
        ...planning,
        [collection]: [...planning[collection], ...next.entries],
        pages: { ...planning.pages, [collection]: next.nextCursor },
      };
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function moreItems() {
    if (!planning?.nextCursor) return;
    busy = true;
    try {
      const next = await api<Planning>(query({ cursor: planning.nextCursor }));
      planning = {
        ...planning,
        items: [...planning.items, ...next.items],
        nextCursor: next.nextCursor,
      };
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function switchScope(organizationId: string, departmentId: string) {
    await post("/api/platform/switch", { organizationId, departmentId });
    location.assign("/?module=theater");
  }
  const featureFor = (item: TradeItem) =>
    planning?.modules
      .find((m) => m.moduleId === item.moduleId)
      ?.manifest.features.find((f) => f.id === item.type);
  function display(item: TradeItem, key: string) {
    const field = featureFor(item)?.fields.find((f) => f.key === key),
      value = item.data[key];
    if (field?.type === "checkbox") return value ? "Ja" : "Nein";
    if (field?.type === "date") return dateLabel(String(value));
    if (field?.type === "datetime") return dateLabel(String(value), true);
    if (field?.key === "amountCents")
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
        Number(value) / 100,
      );
    if (field?.type === "performance") {
      const performance = planning?.performances.find((performance) => performance.id === value);
      return performance
        ? dateLabel(performance.curtainAt, true)
        : "Vorstellung außerhalb des geladenen Zeitraums";
    }
    if (field?.type === "members")
      return (Array.isArray(value) ? value : [])
        .map((id) => workspace.members.find((m) => m.id === id)?.name || id)
        .join(", ");
    if (field?.type === "resource")
      return planning?.resources.find((r) => r.id === value)?.name || String(value);
    if (field?.type === "department")
      return planning?.departments.find((d) => d.id === value)?.name || "Gesamtes Theater";
    if (field?.type === "budget")
      return planning?.funding.find((b) => b.id === value)?.title || "Budgetrahmen";
    if (field?.type === "record" && field.source) {
      const row = workspace.records[field.source].find((r) => r.id === value);
      return String(row?.data.title || row?.data.name || value);
    }
    return String(value);
  }
</script>

<div class="theater-workspace">
  <PageHeader eyebrow={workspace.department.name} title="Theaterbetrieb"
    ><a class="button secondary" href="/?module=help&guide=collaboration">Hilfe & Einstieg</a
    >{#if view !== "overview" && view !== "collaborations"}<Button
        onClick={() => void load()}
        disabled={busy}>Aktualisieren</Button
      >{/if}</PageHeader
  >
  <div class="segmented" role="tablist" aria-label="Theaterbereiche">
    {#each views as [id, label]}<button
        role="tab"
        aria-selected={view === id}
        class:active={view === id}
        on:click={() => (view = id)}>{label}</button
      >{/each}
  </div>
  <label class="theater-view-picker"
    >Theaterbereich<select bind:value={view}
      >{#each views as [id, label]}<option value={id}>{label}</option>{/each}</select
    ></label
  >
  {#if planning}{#key workspace.department.id}<TradeGuide
        compact
        showPrompt={view === "trade" || view === "readiness"}
        moduleId={planning.modules.find(
          (module) => module.config.departmentId === workspace.department.id,
        )?.moduleId || "makeup"}
        onOpen={(next) => (view = next)}
      />{/key}{/if}
  {#if view !== "overview"}
    <div class="filters">
      <label
        >Produktion<select
          bind:value={selectedProduction}
          disabled={busy}
          on:change={() => void load()}
          ><option value="">Alle / ohne Produktion</option
          >{#each workspace.records.productions as p (p.id)}<option value={p.id}
              >{String(p.data.title)}</option
            >{/each}</select
        ></label
      >{#if workspace.pages?.productions}<Button
          disabled={busy}
          onClick={() => void $store.loadMore("productions")}>Weitere Produktionen laden</Button
        >{/if}{#if view === "schedule" || view === "resources"}<label
          >Von<input type="date" bind:value={from} /></label
        ><label>Bis<input type="date" bind:value={to} /></label><Button
          disabled={busy}
          onClick={() => void load()}>Zeitraum laden</Button
        >{/if}
    </div>
  {/if}
  <ErrorMessage message={error} />
  {#if !planning}<p class="muted">Theaterdaten werden geladen …</p>
  {:else if view === "overview" && allowed("budget.read")}<TheaterOverview
      onProduction={(id) => {
        selectedProduction = id;
        view = "readiness";
        void load();
      }}
    />
  {:else if view === "collaborations"}{#key `${selectedProduction}:${collaborationSource?.id || ""}`}<TheaterCollaborations
        {planning}
        productionId={selectedProduction}
        {requestId}
        source={collaborationSource}
        onChanged={async () => {
          await $store.refresh();
          await load();
        }}
      />{/key}
  {:else if view === "trade"}
    <div class="filters">
      <label
        >Modul<select
          bind:value={selectedModule}
          on:change={() =>
            (selectedFeature =
              planning?.modules.find((module) => module.moduleId === selectedModule)?.manifest
                .features[0]?.id || "")}
          >{#each modules as m (m.moduleId)}<option value={m.moduleId}>{m.manifest.label}</option
            >{/each}</select
        ></label
      ><label
        >Arbeitsablauf<select bind:value={selectedFeature}
          >{#each selected?.manifest.features || [] as f (f.id)}<option value={f.id}
              >{f.label}</option
            >{/each}</select
        ></label
      >{#if feature && allowed(feature.permission)}<Button
          variant="primary"
          disabled={busy}
          onClick={() => start()}>Eintrag anlegen</Button
        >{/if}
    </div>
    {#if !selected}<Empty
        title="Kein Fachmodul aktiviert"
        description="Die Theateradministration kann ein Modul für dieses Gewerk aktivieren."
      />{/if}
    <div class="card-grid">
      {#each items as item (item.id)}{@const contract = featureFor(item)}
        <article class="surface">
          <div class="section-heading">
            <h3>{item.title}</h3>
            <Badge>{itemStatus[item.status] || item.status}</Badge>
          </div>
          <p class="small muted">{contract?.label} · {dateLabel(item.updatedAt, true)}</p>
          {#if !selectedProduction && item.productionId}<p class="small muted">
              {String(
                workspace.records.productions.find(
                  (production) => production.id === item.productionId,
                )?.data.title || "Produktion",
              )}
            </p>{/if}
          <dl class="detail-grid">
            {#each contract?.fields || [] as field (field.key)}{#if item.data[field.key] !== undefined && item.data[field.key] !== ""}<div
                >
                  <dt>{field.label}</dt>
                  <dd>{display(item, field.key)}</dd>
                </div>{/if}{/each}
          </dl>
          {#if Array.isArray(item.data.dependencyIds) && item.data.dependencyIds.length}<p
              class="small"
            >
              Vorarbeiten: {item.data.dependencyIds
                .map((id) => planning?.items.find((i) => i.id === id)?.title || "Eintrag")
                .join(", ")}
            </p>{/if}{#if contract && allowed(contract.permission, item.productionId || "", item.departmentId) && !["approved", "rejected"].includes(item.status)}<Button
              disabled={busy}
              onClick={() => start(item)}>Bearbeiten</Button
            >{/if}{#if item.type === "purchase" && item.status === "review" && item.createdBy !== workspace.user.id && allowed("budget.approve", item.productionId || "", item.departmentId)}<Button
              disabled={busy}
              onClick={() =>
                void run("approve-purchase", {
                  id: item.id,
                  expectedVersion: item.version,
                  decision: "approved",
                }).catch(() => {})}>Genehmigen</Button
            ><Button
              disabled={busy}
              onClick={() =>
                void run("approve-purchase", {
                  id: item.id,
                  expectedVersion: item.version,
                  decision: "rejected",
                }).catch(() => {})}>Ablehnen</Button
            >{/if}
          {#if contract && !contract.private && item.productionId && item.departmentId === workspace.department.id && allowed("handover.create", item.productionId, item.departmentId)}<Button
              disabled={busy}
              onClick={() => {
                collaborationSource = item;
                view = "collaborations";
              }}>Mit anderem Gewerk abstimmen</Button
            >{/if}
        </article>{/each}
    </div>
    {#if !items.length && selected}<Empty
        title="Noch keine Einträge"
        description="Wähle einen Arbeitsablauf und lege den ersten Eintrag an."
      />{/if}{#if planning.nextCursor}<Button disabled={busy} onClick={() => void moreItems()}
        >Weitere Einträge laden</Button
      >{/if}
  {:else if view === "resources"}<TheaterResources {planning} {run} {busy} {more} />
  {:else if view === "schedule"}<TheaterSchedule
      {planning}
      {run}
      {busy}
      {more}
      productionId={selectedProduction}
    />
  {:else if view === "readiness"}<section class="surface">
      <h2>Bereitschaft der Gewerke</h2>
      {#if !selectedProduction}<p>
          Wähle eine Produktion, um die Bereitschaft für technische Proben und Vorstellungen zu
          sehen.
        </p>{:else}<table>
          <thead><tr><th>Gewerk</th><th>Erforderlich</th><th>Stand</th><th>Geändert</th></tr></thead
          ><tbody
            >{#each planning.readiness as state (state.moduleId)}<tr
                ><td>{state.label}</td><td>{state.required ? "Ja" : "Optional"}</td><td
                  ><Badge>{state.ready ? "Bereit" : "Offen"}</Badge></td
                ><td>{state.updatedAt ? dateLabel(state.updatedAt, true) : "–"}</td></tr
              >{/each}</tbody
          >
        </table>
        <p class="small muted">
          Eine Teamleitung bestätigt die Bereitschaft im jeweiligen Fachmodul. Offene erforderliche
          Gewerke sperren den Wechsel zur Generalprobe und zum Spielbetrieb.
        </p>{/if}
    </section>
  {:else}<section class="surface">
      <h2>Arbeitsbereich wechseln</h2>
      <ScopePicker compact onSelect={switchScope} />
    </section>
    {#if configuration}<TheaterAdministration
        {configuration}
        {configure}
        {busy}
        {invitationUrl}
      />{/if}{#if workspace.platformAdmin}<section class="surface">
        <h2>Plattformverwaltung</h2>
        <p>Jedes Theater erhält eigene Mitgliedschaften und Fachdatensätze.</p>
        <a class="button secondary" href="/platform">Theaterverwaltung öffnen</a>
      </section>{/if}{/if}
  {#if editing && feature && planning}<Modal
      title={feature.label}
      onClose={() => (editing = false)}
      wide
      ><form class="form-grid" on:submit|preventDefault={() => void save()}>
        <label class="full">Titel<input bind:value={title} required maxlength="200" /></label
        ><TradeFields
          fields={feature.fields}
          data={fields}
          {planning}
          productionId={selectedProduction}
          update={(key, value) => (fields = { ...fields, [key]: value })}
        />{#if !feature.private}<fieldset class="form-multi full">
            <legend>Erforderliche Vorarbeiten</legend
            >{#each planning.items.filter((i) => i.productionId === (selectedProduction || null) && i.id !== editor?.id && i.type !== "workspace" && featureFor(i) && !featureFor(i)?.private) as dependency (dependency.id)}<label
                class="check-label"
                ><input
                  type="checkbox"
                  checked={dependencies.includes(dependency.id)}
                  on:change={(e) =>
                    (dependencies = e.currentTarget.checked
                      ? [...dependencies, dependency.id]
                      : dependencies.filter((id) => id !== dependency.id))}
                />{dependency.title} · {dependency.status}</label
              >{/each}
          </fieldset>{/if}<label
          >Status<select bind:value={status}
            ><option value="draft">Entwurf</option><option value="review">Zur Prüfung</option
            >{#if allowed(feature.id === "budget" ? "budget.approve" : feature.permission === "schedule.manage" ? "schedule.publish" : "document.publish")}<option
                value="published">Veröffentlicht</option
              >{/if}{#if allowed("readiness.manage")}<option value="ready">Bereit</option
              >{/if}<option value="done">Erledigt</option><option value="blocked">Blockiert</option
            ></select
          ></label
        ><ErrorMessage message={error} /><button class="button primary" disabled={busy}
          >Speichern</button
        >
      </form></Modal
    >{/if}
</div>
