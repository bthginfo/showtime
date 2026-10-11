<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { memberCan } from "@/shared/access-policy";
  import { LinkedText } from "@/components/linked-text";
  import { ArrowLeft, ArrowUpRight, CalendarDays, Plus, Users } from "@lucide/svelte";
  import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
  import { recordMatchesPeriod, seasonForDate, type PeriodFilter } from "@/shared/period-filter";
  import { contactsValue } from "@/shared/contracts";
  import { productionContactName } from "@/shared/production-contacts";
  import { productionCastingCounts } from "@/modules/productions/counts";
  import { sortProductionsByPremiere } from "@/shared/production-order";
  import type { Workspace } from "@/shared/contracts";
  import { hours, ids, num, value } from "@/shared/client-api";
  import { useWorkspace } from "../workspace-context";
  import { Badge, Button, Empty, ExportButton, PageHeader, Section } from "../ui";
  import { ResourceEditor } from "../resource-editor";
  import { RecordDetail, ResourceView } from "../resource-view";
  import { ExportDialog, ImportDialog } from "../export-dialog";
  import { ProductionTeamModule } from "../production-people";
  import { ChatModule } from "./chat";
  import { TasksModule } from "./tasks";
  import { CalendarModule } from "./calendar";
  import { TimeModule } from "./time";
  import { statusLabels } from "../resource-fields";
  import { RecordDocuments } from "@/modules/documents/components/record-documents";
  import { MaskPlansModule } from "@/modules/mask-plans/components/mask-plans-module";
  import { RecordLink } from "../record-link";
  import relationStyles from "../record-links.module.css";
  import styles from "../workspace-browse.module.css";
  import { useViewState } from "@/shared/view-state";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  import { productionSections, CastingModule } from "./productions";
  const effects = createEffects();
  type ViewProps = {
    productionId?: string;
    activeTab?: string;
    onNavigate: (id: string, tab: string) => void;
  };
  export let productionId: NonNullable<ViewProps["productionId"]> = "";
  export let activeTab: NonNullable<ViewProps["activeTab"]> = "overview";
  export let onNavigate: ViewProps["onNavigate"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace } = $workspaceStore;
  $: ({ workspace } = $workspaceStore);
  $: makeupWorkspace = workspace.currentModuleId === "makeup";
  $: displayedSections = productionSections.map(([key, label]) => [
    key,
    key === "looks" && !makeupWorkspace ? "Dokumentation" : key === "tasks" ? "Aufgaben" : label,
  ]);
  $: mainContacts = production
    ? contactsValue(production.data.contacts).filter(
        (contact) => !makeupWorkspace || contact.type === "makeup",
      )
    : [];
  let selected = productionId;
  let tab = productionSections.some(([key]) => key === activeTab) ? activeTab : "overview";
  let setSelected = (id: string) => onNavigate(id, "overview");
  let setTab = (next: string) => onNavigate(selected, next);
  const periodStore = useViewState<PeriodFilter>(
    workspace.user.id,
    "productions",
    "period",
    () => ({
      season: seasonForDate(workspace.records.productions),
    }),
  );
  let period: PeriodFilter = $periodStore;
  $: period = $periodStore;
  const setPeriod = periodStore.set;
  const statusStore = useViewState<any>(workspace.user.id, "productions", "status", "current");
  let status: any = $statusStore;
  $: status = $statusStore;
  const setStatus = statusStore.set;
  const searchStore = useViewState<any>(workspace.user.id, "productions", "search", "");
  let search: any = $searchStore;
  $: search = $searchStore;
  const setSearch = searchStore.set;
  const sortStore = useViewState<any>(workspace.user.id, "productions", "sort", "premiere");
  let sort: any = $sortStore;
  $: sort = $sortStore;
  const setSort = sortStore.set;
  let makeupNames = (data: Record<string, unknown>) =>
    [
      ...new Set(
        contactsValue(data.contacts)
          .filter((contact) => contact.type === "makeup")
          .map((contact) =>
            productionContactName(contact, workspace.members, workspace.records.people),
          ),
      ),
    ].join(", ");
  let editor: boolean = false;
  const setEditor = (next: typeof editor | ((current: typeof editor) => typeof editor)) => {
    editor =
      typeof next === "function"
        ? (next as (current: typeof editor) => typeof editor)(editor)
        : next;
  };
  let details: boolean = false;
  const setDetails = (next: typeof details | ((current: typeof details) => typeof details)) => {
    details =
      typeof next === "function"
        ? (next as (current: typeof details) => typeof details)(details)
        : next;
  };
  let exporting: boolean = false;
  const setExporting = (
    next: typeof exporting | ((current: typeof exporting) => typeof exporting),
  ) => {
    exporting =
      typeof next === "function"
        ? (next as (current: typeof exporting) => typeof exporting)(exporting)
        : next;
  };
  let importing: boolean = false;
  const setImporting = (
    next: typeof importing | ((current: typeof importing) => typeof importing),
  ) => {
    importing =
      typeof next === "function"
        ? (next as (current: typeof importing) => typeof importing)(importing)
        : next;
  };
  let tabs = { current: null as HTMLDivElement | null };
  $: effects.run(
    0,
    () => {
      const container = tabs.current;
      const button = container?.querySelector<HTMLButtonElement>("button[aria-current='page']");
      if (!container || !button) return;
      const viewport = container.getBoundingClientRect();
      const target = button.getBoundingClientRect();
      if (target.left < viewport.left || target.right > viewport.right) {
        container.scrollTo({
          left:
            container.scrollLeft +
            target.left -
            viewport.left -
            (container.clientWidth - target.width) / 2,
          behavior: "instant",
        });
      }
    },
    [selected, tab],
  );
  let production = workspace.records.productions.find((x) => x.id === selected);
  let castingCounts = productionCastingCounts(
    selected,
    workspace.records.characters,
    workspace.records.casting,
  );
  let filteredRecords = workspace.records.productions.filter(
    (x) =>
      (status === "all" || status === "archived"
        ? status === "all" || x.data.status === "archived"
        : x.data.status !== "archived") &&
      recordMatchesPeriod(x, period, workspace.records.productions) &&
      value(x.data, "title").toLowerCase().includes(search.toLowerCase()),
  );
  let records =
    sort === "premiere"
      ? sortProductionsByPremiere(filteredRecords)
      : filteredRecords.sort((a, b) => {
          if (sort === "name" || sort === "name-desc")
            return (
              value(a.data, "title").localeCompare(value(b.data, "title"), "de") *
              (sort === "name-desc" ? -1 : 1)
            );
          if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
          return 0;
        });
  let projectHours = (
    workspace as Workspace & {
      projectHours?: Record<string, number>;
    }
  ).projectHours;

  $: selected = productionId;
  $: tab = productionSections.some(([key]) => key === activeTab) ? activeTab : "overview";

  $: production = workspace.records.productions.find((x) => x.id === selected);
  $: castingCounts = productionCastingCounts(
    selected,
    workspace.records.characters,
    workspace.records.casting,
  );
  $: filteredRecords = workspace.records.productions.filter(
    (x) =>
      (status === "all" || status === "archived"
        ? status === "all" || x.data.status === "archived"
        : x.data.status !== "archived") &&
      recordMatchesPeriod(x, period, workspace.records.productions) &&
      value(x.data, "title").toLowerCase().includes(search.toLowerCase()),
  );
  $: records =
    sort === "premiere"
      ? sortProductionsByPremiere(filteredRecords)
      : filteredRecords.sort((a, b) => {
          if (sort === "name" || sort === "name-desc")
            return (
              value(a.data, "title").localeCompare(value(b.data, "title"), "de") *
              (sort === "name-desc" ? -1 : 1)
            );
          if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
          return 0;
        });
  $: projectHours = (
    workspace as Workspace & {
      projectHours?: Record<string, number>;
    }
  ).projectHours;
