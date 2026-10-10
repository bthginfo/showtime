<script lang="ts">
import {memberCan} from "@/shared/access-policy";
import { Check, Download, ExternalLink, LoaderCircle, Users } from "@lucide/svelte";
import { ResourceView } from "@/components/resource-view";
import { Badge, Button, ErrorMessage, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { api, initials, post } from "@/shared/client-api";
import { PeriodPicker, periodExportFilters } from "@/components/period-picker";
import { initialPeriod, periodOptions, recordMatchesPeriod, seasonKey, type PeriodFilter, } from "@/shared/period-filter";
import { useViewState } from "@/shared/view-state";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type Preview, type ImportResult, EnsembleImport } from "./actors-module";
const effects=createEffects();
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
let open: boolean = false;
const setOpen = (next: typeof open | ((current: typeof open) => typeof open)) => { open = typeof next === "function" ? (next as (current: typeof open) => typeof open)(open) : next; };
const periodStore = useViewState<PeriodFilter>(workspace.user.id, "actors", "period", () => initialPeriod(workspace.records.productions));
let period: PeriodFilter = $periodStore; $: period = $periodStore;
const setPeriod = periodStore.set;


</script>


      <ResourceView kind="actors" filter={(record) => recordMatchesPeriod(record, period, workspace.records.productions)} defaults={{
    ensembleSeasons: [period.season || initialPeriod(workspace.records.productions).season],
}} exportFilters={periodExportFilters(period)}><svelte:fragment slot="headerActions">{#if memberCan(workspace.user, 'casting.manage')}<Button onClick={() => setOpen(true)}>
              <Download size={16}></Download>
              Ensemble laden
            </Button>{:else}{undefined}{/if}</svelte:fragment>
        <PeriodPicker compact records={workspace.records.actors} productions={workspace.records.productions} value={period} onChange={setPeriod}></PeriodPicker>
      </ResourceView>
      {#if open}<EnsembleImport onClose={() => setOpen(false)}></EnsembleImport>{/if}
