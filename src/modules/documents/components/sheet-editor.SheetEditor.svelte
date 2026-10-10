<script lang="ts">
import * as Y from "yjs";
import { ArrowLeft, ArrowRight, Check, Pencil, Plus, Redo2, Undo2 } from "@lucide/svelte";
import { ErrorMessage } from "@/components/ui";
import { cellKey, MAX_SHEET_CELLS, MAX_SHEET_COLUMNS, MAX_SHEET_ROWS, SHEETS_MAP, type SheetInfo, } from "../contracts";
import { columnName, createSheetCalculator, displayCell } from "../sheet-values";
import { createSheetLayout, nextSheetCell, pasteIntersectsMerge, sheetMaster, type SheetDirection, } from "../sheet-layout";
import { SHEET_EDIT } from "../client/shared-document";
import { useDocumentRevision } from "../client/use-document-revision";
import { SheetGrid } from "./sheet-grid";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { PAGE_ROWS } from "./sheet-editor";
const effects=createEffects();
type ViewProps = {
    doc: Y.Doc;
    info: SheetInfo[];
    editable: boolean;
    onSheetChange: (id: string) => void;
};
export let doc: ViewProps["doc"] = undefined as any;
export let info: ViewProps["info"] = undefined as any;
export let editable: ViewProps["editable"] = undefined as any;
export let onSheetChange: ViewProps["onSheetChange"] = undefined as any;
const revisionStore = useDocumentRevision(doc);
let revision = $revisionStore;
let sheets = (() => doc.getMap<Y.Map<string>>(SHEETS_MAP))();
let dimensions = (() => doc.getMap<{
    rows: number;
    columns: number;
}>("dimensions"))();
let sheetId = info[0]?.id || "";
const setSheetId = (next: typeof sheetId | ((current: typeof sheetId) => typeof sheetId)) => { sheetId = typeof next === "function" ? (next as (current: typeof sheetId) => typeof sheetId)(sheetId) : next; };
let selection = { row: 1, column: 1 };
const setSelected = (next: typeof selection | ((current: typeof selection) => typeof selection)) => { selection = typeof next === "function" ? (next as (current: typeof selection) => typeof selection)(selection) : next; };
let rowPage: number = 0;
const setPage = (next: typeof rowPage | ((current: typeof rowPage) => typeof rowPage)) => { rowPage = typeof next === "function" ? (next as (current: typeof rowPage) => typeof rowPage)(rowPage) : next; };
let draft: string = "";
const setDraft = (next: typeof draft | ((current: typeof draft) => typeof draft)) => { draft = typeof next === "function" ? (next as (current: typeof draft) => typeof draft)(draft) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let input = {current: null as HTMLInputElement | null};
let grid = {current: null as HTMLDivElement | null};
let dirty = {current: false as any | null};
let focusGrid = {current: false as any | null};
let sheet = info.find((item) => item.id === sheetId) || info[0];
let current: any = sheets.get(sheet?.id || "");
$: effects.run(0, () => {
    if (sheet?.id)
        onSheetChange(sheet.id);
}, [sheet?.id, onSheetChange]);
let size = dimensions.get(sheet?.id || "") || sheet || { rows: 1, columns: 1 };
let rows = Math.min(MAX_SHEET_ROWS, Math.max(1, size.rows));
let columns = Math.min(MAX_SHEET_COLUMNS, Math.max(1, size.columns));
let layout = (() => createSheetLayout(sheet || {}, rows, columns))();
let selected: any = sheetMaster(layout, Math.min(rows, selection.row), Math.min(columns, selection.column));
let page: any = Math.min(rowPage, Math.floor((rows - 1) / PAGE_ROWS));
let cell = cellKey(selected.row, selected.column);
let raw = current?.get(cell) || "";
let calculator = (() => {
    void revision;
    return createSheetCalculator(sheets, info);
})();
let arrayAnchor = sheet
    ? calculator.arrayAnchor(sheet.id, selected.row, selected.column)
    : undefined;
let arrayOutput = Boolean(arrayAnchor && arrayAnchor !== cell);
let undo = (() => new Y.UndoManager([sheets, dimensions], {
    trackedOrigins: new Set([SHEET_EDIT]),
    captureTimeout: 500,
}))();
$: effects.run(1, () => {const manager=undo;return () => manager.destroy();}, [undo]);
$: effects.run(2, () => {
    if (!dirty.current)
        setDraft(raw);
}, [raw, cell, sheetId]);
$: effects.run(3, () => {
    if (!focusGrid.current)
        return;
    focusGrid.current = false;
    const target = grid.current?.querySelector<HTMLButtonElement>(`[data-cell="${cell}"]`);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
}, [cell, page, sheetId]);
let commit = () => {
    if (!dirty.current || !editable || arrayOutput || !current)
        return;
    doc.transact(() => current.set(cell, draft), SHEET_EDIT);
    dirty.current = false;
};
let selectCell = (row: number, column: number, edit = false) => {
    commit();
    dirty.current = false;
    const master = sheetMaster(layout, row, column);
    setSelected(master);
    setDraft(current?.get(cellKey(master.row, master.column)) || "");
    setPage(Math.floor((row - 1) / PAGE_ROWS));
    if (edit)
        input.current?.focus();
    else if (document.activeElement?.classList.contains("sheet-cell"))
        focusGrid.current = true;
};
let navigate = (direction: SheetDirection) => {
    const next = nextSheetCell(layout, selected, direction, rows, columns);
    selectCell(next.row, next.column);
};
let grow = (axis: "rows" | "columns") => {
    if (!sheet || !editable)
        return;
    commit();
    const next = { rows, columns, [axis]: size[axis] + (axis === "rows" ? 20 : 2) };
    if (next.rows > MAX_SHEET_ROWS ||
        next.columns > MAX_SHEET_COLUMNS ||
        next.rows * next.columns > MAX_SHEET_CELLS) {
        setError("Diese Tabelle ist zu groß. Maximal 1.000 Zeilen, 100 Spalten und 50.000 Zellen sind möglich.");
        return;
    }
    doc.transact(() => dimensions.set(sheet.id, next), SHEET_EDIT);
    if (axis === "rows")
        selectCell(next.rows, selected.column);
};
let paste = (event: globalThis.ClipboardEvent) => {
    if (!editable || !current)
        return;
    const text = event.clipboardData?.getData("text/plain") || "";
    if (!/[\t\n\r]/.test(text))
        return;
    event.preventDefault();
    if (text.length > 100000) {
        setError("Die eingefügten Daten sind zu groß. Füge bitte einen kleineren Tabellenbereich ein.");
        return;
    }
    const values = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n$/, "")
        .split("\n")
        .map((line) => line.split("\t"));
    const endRow = selected.row + values.length - 1, endColumn = selected.column + Math.max(...values.map((line) => line.length)) - 1;
    const next = { rows: Math.max(rows, endRow), columns: Math.max(columns, endColumn) };
    if (endRow > MAX_SHEET_ROWS ||
        endColumn > MAX_SHEET_COLUMNS ||
        next.rows * next.columns > MAX_SHEET_CELLS) {
        setError("Die eingefügten Daten sind zu groß. Füge bitte einen kleineren Tabellenbereich ein.");
        return;
    }
    if (values.some((line) => line.some((value) => value.length > 4000))) {
        setError("Eine eingefügte Zelle enthält mehr als 4.000 Zeichen. Kürze diesen Zellwert und versuche es erneut.");
        return;
    }
    if (values.some((line, r) => line.some((_value, c) => {
        const row = selected.row + r, column = selected.column + c;
        const anchor = calculator.arrayAnchor(sheet!.id, row, column);
        return anchor && anchor !== cellKey(row, column);
    }))) {
        setError("Dieser Bereich enthält berechnete Array-Ergebnisse. Bearbeite die Ausgangsformel oder öffne die Datei in Excel.");
        return;
    }
    if (pasteIntersectsMerge(layout, selected, values)) {
        setError("Der eingefügte Bereich enthält verbundene Zellen. Füge die Werte in einen freien Bereich ein oder bearbeite die verbundene Zelle einzeln.");
        return;
    }
    doc.transact(() => {
        values.forEach((line, r) => line.forEach((value, c) => current.set(cellKey(selected.row + r, selected.column + c), value)));
        dimensions.set(sheet!.id, next);
    }, SHEET_EDIT);
    dirty.current = false;
    setDraft(values[0]?.[0] || "");
    setError("");
};
let first = page * PAGE_ROWS + 1;
let last = Math.min(rows, first + PAGE_ROWS - 1);

