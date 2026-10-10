import { ArrowUpRight, FileText, Paperclip, Table2 } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { value } from "@/shared/client-api";
import { documentFormat } from "../contracts";
import "../documents.css";
export {DocumentEditor} from "@/modules/documents/components/document-editor";
export { default as DocumentAttachment } from "./document-attachment.DocumentAttachment.svelte";
