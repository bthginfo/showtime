<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { Download, Share } from "@lucide/svelte";
import { Button, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { appDeviceState } from "@/shared/app-device";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { type InstallEvent } from "./app-install";
const effects=createEffects();
type ViewProps = {
    onOpenHelp?: () => void;
};
export let onOpenHelp: ViewProps["onOpenHelp"] = undefined as any;
const workspaceStore=useWorkspace();
let { notify } = $workspaceStore;
$: ({ notify } = $workspaceStore);
let install: InstallEvent | null = initialState<InstallEvent | null>(null);
const setInstall = (next: InstallEvent | null | ((current: InstallEvent | null) => InstallEvent | null)) => { install = typeof next === "function" ? (next as (current: InstallEvent | null) => InstallEvent | null)(install) : next; };
let needsAppleInstall: boolean = false;
const setNeedsAppleInstall = (next: typeof needsAppleInstall | ((current: typeof needsAppleInstall) => typeof needsAppleInstall)) => { needsAppleInstall = typeof next === "function" ? (next as (current: typeof needsAppleInstall) => typeof needsAppleInstall)(needsAppleInstall) : next; };
let instructions: boolean = false;
const setInstructions = (next: typeof instructions | ((current: typeof instructions) => typeof instructions)) => { instructions = typeof next === "function" ? (next as (current: typeof instructions) => typeof instructions)(instructions) : next; };
$: effects.run(0, () => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () => {
        const { ios, standalone } = appDeviceState();
        setNeedsAppleInstall(ios && !standalone);
        if (standalone) {
            setInstall(null);
            setInstructions(false);
        }
    };
    const installer = (event: Event) => {
        if (appDeviceState().standalone)
            return;
        event.preventDefault();
        setInstall(event as InstallEvent);
    };
    const installed = () => {
        setInstall(null);
        setInstructions(false);
        setNeedsAppleInstall(false);
    };
    update();
    display.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", installer);
    window.addEventListener("appinstalled", installed);
    return () => {
        display.removeEventListener("change", update);
        window.removeEventListener("beforeinstallprompt", installer);
        window.removeEventListener("appinstalled", installed);
    };
}, []);


</script>

{#if !needsAppleInstall && !install}{:else}
      <button type="button" class="text-button app-install-button" on:click={async () => {
    if (needsAppleInstall) {
        setInstructions(true);
        return;
    }
    if (!install)
        return;
    try {
        await install.prompt();
        await install.userChoice;
    }
    catch {
        notify("Die Installation konnte nicht geöffnet werden. Bitte lade die Seite erneut.");
    }
    finally {
        setInstall(null);
    }
}}>
        <Download size={15} aria-hidden="true"></Download>
        App installieren
      </button>
      {#if instructions}<Modal title="Showtime auf dem iPhone oder iPad" className="app-install-dialog" onClose={() => setInstructions(false)}>
          <p>Öffne Showtime in Safari. So legst du die App auf deinen Home-Bildschirm:</p>
          <ol class="app-install-steps">
            <li>
              Tippe in Safari auf <Share size={17} aria-hidden="true"></Share> <strong>Teilen</strong>. Je
              nach Safari-Ansicht findest du es unter <strong>Mehr (…)</strong>.
            </li>
            <li>
              Wähle <strong>Zum Home-Bildschirm</strong> oder{" "}
              <strong>Zu Home-Bildschirm hinzufügen</strong>.
            </li>
            <li>
              Lass <strong>Als Web-App öffnen</strong> eingeschaltet, falls diese Auswahl erscheint.
              Tippe auf <strong>Hinzufügen</strong>.
            </li>
            <li>Starte Showtime danach über das neue App-Symbol.</li>
          </ol>
          <p class="help-note">
            Für Chat-Mitteilungen öffne anschließend in der App Einstellungen → Mitteilungen auf
            diesem Gerät und tippe auf Mitteilungen aktivieren.
          </p>
          <footer class="dialog-footer">
            {#if onOpenHelp}<Button onClick={() => {
    setInstructions(false);
    onOpenHelp();
}}>
                Anleitung & Kurzvideos
              </Button>{/if}
            <Button variant="primary" onClick={() => setInstructions(false)}>
              Verstanden
            </Button>
          </footer>
        </Modal>{/if}
    {/if}
