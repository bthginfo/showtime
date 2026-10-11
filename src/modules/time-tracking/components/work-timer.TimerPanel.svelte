<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { ChevronDown, Clock3, DoorOpen, Pause, Play, Square } from "@lucide/svelte";
  import { categoriesFor } from "@/shared/domain-categories";
  import type { DomainRecord } from "@/shared/contracts";
  import { num, value } from "@/shared/client-api";
  import { useWorkspace } from "@/components/workspace-context";
  import { Badge, Button, ErrorMessage } from "@/components/ui";
  import styles from "./work-timer.module.css";
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
  const effects = createEffects();
  type ViewProps = {
    compact?: boolean;
    productionId?: string;
    kind?: "time" | "attendance";
    onBooked?: (record: DomainRecord) => void;
  };
  export let compact: NonNullable<ViewProps["compact"]> = false;
  export let productionId: NonNullable<ViewProps["productionId"]> = "";
  export let kind: NonNullable<ViewProps["kind"]> = "time";
  export let onBooked: ViewProps["onBooked"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace, action, busy } = $workspaceStore;
  $: ({ workspace, action, busy } = $workspaceStore);
  let now = Date.now();
  const setNow = (next: typeof now | ((current: typeof now) => typeof now)) => {
    now = typeof next === "function" ? (next as (current: typeof now) => typeof now)(now) : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let title: string = "";
  const setTitle = (next: typeof title | ((current: typeof title) => typeof title)) => {
    title =
      typeof next === "function" ? (next as (current: typeof title) => typeof title)(title) : next;
  };
  let project = productionId;
  const setProject = (next: typeof project | ((current: typeof project) => typeof project)) => {
    project =
      typeof next === "function"
        ? (next as (current: typeof project) => typeof project)(project)
        : next;
  };
  let fieldsOpen: boolean = false;
  const setFieldsOpen = (
    next: typeof fieldsOpen | ((current: typeof fieldsOpen) => typeof fieldsOpen),
  ) => {
    fieldsOpen =
      typeof next === "function"
        ? (next as (current: typeof fieldsOpen) => typeof fieldsOpen)(fieldsOpen)
        : next;
  };
  const fieldsId = createId();
  let titleInput = { current: null as HTMLInputElement | null };
  let categoryOptions = categoriesFor("time", workspace.records.categories);
  let category = categoryOptions[0]?.key || "";
  const setCategory = (next: typeof category | ((current: typeof category) => typeof category)) => {
    category =
      typeof next === "function"
        ? (next as (current: typeof category) => typeof category)(category)
        : next;
  };
  let selectedCategory = categoryOptions.some((option) => option.key === category)
    ? category
    : categoryOptions[0]?.key || "";
  let attendance = kind === "attendance";
  let timer = attendance ? workspace.attendanceTimer : workspace.timer;
  $: effects.run(
    0,
    () => {
      if (!timer || timer.data.pausedAt) return;
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    },
    [timer],
  );
  let seconds = timer
    ? Math.max(
        0,
        Math.floor(
          ((timer.data.pausedAt ? new Date(String(timer.data.pausedAt)).getTime() : now) -
            new Date(String(timer.data.startedAt)).getTime()) /
            1000,
        ) - num(timer.data, "pauseSeconds"),
      )
    : 0;
  let display = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  let run = async (operation: string) => {
    setError("");
    if (operation === "start" && !attendance && !title.trim()) {
      setFieldsOpen(true);
      requestAnimationFrame(() => titleInput.current?.focus());
      return;
    }
    try {
      const result = await action(
        `${attendance ? "attendance-" : ""}timer-${operation}`,
        undefined,
        operation === "start"
          ? attendance
            ? { title: title.trim() || "Anwesenheit" }
            : { title: title.trim(), productionId: project, category: selectedCategory }
          : {},
      );
      setNow(Date.now());
      if (operation === "start") setFieldsOpen(false);
      if (operation === "stop" && result && typeof result === "object" && "kind" in result)
        onBooked?.(result as DomainRecord);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Timer-Aktion fehlgeschlagen");
    }
  };
  let Icon = attendance ? DoorOpen : Clock3;
  let timerProject = timer
    ? workspace.records.productions.find((row) => row.id === timer?.data.productionId)
    : undefined;

  $: categoryOptions = categoriesFor("time", workspace.records.categories);
  $: selectedCategory = categoryOptions.some((option) => option.key === category)
    ? category
    : categoryOptions[0]?.key || "";
  $: attendance = kind === "attendance";
  $: timer = attendance ? workspace.attendanceTimer : workspace.timer;
  $: seconds = timer
    ? Math.max(
        0,
        Math.floor(
          ((timer.data.pausedAt ? new Date(String(timer.data.pausedAt)).getTime() : now) -
            new Date(String(timer.data.startedAt)).getTime()) /
            1000,
        ) - num(timer.data, "pauseSeconds"),
      )
    : 0;
  $: display = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  $: Icon = attendance ? DoorOpen : Clock3;
  $: timerProject = timer
    ? workspace.records.productions.find((row) => row.id === timer?.data.productionId)
    : undefined;
</script>

{#if workspace.user.role === "superadmin"}{:else}<section
    class={`timer-panel ${styles.timer} ${compact ? "compact" : ""} ${attendance ? "attendance-timer" : ""}`}
    aria-label={attendance ? "Anwesenheitstimer" : "Produktionstimer"}
  >
    <header class={styles.header}>
      <button
        class={styles.mobileToggle}
        aria-label={timer
          ? `${attendance ? "Anwesenheit" : "Produktion"}: Details und weitere Aktionen`
          : attendance
            ? "Bezeichnung ändern"
            : "Tätigkeit & Zuordnung"}
        aria-expanded={fieldsOpen}
        aria-controls={fieldsId}
        on:click={() => setFieldsOpen((open) => !open)}
      >
        <svelte:component this={Icon} size={16}></svelte:component>
        <span>
          {attendance ? "Anwesenheit" : "Produktion"}
          <small>
            {timer ? "Details" : attendance ? "Bezeichnung" : "Tätigkeit & Zuordnung"}
          </small>
        </span>
        <ChevronDown size={15}></ChevronDown>
      </button>
      <span class={styles.label}>
        <svelte:component this={Icon} size={16}></svelte:component>
        {attendance ? "Anwesenheit" : "Produktion"}
      </span>
      <Badge tone={timer && !timer.data.pausedAt ? "green" : "neutral"}>
        {timer ? (timer.data.pausedAt ? "Pausiert" : "Timer läuft") : "Bereit"}
      </Badge>
    </header>
    {#if timer}<p class={styles.runningTitle}>{value(timer.data, "title")}</p>{/if}
    <div class={styles.main}>
      <p class={styles.value} aria-live="off">
        {display}
      </p>
      <div class={styles.primaryActions}>
        {#if timer}
          <Button
            disabled={busy}
            onClick={() => void run(timer.data.pausedAt ? "resume" : "pause")}
          >
            {#if timer.data.pausedAt}<Play size={15}></Play>{:else}<Pause size={15}></Pause>{/if}
            {timer.data.pausedAt ? "Weiter" : "Pause"}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void run("stop")}
            title="Timer stoppen und Zeit buchen"
          >
            <Square size={13}></Square>
            <span class={styles.desktopLabel}>Stoppen & buchen</span>
            <span class={styles.mobileLabel}>Stoppen</span>
          </Button>
        {:else}<Button
            variant="primary"
            disabled={busy || (!attendance && !selectedCategory)}
            onClick={() => void run("start")}
          >
            <Play size={15}></Play>
            <span class={styles.desktopLabel}>
              {attendance ? "Anwesenheit starten" : "Produktionstimer starten"}
            </span>
            <span class={styles.mobileLabel}>Starten</span>
          </Button>{/if}
      </div>
    </div>
    <div id={fieldsId} class={`${styles.details} ${fieldsOpen ? styles.detailsOpen : ""}`}>
      {#if timer}
        <p class="small muted">
          {attendance
            ? "Deine Anwesenheit läuft unabhängig von einzelnen Tätigkeiten."
            : timerProject
              ? value(timerProject.data, "title")
              : "Allgemeine Arbeit"}
          {` · Beginn ${dateLabel(String(timer.data.startedAt), true)}`}
        </p>
        <Button
          variant="danger-ghost"
          disabled={busy}
          onClick={() => {
            if (
              confirm(`${attendance ? "Anwesenheits" : "Produktions"}timer ohne Buchung verwerfen?`)
            )
              void run("discard");
          }}
        >
          Timer verwerfen
        </Button>
      {:else}
        <label>
          {attendance ? "Bezeichnung (optional)" : "Tätigkeit"}
          <input
            bind:this={titleInput.current}
            maxLength={200}
            placeholder={attendance ? "Anwesenheit" : "Woran arbeitest du?"}
            value={title}
            on:input={(event) => setTitle(event.currentTarget.value)}
          />
        </label>
        {#if !attendance}<div class={styles.selects}>
            <label>
              Produktion
              <select
                value={project}
                disabled={!!productionId}
                on:change={(event) => setProject(event.currentTarget.value)}
              >
                <option value="">Allgemeine Arbeit</option>
                {#each workspace.records.productions.filter((row) => row.data.status !== "archived") as row (row.id)}<option
                    value={row.id}
                  >
                    {value(row.data, "title")}
                  </option>{/each}
              </select>
            </label>
            <label>
              Tätigkeitsbereich
              <select
                value={selectedCategory}
                on:change={(event) => setCategory(event.currentTarget.value)}
              >
                {#if !categoryOptions.length}<option value="">Keine Kategorien vorhanden</option
                  >{/if}
                {#each categoryOptions as option (option.key)}<option value={option.key}>
                    {option.name}
                  </option>{/each}
              </select>
            </label>
          </div>{/if}
        <p class="small muted">
          {attendance
            ? "Im Theater beginnen. Der Produktionstimer kann gleichzeitig laufen."
            : "Allgemeine Tätigkeiten kannst du auch ohne Produktion buchen."}
        </p>
      {/if}
    </div>
    <ErrorMessage message={error}></ErrorMessage>
  </section>{/if}
