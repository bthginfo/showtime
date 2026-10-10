import { Baseline, RotateCcw } from "@lucide/svelte";
export function pickerColor(color?: string) {
    if (!color)
        return "#000000";
    if (/^#[\da-f]{6}$/i.test(color))
        return color;
    if (/^#[\da-f]{3}$/i.test(color))
        return "#" + [...color.slice(1)].map((part) => part.repeat(2)).join("");
    const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
    return rgb
        ? "#" +
            rgb
                .slice(1, 4)
                .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0"))
                .join("")
        : "#000000";
}
export { default as TextColorControl } from "./text-color-control.TextColorControl.svelte";
