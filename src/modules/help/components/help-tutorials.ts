import { Download, LoaderCircle, Play, RotateCcw, Smartphone, VolumeX } from "@lucide/svelte";
import { Button, Empty, Modal } from "@/components/ui";
import type { HelpTutorial } from "../tutorials";
import styles from "./help-tutorials.module.css";
export function duration(seconds: number) {
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} Min.`;
}
export function size(bytes: number) {
    return bytes < 1000000
        ? `${Math.max(1, Math.round(bytes / 1000))} kB`
        : `${(bytes / 1000000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}
export function platform(tutorial: HelpTutorial) {
    return tutorial.platform === "ios"
        ? "iPhone / iPad"
        : tutorial.platform === "android"
            ? "Android"
            : "Alle Geräte";
}
export { default as HelpTutorialList } from "./help-tutorials.HelpTutorialList.svelte";
export { default as HelpTutorialPlayer } from "./help-tutorials.HelpTutorialPlayer.svelte";
