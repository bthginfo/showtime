<script lang="ts">
import { Download, LoaderCircle, Play, RotateCcw, Smartphone, VolumeX } from "@lucide/svelte";
import { Button, Empty, Modal } from "@/components/ui";
import type { HelpTutorial } from "../tutorials";
import styles from "./help-tutorials.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { duration, size, platform, HelpTutorialList } from "./help-tutorials";
const effects=createEffects();
type ViewProps = {
    tutorial: HelpTutorial;
    onClose: () => void;
};
export let tutorial: ViewProps["tutorial"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
let failed: boolean = false;
const setFailed = (next: typeof failed | ((current: typeof failed) => typeof failed)) => { failed = typeof next === "function" ? (next as (current: typeof failed) => typeof failed)(failed) : next; };
let buffering: boolean = false;
const setBuffering = (next: typeof buffering | ((current: typeof buffering) => typeof buffering)) => { buffering = typeof next === "function" ? (next as (current: typeof buffering) => typeof buffering)(buffering) : next; };
let attempt: number = 0;
const setAttempt = (next: typeof attempt | ((current: typeof attempt) => typeof attempt)) => { attempt = typeof next === "function" ? (next as (current: typeof attempt) => typeof attempt)(attempt) : next; };
let videoRef = {current: null as HTMLVideoElement | null};
$: effects.run(0, () => {
    const video = videoRef.current;
    return () => video?.pause();
}, [attempt]);
let handleError = () => {
    setFailed(true);
    setBuffering(false);
};



</script>

<Modal title={tutorial.title} onClose={onClose} className={styles.dialog} wide>
      <div class={styles.playerBody}>
        <div class={styles.playerMetadata}>
          <span>{platform(tutorial)}</span>
          <span>{duration(tutorial.durationSeconds)}</span>
          <span>{size(tutorial.bytes)}</span>
          <span class={styles.silent}>
            <VolumeX size={14} aria-hidden="true"></VolumeX> Ohne Ton, mit Text
          </span>
        </div>
        <p class={styles.playerDescription}>{tutorial.description}</p>
        {#if tutorial.schematic}<p class={styles.schematic}>
            Schematische Handy-Menüs: Namen und Positionen können je nach Gerät und Version etwas
            abweichen.
          </p>{/if}
        <div class={styles.playerLayout}>
          <div class={styles.mediaColumn}>
            <div class={styles.screen}>
              <video bind:this={videoRef.current} aria-label={tutorial.title} controls playsInline preload="none" poster={tutorial.poster} on:error={handleError} on:waiting={() => setBuffering(true)} on:playing={() => setBuffering(false)} on:canplay={() => setBuffering(false)}>
                <source src={tutorial.video} type="video/mp4" on:error={handleError} />
                <track kind="captions" src={tutorial.captions} srcLang="de" label="Deutsch" />
                Dein Browser kann dieses Video nicht abspielen. Du kannst es unten herunterladen.
              </video>
              {#if buffering && !failed}<span class={styles.loading} role="status">
                  <LoaderCircle size={17} className={styles.spinner} aria-hidden="true"></LoaderCircle>
                  Video lädt …
                </span>{/if}
            </div>
            {#if failed}<div class={styles.error} role="alert">
                <p>
                  Das Video konnte nicht abgespielt werden. Versuche es erneut oder lade die Datei
                  herunter.
                </p>
                <Button onClick={() => {
    setFailed(false);
    setBuffering(false);
    setAttempt((value) => value + 1);
}}>
                  <RotateCcw size={15}></RotateCcw> Erneut laden
                </Button>
              </div>{/if}
            <a href={tutorial.video} download class={styles.download}>
              <Download size={16} aria-hidden="true"></Download>
              MP4 herunterladen <span>({size(tutorial.bytes)})</span>
            </a>
          </div>
          <section class={styles.instructions} aria-label="Schritte zum Nachlesen">
            <h3>Schritte zum Nachlesen</h3>
            <p>Die Anleitung funktioniert auch ohne Video.</p>
            <ol>
              {#each tutorial.steps as step, index (`${tutorial.id}-${index}`)}<li>
                  <span aria-hidden="true" class={styles.stepNumber}>
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>{/each}
            </ol>
          </section>
        </div>
      </div>
    </Modal>
