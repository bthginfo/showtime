<script lang="ts">
import { Mail, Phone } from "@lucide/svelte";
import { textValue, type RecordData } from "@/shared/contracts";
import { emailHref, phoneHref } from "./person-data";
import styles from "./people.module.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    data: RecordData;
    empty?: string;
};
export let data: ViewProps["data"] = undefined as any;
export let empty: NonNullable<ViewProps["empty"]> = "Keine Kontaktdaten hinterlegt";
let email = textValue(data.email);
let phone = textValue(data.phone);

$: email = textValue(data.email);
$: phone = textValue(data.phone);

</script>

<div class={styles.contacts}>
      {#if email}{#if emailHref(email)}<a class={styles.contact} href={emailHref(email)} aria-label={`E-Mail an ${textValue(data.name) || email}`}>
            <Mail size={15}></Mail>
            <span>{email}</span>
          </a>{:else}<span class={styles.contact}>
            <Mail size={15}></Mail>
            <span>{email}</span>
          </span>{/if}{/if}
      {#if phone}{#if phoneHref(phone)}<a class={styles.contact} href={phoneHref(phone)} aria-label={`${textValue(data.name) || "Kontakt"} anrufen: ${phone}`}>
            <Phone size={15}></Phone>
            <span>{phone}</span>
          </a>{:else}<span class={styles.contact}>
            <Phone size={15}></Phone>
            <span>{phone}</span>
          </span>{/if}{/if}
      {#if !email && !phone && empty}<span class={styles.secondary}>{empty}</span>{/if}
    </div>
