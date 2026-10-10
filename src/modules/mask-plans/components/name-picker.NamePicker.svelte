<script lang="ts">
import { Plus, X } from "@lucide/svelte";
import { Button } from "@/components/ui";
import styles from "./mask-plans.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    legend: string;
    options: {
        id: string;
        name: string;
        historical?: boolean;
    }[];
    selected: string[];
    names: string[];
    onSelected: (ids: string[]) => void;
    onNames: (names: string[]) => void;
    suggestions?: string[];
};
export let legend: ViewProps["legend"] = undefined as any;
export let options: ViewProps["options"] = undefined as any;
export let selected: ViewProps["selected"] = undefined as any;
export let names: ViewProps["names"] = undefined as any;
export let onSelected: ViewProps["onSelected"] = undefined as any;
export let onNames: ViewProps["onNames"] = undefined as any;
export let suggestions: NonNullable<ViewProps["suggestions"]> = [];
const id = createId();
let name: string = "";
const setName = (next: typeof name | ((current: typeof name) => typeof name)) => { name = typeof next === "function" ? (next as (current: typeof name) => typeof name)(name) : next; };
let message: string = "";
const setMessage = (next: typeof message | ((current: typeof message) => typeof message)) => { message = typeof next === "function" ? (next as (current: typeof message) => typeof message)(message) : next; };
let add = () => {
    const next = name.trim();
    if (!next)
        return;
    if (names.some((item) => item.toLocaleLowerCase("de") === next.toLocaleLowerCase("de"))) {
        setMessage("Dieser Name ist schon eingetragen.");
        return;
    }
    onNames([...names, next]);
    setName("");
    setMessage("");
};



</script>

<fieldset class={styles.picker}>
      <legend>{legend}</legend>
      {#if options.length}<div class={styles.choices}>
          {#each options as option (option.id)}<label class={styles.choice}>
              <input type="checkbox" checked={selected.includes(option.id)} disabled={option.historical && !selected.includes(option.id)} on:input={(event) => onSelected(event.currentTarget.checked
    ? [...selected, option.id]
    : selected.filter((item) => item !== option.id))} />
              <span>
                {option.name}
                {#if option.historical}<small>Frühere Zuordnung · entfernen möglich</small>{/if}
              </span>
            </label>{/each}
        </div>{:else}<p class={styles.hint}>
          Noch keine Personen zur Auswahl. Du kannst Namen frei eintragen.
        </p>{/if}
      {#if names.length > 0}<ul class={styles.names} aria-label="Frei eingetragene Namen">
          {#each names as item, index (`${index}:${item}`)}<li>
              <span>{item}</span>
              <button type="button" class="icon-button" aria-label={`${item} entfernen`} on:click={() => onNames(names.filter((_, position) => position !== index))}>
                <X size={16}></X>
              </button>
            </li>{/each}
        </ul>{/if}
      <div class={styles.addName}>
        <label for={id}>
          Weiteren Namen frei eintragen
          <input id={id} value={name} maxLength={200} list={suggestions.length ? `${id}-suggestions` : undefined} on:input={(event) => {
    setName(event.currentTarget.value);
    setMessage("");
}} on:keydown={(event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        add();
    }
}} />
        </label>
        <Button onClick={add} disabled={!name.trim()} title="Namen hinzufügen">
          <Plus size={16}></Plus>
          Hinzufügen
        </Button>
      </div>
      {#if suggestions.length > 0}<datalist id={`${id}-suggestions`}>
          {#each suggestions as item (item)}<option value={item}></option>{/each}
        </datalist>{/if}
      <p class={styles.hint} role="status">
        {message}
      </p>
    </fieldset>