</script>

{#if production}<section class={styles.productionDetail}>
    <div class="production-breadcrumb">
      <Button
        variant="ghost"
        onClick={() => {
          setSelected("");
        }}
      >
        <ArrowLeft size={16}></ArrowLeft>
        Alle Produktionen
      </Button>
      <Badge tone="green">{value(production.data, "season") || "Spielzeit"}</Badge>
    </div>
    <header class="production-heading">
      <div>
        <p class="eyebrow">{statusLabels[value(production.data, "status")]}</p>
        <h1>{value(production.data, "title")}</h1>
      </div>
      <div class="heading-actions">
        <Button onClick={() => setDetails(true)}>Produktion verwalten</Button>
      </div>
    </header>
    <label class={styles.productionSection}>
      Produktionsbereich
      <select
        aria-label="Produktionsbereich"
        value={tab}
        on:change={(event) => setTab(event.currentTarget.value)}
      >
        {#each displayedSections as [key, label] (key)}<option value={key}>
            {label}
          </option>{/each}
      </select>
    </label>
    <div bind:this={tabs.current} class="tabs production-tabs" aria-label="Produktionsbereiche">
      {#each displayedSections as [key, label] (key)}<button
          aria-current={tab === key ? "page" : undefined}
          class={tab === key ? "active" : ""}
          on:click={() => setTab(key)}
        >
          {label}
        </button>{/each}
    </div>
    {#if tab === "overview"}
      <section class="production-makeup-contact">
        <Users size={22}></Users>
        <div>
          <span class="eyebrow">{makeupWorkspace ? "MASKENBETREUUNG" : "ANSPRECHPERSONEN"}</span>
          <strong>
            {#if mainContacts.length}<span class={relationStyles.compact}>
                {#each mainContacts as contact}{@const person = workspace.records.people.find(
                    (person) =>
                      person.id === contact.personId && !value(person.data, "linkedMemberId"),
                  )}{@const name = productionContactName(
                    contact,
                    workspace.members,
                    workspace.records.people,
                  )}{#if person}{#key contact.id}<RecordLink record={person}>
                        {name}
                      </RecordLink>{/key}{:else}<span>{name}</span>{/if}{/each}
              </span>{:else}{makeupWorkspace
                ? "Noch keine Maskenbetreuung eingetragen"
                : "Noch keine Ansprechpersonen eingetragen"}{/if}
          </strong>
          <p class="small muted">Deine Ansprechpersonen für dieses Stück.</p>
        </div>
        <Button onClick={() => setTab("team")}>Team & Kontakte</Button>
      </section>
      <div class="project-overview">
        <Section title="Über die Produktion">
          <div class="panel-content">
            <p>
              <LinkedText
                text={value(production.data, "description") ||
                  "Hier ist Raum für die wichtigsten Informationen zu diesem Stück."}
              ></LinkedText>
            </p>
            <dl class="detail-grid">
              <div>
                <dt>Premiere</dt>
                <dd>{dateLabel(value(production.data, "premiere"))}</dd>
              </div>
              <div>
                <dt>Projektteam</dt>
                <dd>
                  {ids(production.data, "memberIds")
                    .map((id) => workspace.members.find((x) => x.id === id)?.name)
                    .filter(Boolean)
                    .join(", ") || "Noch nicht zugeteilt"}
                </dd>
              </div>
            </dl>
          </div>
        </Section>
        <section class="project-stats">
          <p class="eyebrow">GEMEINSAME ARBEIT</p>
          <strong>
            {hours(
              projectHours?.[production.id] ??
                workspace.records.time
                  .filter((x) => x.data.productionId === production.id)
                  .reduce((sum, x) => sum + num(x.data, "durationSeconds"), 0),
            )}
            <span>Stunden</span>
          </strong>
          <p class="muted small">Gebuchte Produktionszeit aller freigegebenen Buchungen.</p>
          <Button onClick={() => setTab("time")}>
            Zeitübersicht öffnen
            <ArrowUpRight size={16}></ArrowUpRight>
          </Button>
        </section>
      </div>
      <div class="overview-links">
        {#each [["tasks", "Offene Aufgaben", workspace.records.tasks.filter((x) => x.data.productionId === production.id && x.data.status !== "done").length], ["casting", "Figuren", castingCounts.characters], ["casting", "Besetzungen", castingCounts.casting], ["looks", makeupWorkspace ? "Aufschriebe" : "Dokumentation", workspace.records.looks.filter((x) => x.data.productionId === production.id).length]] as [key, label, count] (label)}<button
            on:click={() => setTab(String(key))}
          >
            <span>{label}</span>
            <strong>{count}</strong>
            <ArrowUpRight size={18}></ArrowUpRight>
          </button>{/each}
      </div>
    {:else}{#if tab === "team"}{#key production.id}<ProductionTeamModule {production}
          ></ProductionTeamModule>{/key}{:else}{#if tab === "chat"}{#key production.id}<ChatModule
              productionId={production.id}
            ></ChatModule>{/key}{:else}{#if tab === "tasks"}{#key production.id}<TasksModule
                productionId={production.id}

              ></TasksModule>{/key}{:else}{#if tab === "calendar"}{#key production.id}<CalendarModule
                  productionId={production.id}
                ></CalendarModule>{/key}{:else}{#if tab === "time"}{#key production.id}<TimeModule
                    productionId={production.id}

                  ></TimeModule>{/key}{:else}{#if tab === "casting"}{#key production.id}<CastingModule
                      productionId={production.id}

                    ></CastingModule>{/key}{:else}{#if tab === "mask-plan"}{#key production.id}<MaskPlansModule
                        {production}

                      ></MaskPlansModule>{/key}{:else}{#if tab === "documents"}{#key production.id}<RecordDocuments
                          record={production}

                        ></RecordDocuments>{/key}{:else}{#key `${production.id}:${tab}`}<ResourceView
                          kind={tab === "looks" ? "looks" : "handovers"}
                          lockedProductionId={production.id}
                          defaults={{ productionId: production.id }}
                          filter={(x) => x.data.productionId === production.id}
                          description={tab === "looks"
                            ? makeupWorkspace
                              ? "Aufschriebe, Bildgalerien und Arbeitsabläufe für diese Produktion."
                              : "Dokumentation, Bildgalerien und Arbeitsabläufe für diese Produktion."
                            : "Checklisten, Absprachen und offene Punkte zu den Vorstellungen."}
                        ></ResourceView>{/key}{/if}{/if}{/if}{/if}{/if}{/if}{/if}{/if}{/if}
    {#if details}<RecordDetail record={production} onClose={() => setDetails(false)}
      ></RecordDetail>{/if}
  </section>{:else}<section class={styles.productionBrowse}>
    <PageHeader compact title="Produktionen"
      ><svelte:fragment slot="secondaryActions">
        <ExportButton onClick={() => setExporting(true)}></ExportButton>
        {#if memberCan(workspace.user, "production.manage")}<Button
            onClick={() => setImporting(true)}>Importieren</Button
          >{/if}
      </svelte:fragment>
      <Button variant="primary" onClick={() => setEditor(true)}>
        <Plus size={16}></Plus>
        Produktion anlegen
      </Button>
    </PageHeader>
    <PeriodPicker
      records={workspace.records.productions}
      productions={workspace.records.productions}
      value={period}
      onChange={setPeriod}
    ></PeriodPicker>
    <div class={`toolbar ${styles.productionToolbar}`}>
      <div class="segmented">
        {#each [["current", "Aktuell"], ["archived", "Archiv"], ["all", "Alle"]] as [key, label] (key)}<button
            class={status === key ? "active" : ""}
            on:click={() => setStatus(key)}
          >
            {label}
          </button>{/each}
      </div>
      <input
        class={`search-input ${styles.productionSearch}`}
        value={search}
        on:input={(e) => setSearch(e.currentTarget.value)}
        placeholder="Produktion suchen …"
        aria-label="Produktion suchen"
      />
      <label class={`production-sort ${styles.productionSort}`}>
        <span>Sortieren nach</span>
        <select value={sort} on:change={(event) => setSort(event.currentTarget.value)}>
          <option value="premiere">Premiere (früheste zuerst)</option>
          <option value="name">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="updated">Zuletzt geändert</option>
        </select>
      </label>
    </div>
    {#if records.length}<div class="production-grid">
        {#each records as project, i (project.id)}{@const remaining =
            workspace.records.tasks.filter(
              (x) => x.data.productionId === project.id && x.data.status !== "done",
            ).length}<button
            class="production-card"
            on:click={() => setSelected(project.id)}
            style={styleString({
              "--project-color": value(project.data, "color") || "#16735c",
            } as CSSProperties)}
          >
            <div class="production-card-top">
              <span class="eyebrow">{value(project.data, "season") || "SPIELZEIT"}</span>
              <Badge>{statusLabels[value(project.data, "status")]}</Badge>
            </div>
            <span class="production-number">{String(i + 1).padStart(2, "0")}</span>
            <h2>{value(project.data, "title")}</h2>
            <p>
              {value(project.data, "description") ||
                (makeupWorkspace
                  ? "Alle Aufgaben, Figuren und Aufschriebe für dieses Stück."
                  : "Aufgaben, Besetzung, Termine und Dokumentation für dieses Stück.")}
            </p>
            <div class="production-card-meta">
              <span>
                <CalendarDays size={15}></CalendarDays>
                {project.data.premiere
                  ? `Premiere ${dateLabel(value(project.data, "premiere"))}`
                  : "Premiere noch offen"}
              </span>
              <span>
                <Users size={15}></Users>
                {ids(project.data, "memberIds").length} im Team
              </span>
            </div>
            {#if makeupWorkspace}<div class="production-card-makeup">
                <Users size={15}></Users>
                <span>
                  <span class="small muted">Maskenbetreuung</span>
                  <strong>{makeupNames(project.data) || "Noch offen"}</strong>
                </span>
              </div>{/if}
            <footer>
              <span>{remaining} offene Aufgaben</span>
              <ArrowUpRight size={20}></ArrowUpRight>
            </footer>
          </button>{/each}
      </div>{:else}<Empty
        title={workspace.records.productions.length
          ? "Keine Produktionen in dieser Ansicht."
          : "Platz für euer nächstes Stück."}
        description={workspace.records.productions.length
          ? "Die gewählte Spielzeit, der Status oder der Suchtext blendet vorhandene Produktionen aus. Setze die Filter zurück, um alle geladenen Produktionen zu sehen."
          : "Lege eine Produktion an. Hier laufen Aufgaben, Besetzung, Dokumentation, Termine und Arbeitszeit zusammen."}
        action={workspace.records.productions.length
          ? "Alle Produktionen anzeigen"
          : "Erste Produktion anlegen"}
        onAction={() => {
          if (workspace.records.productions.length) {
            setPeriod({});
            setSearch("");
            setStatus("all");
          } else setEditor(true);
        }}
      ></Empty>{/if}
    {#if editor}<ResourceEditor
        kind="productions"
        defaults={{ season: period.season || seasonForDate(workspace.records.productions) }}
        onClose={() => setEditor(false)}
      ></ResourceEditor>{/if}
    {#if exporting}<ExportDialog
        kind="productions"
        filters={periodExportFilters(period)}
        onClose={() => setExporting(false)}
      ></ExportDialog>{/if}
    {#if importing}<ImportDialog kind="productions" onClose={() => setImporting(false)}
      ></ImportDialog>{/if}
  </section>{/if}
