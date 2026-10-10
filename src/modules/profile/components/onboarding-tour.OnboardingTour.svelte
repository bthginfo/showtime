<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Clock3, Layers3, MessageSquare, Theater, } from "@lucide/svelte";
import { onboardingVersion, type AccentPalette } from "@/shared/contracts";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { BrandMark } from "@/components/brand-mark";
import { AccentPicker, useAccentPreview } from "./accent-picker";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { steps } from "./onboarding-tour";
const effects=createEffects();
type ViewProps = {
    navigate: (module: string) => void;
    onDone: () => void;
};
export let navigate: ViewProps["navigate"] = undefined as any;
export let onDone: ViewProps["onDone"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, action, busy } = $workspaceStore;
$: ({ workspace, action, busy } = $workspaceStore);
let step: number = 0;
const setStep = (next: typeof step | ((current: typeof step) => typeof step)) => { step = typeof next === "function" ? (next as (current: typeof step) => typeof step)(step) : next; };
let palette: AccentPalette = initialState<AccentPalette>(workspace.user.preferences?.accentPalette || "green");
const setPalette = (next: AccentPalette | ((current: AccentPalette) => AccentPalette)) => { palette = typeof next === "function" ? (next as (current: AccentPalette) => AccentPalette)(palette) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let heading = {current: null as HTMLHeadingElement | null};
let last = step === steps.length;
let current: any = steps[Math.min(step, steps.length - 1)];
let Icon = current.icon;
$: effects.run(0, ()=>useAccentPreview(palette), [palette]);
$: effects.run(1, () => {
    navigate(step === steps.length ? "today" : steps[step].module);
    heading.current?.closest("dialog")?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
    const main = document.querySelector<HTMLElement>(".main-content");
    main?.setAttribute("data-tour-area", last ? "today" : current.module);
    window.scrollTo({ top: 0, behavior: "instant" });
    let stopped = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (stopped || !matchMedia("(max-width:760px)").matches || last)
            return;
        const targets: Record<string, string> = {
            productions: ".production-card",
            tasks: ".kanban",
            calendar: ".calendar-board",
            time: ".dual-timers",
            chat: ".chat-layout",
            documentation: ".document-folder",
        };
        const target = targets[current.module]
            ? document.querySelector<HTMLElement>(targets[current.module])
            : null;
        if (target) {
            target.setAttribute("data-tour-example", "true");
            const y = target.getBoundingClientRect().top;
            if (y > 150)
                window.scrollTo({ top: Math.max(0, window.scrollY + y - 110), behavior: "instant" });
        }
    }));
    return () => {
        stopped = true;
        main?.removeAttribute("data-tour-area");
        document
            .querySelectorAll("[data-tour-example]")
            .forEach((node) => node.removeAttribute("data-tour-example"));
    };
}, [step, navigate, current.module, last]);
let finish = async (saveColor: boolean) => {
    setError("");
    try {
        await action("profile-update", undefined, {
            onboardingCompleted: true,
            ...(saveColor ? { accentPalette: palette } : {}),
        });
        onDone();
    }
    catch (exception) {
        setError(exception instanceof Error
            ? exception.message
            : "Deine Einstellungen konnten nicht gespeichert werden.");
    }
};

$: last = step === steps.length;
$: current = steps[Math.min(step, steps.length - 1)];
$: Icon = current.icon;


</script>

<Modal title="Dein Einstieg in Showtime" onClose={() => {
    if (!busy)
        void finish(false);
}} className={`onboarding-dialog ${last ? "onboarding-colors" : ""}`}>
      <div class="onboarding-body" data-onboarding-version={onboardingVersion}>
        <div class="onboarding-progress" aria-label={`Schritt ${step + 1} von ${steps.length + 1}`}>
          <span class="small muted" role="status">
            Schritt {step + 1} von {steps.length + 1}
          </span>
          <div aria-hidden="true">
            {#each Array.from({ length: steps.length + 1 }) as _, index (index)}<span class={index <= step ? "filled" : ""}></span>{/each}
          </div>
        </div>
        <div class="onboarding-symbol" aria-hidden="true">
          {#if last}<BrandMark></BrandMark>{:else}<svelte:component this={Icon} size={28} strokeWidth={1.6}></svelte:component>{/if}
        </div>
        <h3 bind:this={heading.current} tabindex="-1">
          {last ? "Mach es zu deinem Arbeitsraum." : current.title}
        </h3>
        {#if last}
            <p class="muted">
              Wähle deine persönliche Akzentfarbe. Du kannst sie später im Profil ändern.
            </p>
            <AccentPicker value={palette} onChange={setPalette}></AccentPicker>
          {:else}
            <p class="onboarding-copy">{current.text}</p>
            <ul class="onboarding-tips onboarding-desktop-tips">
              {#each current.tips as tip (tip)}<li>
                  <Check size={16}></Check>
                  {tip}
                </li>{/each}
            </ul>
            <details class="onboarding-mobile-tips">
              <summary>Mehr Hinweise</summary>
              <ul class="onboarding-tips">
                {#each current.tips as tip (tip)}<li>
                    <Check size={16}></Check>
                    {tip}
                  </li>{/each}
              </ul>
            </details>
          {/if}
        <ErrorMessage message={error}></ErrorMessage>
      </div>
      <footer class="dialog-footer onboarding-footer">
        <div class="onboarding-secondary">
          <Button variant="ghost" disabled={busy} onClick={() => void finish(false)}>
            Einführung überspringen
          </Button>
          {#if step > 0}<Button disabled={busy} onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16}></ArrowLeft>
              Zurück
            </Button>{/if}
        </div>
        <Button variant="primary" disabled={busy} onClick={() => (last ? void finish(true) : setStep(step + 1))}>
          {busy ? "Wird gespeichert …" : last ? "Farbe speichern & loslegen" : "Weiter"}
          <ArrowRight size={16}></ArrowRight>
        </Button>
      </footer>
    </Modal>
