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

export { default as DocumentEditor } from "./document-editor.DocumentEditor.svelte";
