<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { weekStart } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { ArrowRight, Clock3, DoorOpen } from "@lucide/svelte";
  import type { DomainRecord } from "@/shared/contracts";
  import { hours, shiftDate, timeAllocations } from "@/shared/client-api";
  import { useWorkspace } from "@/components/workspace-context";
  import { PageHeader } from "@/components/ui";
  import { WorkTimeModule } from "@/components/modules/time";
  import { AttendanceModule } from "./attendance-module";
  import { TimerPanel } from "./work-timer";
  import { TimeBookingEditor } from "./time-booking-editor";
  import styles from "./time-workspace.module.css";
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
  const effects = createEffects();
  const workspaceStore = useWorkspace();
  let { workspace } = $workspaceStore;
  $: ({ workspace } = $workspaceStore);
  const tabStore = useViewState<any>(workspace.user.id, "time", "tab", "attendance");
  let tab: any = $tabStore;
  $: tab = $tabStore;
  const setTab = tabStore.set;
  let booked: DomainRecord | null = initialState<DomainRecord | null>(null);
  const setBooked = (
    next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null),
  ) => {
    booked =
      typeof next === "function"
        ? (next as (current: DomainRecord | null) => DomainRecord | null)(booked)
        : next;
  };
  let selfBooking = workspace.user.role !== "superadmin";
  let week = weekStart();
  let until = shiftDate(week, 6);
  let totals = (() => {
    const sum = (records: DomainRecord[]) =>
      records
        .filter((row) => row.data.userId === workspace.user.id)
        .flatMap((row) => timeAllocations(row.data))
        .filter((day) => day.date >= week && day.date <= until)
        .reduce((total, day) => total + day.seconds, 0);
    return {
      attendance: sum(workspace.records.attendance || []),
      work: sum(workspace.records.time),
    };
  })();

  $: selfBooking = workspace.user.role !== "superadmin";
  $: week = weekStart();
  $: until = shiftDate(week, 6);
  $: totals = (() => {
    const sum = (records: DomainRecord[]) =>
      records
        .filter((row) => row.data.userId === workspace.user.id)
        .flatMap((row) => timeAllocations(row.data))
        .filter((day) => day.date >= week && day.date <= until)
        .reduce((total, day) => total + day.seconds, 0);
    return {
      attendance: sum(workspace.records.attendance || []),
      work: sum(workspace.records.time),
    };
  })();
</script>

<div class={styles.workspace}>
  <PageHeader title="Zeit buchen" compact></PageHeader>
  {#if selfBooking}
    <div class={`dual-timers ${styles.timers}`}>
      <TimerPanel kind="attendance" onBooked={setBooked}></TimerPanel>
      <TimerPanel onBooked={setBooked}></TimerPanel>
    </div>
    <section
      class={`time-comparison ${styles.comparison}`}
      aria-label="Vergleich deiner aktuellen Woche"
    >
      <div>
        <span class="eyebrow">DEINE AKTUELLE WOCHE</span>
        <p class="small muted">
          Bereits gebuchte Zeiten · laufende Timer werden erst nach dem Stoppen gezählt.
        </p>
      </div>
      <div>
        <DoorOpen size={19}></DoorOpen>
        <span>
          Anwesenheit<strong>{hours(totals.attendance)} h</strong>
        </span>
      </div>
      <div>
        <Clock3 size={19}></Clock3>
        <span>
          Produktionsstunden<strong>{hours(totals.work)} h</strong>
        </span>
      </div>
      <div class="time-comparison-note">
        <ArrowRight size={15}></ArrowRight>
        <span>Du musst nicht jede Minute einer Produktion zuordnen.</span>
      </div>
    </section>
  {/if}
  <div class="tabs time-workspace-tabs" aria-label="Zeitnachweise">
    <button
      class={tab === "attendance" ? "active" : ""}
      aria-current={tab === "attendance" ? "page" : undefined}
      on:click={() => setTab("attendance")}
    >
      <DoorOpen size={16}></DoorOpen>
      <span class={styles.desktopLabel}>Anwesenheit im Theater</span>
      <span class={styles.mobileLabel}>Anwesenheit</span>
    </button>
    <button
      class={tab === "work" ? "active" : ""}
      aria-current={tab === "work" ? "page" : undefined}
      on:click={() => setTab("work")}
    >
      <Clock3 size={16}></Clock3>
      <span class={styles.desktopLabel}>Produktionsstunden</span>
      <span class={styles.mobileLabel}>Produktionsstunden</span>
    </button>
  </div>
  <div hidden={tab !== "attendance"}>
    <AttendanceModule embedded></AttendanceModule>
  </div>
  <div hidden={tab !== "work"}>
    <WorkTimeModule embedded></WorkTimeModule>
  </div>
  {#if booked}<TimeBookingEditor
      kind={booked.kind === "attendance" ? "attendance" : "time"}
      record={booked}
      onClose={() => setBooked(null)}
    ></TimeBookingEditor>{/if}
</div>
