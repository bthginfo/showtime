import type { AccentPalette } from "@/shared/contracts";
import { useWorkspace } from "@/components/workspace-context";
import { Button, ErrorMessage, Section } from "@/components/ui";
import { ThemeSwitch } from "@/components/theme-switch";
import { AccentPicker, useAccentPreview } from "./accent-picker";

export { default as AppearanceCard } from "./appearance-card.AppearanceCard.svelte";
