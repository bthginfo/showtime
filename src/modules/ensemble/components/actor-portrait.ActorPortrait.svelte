<script lang="ts">
  import type { DomainRecord } from "@/shared/contracts";
  import { portraitFocus, portraitLayout } from "../portrait-layout";
  import styles from "./actor-portrait.module.css";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  const effects = createEffects();
  type ViewProps = {
    file: DomainRecord;
    className?: string;
    alt?: string;
  };
  export let file: ViewProps["file"] = undefined as any;
  export let className: NonNullable<ViewProps["className"]> = "";
  export let alt: NonNullable<ViewProps["alt"]> = "";
  let container = { current: null as HTMLDivElement | null };
  let frame = { width: 0, height: 0 };
  let unavailable = false;
  const setFrame = (next: typeof frame | ((current: typeof frame) => typeof frame)) => {
    frame =
      typeof next === "function" ? (next as (current: typeof frame) => typeof frame)(frame) : next;
  };
  let image = {
    width: Number(file.data.width) || 0,
    height: Number(file.data.height) || 0,
  };
  const setImage = (next: typeof image | ((current: typeof image) => typeof image)) => {
    image =
      typeof next === "function" ? (next as (current: typeof image) => typeof image)(image) : next;
  };
  $: effects.run(
    0,
    () => {
      const element = container.current;
      if (!element) return;
      const measure = () => {
        const bounds = element.getBoundingClientRect();
        setFrame({ width: bounds.width, height: bounds.height });
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    },
    [],
  );
  let layout = portraitLayout(image, frame, portraitFocus(file.data.portraitFocus));

  $: layout = portraitLayout(image, frame, portraitFocus(file.data.portraitFocus));
</script>

<div bind:this={container.current} class={`${styles.frame} ${className}`}>
  {#if unavailable}<span class="portrait-unavailable">Foto nicht verfügbar</span>{:else}<img
      width={image.width || 1800}
      height={image.height || 1800}
      src={`/api/files/${file.id}`}
      {alt}
      loading="lazy"
      class={styles.image}
      style={styleString(
        layout
          ? { width: layout.width, height: layout.height, left: layout.left, top: layout.top }
          : undefined,
      )}
      on:error={() => (unavailable = true)}
      on:load={(event) =>
        setImage({
          width: (event.currentTarget as HTMLImageElement).naturalWidth,
          height: (event.currentTarget as HTMLImageElement).naturalHeight,
        })}
    />{/if}
</div>

<style>
  .portrait-unavailable {
    display: grid;
    place-items: center;
    text-align: center;
    height: 100%;
    min-height: 3rem;
    padding: 0.75rem;
    color: var(--muted);
    font-size: 0.8rem;
    line-height: 1.4;
  }
</style>