$: revision = $revisionStore;
$: sheets = (() => doc.getMap<Y.Map<string>>(SHEETS_MAP))();
$: dimensions = (() => doc.getMap<{
    rows: number;
    columns: number;
}>("dimensions"))();
$: sheet = info.find((item) => item.id === sheetId) || info[0];
$: { void revision; current = sheets.get(sheet?.id || ""); }
$: { void revision; size = dimensions.get(sheet?.id || "") || sheet || { rows: 1, columns: 1 }; }
$: rows = Math.min(MAX_SHEET_ROWS, Math.max(1, size.rows));
$: columns = Math.min(MAX_SHEET_COLUMNS, Math.max(1, size.columns));
$: layout = (() => createSheetLayout(sheet || {}, rows, columns))();
$: selected = sheetMaster(layout, Math.min(rows, selection.row), Math.min(columns, selection.column));
$: page = Math.min(rowPage, Math.floor((rows - 1) / PAGE_ROWS));
$: cell = cellKey(selected.row, selected.column);
$: { void revision; raw = current?.get(cell) || ""; }
$: calculator = (() => {
    void revision;
    return createSheetCalculator(sheets, info);
})();
$: arrayAnchor = sheet
    ? calculator.arrayAnchor(sheet.id, selected.row, selected.column)
    : undefined;
