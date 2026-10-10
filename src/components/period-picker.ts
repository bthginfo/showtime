import { CalendarDays, ChevronDown } from "@lucide/svelte";
import { instantDate, timeAllocations, weekStart } from "@/shared/client-api";
import type { DomainRecord } from "@/shared/contracts";
import { dateMatchesPeriod, periodOptions, recordMatchesPeriod, seasonBounds, seasonForDate, seasonKey, type PeriodFilter, } from "@/shared/period-filter";
import { numberDraft, previewNumberDraft } from "@/shared/number-draft";
import styles from "./period-picker.module.css";
export const periodExportFilters = (value: PeriodFilter) => ({
    ...(value.year ? { year: String(value.year) } : {}),
    ...(value.season ? { season: value.season } : {}),
});
export function weekForPeriod(records: DomainRecord[], personId: string, period: PeriodFilter, currentWeek: string) {
    if (!period.year && !period.season)
        return currentWeek;
    if (dateMatchesPeriod(currentWeek, period))
        return currentWeek;
    const date = records
        .filter((row) => row.data.userId === personId)
        .flatMap((row) => timeAllocations(row.data))
        .find((day) => dateMatchesPeriod(day.date, period))?.date ||
        (period.year ? period.year + "-01-04" : seasonBounds(period.season)?.from);
    if (!date)
        return currentWeek;
    return weekStart(instantDate(date));
}
export { default as PeriodPicker } from "./period-picker.PeriodPicker.svelte";
