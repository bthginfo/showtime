<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { initialState } from "@/shared/svelte-runtime";

  import { CalendarCheck, ChevronDown } from "@lucide/svelte";
  import { Button } from "@/components/ui";
  import { useWorkspace } from "@/components/workspace-context";
  import { hours } from "@/shared/client-api";
  import { isActiveStaff } from "@/shared/client-members";
  import { categoriesFor } from "@/shared/domain-categories";
  import { useStoredValue } from "@/shared/client-storage";
  import type { PeriodFilter } from "@/shared/period-filter";
  import {
    calendarTimeProposals,
    type CalendarTimeProposal,
    type ProposalRange,
  } from "../calendar-proposals";
  import { TimeBookingEditor } from "./time-booking-editor";
  import styles from "./time-history.module.css";
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
    kind: "attendance" | "time";
    person: string;
    week: string;
    period: PeriodFilter;
    productionId?: string;
  };
  export let kind: ViewProps["kind"] = undefined as any;
  export let person: ViewProps["person"] = undefined as any;
  export let week: ViewProps["week"] = undefined as any;
  export let period: ViewProps["period"] = undefined as any;
  export let productionId: NonNullable<ViewProps["productionId"]> = "";
  const workspaceStore = useWorkspace();
  let { workspace } = $workspaceStore;
  $: ({ workspace } = $workspaceStore);
  let selected: CalendarTimeProposal | null = initialState<CalendarTimeProposal | null>(null);
  const setSelected = (
    next:
      | CalendarTimeProposal
      | null
      | ((current: CalendarTimeProposal | null) => CalendarTimeProposal | null),
  ) => {
    selected =
      typeof next === "function"
        ? (next as (current: CalendarTimeProposal | null) => CalendarTimeProposal | null)(selected)
        : next;
  };
  const reviewedJsonStore = useStoredValue<any>(
    `digitalmask-calendar-reviewed:${workspace.user.id}:${kind}`,
    "[]",
  );
  let reviewedJson: any = $reviewedJsonStore;
  $: reviewedJson = $reviewedJsonStore;
  const setReviewedJson = reviewedJsonStore.set;
  let reviewed = (() => {
    try {
      const parsed = JSON.parse(reviewedJson);
      return Array.isArray(parsed)
        ? parsed.filter(
            (range) => range && typeof range.start === "string" && typeof range.end === "string",
          )
        : [];
    } catch {
      return [];
    }
  })();
  let result = (() =>
    calendarTimeProposals({
      kind,
      userId: person,
      week,
      now: new Date(),
      events: workspace.records.events,
      bookings: workspace.records[kind],
      productions: workspace.records.productions,
      calendarCategories: workspace.records.calendarCategories,
      timeCategoryKeys: categoriesFor("time", workspace.records.categories).map(
        (category) => category.key,
      ),
      productionId,
      period,
      reviewed,
    }))();

  $: reviewed = (() => {
    try {
      const parsed = JSON.parse(reviewedJson);
      return Array.isArray(parsed)
        ? parsed.filter(
            (range) => range && typeof range.start === "string" && typeof range.end === "string",
          )
        : [];
    } catch {
      return [];
    }
  })();
  $: result = (() =>
    calendarTimeProposals({
      kind,
      userId: person,
      week,
      now: new Date(),
      events: workspace.records.events,
      bookings: workspace.records[kind],
      productions: workspace.records.productions,
      calendarCategories: workspace.records.calendarCategories,
      timeCategoryKeys: categoriesFor("time", workspace.records.categories).map(
        (category) => category.key,
      ),
      productionId,
      period,
      reviewed,
    }))();
</script>

{#if !isActiveStaff(workspace.user) || person !== workspace.user.id}{:else}
  <details class={styles.proposals}>
    <summary>
      <CalendarCheck size={18}></CalendarCheck>
      <span>
        <strong>Kalenderzeiten prüfen</strong>
        <small>
          {result.proposals.length
            ? `${result.proposals.length} geplante ${result.proposals.length === 1 ? "Zeit" : "Zeiten"} · noch nicht gebucht`
            : "Geplante Zeiten · noch nicht gebucht"}
        </small>
      </span>
      <ChevronDown size={18}></ChevronDown>
    </summary>
    <div class={styles.proposalBody}>
      <p class="small muted">
        Nur beendete eigene Dienste werden vorgeschlagen. Prüfe die tatsächlich geleistete Zeit,
        Pausen und Zuordnung. Erst „Geprüfte Zeit buchen“ zählt als{" "}
        {kind === "attendance" ? "Anwesenheit" : "Arbeitszeit"}.
      </p>
      {#if result.overlappingEvents}<p class={styles.proposalNotice}>
          Kalendertermine überschneiden sich. Die mehrdeutigen Teile sind ausgelassen; ordne diese
          Zeiten bei Bedarf manuell zu.
        </p>{/if}
      {#if result.undatedBookings}<p class={styles.proposalNotice}>
          An Tagen mit Buchungen ohne Uhrzeit sind Vorschläge ausgelassen. Prüfe dort die
          vorhandenen Buchungen.
        </p>{/if}
      {#if result.blockedDayEvents}<p class={styles.proposalNotice}>
          Dienste liegen auf einem gesperrten freien oder abwesenden Tag. Diese Teile sind
          ausgelassen; prüfe zuerst den Kalender.
        </p>{/if}
      {#if result.proposals.length}<ul class={styles.proposalList}>
          {#each result.proposals as proposal (proposal.id)}<li>
              <div>
                <span class={styles.plannedLabel}>Noch nicht gebucht</span>
                <strong>{proposal.sourceLabels.join(" · ")}</strong>
                <span class="small muted">
                  {dateLabel(proposal.start, true)} – {dateLabel(proposal.end, true)} ·{" "}
                  {hours(proposal.seconds)} h geplant
                </span>
                {#if proposal.adjusted}<span class="small muted"
                    >Bereits belegte Zeiten sind ausgespart.</span
                  >{/if}
              </div>
              <Button onClick={() => setSelected(proposal)}>Prüfen</Button>
            </li>{/each}
        </ul>{:else}<p class={styles.emptyInline}>
          Keine offenen Vorschläge in dieser Woche. Zukünftige, laufende, ganztägige und bereits
          gebuchte Zeiten werden nicht vorgeschlagen.
        </p>{/if}
    </div>
  </details>
  {#if selected}{@const activeSelected = selected}<TimeBookingEditor
      {kind}
      defaults={activeSelected.data}
      proposal={activeSelected.sourceLabels.join(" · ")}
      onSaved={() =>
        setReviewedJson(
          JSON.stringify([...reviewed, { start: activeSelected.start, end: activeSelected.end }]),
        )}
      onClose={() => setSelected(null)}
    ></TimeBookingEditor>{/if}
{/if}
