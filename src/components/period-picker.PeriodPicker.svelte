<script lang="ts">
import { CalendarDays, ChevronDown } from "@lucide/svelte";
import { instantDate, timeAllocations, weekStart } from "@/shared/client-api";
import type { DomainRecord } from "@/shared/contracts";
import { dateMatchesPeriod, periodOptions, recordMatchesPeriod, seasonBounds, seasonForDate, seasonKey, type PeriodFilter, } from "@/shared/period-filter";
import { numberDraft, previewNumberDraft } from "@/shared/number-draft";
import styles from "./period-picker.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { periodExportFilters, weekForPeriod } from "./period-picker";
const effects=createEffects();
type ViewProps = {
    records: DomainRecord[];
    productions: DomainRecord[];
    value: PeriodFilter;
    onChange: (filter: PeriodFilter) => void;
    season?: boolean;
    compact?: boolean;
};
export let records: ViewProps["records"] = undefined as any;
export let productions: ViewProps["productions"] = undefined as any;
export let value: ViewProps["value"] = undefined as any;
export let onChange: ViewProps["onChange"] = undefined as any;
export let season: NonNullable<ViewProps["season"]> = true;
export let compact: NonNullable<ViewProps["compact"]> = false;
const listId = createId();
const controlsId = createId();
let expanded: boolean = false;
const setExpanded = (next: typeof expanded | ((current: typeof expanded) => typeof expanded)) => { expanded = typeof next === "function" ? (next as (current: typeof expanded) => typeof expanded)(expanded) : next; };
let year = numberDraft(value.year);
let yearEdit = { base: year, text: year };
const setYearEdit = (next: typeof yearEdit | ((current: typeof yearEdit) => typeof yearEdit)) => { yearEdit = typeof next === "function" ? (next as (current: typeof yearEdit) => typeof yearEdit)(yearEdit) : next; };
let yearDraft = yearEdit.base === year ? yearEdit.text : year;
let currentSeason = seasonForDate(productions);
let isCurrent = !value.year && !!value.season && seasonKey(value.season) === seasonKey(currentSeason);
let options = (() => {
    const next = periodOptions(records, productions);
    if (value.season && !next.seasons.includes(value.season))
        next.seasons.unshift(value.season);
    if (season && !next.seasons.some((label) => seasonKey(label) === seasonKey(currentSeason)))
        next.seasons.unshift(currentSeason);
    return next;
})();
let count = (() => records.filter((record) => recordMatchesPeriod(record, value, productions)).length)();
let returnCurrent = () => {
    setYearEdit({ base: year, text: "" });
    onChange({ season: currentSeason });
};

$: year = numberDraft(value.year);
$: yearDraft = yearEdit.base === year ? yearEdit.text : year;
$: currentSeason = seasonForDate(productions);
$: isCurrent = !value.year && !!value.season && seasonKey(value.season) === seasonKey(currentSeason);
$: options = (() => {
    const next = periodOptions(records, productions);
    if (value.season && !next.seasons.includes(value.season))
        next.seasons.unshift(value.season);
    if (season && !next.seasons.some((label) => seasonKey(label) === seasonKey(currentSeason)))
        next.seasons.unshift(currentSeason);
    return next;
})();
$: count = (() => records.filter((record) => recordMatchesPeriod(record, value, productions)).length)();


</script>

<div class={`period-picker ${styles.root}${compact ? " period-picker--compact" : ""}`}>
      <div class={styles.mobileSummary}>
        <button type="button" class={styles.summaryButton} aria-label="Zeitraum auswählen" aria-expanded={expanded} aria-controls={controlsId} on:click={() => setExpanded((open) => !open)}>
          <CalendarDays size={17}></CalendarDays>
          <span>
            <strong>
              {season && value.season
    ? `Spielzeit ${value.season}${value.year ? ` · ${value.year}` : ""}`
    : value.year
        ? `Jahr ${value.year}`
        : season
            ? "Alle Spielzeiten"
            : "Alle Jahre"}
            </strong>
            <small>
              {isCurrent ? "Aktuell · " : ""}
              {count} {count === 1 ? "Eintrag" : "Einträge"}
              {expanded ? " · Filter schließen" : " · Filter ändern"}
            </small>
          </span>
          <ChevronDown size={16} className={expanded ? styles.chevronOpen : ""}></ChevronDown>
        </button>
        {#if season && !isCurrent}<button type="button" class={styles.currentButton} aria-label="Aktuelle Spielzeit anzeigen" on:click={returnCurrent}>
            Aktuell
          </button>{/if}
      </div>
      <div id={controlsId} class={`${styles.controls} ${expanded ? styles.expanded : ""}`}>
        <label>
          Jahr
          <input type="number" min={1900} max={2100} list={listId} placeholder="Alle Jahre" value={yearDraft} on:input={(event) => {
    const text = event.currentTarget.value;
    setYearEdit({ base: year, text });
    const parsed = previewNumberDraft(text, { min: 1900, max: 2100, integer: true });
    if (!text || parsed !== undefined)
        onChange({ ...value, year: parsed });
}} />
          <datalist id={listId}>
            {#each options.years as year (year)}<option value={year}></option>{/each}
          </datalist>
        </label>
        {#if season}<label>
            Spielzeit
            <select aria-label="Spielzeit" value={value.season || ""} on:change={(event) => onChange({ ...value, season: event.currentTarget.value || undefined })}>
              <option value="">Alle Spielzeiten</option>
              {#each options.seasons as season (season)}<option value={season}>
                  {season}
                </option>{/each}
            </select>
          </label>{/if}
        {#if (yearDraft || value.season)}<button type="button" class="text-button" on:click={() => {
    setYearEdit({ base: year, text: "" });
    onChange({});
}}>
            Zeitraum zurücksetzen
          </button>{/if}
        {#if season && !isCurrent}<button type="button" class={`text-button ${styles.desktopCurrent}`} on:click={returnCurrent}>
            Aktuelle Spielzeit
          </button>{/if}
      </div>
    </div>
