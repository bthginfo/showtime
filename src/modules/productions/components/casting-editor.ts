import { Plus } from "@lucide/svelte";
import type { DomainRecord, RecordData } from "@/shared/contracts";
import { value, ids } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Modal } from "@/components/ui";
import { ResourceEditor } from "@/components/resource-editor";
import { CastingImpact } from "@/components/casting-impact";
import { initialPeriod } from "@/shared/period-filter";

export { default as CastingEditor } from "./casting-editor.CastingEditor.svelte";
