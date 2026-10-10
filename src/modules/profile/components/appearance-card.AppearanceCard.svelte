<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import type { AccentPalette } from "@/shared/contracts";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Section } from "@/components/ui";
import { ThemeSwitch } from "@/components/theme-switch";
import { AccentPicker, useAccentPreview } from "./accent-picker";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
const workspaceStore=useWorkspace();
let { workspace, action, busy } = $workspaceStore;
$: ({ workspace, action, busy } = $workspaceStore);
let saved = workspace.user.preferences?.accentPalette || "green";
let palette: AccentPalette = initialState<AccentPalette>(saved);
const setPalette = (next: AccentPalette | ((current: AccentPalette) => AccentPalette)) => { palette = typeof next === "function" ? (next as (current: AccentPalette) => AccentPalette)(palette) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let notice: string = "";
const setNotice = (next: typeof notice | ((current: typeof notice) => typeof notice)) => { notice = typeof next === "function" ? (next as (current: typeof notice) => typeof notice)(notice) : next; };
$: effects.run(0, ()=>useAccentPreview(palette), [palette]);

$: saved = workspace.user.preferences?.accentPalette || "green";

</script>

<Section title="Deine Darstellung">
      <form class="panel-content appearance-form" on:submit={async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
        await action("profile-update", undefined, { accentPalette: palette });
        setNotice("Deine Akzentfarbe ist in deinem Profil gespeichert.");
    }
    catch (exception) {
        setError(exception instanceof Error ? exception.message : "Speichern fehlgeschlagen");
    }
}}>
        <p class="muted">Hell, dunkel oder passend zu deinem Gerät.</p>
        <ThemeSwitch full></ThemeSwitch>
        <AccentPicker value={palette} onChange={(value) => {
    setPalette(value);
    setNotice("");
}}></AccentPicker>
        <div class="appearance-preview">
          <span class="eyebrow">VORSCHAU</span>
          <strong>Alles bereit für deinen Tag.</strong>
          <p class="small muted">
            Die Auswahl färbt Navigation und Bedienelemente. Sie wird erst beim Speichern
            übernommen.
          </p>
        </div>
        <ErrorMessage message={error}></ErrorMessage>
        {#if notice}<p class="success-message" role="status">
            {notice}
          </p>{/if}
        <div class="appearance-actions">
          <Button type="submit" variant="primary" disabled={busy}>
            Farbe speichern
          </Button>
          {#if palette !== saved}<Button onClick={() => {
    setPalette(saved);
    setNotice("");
}}>
              Vorschau verwerfen
            </Button>{/if}
        </div>
      </form>
    </Section>
