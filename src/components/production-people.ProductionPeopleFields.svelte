<script lang="ts">
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
import { productionChangedMessage, saveError, MakeupChoice, ProductionTeamModule } from "./production-people";
const effects=createEffects();
type ViewProps = {
    contacts: ProductionContact[];
    memberIds: string[];
    onChange: (contacts: ProductionContact[], memberIds: string[]) => void;
};
export let contacts: ViewProps["contacts"] = undefined as any;
export let memberIds: ViewProps["memberIds"] = undefined as any;
export let onChange: ViewProps["onChange"] = undefined as any;
const workspaceStore=useWorkspace();
let { workspace, busy } = $workspaceStore;
$: ({ workspace, busy } = $workspaceStore);
const roleList = createId();
let roles = [
    ...new Set([
        "Regie",
        "Kostüm",
        "Assistenz",
        "Maskenbetreuung",
        ...workspace.records.productions.flatMap((row) => contactsValue(row.data.contacts).map((contact) => contact.role)),
    ]),
].filter(Boolean);
let members = workspace.members.filter(isActiveStaff);
let update = (id: string, data: Partial<ProductionContact>) => onChange(contacts.map((contact) => (contact.id === id ? { ...contact, ...data } : contact)), memberIds);
let contactMembers = contacts.map((contact) => contact.memberId).filter(Boolean);
let teamChoices = workspace.members.filter((member) => isActiveStaff(member) || memberIds.includes(member.id) || contactMembers.includes(member.id));

$: roles = [
    ...new Set([
        "Regie",
        "Kostüm",
        "Assistenz",
        "Maskenbetreuung",
        ...workspace.records.productions.flatMap((row) => contactsValue(row.data.contacts).map((contact) => contact.role)),
    ]),
].filter(Boolean);
$: members = workspace.members.filter(isActiveStaff);

$: contactMembers = contacts.map((contact) => contact.memberId).filter(Boolean);
$: teamChoices = workspace.members.filter((member) => isActiveStaff(member) || memberIds.includes(member.id) || contactMembers.includes(member.id));

</script>

<section class="production-people-fields field-wide">
      <header class="panel-heading">
        <div>
          <h3>Kontakte & Zuständigkeiten</h3>
          <p class="small muted">
            Freie Rollen für Regie, Kostüm, Assistenz und Maskenbetreuung.
          </p>
        </div>
        <Button disabled={busy} onClick={() => onChange([
    ...contacts,
    { id: crypto.randomUUID(), role: "", type: "external", name: "", memberId: "" },
], memberIds)}>
          <Plus size={16}></Plus>
          Kontakt hinzufügen
        </Button>
      </header>
      <datalist id={roleList}>
        {#each roles as role (role)}<option value={role}></option>{/each}
      </datalist>
      <fieldset class={`form-multi ${styles.formTeam}`} disabled={busy}>
        <legend>Produktionsteam</legend>
        <p class="small muted">
          Teammitglieder auswählen und bei Bedarf direkt als Maskenbetreuung zuweisen. Wenn du die
          Betreuung entfernst, bleibt die Person im Team.
        </p>
        {#each teamChoices as member (member.id)}{@const included = memberIds.includes(member.id) || contactMembers.includes(member.id)}<div class={styles.formMember}>
              <label class={`check-label ${styles.memberCheck}`}>
                <input type="checkbox" checked={included} disabled={contactMembers.includes(member.id)} on:input={(event) => onChange(contacts, event.currentTarget.checked
    ? [...new Set([...memberIds, member.id])]
    : memberIds.filter((id) => id !== member.id))} />
                <span>
                  {member.name}
                  {#if !isActiveStaff(member)}<span class="small muted"> · Historische Zuordnung, entfernen</span>{/if}
                </span>
              </label>
              {#if included && isActiveStaff(member)}<MakeupChoice member={member} selected={hasMakeupResponsibility(contacts, member.id)} disabled={busy} onClick={() => {
    const next = toggleMakeupResponsibility(contacts, memberIds, member.id, crypto.randomUUID());
    onChange(next.contacts, next.memberIds);
}}></MakeupChoice>{/if}
            </div>{/each}
        {#if !members.length}<p class="small muted">Noch keine aktiven Teammitglieder.</p>{/if}
      </fieldset>
      {#if !contacts.length}<p class="empty-inline">
          Noch keine Kontakte. Externe Personen benötigen keinen Account.
        </p>{/if}
      {#each contacts as contact, index (contact.id)}<fieldset class="production-contact-form" disabled={busy}>
          <legend>Kontakt {index + 1}</legend>
          <div class="form-grid">
            <label>
              Rolle
              <input required list={roleList} value={contact.role} placeholder="z. B. Regieassistenz" on:input={(event) => update(contact.id, { role: event.currentTarget.value })} />
            </label>
            <label>
              Zuordnung
              <select value={contact.type} on:change={(event) => update(contact.id, {
    type: event.currentTarget.value as ProductionContact["type"],
    memberId: "",
    name: "",
    personId: "",
})}>
                <option value="external">Externe Person</option>
                <option value="makeup">Maskenbetreuung</option>
              </select>
            </label>
            {#if contact.type === "makeup"}<label>
                Person auswählen
                <select aria-label={`Person für Kontakt ${index + 1}`} value={contact.memberId || ""} on:change={(event) => update(contact.id, { memberId: event.currentTarget.value, name: "", personId: "" })}>
                  <option value="">Namen frei eintragen</option>
                  {#if contact.memberId &&
    !members.some((member) => member.id === contact.memberId)}<option disabled value={contact.memberId}>
                        {workspace.members.find((member) => member.id === contact.memberId)?.name ||
    "Bisheriges Teammitglied"}{" "}
                        · historische Zuordnung, bitte neu zuordnen
                      </option>{/if}
                  {#each members as member (member.id)}<option value={member.id}>
                      {member.name}
                    </option>{/each}
                </select>
              </label>{/if}
            {#if !contact.memberId}<div class="field-wide">
                <PersonPicker value={contact.personId || ""} label={`Verzeichnis für Kontakt ${index + 1}`} onChange={(personId) => update(contact.id, {
    personId,
    name: value(workspace.records.people.find((person) => person.id === personId)?.data ||
        {}, "name"),
})} onCreated={(person) => update(contact.id, { personId: person.id, name: value(person.data, "name") })}></PersonPicker>
              </div>{/if}
            {#if !contact.memberId && !contact.personId}<label>
                Name
                <input required value={contact.name} on:input={(event) => update(contact.id, { name: event.currentTarget.value, personId: "" })} placeholder="Vor- und Nachname" />
              </label>{/if}
          </div>
          <Button variant="danger-ghost" onClick={() => onChange(contacts.filter((row) => row.id !== contact.id), memberIds)}>
            <Trash2 size={15}></Trash2>
            Kontakt {index + 1} entfernen
          </Button>
        </fieldset>{/each}
    </section>
