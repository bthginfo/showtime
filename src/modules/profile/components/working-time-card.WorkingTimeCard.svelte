<script lang="ts">
  import { useTheaterTime } from "@/components/theater-time";
  const { localDate, weekStart, dateLabel } = useTheaterTime();
  import { memberCan } from "@/shared/access-policy";
  import { Check, Clock3, Trash2 } from "@lucide/svelte";
  import type { Member } from "@/shared/contracts";
  import { hours } from "@/shared/client-api";
  import { isStaff } from "@/shared/client-members";
  import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
  import {
    currentWorkingSchedule,
    defaultWorkingDays,
    workingDayLabels,
    type WorkingTimeSchedule,
  } from "@/shared/working-time";
  import { useWorkspace } from "@/components/workspace-context";
  import { Button, ErrorMessage, Modal, Section } from "@/components/ui";
  import { signedHours } from "@/modules/time-tracking/balance";
  import styles from "./working-time-card.module.css";
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
  import { WorkingTimeForm } from "./working-time-card";
  const effects = createEffects();
  const workspaceStore = useWorkspace();
  let { workspace, busy } = $workspaceStore;
  $: ({ workspace, busy } = $workspaceStore);
  let admin =
    memberCan(workspace.user, "personnel.manage") || memberCan(workspace.user, "time.team.manage");
  let person = isStaff(workspace.user)
    ? workspace.user.id
    : workspace.members.find(isStaff)?.id || "";
  const setPerson = (next: typeof person | ((current: typeof person) => typeof person)) => {
    person =
      typeof next === "function"
        ? (next as (current: typeof person) => typeof person)(person)
        : next;
  };
  let notice: string = "";
  const setNotice = (next: typeof notice | ((current: typeof notice) => typeof notice)) => {
    notice =
      typeof next === "function"
        ? (next as (current: typeof notice) => typeof notice)(notice)
        : next;
  };
  let member =
    person === workspace.user.id
      ? workspace.user
      : workspace.members.find((row) => row.id === person);

  $: admin =
    memberCan(workspace.user, "personnel.manage") || memberCan(workspace.user, "time.team.manage");
  $: member =
    person === workspace.user.id
      ? workspace.user
      : workspace.members.find((row) => row.id === person);
</script>

<Section title={admin ? "Wochenstunden & Zeitkonten" : "Deine Wochenstunden & Zeitkonto"}>
  <div class="panel-content">
    {#if admin}<label>
        Person
        <select
          aria-label="Wochenstunden für Person"
          value={person}
          disabled={busy}
          on:change={(event) => {
            setPerson(event.currentTarget.value);
            setNotice("");
          }}
        >
          {#each workspace.members.filter(isStaff) as row (row.id)}<option value={row.id}>
              {row.name}
              {row.status === "disabled" ? " · ehemaliges Teammitglied" : ""}
            </option>{/each}
        </select>
      </label>{/if}
    {#if notice}<p class="success-message" role="status">
        <Check size={16}></Check>
        {notice}
      </p>{/if}
    {#if member}{#key `${member.id}:${member.preferences?.workingTime?.version || 0}`}<WorkingTimeForm
          {member}
          onSaved={setNotice}
          onSaving={() => setNotice("")}
        ></WorkingTimeForm>{/key}{:else}<p class="muted">
        Noch keine Teammitglieder vorhanden.
      </p>{/if}
  </div>
</Section>