$: arrayOutput = Boolean(arrayAnchor && arrayAnchor !== cell);






$: first = page * PAGE_ROWS + 1;
$: last = Math.min(rows, first + PAGE_ROWS - 1);

</script>

{#if !sheet}<div class="document-loading">
        <strong>Keine Tabellenblätter verfügbar.</strong>
        <p>Lade die Originaldatei herunter und prüfe ihren Inhalt.</p>
      </div>{:else}<div class="shared-sheet-editor">
      <div class="document-toolbar" role="toolbar" aria-label="Tabelle bearbeiten">
        <button class="document-tool" aria-label="Rückgängig" title="Rückgängig" disabled={!editable || !(revision >= 0 && undo.canUndo())} on:click={() => {
    commit();
    undo.undo();
}}>
          <Undo2 size={18}></Undo2>
        </button>
        <button class="document-tool" aria-label="Wiederholen" title="Wiederholen" disabled={!editable || !(revision >= 0 && undo.canRedo())} on:click={() => {
    commit();
    undo.redo();
}}>
          <Redo2 size={18}></Redo2>
        </button>
        <button class="document-tool text-tool" disabled={!editable} on:click={() => grow("rows")}>
          <Plus size={16}></Plus> Zeilen
        </button>
        <button class="document-tool text-tool" disabled={!editable} on:click={() => grow("columns")}>
          <Plus size={16}></Plus> Spalten
        </button>
        <div class="sheet-page-controls">
          <button class="document-tool" aria-label="Vorherige Zeilen" disabled={page === 0} on:click={() => {
    selectCell((page - 1) * PAGE_ROWS + 1, selected.column);
}}>
            <ArrowLeft size={17}></ArrowLeft>
          </button>
          <span>
            {first}–{last} / {rows}
          </span>
          <button class="document-tool" aria-label="Weitere Zeilen" disabled={last >= rows} on:click={() => {
    selectCell((page + 1) * PAGE_ROWS + 1, selected.column);
}}>
            <ArrowRight size={17}></ArrowRight>
          </button>
        </div>
      </div>
      <div class="sheet-formula-bar">
        <span class="sheet-coordinate">
          {columnName(selected.column)}
          {selected.row}
        </span>
        <input bind:this={input.current} aria-label={`Zelle ${columnName(selected.column)}${selected.row} bearbeiten`} value={draft} disabled={!editable || arrayOutput} maxLength={4000} placeholder="Wert oder =Formel eingeben" on:input={(event) => {
    dirty.current = true;
    setDraft(event.currentTarget.value);
}} on:blur={commit} on:paste={paste} on:keydown={(event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        commit();
        navigate("down");
    }
    else if (event.key === "Escape") {
        event.preventDefault();
        dirty.current = false;
        setDraft(raw);
        input.current?.blur();
    }
}} />
        <button class="document-tool" aria-label="Zellwert übernehmen" title="Zellwert übernehmen" disabled={!editable || arrayOutput} on:click={commit}>
          <Check size={18}></Check>
        </button>
      </div>
      {#if (raw.startsWith("=") || arrayAnchor) &&
    calculator.hasError(sheet.id, selected.row, selected.column)}<p class="small muted" role="status">
            {arrayOutput
    ? "Diese Zelle ist das Ergebnis einer Array-Formel. Bearbeite ihre Ausgangszelle oder nutze Excel. "
    : "Diese Formel bleibt erhalten. "}
            Das Ergebnis wird beim Öffnen der heruntergeladenen Datei in Excel neu berechnet.
          </p>{/if}
      <ErrorMessage message={error}></ErrorMessage>
      <SheetGrid sheet={sheet} columns={columns} first={first} last={last} layout={layout} selected={selected} grid={grid} display={(row, column) => calculator.needsExcel(sheet.id, row, column)
    ? "Excel berechnet"
    : displayCell(calculator(sheet.id, row, column))} onSelect={selectCell} onNavigate={navigate} onPaste={paste}></SheetGrid>
      <footer class="sheet-tabs" aria-label="Tabellenblätter">
        {#each info as item (item.id)}<button class={sheetId === item.id ? "active" : ""} aria-current={sheetId === item.id ? "page" : undefined} on:click={() => {
    commit();
    dirty.current = false;
    setSheetId(item.id);
    setSelected({ row: 1, column: 1 });
    setPage(0);
    setDraft(sheets.get(item.id)?.get("1:1") || "");
}}>
            {item.name}
          </button>{/each}
        <button class="sheet-edit-selected" disabled={!editable || arrayOutput} on:click={() => input.current?.focus()}>
          <Pencil size={15}></Pencil> Zelle bearbeiten
        </button>
      </footer>
    </div>{/if}
