<script lang="ts">
import { ArrowUpRight, FileText, Paperclip, Table2 } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { value } from "@/shared/client-api";
import { documentFormat } from "../contracts";
import "../documents.css";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { DocumentEditor } from "./document-attachment";
const effects=createEffects();
type ViewProps = {
    file: DomainRecord;
    compact?: boolean;
};
export let file: ViewProps["file"] = undefined as any;
export let compact: NonNullable<ViewProps["compact"]> = false;
let opened: boolean = false;
const setOpened = (next: typeof opened | ((current: typeof opened) => typeof opened)) => { opened = typeof next === "function" ? (next as (current: typeof opened) => typeof opened)(opened) : next; };
let format = documentFormat(file.data.mime);
let Icon = format === "sheet" ? Table2 : format ? FileText : Paperclip;
let className = compact
    ? "message-attachment shared-document-attachment"
    : "file-tile shared-document-attachment";

$: format = documentFormat(file.data.mime);
$: Icon = format === "sheet" ? Table2 : format ? FileText : Paperclip;
$: className = compact
    ? "message-attachment shared-document-attachment"
    : "file-tile shared-document-attachment";

</script>


      {#if format}<button type="button" class={className} on:click={() => setOpened(true)} title="Gemeinsam öffnen und bearbeiten">
          <svelte:component this={Icon} size={compact ? 15 : 24}></svelte:component>
          <span>{value(file.data, "name")}</span>
          <ArrowUpRight size={14}></ArrowUpRight>
        </button>{:else}<a class={className} href={`/api/files/${file.id}`} target="_blank" rel="noreferrer">
          <svelte:component this={Icon} size={compact ? 15 : 24}></svelte:component>
          <span>{value(file.data, "name")}</span>
        </a>{/if}
      {#if opened}<DocumentEditor file={file} onClose={() => setOpened(false)}></DocumentEditor>{/if}
