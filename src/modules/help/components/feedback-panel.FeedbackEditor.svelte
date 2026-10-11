<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { dateLabel } = useTheaterTime();
  import { LinkedText } from "@/components/linked-text";
  import { ArrowUpRight, Bug, Lightbulb, Plus } from "@lucide/svelte";
  import type { DomainRecord } from "@/shared/contracts";
  import { value } from "@/shared/client-api";
  import { useWorkspace } from "@/components/workspace-context";
  import { Badge, Button, Empty, ErrorMessage, Modal } from "@/components/ui";
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
  import { feedbackStatuses, FeedbackPanel } from "./feedback-panel";
  const effects = createEffects();
  type ViewProps = {
    record?: DomainRecord;
    onClose: () => void;
  };
  export let record: ViewProps["record"] = undefined as any;
  export let onClose: ViewProps["onClose"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { save, busy } = $workspaceStore;
  $: ({ save, busy } = $workspaceStore);
  let type = value(record?.data || {}, "type") || "feature";
  const setType = (next: typeof type | ((current: typeof type) => typeof type)) => {
    type =
      typeof next === "function" ? (next as (current: typeof type) => typeof type)(type) : next;
  };
  let title = value(record?.data || {}, "title");
  const setTitle = (next: typeof title | ((current: typeof title) => typeof title)) => {
    title =
      typeof next === "function" ? (next as (current: typeof title) => typeof title)(title) : next;
  };
  let description = value(record?.data || {}, "description");
  const setDescription = (
    next: typeof description | ((current: typeof description) => typeof description),
  ) => {
    description =
      typeof next === "function"
        ? (next as (current: typeof description) => typeof description)(description)
        : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
</script>

<Modal title={record ? "Rückmeldung bearbeiten" : "Idee oder Fehler melden"} {onClose}>
  <form
    class="feedback-form"
    on:submit={async (event) => {
      event.preventDefault();
      setError("");
      try {
        await save(
          "feedback",
          { type, title: title.trim(), description: description.trim() },
          record,
        );
        onClose();
      } catch (exception) {
        setError(exception instanceof Error ? exception.message : "Senden fehlgeschlagen");
      }
    }}
  >
    <fieldset class="feedback-types">
      <legend>Art der Rückmeldung</legend>
      <div class="feedback-type-options">
        <label>
          <input
            type="radio"
            name="feedback-type"
            value="feature"
            checked={type === "feature"}
            on:input={() => setType("feature")}
          />
          <Lightbulb size={18}></Lightbulb>
          Idee / Wunsch
        </label>
        <label>
          <input
            type="radio"
            name="feedback-type"
            value="bug"
            checked={type === "bug"}
            on:input={() => setType("bug")}
          />
          <Bug size={18}></Bug>
          Fehler
        </label>
      </div>
    </fieldset>
    <label>
      Titel
      <input
        required
        maxLength={200}
        value={title}
        on:input={(event) => setTitle(event.currentTarget.value)}
        placeholder={type === "bug"
          ? "Was funktioniert nicht?"
          : "Was würde eure Arbeit erleichtern?"}
      />
    </label>
    <label>
      Beschreibung
      <textarea
        required
        maxLength={10000}
        rows={6}
        value={description}
        on:input={(event) => setDescription(event.currentTarget.value)}
        placeholder={type === "bug"
          ? "In welchem Bereich? Welche Schritte hast du ausgeführt? Was ist passiert und was hast du erwartet?"
          : "Beschreibe deinen Wunsch und wofür du ihn im Arbeitsalltag brauchst."}></textarea>
    </label>
    <p class="small muted">
      Deine Rückmeldung und ihr Bearbeitungsstatus sind für dich und den Superadmin einsehbar. Bitte
      trage hier keine Passwörter oder sensiblen Angaben zu Personen ein.
    </p>
    <ErrorMessage message={error}></ErrorMessage>
    <footer class="dialog-footer">
      <Button onClick={onClose}>Abbrechen</Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Wird gespeichert …" : record ? "Änderungen speichern" : "Rückmeldung senden"}
      </Button>
    </footer>
  </form>
</Modal>
