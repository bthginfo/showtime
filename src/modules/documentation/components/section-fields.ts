import { ArrowDown, ArrowUp, Plus, Trash2 } from "@lucide/svelte";
import type { TextSection } from "@/shared/document-sections";
import { sectionName } from "@/shared/document-sections";
import { categoriesFor } from "@/shared/domain-categories";
import { useWorkspace } from "@/components/workspace-context";
import { Button, Empty } from "@/components/ui";

export { default as SectionFields } from "./section-fields.SectionFields.svelte";
