<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { History } from "@lucide/svelte";
  import type { DomainRecord, RecordData } from "@/shared/contracts";
  import { api } from "@/shared/client-api";
  import { Button, ErrorMessage } from "./ui";
  import { fields } from "./resource-fields";
  import { useWorkspace } from "./workspace-context";
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
  import { type Version } from "./history-panel";
  const effects = createEffects();
  type ViewProps = {
    record: DomainRecord;
  };
  export let record: ViewProps["record"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace } = $workspaceStore;
  $: ({ workspace } = $workspaceStore);
  let versions: Version[] | null = initialState<Version[] | null>(null);
  const setVersions = (
    next: Version[] | null | ((current: Version[] | null) => Version[] | null),
  ) => {
    versions =
      typeof next === "function"
        ? (next as (current: Version[] | null) => Version[] | null)(versions)
        : next;
  };
  let open: boolean = false;
  const setOpen = (next: typeof open | ((current: typeof open) => typeof open)) => {
    open =
      typeof next === "function" ? (next as (current: typeof open) => typeof open)(open) : next;
  };
  let busy: boolean = false;
  const setBusy = (next: typeof busy | ((current: typeof busy) => typeof busy)) => {
    busy =
      typeof next === "function" ? (next as (current: typeof busy) => typeof busy)(busy) : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let selected: string = "";
  const setSelected = (next: typeof selected | ((current: typeof selected) => typeof selected)) => {
    selected =
      typeof next === "function"
        ? (next as (current: typeof selected) => typeof selected)(selected)
        : next;
  };
  let load = async () => {
    setOpen(!open);
    if (versions || open) return;
    setBusy(true);
    try {
      const result = await api<{
        versions: Version[];
      }>(`/api/history?id=${encodeURIComponent(record.id)}`);
      setVersions(result.versions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Historie konnte nicht geladen werden.");
    } finally {
      setBusy(false);
    }
  };
</script>

<section class="detail-section">
  <Button onClick={() => void load()}>
    <History size={16}></History>
    {open ? "Versionshistorie schließen" : "Versionshistorie ansehen"}
  </Button>
  {#if open}
    {#if busy}<p class="empty-inline">Versionen werden geladen …</p>{/if}
    <ErrorMessage message={error}></ErrorMessage>
    {#if versions?.length === 0}<p class="empty-inline">Noch keine früheren Versionen.</p>{/if}
    {#each versions as version (version.id)}<details
        open={selected === version.id}
        on:toggle={(event) => {
          if (event.currentTarget.open) setSelected(version.id);
        }}
        class="history-version"
      >
        <summary>
          Version {version.version} · {dateLabel(version.createdAt, true)} ·{" "}
          {workspace.members.find((x) => x.id === version.createdBy)?.name || "Teammitglied"}
        </summary>
        <dl class="detail-grid">
          {#each (fields[record.kind] || []).filter((field) => version.data[field.key] !== undefined && !field.source && field.type !== "checklist") as field (field.key)}<div
              class={field.type === "textarea" ? "field-wide" : ""}
            >
              <dt>{field.label}</dt>
              <dd>
                {Array.isArray(version.data[field.key])
                  ? (version.data[field.key] as string[]).join(" · ")
                  : String(version.data[field.key] || "–")}
              </dd>
            </div>{/each}
        </dl>
      </details>{/each}
  {/if}
</section>
