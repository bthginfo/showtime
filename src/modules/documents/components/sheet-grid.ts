import type { SheetInfo } from "../contracts";
import { columnName } from "../sheet-values";
import { sheetCellPresentation, sheetColumnWidth, sheetRowHeight, visibleSheetCell, type SheetDirection, type SheetLayout, type SheetPosition, } from "../sheet-layout";
export const movements: Record<string, SheetDirection> = {
    ArrowDown: "down",
    ArrowUp: "up",
    ArrowLeft: "left",
    ArrowRight: "right",
};
export { default as SheetGrid } from "./sheet-grid.SheetGrid.svelte";
