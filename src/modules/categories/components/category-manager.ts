import { Pencil, Plus, Trash2 } from "@lucide/svelte";
import type { DomainRecord } from "@/shared/contracts";
import { categoriesFor, type CategoryScope } from "@/shared/domain-categories";
import { value } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Button, Empty, ErrorMessage, Modal } from "@/components/ui";
import { numberDraft, parseNumberDraft } from "@/shared/number-draft";
export const scopes = {
    time: "Tätigkeitsbereiche",
    materials: "Funduskategorien",
    looks: "Aufschriebabschnitte",
    handovers: "Übergabeabschnitte",
};
export { categoriesFor };
export { default as CategoryManager } from "./category-manager.CategoryManager.svelte";
export { default as CategoryEditor } from "./category-manager.CategoryEditor.svelte";
