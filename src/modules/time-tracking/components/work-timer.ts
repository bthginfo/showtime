import { ChevronDown, Clock3, DoorOpen, Pause, Play, Square } from "@lucide/svelte";
import { categoriesFor } from "@/shared/domain-categories";
import type { DomainRecord } from "@/shared/contracts";
import { dateLabel, num, value } from "@/shared/client-api";
import { useWorkspace } from "@/components/workspace-context";
import { Badge, Button, ErrorMessage } from "@/components/ui";
import styles from "./work-timer.module.css";

export { default as TimerPanel } from "./work-timer.TimerPanel.svelte";
