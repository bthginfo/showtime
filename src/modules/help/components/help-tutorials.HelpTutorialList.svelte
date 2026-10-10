<script lang="ts">
import { Download, LoaderCircle, Play, RotateCcw, Smartphone, VolumeX } from "@lucide/svelte";
import { Button, Empty, Modal } from "@/components/ui";
import type { HelpTutorial } from "../tutorials";
import styles from "./help-tutorials.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { duration, size, platform, HelpTutorialPlayer } from "./help-tutorials";
const effects=createEffects();
type ViewProps = {
    tutorials: HelpTutorial[];
    onOpen: (tutorial: HelpTutorial) => void;
    compact?: boolean;
};
export let tutorials: ViewProps["tutorials"] = undefined as any;
export let onOpen: ViewProps["onOpen"] = undefined as any;
export let compact: NonNullable<ViewProps["compact"]> = false;


</script>

{#if !tutorials.length}{#if compact}{:else}<Empty title="Kein passendes Kurzvideo gefunden." description="Versuche einen anderen Begriff. Unter Anleitungen findest du alle Schritte auch zum Lesen."></Empty>{/if}{:else}<section class={`${styles.library} ${compact ? styles.compact : ""}`} aria-label={compact ? "Passende Kurzvideos" : "Kurzvideos"}>
      <div class={styles.heading}>
        <div>
          <p class="eyebrow">KURZ GEZEIGT</p>
          <h2>{compact ? "Lieber kurz ansehen?" : "Ein paar Klicks. Ein klarer Ablauf."}</h2>
        </div>
        <span class={styles.silent}>
          <VolumeX size={15} aria-hidden="true"></VolumeX>
          Ohne Ton, mit Text
        </span>
      </div>
      {#if !compact}<p class={styles.intro}>
          Ausgewählte Anleitungen für häufige Handgriffe. Ein Video lädt erst beim Abspielen.
        </p>{/if}
      <div class={styles.list}>
        {#each tutorials as tutorial (tutorial.id)}<button type="button" class={styles.card} on:click={() => onOpen(tutorial)} aria-label={`Video öffnen: ${tutorial.title}`}>
            <span class={styles.preview} aria-hidden="true">


              <img src={tutorial.poster} alt="" width={180} height={320} loading="lazy" decoding="async" />
              <span class={styles.play}>
                <Play size={18} fill="currentColor" strokeWidth={1.5}></Play>
              </span>
            </span>
            <span class={styles.cardBody}>
              <span class={styles.platform}>
                <Smartphone size={13} aria-hidden="true"></Smartphone>
                {platform(tutorial)}
              </span>
              <span class={styles.cardTitle}>{tutorial.title}</span>
              <span class={styles.description}>{tutorial.description}</span>
              <span class={styles.metadata}>
                {duration(tutorial.durationSeconds)} <span aria-hidden="true">·</span>{" "}
                {size(tutorial.bytes)}
                {#if tutorial.schematic}<span>· Schematische Handy-Menüs</span>{/if}
              </span>
            </span>
            <span class={styles.openLabel} aria-hidden="true">
              Ansehen
            </span>
          </button>{/each}
      </div>
    </section>{/if}
