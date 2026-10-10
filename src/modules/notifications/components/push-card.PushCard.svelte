<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { Bell, BellRing, Check, Smartphone } from "@lucide/svelte";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, ErrorMessage, Section } from "@/components/ui";
import { disablePush, enablePush, getPushDeviceState, testPush, type PushDeviceState, } from "@/modules/notifications/client";
import styles from "./push-card.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    onOpenHelp?: () => void;
};
export let onOpenHelp: ViewProps["onOpenHelp"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace } = $workspaceStore;
$: ({ workspace } = $workspaceStore);
let userId = workspace.user.id;
let device: PushDeviceState | null = initialState<PushDeviceState | null>(null);
const setDevice = (next: PushDeviceState | null | ((current: PushDeviceState | null) => PushDeviceState | null)) => { device = typeof next === "function" ? (next as (current: PushDeviceState | null) => PushDeviceState | null)(device) : next; };
let pending: "enable" | "disable" | "test" | "reload" | null = initialState<"enable" | "disable" | "test" | "reload" | null>(null);
const setPending = (next: "enable" | "disable" | "test" | "reload" | null | ((current: "enable" | "disable" | "test" | "reload" | null) => "enable" | "disable" | "test" | "reload" | null)) => { pending = typeof next === "function" ? (next as (current: "enable" | "disable" | "test" | "reload" | null) => "enable" | "disable" | "test" | "reload" | null)(pending) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let notice: string = "";
const setNotice = (next: typeof notice | ((current: typeof notice) => typeof notice)) => { notice = typeof next === "function" ? (next as (current: typeof notice) => typeof notice)(notice) : next; };
$: effects.run(0, () => {
    let current = true;
    getPushDeviceState(userId)
        .then((state) => {
        if (current)
            setDevice(state);
    })
        .catch((exception: unknown) => {
        if (current)
            setError(exception instanceof Error
                ? exception.message
                : "Mitteilungen konnten nicht geladen werden.");
    });
    return () => {
        current = false;
    };
}, [userId]);
let run = async (operation: "enable" | "disable" | "test" | "reload") => {
    setPending(operation);
    setError("");
    setNotice("");
    try {
        // Call enablePush directly from the click gesture, before any awaited request.
        if (operation === "enable")
            await enablePush(userId);
        if (operation === "disable")
            await disablePush(userId);
        if (operation === "test")
            await testPush();
        setDevice(await getPushDeviceState(userId));
        setNotice(operation === "enable"
            ? "Mitteilungen sind auf diesem Gerät aktiviert."
            : operation === "disable"
                ? "Mitteilungen sind auf diesem Gerät deaktiviert."
                : operation === "test"
                    ? "Die Testmitteilung wurde gesendet. Prüfe die Mitteilungen auf deinem Gerät."
                    : "Der Gerätestatus wurde aktualisiert.");
    }
    catch (exception) {
        setError(exception instanceof Error
            ? exception.message
            : "Die Änderung konnte nicht gespeichert werden.");
        try {
            setDevice(await getPushDeviceState(userId));
        }
        catch {
            // Preserve the original error if the device status cannot be refreshed.
        }
    }
    finally {
        setPending(null);
    }
};
let blocked = device?.permission === "denied";
let canEnable = device?.supported && device.configured && !device.needsHomeScreen && !blocked;

$: userId = workspace.user.id;

$: blocked = device?.permission === "denied";
$: canEnable = device?.supported && device.configured && !device.needsHomeScreen && !blocked;

</script>

<Section title="Mitteilungen auf diesem Gerät">
      <div class="panel-content push-device-card" aria-busy={!!pending}>
        <div class="push-device-status">
          <span class={`push-device-icon${device?.active ? " is-active" : ""}`}>
            {#if device?.active}<BellRing size={23} aria-hidden="true"></BellRing>{:else}<Bell size={23} aria-hidden="true"></Bell>{/if}
          </span>
          <div>
            <strong>
              {device?.active ? "Du bleibst auf dem Laufenden" : "Auch unterwegs nichts verpassen"}
            </strong>
            <Badge tone={device?.active ? "green" : "neutral"}>
              {!device
    ? error
        ? "Status nicht verfügbar"
        : "Status wird geprüft …"
    : device.active
        ? "Aktiviert"
        : "Nicht aktiviert"}
            </Badge>
          </div>
        </div>
        <p class="muted">
          Erhalte Mitteilungen bei neuen Chatnachrichten, zugeteilten Aufgaben, Dienständerungen und
          Entscheidungen zu deinen Freiwünschen. Du entscheidest für jedes Gerät einzeln.
        </p>
        <p class="small muted">
          Ungelesene Mitteilungen können als Punkt oder Zahl am App-Symbol erscheinen. Aussehen und
          Anzeige hängen von deinem Handy und seinen Einstellungen ab.
        </p>
        {#if !device?.active}<div class={styles.setup}>
            <strong>Nach der Installation Mitteilungen einschalten</strong>
            <ol>
              <li>Öffne DigitalMask über das App-Symbol auf deinem Home-Bildschirm.</li>
              <li>
                Gehe in DigitalMask zu{" "}
                <strong>Einstellungen → Mitteilungen auf diesem Gerät</strong>.
              </li>
              <li>
                Tippe auf <strong>Mitteilungen aktivieren</strong> und bei der Nachfrage deines
                Handys auf <strong>Erlauben</strong> oder <strong>Zulassen</strong>.
              </li>
              <li>
                Tippe danach auf <strong>Testmitteilung</strong>, um den Empfang zu prüfen.
              </li>
            </ol>
            <p>
              Die Installation allein aktiviert noch keine Mitteilungen. Auf iPhone oder iPad
              brauchst du dafür iOS beziehungsweise iPadOS 16.4 oder neuer.
            </p>
          </div>{/if}
        {#if device?.needsHomeScreen}<div class="push-device-guidance">
            <Smartphone size={20} aria-hidden="true"></Smartphone>
            <p>
              <strong>Öffne DigitalMask als App.</strong>
              Auf dem iPhone oder iPad: Öffne DigitalMask in Safari, wähle „Teilen“ und „Zum
              Home-Bildschirm“. Öffne die App danach über ihr Symbol und folge den Schritten oben.
            </p>
          </div>{:else}{#if blocked}<div class="push-device-guidance">
            <Bell size={20} aria-hidden="true"></Bell>
            <p>
              <strong>Mitteilungen sind auf diesem Gerät blockiert.</strong>
              Erlaube Mitteilungen für DigitalMask in den Geräte- oder Browser-Einstellungen. Öffne
              diese Seite danach erneut oder prüfe den Status unten. Auf dem iPhone:{" "}
              <strong>Einstellungen → Mitteilungen → DigitalMask → Mitteilungen erlauben</strong>.
            </p>
          </div>{:else}{#if device && !device.supported}<p class="push-device-guidance">
            Dieser Browser unterstützt keine Handy-Mitteilungen für DigitalMask. Nutze einen
            aktuellen Browser oder öffne DigitalMask als App auf deinem Home-Bildschirm.
          </p>{:else}{#if device && !device.configured}<p class="push-device-guidance">
            Mitteilungen werden gerade eingerichtet. Du kannst sie hier aktivieren, sobald sie
            verfügbar sind.
          </p>{:else}{/if}{/if}{/if}{/if}
        <ErrorMessage message={error}></ErrorMessage>
        {#if notice}<p class="success-message" role="status">
            <Check size={16} aria-hidden="true"></Check>
            {notice}
          </p>{/if}
        <div class="push-device-actions">
          {#if device?.active}
              <Button onClick={() => void run("test")} disabled={!!pending}>
                <BellRing size={16} aria-hidden="true"></BellRing>
                {pending === "test" ? "Sendet …" : "Testmitteilung"}
              </Button>
              <Button variant="ghost" onClick={() => void run("disable")} disabled={!!pending}>
                {pending === "disable" ? "Deaktiviert …" : "Deaktivieren"}
              </Button>
            {:else}{#if canEnable}<Button variant="primary" onClick={() => void run("enable")} disabled={!!pending}>
              <Bell size={16} aria-hidden="true"></Bell>
              {pending === "enable" ? "Aktiviert …" : "Mitteilungen aktivieren"}
            </Button>{:else}<Button onClick={() => void run("reload")} disabled={!!pending || (!device && !error)}>
              {pending === "reload" ? "Prüft …" : "Status prüfen"}
            </Button>{/if}{/if}
        </div>
        <details class="push-device-help">
          <summary>Hinweise für mein Handy</summary>
          <p>
            Auf iPhone und iPad funktioniert dies mit der App auf dem Home-Bildschirm ab iOS oder
            iPadOS 16.4. Unter Android steuert das System den Punkt oder Zähler am App-Symbol. Prüfe
            bei ausbleibenden Mitteilungen auch den Fokusmodus und die Mitteilungseinstellungen
            deines Handys.
          </p>
        </details>
        {#if onOpenHelp}<button type="button" class="text-button" on:click={onOpenHelp}>
            Anleitung & Kurzvideo ansehen
          </button>{/if}
      </div>
    </Section>
