<script lang="ts">
  import { initialState } from "@/shared/svelte-runtime";

  import { Plus } from "@lucide/svelte";
  import type { DomainRecord, RecordData } from "@/shared/contracts";
  import { documentSections, lookTitle, type TextSection } from "@/shared/document-sections";
  import { categoriesFor } from "@/shared/domain-categories";
  import { ids, value } from "@/shared/client-api";
  import { useWorkspace } from "@/components/workspace-context";
  import { Button, ErrorMessage, Modal } from "@/components/ui";
  import { ResourceEditor } from "@/components/resource-editor";
  import { RepeatableList } from "@/components/repeatable-list";
  import { CategoryManager } from "@/modules/categories/components/category-manager";
  import { SectionFields } from "./section-fields";
  import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
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
    kind: "looks" | "handovers" | "templates";
    record?: DomainRecord;
    defaults?: RecordData;
    lockedProductionId?: string;
    onClose: () => void;
    onSaved?: (record: DomainRecord) => void;
  };
  export let kind: ViewProps["kind"] = undefined as any;
  export let record: ViewProps["record"] = undefined as any;
  export let defaults: NonNullable<ViewProps["defaults"]> = {};
  export let lockedProductionId: ViewProps["lockedProductionId"] = undefined as any;
  export let onClose: ViewProps["onClose"] = undefined as any;
  export let onSaved: ViewProps["onSaved"] = undefined as any;
  const workspaceStore = useWorkspace();
  let { workspace, save, busy } = $workspaceStore;
  $: ({ workspace, save, busy } = $workspaceStore);
  let initial = { ...defaults, ...record?.data };
  // Existing records keep their saved type when a different department opens them.
  let general =
    kind === "looks" &&
    (record ? initial.documentMode === "general" : workspace.currentModuleId !== "makeup");
  let scope: "looks" | "handovers" = kind === "handovers" ? "handovers" : "looks";
  let production = lockedProductionId ?? value(initial, "productionId");
  const setProduction = (
    next: typeof production | ((current: typeof production) => typeof production),
  ) => {
    production =
      typeof next === "function"
        ? (next as (current: typeof production) => typeof production)(production)
        : next;
  };
  let actorId = value(initial, "actorId");
  const setActorId = (next: typeof actorId | ((current: typeof actorId) => typeof actorId)) => {
    actorId =
      typeof next === "function"
        ? (next as (current: typeof actorId) => typeof actorId)(actorId)
        : next;
  };
  let actorName = value(initial, "actorName");
  const setActorName = (
    next: typeof actorName | ((current: typeof actorName) => typeof actorName),
  ) => {
    actorName =
      typeof next === "function"
        ? (next as (current: typeof actorName) => typeof actorName)(actorName)
        : next;
  };
  let characterId = value(initial, "characterId");
  const setCharacterId = (
    next: typeof characterId | ((current: typeof characterId) => typeof characterId),
  ) => {
    characterId =
      typeof next === "function"
        ? (next as (current: typeof characterId) => typeof characterId)(characterId)
        : next;
  };
  let characterName = value(initial, "characterName");
  const setCharacterName = (
    next: typeof characterName | ((current: typeof characterName) => typeof characterName),
  ) => {
    characterName =
      typeof next === "function"
        ? (next as (current: typeof characterName) => typeof characterName)(characterName)
        : next;
  };
  let actorFree = !!initial.actorName && !initial.actorId;
  const setActorFree = (
    next: typeof actorFree | ((current: typeof actorFree) => typeof actorFree),
  ) => {
    actorFree =
      typeof next === "function"
        ? (next as (current: typeof actorFree) => typeof actorFree)(actorFree)
        : next;
  };
  let characterFree = !!initial.characterName && !initial.characterId;
  const setCharacterFree = (
    next: typeof characterFree | ((current: typeof characterFree) => typeof characterFree),
  ) => {
    characterFree =
      typeof next === "function"
        ? (next as (current: typeof characterFree) => typeof characterFree)(characterFree)
        : next;
  };
  let title = value(initial, "title");
  const setTitle = (next: typeof title | ((current: typeof title) => typeof title)) => {
    title =
      typeof next === "function" ? (next as (current: typeof title) => typeof title)(title) : next;
  };
  let templateId = value(initial, "templateId");
  const setTemplateId = (
    next: typeof templateId | ((current: typeof templateId) => typeof templateId),
  ) => {
    templateId =
      typeof next === "function"
        ? (next as (current: typeof templateId) => typeof templateId)(templateId)
        : next;
  };
  let duration =
    initial.productionDurationMinutes == null ? "" : String(initial.productionDurationMinutes);
  const setDuration = (next: typeof duration | ((current: typeof duration) => typeof duration)) => {
    duration =
      typeof next === "function"
        ? (next as (current: typeof duration) => typeof duration)(duration)
        : next;
  };
  let version = numberDraft(initial.version, 1);
  const setVersion = (next: typeof version | ((current: typeof version) => typeof version)) => {
    version =
      typeof next === "function"
        ? (next as (current: typeof version) => typeof version)(version)
        : next;
  };
  let checklist: {
    text: string;
    done: boolean;
  }[] = Array.isArray(initial.checklist)
    ? (initial.checklist as {
        text: string;
        done: boolean;
      }[])
    : [];
  const setChecklist = (
    next:
      | {
          text: string;
          done: boolean;
        }[]
      | ((
          current: {
            text: string;
            done: boolean;
          }[],
        ) => {
          text: string;
          done: boolean;
        }[]),
  ) => {
    checklist =
      typeof next === "function"
        ? (
            next as (
              current: {
                text: string;
                done: boolean;
              }[],
            ) => {
              text: string;
              done: boolean;
            }[]
          )(checklist)
        : next;
  };
  let creating: "actors" | "characters" | null = initialState<"actors" | "characters" | null>(null);
  const setCreating = (
    next:
      | "actors"
      | "characters"
      | null
      | ((current: "actors" | "characters" | null) => "actors" | "characters" | null),
  ) => {
    creating =
      typeof next === "function"
        ? (next as (current: "actors" | "characters" | null) => "actors" | "characters" | null)(
            creating,
          )
        : next;
  };
  let categoriesOpen: boolean = false;
  const setCategoriesOpen = (
    next: typeof categoriesOpen | ((current: typeof categoriesOpen) => typeof categoriesOpen),
  ) => {
    categoriesOpen =
      typeof next === "function"
        ? (next as (current: typeof categoriesOpen) => typeof categoriesOpen)(categoriesOpen)
        : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let sections: TextSection[] = initialState<TextSection[]>(
    (() => {
      if (general) {
        const saved = documentSections(initial, "looks").filter(
          (section) =>
            section.key === "notes" ||
            section.entries.some((entry) => entry.text.trim() || entry.label?.trim()),
        );
        return saved.length
          ? saved
          : [{ key: "notes", entries: [{ id: crypto.randomUUID(), text: "" }] }];
      }
      const old = documentSections(initial, scope);
      const choices = categoriesFor(scope, workspace.records.categories);
      const next = choices.map((category) => ({
        key: category.key,
        entries: old.find((section) => section.key === category.key)?.entries || [
          { id: crypto.randomUUID(), text: "" },
        ],
      }));
      for (const section of old)
        if (!next.some((row) => row.key === section.key) && section.entries.length)
          next.push(section);
      if (kind === "templates" && !initial.sections && ids(initial, "fields").length) {
        const custom = ids(initial, "fields").filter(
          (field) =>
            !choices.some((category) => category.name.toLowerCase() === field.toLowerCase()),
        );
        if (custom.length) {
          let target = next.find((section) => section.key === "setup");
          if (!target) {
            target = { key: choices.at(-1)?.key || "setup", entries: [] };
            next.push(target);
          }
          target.entries.push(
            ...custom.map((label) => ({ id: crypto.randomUUID(), text: "", label })),
          );
        }
      }
      return next;
    })(),
  );
  const setSections = (next: TextSection[] | ((current: TextSection[]) => TextSection[])) => {
    sections =
      typeof next === "function"
        ? (next as (current: TextSection[]) => TextSection[])(sections)
        : next;
  };
  let selectedProduction = workspace.records.productions.find((row) => row.id === production);
  let changeTemplate = (id: string) => {
    setTemplateId(id);
    const template = workspace.records.templates.find((row) => row.id === id);
    if (!template) return;
    const incoming = documentSections(template.data, "looks");
    if (!template.data.sections) {
      const choices = categoriesFor("looks", workspace.records.categories);
      const custom = ids(template.data, "fields").filter(
        (field) => !choices.some((category) => category.name.toLowerCase() === field.toLowerCase()),
      );
      if (custom.length) {
        let target = incoming.find((section) => section.key === "setup");
        if (!target) {
          target = { key: "setup", entries: [] };
          incoming.push(target);
        }
        target.entries.push(
          ...custom.map((label) => ({ id: crypto.randomUUID(), label, text: "" })),
        );
      }
    }
    setSections((current) => {
      const next = current.map((section) => ({ ...section, entries: [...section.entries] }));
      for (const section of incoming) {
        let target = next.find((row) => row.key === section.key);
        if (!target) {
          target = { key: section.key, entries: [] };
          next.push(target);
        }
        for (const entry of section.entries) {
          if (
            !target.entries.some(
              (row) => (row.label || "") === (entry.label || "") && row.text === entry.text,
            )
          )
            target.entries.push({ ...entry, id: crypto.randomUUID() });
        }
      }
      return next;
    });
  };

  $: initial = { ...defaults, ...record?.data };
  $: scope = kind === "handovers" ? "handovers" : "looks";
  $: selectedProduction = workspace.records.productions.find((row) => row.id === production);
</script>

<Modal
  title={`${kind === "templates" ? "Vorlage" : kind === "handovers" ? "Dienstübergabe" : general ? "Dokumentation" : "Aufschrieb"} ${record ? "bearbeiten" : "anlegen"}`}
  {onClose}
  wide
>
  <form
    class="document-editor"
    on:submit={async (event) => {
      event.preventDefault();
      setError("");
      try {
        if (kind === "looks" && !general && !(actorFree ? actorName.trim() : actorId))
          throw new Error("Bitte eine Schauspielperson auswählen oder ihren Namen eintragen.");
        const data: RecordData =
          kind === "looks"
            ? {
                documentMode: general ? "general" : "look",
                title: general ? title.trim() : "",
                productionId: production,
                actorId: actorFree ? "" : actorId,
                actorName: actorFree ? actorName.trim() : "",
                characterId: characterFree ? "" : characterId,
                characterName: characterFree ? characterName.trim() : "",
                templateId,
                templateVersion: Number(
                  workspace.records.templates.find((row) => row.id === templateId)?.data.version ||
                    1,
                ),
                sections,
                productionDurationMinutes:
                  parseNumberDraft(duration, { label: "Stückdauer", min: 0, max: 10000 }) ?? null,
                imageIds: ids(initial, "imageIds"),
              }
            : kind === "templates"
              ? {
                  title,
                  version: parseNumberDraft(version, {
                    label: "Vorlagenversion",
                    required: true,
                    min: 1,
                    integer: true,
                  }),
                  sections,
                  fields: ids(initial, "fields"),
                }
              : {
                  title,
                  productionId: "",
                  sections,
                  checklist: checklist.filter((item) => item.text.trim()),
                  imageIds: ids(initial, "imageIds"),
                };
        if (kind === "looks") data.title = lookTitle(data, workspace.records.actors);
        const saved = await save(kind, data, record);
        onSaved?.(saved);
        onClose();
      } catch (exception) {
        setError(exception instanceof Error ? exception.message : "Speichern fehlgeschlagen");
      }
    }}
  >
    {#if kind !== "looks" || general}<label>
        {kind === "templates" ? "Vorlagenname" : general ? "Titel" : "Übergabetitel"}
        <input
          required
          maxLength={200}
          value={title}
          on:input={(event) => setTitle(event.currentTarget.value)}
        />
      </label>{/if}
    {#if kind === "looks"}
      <div class="document-public-note">
        {general
          ? "Dokumentationen sind für das freigegebene Team sichtbar. Nutze einen Titel, der den Inhalt kurz beschreibt."
          : "Aufschriebe sind für das freigegebene Team sichtbar. Ihr Titel ist der Name der Schauspielperson."}
      </div>
      <div class="form-grid">
        <label>
          Produktion
          <select
            disabled={lockedProductionId !== undefined || (!!record && !!initial.productionId)}
            value={production}
            on:change={(event) => {
              setProduction(event.currentTarget.value);
              setCharacterId("");
            }}
          >
            <option value="">{general ? "Ohne Produktion" : "Allgemeiner Aufschrieb"}</option>
            {#each workspace.records.productions as row (row.id)}<option value={row.id}>
                {value(row.data, "title")}
                {row.data.status === "archived" ? " · Archiv" : ""}
              </option>{/each}
          </select>
        </label>
        <label>
          Vorlage (optional)
          <select
            value={templateId}
            on:change={(event) => changeTemplate(event.currentTarget.value)}
          >
            <option value="">Ohne Vorlage</option>
            {#each workspace.records.templates as row (row.id)}<option value={row.id}>
                {value(row.data, "title")}
              </option>{/each}
          </select>
        </label>
      </div>
      <details class="form-disclosure" open={!general}>
        <summary>{general ? "Person, Figur und Stückdauer (optional)" : "Person und Figur"}</summary
        >
        <div class="form-grid">
          {#each ["actor", "character"] as const as key (key)}{@const actor =
              key === "actor"}{@const free = actor ? actorFree : characterFree}{@const label = actor
              ? "Schauspielperson"
              : "Figur"}{@const rows = actor
              ? workspace.records.actors
              : workspace.records.characters.filter(
                  (row) => value(row.data, "productionId") === production,
                )}
            <fieldset class="casting-choice">
              <legend>
                {label}
                {!actor || general ? " (optional)" : ""}
              </legend>
              <label class="check-label">
                <input
                  type="checkbox"
                  checked={free}
                  on:input={(event) =>
                    (actor ? setActorFree : setCharacterFree)(event.currentTarget.checked)}
                />
                Namen frei eintragen
              </label>
              {#if free}<label>
                  {label} · Name
                  <input
                    required={actor && !general}
                    maxLength={200}
                    value={actor ? actorName : characterName}
                    on:input={(event) =>
                      (actor ? setActorName : setCharacterName)(event.currentTarget.value)}
                  />
                </label>{:else}
                <label>
                  {label} auswählen
                  <select
                    required={actor && !general}
                    value={actor ? actorId : characterId}
                    on:change={(event) =>
                      (actor ? setActorId : setCharacterId)(event.currentTarget.value)}
                  >
                    <option value=""
                      >{actor
                        ? general
                          ? "Keine Person"
                          : "Bitte auswählen"
                        : "Keine Figur"}</option
                    >
                    {#each rows as row (row.id)}<option value={row.id}>
                        {value(row.data, "name")}
                      </option>{/each}
                  </select>
                </label>
                <Button
                  disabled={!actor && !production}
                  onClick={() => setCreating(actor ? "actors" : "characters")}
                >
                  <Plus size={15}></Plus>
                  {label} direkt anlegen
                </Button>
              {/if}
            </fieldset>{/each}
        </div>
        <label>
          Stückdauer (Minuten, optional abweichend)
          <input
            type="number"
            step="any"
            min={0}
            max={10000}
            value={duration}
            placeholder={selectedProduction?.data.durationMinutes
              ? String(selectedProduction.data.durationMinutes)
              : "Dauer der Produktion übernehmen"}
            on:input={(event) => setDuration(event.currentTarget.value)}
          />
        </label>
      </details>
    {/if}
    {#if kind === "templates"}<label>
        Vorlagenversion
        <input
          type="number"
          required
          min={1}
          value={version}
          on:input={(event) => setVersion(event.currentTarget.value)}
        />
      </label>{/if}
    <div class="document-section-heading">
      <h3>{kind === "templates" ? "Textfelder der Vorlage" : "Inhalte"}</h3>
      {#if workspace.user.role !== "user"}<Button onClick={() => setCategoriesOpen(true)}
          >Abschnitte verwalten</Button
        >{/if}
    </div>
    <SectionFields kind={scope} {sections} onChange={setSections} {general}></SectionFields>
    {#if kind === "handovers"}<RepeatableList
        label="Checkliste"
        checklist
        items={checklist}
        onChange={(items) =>
          setChecklist(items.map((item) => ({ text: item.text, done: item.done === true })))}
      ></RepeatableList>{/if}
    {#if record && !!(initial.scene || initial.durationMinutes || initial.legacyProductionId)}<p
        class="help-note"
      >
        Historische Angaben bleiben gespeichert: {value(initial, "scene")}{" "}
        {initial.durationMinutes ? `· früherer Zeitbedarf ${initial.durationMinutes} Minuten` : ""}
        {initial.legacyProductionId ? " · frühere Produktionszuordnung" : ""}.
      </p>{/if}
    <p class="small muted">
      Weitere Bilder lassen sich nach dem Speichern in der Galerie hinzufügen.
    </p>
    <ErrorMessage message={error}></ErrorMessage>
    <footer class="dialog-footer">
      <Button onClick={onClose}>Abbrechen</Button>
      <Button type="submit" variant="primary" disabled={busy}>Speichern</Button>
    </footer>
  </form>
</Modal>
{#if categoriesOpen}<CategoryManager {scope} onClose={() => setCategoriesOpen(false)}
  ></CategoryManager>{/if}{" "}
{#if creating}<ResourceEditor
    kind={creating}
    defaults={creating === "characters" ? { productionId: production } : {}}
    lockedProductionId={creating === "characters" ? production : undefined}
    onClose={() => setCreating(null)}
    onSaved={(saved) => {
      if (creating === "actors") {
        setActorId(saved.id);
        setActorFree(false);
      } else {
        setCharacterId(saved.id);
        setCharacterFree(false);
      }
      setCreating(null);
    }}
  ></ResourceEditor>{/if}
