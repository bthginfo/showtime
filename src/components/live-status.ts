import { useWorkspace } from "./workspace-context";
export const labels = {
    connecting: "Verbindung wird aufgebaut",
    live: "Live verbunden",
    reconnecting: "Verbindung wird erneuert",
    offline: "Offline",
    paused: "Aktualisierung pausiert",
    unavailable: "Live-Verbindung unterbrochen",
};
export const descriptions = {
    connecting: "Die automatische Aktualisierung wird gestartet.",
    live: "Änderungen im Team werden automatisch angezeigt.",
    reconnecting: "Wir verbinden dich automatisch neu. Deine Eingaben bleiben erhalten.",
    offline: "Sobald du wieder online bist, werden Änderungen automatisch geladen.",
    paused: "Im Hintergrund pausiert die Aktualisierung. Beim Zurückkehren wird sie fortgesetzt.",
    unavailable: "Die automatische Aktualisierung ist gerade nicht verfügbar.",
};
export { default as LiveStatus } from "./live-status.LiveStatus.svelte";
