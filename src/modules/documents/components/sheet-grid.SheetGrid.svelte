<script lang="ts">
import type { SheetInfo } from "../contracts";
import { columnName } from "../sheet-values";
import { sheetCellPresentation, sheetColumnWidth, sheetRowHeight, visibleSheetCell, type SheetDirection, type SheetLayout, type SheetPosition, } from "../sheet-layout";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { movements } from "./sheet-grid";
const effects=createEffects();
type ViewProps = {
    sheet: SheetInfo;
    columns: number;
    first: number;
    last: number;
    layout: SheetLayout;
    selected: SheetPosition;
    grid: RefObject<HTMLDivElement | null>;
    display: (row: number, column: number) => string;
    onSelect: (row: number, column: number, edit?: boolean) => void;
    onNavigate: (direction: SheetDirection) => void;
    onPaste: (event: globalThis.ClipboardEvent) => void;
};
export let sheet: ViewProps["sheet"] = undefined as any;
export let columns: ViewProps["columns"] = undefined as any;
export let first: ViewProps["first"] = undefined as any;
export let last: ViewProps["last"] = undefined as any;
export let layout: ViewProps["layout"] = undefined as any;
export let selected: ViewProps["selected"] = undefined as any;
export let grid: ViewProps["grid"] = undefined as any;
export let display: ViewProps["display"] = undefined as any;
export let onSelect: ViewProps["onSelect"] = undefined as any;
export let onNavigate: ViewProps["onNavigate"] = undefined as any;
export let onPaste: ViewProps["onPaste"] = undefined as any;
let width = 44 +
    Array.from({ length: columns }, (_, c) => sheetColumnWidth(sheet, c + 1)).reduce((a, b) => a + b, 0);

$: width = 44 +
    Array.from({ length: columns }, (_, c) => sheetColumnWidth(sheet, c + 1)).reduce((a, b) => a + b, 0);

</script>

<div bind:this={grid.current} class="sheet-grid-scroll" on:paste={onPaste}>
      <table class="shared-sheet-grid" aria-label={sheet.name || "Tabelle"} style={styleString({ width })}>
        <colgroup>
          <col style={styleString({ width: 44 })} />
          {#each Array.from({ length: columns }) as _, c (c)}<col style={styleString({ width: sheetColumnWidth(sheet, c + 1) })} />{/each}
        </colgroup>
        <thead>
          <tr>
            <th class="sheet-corner" aria-label="Zeile"></th>
            {#each Array.from({ length: columns }) as _, c (c)}<th scope="col">
                {columnName(c + 1)}
              </th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each Array.from({ length: Math.max(0, last - first + 1) }) as _, offset}{@const row = first + offset}<tr style={styleString({ height: sheetRowHeight(sheet, row) })}>
                <th scope="row">{row}</th>
                {#each Array.from({ length: columns }) as _, c (c)}{@const visible = visibleSheetCell(layout, row, c + 1, first, last)}{#if visible}{@const { master } = visible}{@const contents = display(master.row, master.column)}{@const active = selected.row === master.row && selected.column === master.column}{@const presentation = sheetCellPresentation(sheet, visible)}{@const rangeLabel = visible.range
    ? `, verbunden bis ${columnName(visible.range.last.column)}${visible.range.last.row}`
    : ""}<td rowspan={visible.rowSpan} colspan={visible.colSpan} class={active ? "selected" : ""} style={styleString(presentation.cell)}>
                      <button type="button" class="sheet-cell" style={styleString(presentation.content)} data-cell={`${master.row}:${master.column}`} tabindex={active ? 0 : -1} aria-label={`Zelle ${columnName(master.column)}${master.row}${contents ? `: ${contents}` : ""}${rangeLabel}`} aria-pressed={active} title={contents || undefined} on:click={() => onSelect(row, c + 1)} on:dblclick={() => onSelect(row, c + 1, true)} on:keydown={(event) => {
    if (movements[event.key]) {
        event.preventDefault();
        onNavigate(movements[event.key]);
    }
    else if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        onSelect(row, c + 1, true);
    }
}}>
                        <span class="sheet-cell-content">
                          {#if contents}{contents}{:else}<span aria-hidden="true">&nbsp;</span>{/if}
                        </span>
                      </button>
                    </td>{/if}{/each}
              </tr>{/each}
        </tbody>
      </table>
    </div>
