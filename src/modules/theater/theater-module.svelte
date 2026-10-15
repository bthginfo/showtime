<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { localDate } = useTheaterTime();
  import { theaterLabel, theaterInstant } from "@/shared/theater-time";
  import { onMount, tick } from "svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { PageHeader, Button, ErrorMessage, Modal, Empty, Badge } from "@/components/ui";
  import { api, post, shiftDate, ApiFailure } from "@/shared/client-api";
  import { navigateWorkspace, replaceWorkspaceLocation } from "@/shared/client-navigation";
  import { hasPermission, type Permission } from "@/platform/access";
  import ScopePicker from "@/components/scope-picker.svelte";
  import { workplaceSwitchPolicy } from "@/shared/workplace-switch";
  import type { Planning, TradeItem, Configuration, ScheduleArea } from "./types";
  import type { Collection } from "./collections";
  import TradeFields from "./trade-fields.svelte";
  import TheaterResources from "./theater-resources.svelte";
  import TheaterSchedule from "./theater-schedule.svelte";
  import TheaterAdministration from "./theater-administration.svelte";
  import TheaterCollaborations from "./theater-collaborations.svelte";
  import { tradeCurrentDisplay } from "@/shared/trade-display";
  import TheaterOverview from "./theater-overview.svelte";
  import TradeGuide from "@/modules/help/components/trade-guide.svelte";
  import TradeDetail from "./trade-detail.svelte";
  import ReadinessPanel from "./readiness-panel.svelte";
  import TheaterIntegrations from "./theater-integrations.svelte";
  import TradeReferencePicker from "./trade-reference-picker.svelte";
  import { hasLeadershipOverview } from "@/shared/workspace-home";
  import WorkTiles from "@/components/work-tiles.svelte";
  import { theaterAreaTiles } from "@/shared/workspace-tiles";
  import { tradeActions, tradeStatus } from "@/shared/trade-actions";
  import { tradeGuides } from "@/shared/trade-guides";
  import { ArrowLeft, LayoutGrid, ArrowDownUp } from "@lucide/svelte";
  import {
    tradeFeatureDescription,
    tradeFeatureGroup,
    tradeSummaryFields,
  } from "@/shared/trade-presentation";
  export let initialView = "trade";
  export let productionId = "";
  export let requestId = "";
  export let itemId = "";
  export let featureId = "";
  export let tradeModule = "";
  export let createEntry = false;
  const store = useWorkspace();
  $: workspace = $store.workspace;
  $: switchPolicy = workplaceSwitchPolicy(workspace);
  let view = [
    "trade",
    "resources",
    "schedule",
    "readiness",
    "administration",
    "collaborations",
    "overview",
    "integrations",
  ].includes(initialView)
    ? initialView
    : "trade";
  let planning: Planning | null = null;
  let error = "";
  let notice = "";
  let busy = false;
  let selectedProduction = productionId;
  let scheduleArea: ScheduleArea = "";
  let resourceArea: "catalog" | "bookings" = "catalog";
  $: dateFilteredView =
    (view === "schedule" && ["performances", "versions"].includes(scheduleArea)) ||
    (view === "resources" && resourceArea === "bookings");
  let featureHeading: HTMLHeadingElement;
  let recordsHeading: HTMLHeadingElement;
  function navigateTheater(nextView: string, nextProduction = selectedProduction) {
    const params = new URLSearchParams({ module: "theater", view: nextView });
    if (nextProduction) params.set("productionId", nextProduction);
    if (selectedFeature) params.set("featureId", selectedFeature);
    if (selectedModule) params.set("tradeModule", selectedModule);
    navigateWorkspace("/?" + params.toString(), { retainOrigin: false });
  }
  async function chooseFeature(id: string) {
    selectedFeature = id;
    choosingFeature = false;
    search = "";
    statusFilter = "all";
    const params = new URLSearchParams(location.search);
    params.set("featureId", id);
    params.set("tradeModule", selectedModule);
    params.delete("create");
    replaceWorkspaceLocation("/?" + params, false);
    await tick();
    recordsHeading?.focus({ preventScroll: true });
    recordsHeading?.scrollIntoView({ block: "start" });
  }
  $: if (
    !selectedProduction &&
    workspace.user.grants?.length &&
    workspace.user.grants.every((grant) => grant.role === "guest") &&
    workspace.records.productions.length === 1
  )
    selectedProduction = workspace.records.productions[0].id;
  let collaborationSource: TradeItem | null = null;
  let selectedModule = tradeModule;
  let selectedFeature = featureId;
  let choosingFeature = false,
    sort = "updated",
    onlyMine = false;
  let editorProduction = "",
    editorModule = "",
    editorFeatureId = "";
  let conflict = false,
    latest: TradeItem | null = null;
  let createOpened = false,
    search = "",
    statusFilter = "all";
  let editor: TradeItem | null = null;
  let detailItem: TradeItem | null = null;
  let detailTrail: TradeItem[] = [];
  let includeArchived = false,
    ownerId = "",
    deputyId = "",
    dueAt = "";
  let editing = false;
  let title = "";
  let status = "draft";
  let initialItemOpened = false;
  let fields: Record<string, unknown> = {};
  let dependencies: string[] = [];
  let invitationUrl = "";
  let configuration: Configuration | null = null;
  let from = shiftDate(localDate(), -14);
  let to = shiftDate(localDate(), 120);
  $: modules =
    planning?.modules
      .filter(
        (m) =>
          m.config.departmentId === workspace.department.id ||
          (m.moduleId === "administration" && allowed("budget.request")),
      )
      .map((m) =>
        m.config.departmentId === workspace.department.id
          ? m
          : {
              ...m,
              manifest: {
                ...m.manifest,
                features: m.manifest.features.filter((f) => f.id === "purchase"),
              },
            },
      ) || [];
  $: selected = modules.find((m) => m.moduleId === selectedModule) || modules[0];
  $: feature =
    selected?.manifest.features.find((f) => f.id === selectedFeature) ||
    selected?.manifest.features[0];
  $: editorFeature = planning?.modules
    .find((m) => m.moduleId === editorModule)
    ?.manifest.features.find((f) => f.id === editorFeatureId);
  $: subject = { id: workspace.user.id, grants: workspace.user.grants || [] };
  $: featureItems =
    planning?.items.filter(
      (i) =>
        i.moduleId === selected?.moduleId &&
        i.type !== "workspace" &&
        !["archived", "cancelled"].includes(i.status),
    ) || [];
  $: visibleItems =
    planning?.items.filter(
      (i) =>
        i.type !== "workspace" &&
        i.moduleId === selected?.moduleId &&
        (!onlyMine ||
          i.ownerId === workspace.user.id ||
          (!i.ownerId && i.createdBy === workspace.user.id)) &&
        (!search.trim() ||
          i.title.toLocaleLowerCase("de").includes(search.trim().toLocaleLowerCase("de"))) &&
        (statusFilter === "all" ||
          (statusFilter === "open"
            ? !["done", "archived", "cancelled", "approved", "ready"].includes(i.status)
            : i.status === statusFilter)) &&
        (includeArchived || !["archived", "cancelled"].includes(i.status)),
    ) || [];
  $: items = visibleItems
    .filter((i) => i.type === feature?.id)
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "de")
        : sort === "due"
          ? (a.dueAt || "9999").localeCompare(b.dueAt || "9999")
          : sort === "sequence"
            ? Number(a.data.sequence ?? Infinity) - Number(b.data.sequence ?? Infinity)
            : b.updatedAt.localeCompare(a.updatedAt),
    );
  $: views = [
    ...(hasLeadershipOverview(workspace) ? [["overview", "Hausübersicht"]] : []),
    [
      "trade",
      workspace.currentModuleId === "intendance" ? "Entscheidungen & Ziele" : "Arbeitsstände",
    ],
    ["collaborations", "Abstimmungen"],
    ["resources", "Ressourcen"],
    ["schedule", "Spielplan"],
    ["readiness", "Bereitschaft"],
    ["integrations", "Import & Export"],
    ...(allowed("tenant.configure") ? [["administration", "Theater & Zugänge"]] : []),
  ];
  $: primaryViews = views.filter(
    ([id]) => !["resources", "integrations", "administration"].includes(id),
  );
  $: otherViews = views.filter(([id]) =>
    ["resources", "integrations", "administration"].includes(id),
  );
  $: if (view === "overview" && !hasLeadershipOverview(workspace)) view = "trade";
  const itemStatus: Record<string, string> = {
    draft: "Entwurf",
    review: "Zur Prüfung",
    published: "Veröffentlicht",
    ready: "Bereit",
    done: "Erledigt",
    blocked: "Blockiert",
    approved: "Genehmigt",
    rejected: "Abgelehnt",
    archived: "Archiviert",
    cancelled: "Abgebrochen",
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
      if (itemId && !initialItemOpened) {
        initialItemOpened = true;
        const loaded = await api<{ item: TradeItem }>(
          "/api/theater/operations?id=" + encodeURIComponent(itemId),
        );
        detailItem = loaded.item;
      }
      if (!selectedModule || !modules.some((m) => m.moduleId === selectedModule))
        selectedModule =
          planning.modules.find((m) => m.config.departmentId === workspace.department.id)
            ?.moduleId || "";
      const selectedManifest = planning.modules.find(
        (module) => module.moduleId === selectedModule,
      )?.manifest;
      if (!selectedManifest?.features.some((feature) => feature.id === selectedFeature))
        selectedFeature = selectedManifest?.features[0]?.id || "";
      if (view === "administration" && allowed("tenant.configure"))
        configuration = await api<Configuration>("/api/platform/configuration");
      if (
        createEntry &&
        !createOpened &&
        selectedManifest?.features.some(
          (feature) => feature.id === selectedFeature && allowed(feature.permission),
        )
      ) {
        createOpened = true;
        busy = false;
        await tick();
        start();
      }
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
    editorModule = item?.moduleId || selected?.moduleId || "";
    editorFeatureId = item?.type || feature?.id || "";
    editorProduction = item ? item.productionId || "" : selectedProduction;
    conflict = false;
    latest = null;
    error = "";
    const contract = planning?.modules
      .find((m) => m.moduleId === editorModule)
      ?.manifest.features.find((f) => f.id === editorFeatureId);
    title = item?.title || "";
    ownerId = item?.ownerId || workspace.user.id;
    deputyId = String(item?.data._deputyId || "");
    dueAt = item?.dueAt?.slice(0, 10) || "";
    status =
      item?.status ||
      (["audience-report", "stock-movement"].includes(editorFeatureId)
        ? "done"
        : editorFeatureId === "loan"
          ? "review"
          : "draft");
    fields = Object.fromEntries(
      (contract?.fields || [])
        .filter((f) => item?.data[f.key] !== undefined)
        .map((f) => [
          f.key,
          f.managed === "approval" ? (f.type === "checkbox" ? false : "draft") : item!.data[f.key],
        ]),
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
    if (busy || !editorFeature) return;
    busy = true;
    error = "";
    conflict = false;
    try {
      await post("/api/theater", {
        action: "save-item",
        data: {
          id: editor?.id,
          expectedVersion: editor?.version,
          moduleId: editorModule,
          type: editorFeatureId,
          title,
          status,
          productionId: editorProduction || undefined,
          data: fields,
          dependencyIds: dependencies,
          ownerId,
          ...(deputyId ? { deputyId } : {}),
          ...(dueAt
            ? { dueAt: theaterInstant(dueAt + "T12:00", planning?.timezone || "Europe/Berlin") }
            : {}),
        },
      });
      editing = false;
      notice =
        editorFeatureId === "stock-movement"
          ? "Bestandsbewegung gebucht. Der Bestand wurde aktualisiert."
          : "Arbeitsstand gespeichert.";
      await $store.refresh();
      await load();
    } catch (e) {
      error = (e as Error).message;
      conflict = e instanceof ApiFailure && e.status === 409 && !!editor;
    } finally {
      busy = false;
    }
  }
  async function compareLatest() {
    if (!editor || busy) return;
    busy = true;
    try {
      latest = (
        await api<{ item: TradeItem }>(
          "/api/theater/operations?id=" + encodeURIComponent(editor.id),
        )
      ).item;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
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
    if (busy || !planning?.nextCursor) return;
    busy = true;
    error = "";
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
    return field && planning
      ? tradeCurrentDisplay(value, field, workspace, planning, item.approvalVerified)
      : String(value);
  }
  const dateLabel = (value: string, withTime = false) =>
    theaterLabel(value, planning?.timezone || "Europe/Berlin", withTime);
</script>

<div class="theater-workspace">
  <PageHeader
    title={view === "trade"
      ? workspace.department.name
      : views.find(([id]) => id === view)?.[1] || "Theaterbetrieb"}
    ><a class="button secondary" href="/?module=help&guide=trade">Hilfe für mein Gewerk</a
    >{#if view !== "overview" && view !== "collaborations"}<Button
        onClick={() => void load()}
        disabled={busy}>Aktualisieren</Button
      >{/if}</PageHeader
  >
  <div class="segmented" role="tablist" aria-label="Theaterbereiche">
    {#each primaryViews as [id, label]}<button
        role="tab"
        aria-selected={view === id}
        class:active={view === id}
        on:click={() => navigateTheater(id)}>{label}</button
      >{/each}
  </div>
  <details class="theater-more">
    <summary>Weitere Bereiche</summary>
    <WorkTiles
      label="Weitere Theaterbereiche"
      tiles={otherViews.map(([id, title]) => ({ id, title, ...theaterAreaTiles[id] }))}
      onChoose={(id) => navigateTheater(id)}
    />
  </details>
  <label class="theater-view-picker"
    >Theaterbereich<select bind:value={view} on:change={() => navigateTheater(view)}
      >{#each views as [id, label]}<option value={id}>{label}</option>{/each}</select
    ></label
  >
  {#if planning && (view === "readiness" || choosingFeature)}{#key workspace.department.id}<TradeGuide
        compact
        showPrompt={view === "trade" || view === "readiness"}
        moduleId={planning.modules.find(
          (module) => module.config.departmentId === workspace.department.id,
        )?.moduleId || "makeup"}
        onOpen={(next) => navigateTheater(next)}
      />{/key}{/if}
  {#if view !== "overview" && !(view === "schedule" && ["", "works", "seasons"].includes(scheduleArea)) && !(view === "resources" && resourceArea === "catalog")}
    <svelte:element this={dateFilteredView ? "details" : "div"} class="planning-filters">
      {#if dateFilteredView}<summary>Zeitraum & Produktion filtern</summary>{/if}
      <div class="filters">
        <label
          >Produktion<select
            bind:value={selectedProduction}
            disabled={busy}
            on:change={() => navigateTheater(view, selectedProduction)}
            ><option value="">Alle Produktionen</option
            >{#each workspace.records.productions as p (p.id)}<option value={p.id}
                >{String(p.data.title)}</option
              >{/each}</select
          ></label
        >{#if workspace.pages?.productions}<Button
            disabled={busy}
            onClick={() => void $store.loadMore("productions")}>Weitere Produktionen laden</Button
          >{/if}{#if dateFilteredView}<label>Von<input type="date" bind:value={from} /></label
          ><label>Bis<input type="date" bind:value={to} /></label><Button
            disabled={busy}
            onClick={() => void load()}>Zeitraum laden</Button
          >{/if}
      </div>
    </svelte:element>
  {/if}
  <ErrorMessage message={error} />
  {#if notice}<p class="trade-notice" role="status">{notice}</p>{/if}
  {#if !planning}<p class="muted">Theaterdaten werden geladen …</p>
  {:else if view === "overview" && hasLeadershipOverview(workspace)}<TheaterOverview
      onProduction={(id) => navigateTheater("readiness", id)}
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
    {#if choosingFeature && modules.length > 1}<div class="filters">
        <label
          >Arbeitsbereich<select
            bind:value={selectedModule}
            on:change={() =>
              (selectedFeature =
                planning?.modules.find((module) => module.moduleId === selectedModule)?.manifest
                  .features[0]?.id || "")}
            >{#each modules as m (m.moduleId)}<option value={m.moduleId}>{m.manifest.label}</option
              >{/each}</select
          ></label
        >
      </div>{/if}
    {#if selected && choosingFeature}<section class="feature-choices" aria-label="Fachvorgänge">
        <div class="section-heading">
          <div>
            <h2 bind:this={featureHeading} tabindex="-1">
              Alle Funktionen · {selected.manifest.label}
            </h2>
            <p class="muted">{tradeGuides[selected.moduleId]?.purpose}</p>
          </div>
          <Button onClick={() => (choosingFeature = false)}
            ><ArrowLeft size={16} />Zurück zu {feature?.label}</Button
          >
        </div>
        {#each ["Facharbeit", "Bestände & Nachweise", "Bereitschaft"] as group (group)}
          {#if selected.manifest.features.some((f) => tradeFeatureGroup(f.id) === group)}<section
              class="trade-function-group"
            >
              <h3>{group}</h3>
              <WorkTiles
                label="Vorgang wählen"
                selected={feature?.id}
                disabled={busy}
                tiles={selected.manifest.features
                  .filter((f) => tradeFeatureGroup(f.id) === group)
                  .map((f) => ({
                    id: f.id,
                    title: f.label,
                    description: tradeFeatureDescription(f),
                    count: featureItems.filter((i) => i.type === f.id).length,
                  }))}
                onChoose={(id) => void chooseFeature(id)}
              />
            </section>{/if}{/each}
        {#if planning.nextCursor}<p class="small muted">
            Die Zahlen beziehen sich auf die bisher geladenen Arbeitsstände.
          </p>{/if}
      </section>{/if}
    {#if !choosingFeature}
      <section
        id="trade-records"
        class="feature-records"
        aria-label={feature?.label || "Arbeitsstände"}
      >
        <div class="section-heading">
          <div>
            <h2 bind:this={recordsHeading} tabindex="-1">{feature?.label || "Arbeitsstände"}</h2>
            {#if feature}<p class="muted feature-description">
                {tradeFeatureDescription(feature)}
              </p>{/if}
          </div>
          <div class="button-row">
            <Button
              onClick={async () => {
                choosingFeature = true;
                await tick();
                featureHeading?.focus();
              }}><LayoutGrid size={16} />Alle Funktionen</Button
            >
            {#if feature && allowed(feature.permission)}<Button
                variant="primary"
                disabled={busy}
                onClick={() => start()}
                >{feature.id === "stock-movement"
                  ? "Bewegung buchen"
                  : feature.id === "readiness"
                    ? "Bereitschaft prüfen"
                    : `${feature.label} anlegen`}</Button
              >{/if}
          </div>
        </div>
        <div class="filters trade-list-filters">
          <label
            >Arbeitsstände suchen<input
              type="search"
              placeholder="Titel suchen …"
              bind:value={search}
            /></label
          ><label class="trade-sort"
            ><span><ArrowDownUp size={14} />Sortierung</span><select bind:value={sort}
              ><option value="updated">Zuletzt geändert</option><option value="due"
                >Frist zuerst</option
              ><option value="title">Titel A–Z</option
              >{#if feature?.fields.some((f) => f.key === "sequence")}<option value="sequence"
                  >Ablaufreihenfolge</option
                >{/if}</select
            ></label
          >
        </div>
        <details class="trade-filter-options">
          <summary
            >Filter{statusFilter !== "all" || onlyMine || includeArchived
              ? " · aktiv"
              : ""}</summary
          >
          <div class="filters">
            <label
              >Status<select bind:value={statusFilter}
                ><option value="all">Alle aktuellen Stände</option><option value="open"
                  >Nur offene</option
                ><option value="blocked">Blockierte</option><option value="done">Erledigte</option
                ></select
              ></label
            >
            <label class="check-label"
              ><input type="checkbox" bind:checked={onlyMine} />Nur meine Zuständigkeit</label
            >
            <label class="check-label"
              ><input type="checkbox" bind:checked={includeArchived} />Archivierte Stände anzeigen</label
            >
            <Button
              onClick={() => {
                search = "";
                statusFilter = "all";
                onlyMine = false;
                includeArchived = false;
              }}>Filter zurücksetzen</Button
            >
          </div>
        </details>
        {#if !selected}<Empty
            title="Kein Fachmodul aktiviert"
            description="Die Theateradministration kann ein Modul für dieses Gewerk aktivieren."
          />{/if}
        {#if selected?.moduleId === "stage-management" && selectedProduction}<details
            class="surface task-disclosure"
          >
            <summary>Druck & Offline</summary>
            <div class="disclosure-body">
              <p>
                Speichere den aktuell zugänglichen Cue-Stand als unveränderlichen Auszug. Gleiche
                ihn vor jeder Vorstellung mit der aktuellen Freigabe ab.
              </p>
              <div class="button-row">
                <a
                  class="button secondary"
                  href={"/api/theater/cues?productionId=" + encodeURIComponent(selectedProduction)}
                  >Cue-Stand für Druck / Offline speichern</a
                ><a
                  class="button secondary"
                  href={"/api/theater/cues?format=csv&productionId=" +
                    encodeURIComponent(selectedProduction)}>Cues als CSV</a
                >
              </div>
            </div>
          </details>{/if}
        <p class="small muted trade-results" aria-live="polite">
          {items.length}
          {items.length === 1 ? "Arbeitsstand" : "Arbeitsstände"}{planning.nextCursor
            ? " im geladenen Bestand · weitere Einträge vorhanden"
            : ""}
        </p>
        <div class="card-grid trade-record-grid">
          {#each items as item (item.id)}{@const contract = featureFor(item)}
            <article class="surface trade-entry">
              <div class="section-heading">
                <h3>{item.title}</h3>
                <Badge>{tradeStatus(item) || itemStatus[item.status] || item.status}</Badge>
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
                {#each contract ? tradeSummaryFields(contract, item.data) : [] as field (field.key)}{#if item.data[field.key] !== undefined && item.data[field.key] !== ""}<div
                    >
                      <dt>
                        {field.key === "amountCents"
                          ? field.label.replace("(Cent)", "(€)")
                          : field.label}
                      </dt>
                      <dd>{display(item, field.key)}</dd>
                    </div>{/if}{/each}
              </dl>
              <p class="small muted">
                Verantwortlich: {workspace.members.find((m) => m.id === item.ownerId)?.name ||
                  "Nicht geladen"}{item.dueAt ? " · fällig " + dateLabel(item.dueAt) : ""}
              </p>
              {#if item.type === "asset" && item.data._stock}<p class="small">
                  Verfügbar: {String((item.data._stock as { available: number }).available)} · ausgeliehen:
                  {String((item.data._stock as { loaned: number }).loaned)}
                </p>{/if}
              {#if Array.isArray(item.data.dependencyIds) && item.data.dependencyIds.length}<p
                  class="small"
                >
                  Vorarbeiten: {item.data.dependencyIds
                    .map((id) => planning?.items.find((i) => i.id === id)?.title || "Eintrag")
                    .join(", ")}
                </p>{/if}
              {#if item.approvalVerified && item.data._approval}<p class="small">
                  Geprüfte Fassung: Freigabe durch {workspace.members.find(
                    (member) =>
                      member.id === (item.data._approval as { approvedBy: string }).approvedBy,
                  )?.name || "berechtigte Leitung"} · {dateLabel(
                    String((item.data._approval as { approvedAt: string }).approvedAt),
                  )}
                </p>{/if}
              <div
                class="trade-entry-actions"
                role="group"
                aria-label={"Aktionen für " + item.title}
              >
                <Button onClick={() => (detailItem = item)}>Details öffnen</Button>
                {#if tradeActions(subject, item, contract, workspace.department.id).edit}<Button
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
                {#if tradeActions(subject, item, contract, workspace.department.id).followup}<Button
                    disabled={busy}
                    onClick={() => {
                      collaborationSource = item;
                      view = "collaborations";
                    }}>Rückmeldung anfragen</Button
                  >{/if}
              </div>
            </article>{/each}
        </div>
        {#if !items.length && selected}<Empty
            title={planning.nextCursor
              ? "Noch keine Treffer im geladenen Bestand"
              : search.trim() || statusFilter !== "all" || onlyMine
                ? "Keine Treffer für diese Filter"
                : `Noch keine ${feature?.label || "Einträge"} erfasst`}
            description={planning.nextCursor
              ? "Lade weitere Einträge. Ältere Arbeitsstände können auf den nächsten Seiten liegen."
              : search.trim() || statusFilter !== "all" || onlyMine
                ? "Setze die Filter zurück oder ändere den Suchbegriff."
                : feature && allowed(feature.permission)
                  ? `Über „${feature.id === "stock-movement" ? "Bewegung buchen" : feature.id === "readiness" ? "Bereitschaft prüfen" : feature.label + " anlegen"}“ oben legst du den ersten Eintrag an.`
                  : "Hier erscheinen die für dich freigegebenen Arbeitsstände. Deine zuständige Leitung kann neue Einträge anlegen."}
          />{/if}{#if !items.length && (search || statusFilter !== "all" || onlyMine)}<Button
            onClick={() => {
              search = "";
              statusFilter = "all";
              onlyMine = false;
            }}>Suche und Filter zurücksetzen</Button
          >{/if}{#if planning.nextCursor}<div class="record-pagination">
            <Button disabled={busy} onClick={() => void moreItems()}
              >{busy ? "Einträge werden geladen …" : "Weitere Einträge laden"}</Button
            >
          </div>{/if}
        <div class="trade-secondary-actions">
          <Button onClick={() => navigateTheater("integrations")}
            >Daten importieren oder exportieren</Button
          >{#if workspace.currentModuleId !== "administration" && allowed("budget.request")}<Button
              onClick={async () => {
                selectedModule = "administration";
                await chooseFeature("purchase");
              }}>Bedarf anmelden</Button
            >{/if}
        </div>
      </section>{/if}
  {:else if view === "resources"}<TheaterResources
      {planning}
      {run}
      {busy}
      {more}
      productionId={selectedProduction}
      bind:area={resourceArea}
    />
  {:else if view === "integrations"}<TheaterIntegrations
      {planning}
      initialModule={selectedModule || workspace.currentModuleId || ""}
      initialFeature={selectedFeature}
      workspaceOnly
      productionId={selectedProduction}
      onChanged={async () => {
        await $store.refresh();
        await load();
      }}
    />
  {:else if view === "schedule"}<TheaterSchedule
      {planning}
      {run}
      {busy}
      {more}
      bind:area={scheduleArea}
      productionId={selectedProduction}
      onChanged={async () => {
        await $store.refresh();
        await load();
      }}
    />
  {:else if view === "readiness"}{#key selectedProduction}<ReadinessPanel
        {planning}
        productionId={selectedProduction}
        onChanged={load}
      />{/key}
  {:else}{#if switchPolicy.canSwitch}<section class="surface">
        <h2>{switchPolicy.canSwitchTheater ? "Arbeitsbereich wechseln" : "Gewerk wechseln"}</h2>
        <ScopePicker
          compact
          initialOrganization={workspace.organization.id}
          initialDepartment={workspace.department.id}
          onSelect={switchScope}
        />
      </section>{/if}
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
  {#if editing && editorFeature && planning}<Modal
      title={editorFeature.label}
      onClose={() => {
        if (!busy) editing = false;
      }}
      wide
      ><form on:submit|preventDefault={() => void save()}>
        <fieldset class="trade-editor-fields form-grid" disabled={busy}>
          <label class="full"
            >Titel<input
              bind:value={title}
              required
              maxlength="200"
              placeholder={`z. B. ${editorFeature.label} – ${editorProduction ? String(workspace.records.productions.find((row) => row.id === editorProduction)?.data.title || "Produktion") : "kurze, eindeutige Bezeichnung"}`}
            /></label
          ><label
            >Produktion<select bind:value={editorProduction}
              ><option value="">Ohne Produktionszuordnung</option
              >{#each workspace.records.productions as production (production.id)}<option
                  value={production.id}>{String(production.data.title)}</option
                >{/each}</select
            ></label
          >{#if !["stock-movement", "loan", "readiness"].includes(editorFeature.id)}<label
              >Status<select bind:value={status}
                ><option value="draft">Entwurf</option><option value="review">Zur Prüfung</option
                >{#if allowed(editorFeature.id === "budget" ? "budget.approve" : editorFeature.permission === "schedule.manage" ? "schedule.publish" : "document.publish", editorProduction)}<option
                    value="published">Veröffentlicht</option
                  >{/if}{#if allowed("readiness.manage")}<option value="ready">Bereit</option
                  >{/if}<option value="done">Erledigt</option><option value="blocked"
                  >Blockiert</option
                ></select
              ></label
            >{/if}
          {#if editorFeature.id === "stock-movement"}<p class="full trade-booking-note">
              Diese Bewegung ändert den Bestand sofort. Gespeicherte Bewegungen bleiben als Nachweis
              erhalten; Korrekturen erfolgen über eine Gegenbuchung.
            </p>{:else if editorFeature.id === "loan"}<p class="full trade-booking-note">
              Beim Anlegen wird die Menge sofort als ausgeliehen gebucht. Artikel und Menge bleiben
              danach fest; die Rückgabe trägst du hier nach.
            </p>{:else if editorFeature.id === "readiness"}<p class="full trade-booking-note">
              Bestätige „Bereit“ erst nach der fachlichen Prüfung. Änderungen an den zugrunde
              liegenden Arbeitsständen öffnen die Bereitschaft erneut.
            </p>{/if}
          <TradeFields
            privateData={editorFeature.private || false}
            fields={editorFeature.fields}
            moduleId={editorModule}
            featureId={editorFeatureId}
            data={fields}
            {planning}
            productionId={editorProduction}
            update={(key, value) => (fields = { ...fields, [key]: value })}
          />
          <details class="form-disclosure full">
            <summary>Zuständigkeit, Frist & Vorarbeiten</summary>
            <div class="form-grid">
              <label
                >Verantwortlich<select bind:value={ownerId}
                  >{#each workspace.members.filter((m) => m.id === workspace.user.id || allowed("task.assign")) as member (member.id)}<option
                      value={member.id}>{member.name}</option
                    >{/each}</select
                ></label
              >{#if allowed("task.assign")}<label
                  >Vertretung<select bind:value={deputyId}
                    ><option value="">Keine</option
                    >{#each workspace.members as member (member.id)}<option value={member.id}
                        >{member.name}</option
                      >{/each}</select
                  ></label
                >{/if}<label>Frist<input type="date" bind:value={dueAt} /></label
              >{#if !editorFeature.private}{#key editorProduction}<TradeReferencePicker
                    moduleId={editorModule}
                    type={editorFeatureId}
                    productionId={editorProduction}
                    field={{
                      key: "dependencyIds",
                      label: "Erforderliche Vorarbeiten",
                      type: "trades",
                    }}
                    value={dependencies}
                    max={50}
                    omitId={editor?.id || ""}
                    onChange={(ids) => (dependencies = ids as string[])}
                  />{/key}{/if}
            </div>
          </details>
          {#if error}<div class="full"><ErrorMessage message={error} /></div>{/if}
          {#if conflict}<section class="full trade-conflict">
              <h3>Deine Eingaben bleiben erhalten</h3>
              <p>Prüfe den aktuellen Stand, bevor du erneut speicherst.</p>
              <Button onClick={() => void compareLatest()}>Aktuellen Stand vergleichen</Button>
              {#if latest}<div class="table-scroll">
                  <table>
                    <thead
                      ><tr><th>Angabe</th><th>Dein Entwurf</th><th>Aktuell gespeichert</th></tr
                      ></thead
                    ><tbody>
                      <tr><th>Titel</th><td>{title}</td><td>{latest.title}</td></tr>
                      {#each editorFeature.fields.filter((f) => !f.managed) as field (field.key)}<tr
                          ><th>{field.label}</th><td
                            >{tradeCurrentDisplay(
                              fields[field.key],
                              field,
                              workspace,
                              planning,
                            )}</td
                          ><td
                            >{tradeCurrentDisplay(
                              latest.data[field.key],
                              field,
                              workspace,
                              planning,
                              latest.approvalVerified,
                            )}</td
                          ></tr
                        >{/each}
                    </tbody>
                  </table>
                </div>
                {#if editor && latest.version !== editor.version}<Button
                    onClick={() => {
                      editor = latest;
                      conflict = false;
                      error = "";
                      latest = null;
                    }}>Vergleich geprüft · meinen Entwurf weiterbearbeiten</Button
                  >
                  <p class="small muted">
                    Beim nächsten Speichern ersetzt dein Entwurf die verglichene Fassung.
                  </p>{:else}<p class="small muted">
                    Die Fassung ist unverändert. Prüfe den Hinweis oben; ein erneutes Speichern
                    allein löst ihn nicht.
                  </p>{/if}{/if}
            </section>{/if}
          <div class="dialog-footer full">
            <Button disabled={busy} onClick={() => (editing = false)}>Abbrechen</Button><button
              class="button primary"
              disabled={busy}
              >{busy
                ? "Wird gespeichert …"
                : editor
                  ? "Änderungen speichern"
                  : editorFeature.id === "stock-movement"
                    ? "Bestandsbewegung verbindlich buchen"
                    : editorFeature.id === "loan"
                      ? "Ausleihe buchen"
                      : editorFeature.id === "readiness"
                        ? "Prüfergebnis speichern"
                        : `${editorFeature.label} anlegen`}</button
            >
          </div>
        </fieldset>
      </form></Modal
    >{/if}
  {#if detailItem && planning}{#key detailItem.id}<TradeDetail
        item={detailItem}
        {planning}
        onClose={() => {
          detailItem = null;
          detailTrail = [];
        }}
        onBack={detailTrail.length
          ? () => {
              detailItem = detailTrail.at(-1)!;
              detailTrail = detailTrail.slice(0, -1);
            }
          : undefined}
        onEdit={(item) => {
          detailItem = null;
          detailTrail = [];
          start(item);
        }}
        onOpen={async (id) => {
          const result = await api<{ item: TradeItem }>(
            "/api/theater/operations?id=" + encodeURIComponent(id),
          );
          if (detailItem) detailTrail = [...detailTrail, detailItem];
          detailItem = result.item;
        }}
        onChanged={async () => {
          await $store.refresh();
          await load();
        }}
      />{/key}{/if}
</div>
