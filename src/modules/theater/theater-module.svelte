<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { localDate } = useTheaterTime();
  import { theaterLabel, theaterInstant } from "@/shared/theater-time";
  import { onMount } from "svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { PageHeader, Button, ErrorMessage, Modal, Empty, Badge } from "@/components/ui";
  import { api, post, shiftDate } from "@/shared/client-api";
  import { navigateWorkspace } from "@/shared/client-navigation";
  import { hasPermission, type Permission } from "@/platform/access";
  import ScopePicker from "@/components/scope-picker.svelte";
  import type { Planning, TradeItem, Configuration } from "./types";
  import type { Collection } from "./collections";
  import TradeFields from "./trade-fields.svelte";
  import TheaterResources from "./theater-resources.svelte";
  import TheaterSchedule from "./theater-schedule.svelte";
  import TheaterAdministration from "./theater-administration.svelte";
  import TheaterCollaborations from "./theater-collaborations.svelte";
  import { tradeDisplay } from "@/shared/trade-display";
  import TheaterOverview from "./theater-overview.svelte";
  import TradeGuide from "@/modules/help/components/trade-guide.svelte";
  import TradeDetail from "./trade-detail.svelte";
  import ReadinessPanel from "./readiness-panel.svelte";
  import TheaterIntegrations from "./theater-integrations.svelte";
  export let initialView = "trade";
  export let productionId = "";
  export let requestId = "";
  export let itemId = "";
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
    "integrations",
  ].includes(initialView)
    ? initialView
    : "trade";
  let planning: Planning | null = null;
  let error = "";
  let busy = false;
  let selectedProduction = productionId;
  function navigateTheater(nextView: string, nextProduction = selectedProduction) {
    const params = new URLSearchParams({ module: "theater", view: nextView });
    if (nextProduction) params.set("productionId", nextProduction);
    navigateWorkspace("/?" + params.toString(), { retainOrigin: false });
  }
  $: if (
    !selectedProduction &&
    workspace.user.grants?.length &&
    workspace.user.grants.every((grant) => grant.role === "guest") &&
    workspace.records.productions.length === 1
  )
    selectedProduction = workspace.records.productions[0].id;
  let collaborationSource: TradeItem | null = null;
  let selectedModule = "";
  let selectedFeature = "";
  let editor: TradeItem | null = null;
  let detailItem: TradeItem | null = null;
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
      (i) =>
        i.type !== "workspace" &&
        i.moduleId === selected?.moduleId &&
        i.type === feature?.id &&
        (includeArchived || !["archived", "cancelled"].includes(i.status)),
    ) || [];
  $: views = [
    ...(allowed("budget.read") ? [["overview", "Hausübersicht"]] : []),
    ["trade", "Mein Gewerk"],
    ["collaborations", "Zusammenarbeit"],
    ["resources", "Ressourcen"],
    ["schedule", "Spielplan"],
    ["readiness", "Bereitschaft"],
    ...(allowed("tenant.configure")
      ? [
          ["integrations", "Schnittstellen"],
          ["administration", "Theater & Zugänge"],
        ]
      : []),
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
    ownerId = item?.ownerId || workspace.user.id;
    deputyId = String(item?.data._deputyId || "");
    dueAt = item?.dueAt?.slice(0, 10) || "";
    status = item?.status || (feature?.id === "audience-report" ? "done" : "draft");
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
        ownerId,
        ...(deputyId ? { deputyId } : {}),
        ...(dueAt
          ? { dueAt: theaterInstant(dueAt + "T12:00", planning?.timezone || "Europe/Berlin") }
          : {}),
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
    if (field?.managed && !item.approvalVerified) return "Freigabe noch erforderlich";
    return field && planning ? tradeDisplay(value, field, workspace, planning) : String(value);
  }
  const dateLabel = (value: string, withTime = false) =>
    theaterLabel(value, planning?.timezone || "Europe/Berlin", withTime);
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
        on:click={() => navigateTheater(id)}>{label}</button
      >{/each}
  </div>
  <label class="theater-view-picker"
    >Theaterbereich<select bind:value={view} on:change={() => navigateTheater(view)}
      >{#each views as [id, label]}<option value={id}>{label}</option>{/each}</select
    ></label
  >
  {#if planning}{#key workspace.department.id}<TradeGuide
        compact
        showPrompt={view === "trade" || view === "readiness"}
        moduleId={planning.modules.find(
          (module) => module.config.departmentId === workspace.department.id,
        )?.moduleId || "makeup"}
        onOpen={(next) => navigateTheater(next)}
      />{/key}{/if}
  {#if view !== "overview"}
    <div class="filters">
      <label
        >Produktion<select
          bind:value={selectedProduction}
          disabled={busy}
          on:change={() => navigateTheater(view, selectedProduction)}
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
    {#if selected?.moduleId === "stage-management" && selectedProduction}<section class="surface">
        <h2>Druck & Offline</h2>
        <p>
          Speichere den aktuell zugänglichen Cue-Stand als unveränderlichen Auszug. Gleiche ihn vor
          jeder Vorstellung mit der aktuellen Freigabe ab.
        </p>
        <a
          class="button secondary"
          href={"/api/theater/cues?productionId=" + encodeURIComponent(selectedProduction)}
          >Cue-Stand für Druck / Offline speichern</a
        ><a
          class="button secondary"
          href={"/api/theater/cues?format=csv&productionId=" +
            encodeURIComponent(selectedProduction)}>Cues als CSV</a
        >
      </section>{/if}
    <label class="check-label"
      ><input type="checkbox" bind:checked={includeArchived} />Archivierte Stände anzeigen</label
    >
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
              "Erstellende Person"}{item.dueAt ? " · fällig " + dateLabel(item.dueAt) : ""}
          </p>
          <div class="button-row">
            <Button onClick={() => (detailItem = item)}>Details, Fassungen & Anlagen</Button
            >{#if item.type === "asset" && item.data._stock}<span class="small"
                >Verfügbar: {String((item.data._stock as { available: number }).available)} · ausgeliehen:
                {String((item.data._stock as { loaned: number }).loaned)}</span
              >{/if}
          </div>
          {#if Array.isArray(item.data.dependencyIds) && item.data.dependencyIds.length}<p
              class="small"
            >
              Vorarbeiten: {item.data.dependencyIds
                .map((id) => planning?.items.find((i) => i.id === id)?.title || "Eintrag")
                .join(", ")}
            </p>{/if}{#if contract && allowed(contract.permission, item.productionId || "", item.departmentId) && !["approved", "rejected", "archived", "cancelled", "stock-movement"].includes(item.status) && item.type !== "stock-movement"}<Button
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
          {#if item.approvalVerified && item.data._approval}<p class="small">
              Geprüfte Fassung: Freigabe durch {workspace.members.find(
                (member) =>
                  member.id === (item.data._approval as { approvedBy: string }).approvedBy,
              )?.name || "berechtigte Leitung"} · {dateLabel(
                String((item.data._approval as { approvedAt: string }).approvedAt),
              )}
            </p>{/if}
          {#if contract && !contract.private && item.productionId && item.departmentId === workspace.department.id && allowed("collaboration.create", item.productionId, item.departmentId)}<Button
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
        description={feature && allowed(feature.permission)
          ? "Wähle die passende Produktion und lege einen Arbeitsstand an. Verknüpfte Personen und Geräte werden beim Speichern geprüft."
          : "Hier erscheinen die für dich freigegebenen Arbeitsstände. Deine zuständige Leitung kann neue Einträge anlegen."}
      />{/if}{#if planning.nextCursor}<Button disabled={busy} onClick={() => void moreItems()}
        >Weitere Einträge laden</Button
      >{/if}
  {:else if view === "resources"}<TheaterResources {planning} {run} {busy} {more} />
  {:else if view === "integrations"}<TheaterIntegrations
      {planning}
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
          privateData={feature.private || false}
          fields={feature.fields}
          data={fields}
          {planning}
          productionId={selectedProduction}
          update={(key, value) => (fields = { ...fields, [key]: value })}
        /><label
          >Verantwortlich<select bind:value={ownerId}
            >{#each workspace.members.filter((m) => m.id === workspace.user.id || allowed("task.assign")) as member (member.id)}<option
                value={member.id}>{member.name}</option
              >{/each}</select
          ></label
        >{#if allowed("task.assign")}<label
            >Vertretung<select bind:value={deputyId}
              ><option value="">Keine</option>{#each workspace.members as member (member.id)}<option
                  value={member.id}>{member.name}</option
                >{/each}</select
            ></label
          >{/if}<label>Frist<input type="date" bind:value={dueAt} /></label
        >{#if !feature.private}<fieldset class="form-multi full">
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
        >{#if error}<div class="full"><ErrorMessage message={error} /></div>{/if}
        <div class="dialog-footer full">
          <Button disabled={busy} onClick={() => (editing = false)}>Abbrechen</Button><button
            class="button primary"
            disabled={busy}>Speichern</button
          >
        </div>
      </form></Modal
    >{/if}
  {#if detailItem && planning}<TradeDetail
      item={detailItem}
      {planning}
      onClose={() => (detailItem = null)}
      onChanged={async () => {
        await $store.refresh();
        await load();
      }}
    />{/if}
</div>
