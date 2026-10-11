<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { Check, LoaderCircle, Plus, Trash2, Users } from "@lucide/svelte";
import { contactsValue, type DomainRecord, type Member, type ProductionContact, } from "@/shared/contracts";
import { ApiFailure, ids, initials, value } from "@/shared/client-api";
import { PersonPicker } from "@/modules/people/components";
import { hasMakeupResponsibility, productionContactName, toggleMakeupResponsibility, } from "@/shared/production-contacts";
import { isActiveStaff } from "@/shared/client-members";
import { useWorkspace } from "./workspace-context";
import { Badge, Button, Empty, ErrorMessage, Modal, PageHeader } from "./ui";
import { RecordLink } from "./record-link";
import styles from "./production-makeup-choice.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { productionChangedMessage, saveError, MakeupChoice, ProductionPeopleFields } from "./production-people";
const effects=createEffects();
type ViewProps = {
    production: DomainRecord;
};
export let production: ViewProps["production"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, save, refresh, busy } = $workspaceStore;
$: ({ workspace, save, refresh, busy } = $workspaceStore);
let editing: boolean = false;
const setEditing = (next: typeof editing | ((current: typeof editing) => typeof editing)) => { editing = typeof next === "function" ? (next as (current: typeof editing) => typeof editing)(editing) : next; };
let editingBase: DomainRecord | null = initialState<DomainRecord | null>(null);
const setEditingBase = (next: DomainRecord | null | ((current: DomainRecord | null) => DomainRecord | null)) => { editingBase = typeof next === "function" ? (next as (current: DomainRecord | null) => DomainRecord | null)(editingBase) : next; };
let contacts = contactsValue(production.data.contacts);
const setContacts = (next: typeof contacts | ((current: typeof contacts) => typeof contacts)) => { contacts = typeof next === "function" ? (next as (current: typeof contacts) => typeof contacts)(contacts) : next; };
let memberIds = ids(production.data, "memberIds");
const setMemberIds = (next: typeof memberIds | ((current: typeof memberIds) => typeof memberIds)) => { memberIds = typeof next === "function" ? (next as (current: typeof memberIds) => typeof memberIds)(memberIds) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let quickError: string = "";
const setQuickError = (next: typeof quickError | ((current: typeof quickError) => typeof quickError)) => { quickError = typeof next === "function" ? (next as (current: typeof quickError) => typeof quickError)(quickError) : next; };
let quickNotice: string = "";
const setQuickNotice = (next: typeof quickNotice | ((current: typeof quickNotice) => typeof quickNotice)) => { quickNotice = typeof next === "function" ? (next as (current: typeof quickNotice) => typeof quickNotice)(quickNotice) : next; };
let pendingMemberId: string = "";
const setPendingMemberId = (next: typeof pendingMemberId | ((current: typeof pendingMemberId) => typeof pendingMemberId)) => { pendingMemberId = typeof next === "function" ? (next as (current: typeof pendingMemberId) => typeof pendingMemberId)(pendingMemberId) : next; };
let quickMutation = {current: false as any | null};
let currentContacts = contactsValue(production.data.contacts);
let team = workspace.members.filter((member) => ids(production.data, "memberIds").includes(member.id));
let edit = () => {
    setContacts(currentContacts);
    setMemberIds(ids(production.data, "memberIds"));
    setError("");
    setEditingBase(production);
    setEditing(true);
};
let toggleSaved = async (member: Member) => {
    if (quickMutation.current || busy || !isActiveStaff(member))
        return;
    quickMutation.current = true;
    setPendingMemberId(member.id);
    setQuickError("");
    setQuickNotice("");
    const original = production;
    const originalContacts = contactsValue(original.data.contacts);
    const selected = hasMakeupResponsibility(originalContacts, member.id);
    const next = toggleMakeupResponsibility(originalContacts, ids(original.data, "memberIds"), member.id, crypto.randomUUID());
    try {
        await save("productions", next, original);
        setQuickNotice(selected
            ? `${member.name} bleibt im Team, ohne Maskenbetreuung.`
            : `${member.name} ist jetzt Maskenbetreuung.`);
    }
    catch (exception) {
        setQuickError(saveError(exception));
    }
    finally {
        quickMutation.current = false;
        setPendingMemberId("");
    }
};

$: currentContacts = contactsValue(production.data.contacts);
$: team = workspace.members.filter((member) => ids(production.data, "memberIds").includes(member.id));



</script>


      <PageHeader title="Team & Kontakte" >
        <Button onClick={edit} disabled={busy || !!pendingMemberId}>
          Team & Kontakte bearbeiten
        </Button>
      </PageHeader>
      {#if currentContacts.length}<div class="production-contacts-list">
          {#each currentContacts as contact (contact.id)}<article class="production-contact">
              <span class="contact-role">{contact.role}</span>
              <strong>
                {#if contact.personId &&
    workspace.records.people.some((person) => person.id === contact.personId && !value(person.data, "linkedMemberId"))}<RecordLink record={workspace.records.people.find((person) => person.id === contact.personId)!}>
                    {productionContactName(contact, workspace.members, workspace.records.people)}
                  </RecordLink>{:else}{productionContactName(contact, workspace.members, workspace.records.people)}{/if}
              </strong>
              <Badge tone={contact.type === "makeup" ? "green" : "neutral"}>
                {contact.type === "makeup" ? "Maskenbetreuung" : "Extern"}
              </Badge>
            </article>{/each}
        </div>{:else}<Empty title="Wer wirkt an diesem Stück mit?" description="Ergänzt eure Kontakte mit frei gewählten Rollen, auch ohne Theateraccount." action="Kontakte hinzufügen" onAction={edit}></Empty>{/if}
      <section class="panel production-team-panel" aria-label="Produktionsteam">
        <header class="panel-heading">
          <h3>
            <Users size={17}></Users> Produktionsteam
          </h3>
          <span class="small muted">{team.length} Personen</span>
        </header>
        <div class="production-team-members">
          {#if team.length}{#each team as member (member.id)}<div class={`production-team-member ${styles.savedMember}`}>
                <span class="avatar">{initials(member.name)}</span>
                <div>
                  <strong>{member.name}</strong>
                  <span class="small muted">
                    {currentContacts
    .filter((contact) => contact.memberId === member.id)
    .map((contact) => contact.role)
    .join(" · ") || "Teammitglied"}
                    {member.status !== "active" ? " · Nicht aktiv" : ""}
                  </span>
                </div>
                {#if isActiveStaff(member)}<MakeupChoice member={member} selected={hasMakeupResponsibility(currentContacts, member.id)} disabled={busy || !!pendingMemberId} pending={pendingMemberId === member.id} onClick={() => void toggleSaved(member)}></MakeupChoice>{/if}
              </div>{/each}{:else}<p class="small muted">Noch kein Produktionsteam zugeteilt.</p>{/if}
        </div>
        {#if (quickNotice || quickError)}<div class={styles.feedback}>
            {#if quickNotice}<p class={styles.success} role="status">
                <Check size={16} aria-hidden="true"></Check> {quickNotice}
              </p>{/if}
            <ErrorMessage message={quickError}></ErrorMessage>
            {#if quickError === productionChangedMessage}<Button disabled={busy || !!pendingMemberId} onClick={async () => {
    setQuickError("");
    try {
        await refresh();
    }
    catch (exception) {
        setQuickError(saveError(exception));
    }
}}>
                Aktuellen Stand laden
              </Button>{/if}
          </div>{/if}
      </section>
      {#if editing}<Modal title={`Team & Kontakte · ${value(production.data, "title")}`} onClose={() => setEditing(false)} wide>
          <form on:submit={async (event) => {
    event.preventDefault();
    setError("");
    try {
        await save("productions", { contacts, memberIds }, editingBase || production);
        setQuickError("");
        setQuickNotice("");
        setEditing(false);
    }
    catch (exception) {
        setError(saveError(exception));
    }
}}>
            <ProductionPeopleFields contacts={contacts} memberIds={memberIds} onChange={(nextContacts, nextMembers) => {
    setContacts(nextContacts);
    setMemberIds(nextMembers);
}}></ProductionPeopleFields>
            <ErrorMessage message={error}></ErrorMessage>
            <footer class="dialog-footer">
              <Button onClick={() => setEditing(false)}>Abbrechen</Button>
              <Button type="submit" variant="primary" disabled={busy}>
                Speichern
              </Button>
            </footer>
          </form>
        </Modal>{/if}
