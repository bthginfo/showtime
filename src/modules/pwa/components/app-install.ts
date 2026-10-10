import { Download, Share } from "@lucide/svelte";
import { Button, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { appDeviceState } from "@/shared/app-device";
export interface InstallEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: string;
    }>;
}
export { default as AppInstall } from "./app-install.AppInstall.svelte";
