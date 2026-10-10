import { Eye, EyeOff } from "@lucide/svelte";
export function subscribeHydration() {
    return () => { };
}
export type PasswordInputProps = Omit<import("svelte/elements").HTMLInputAttributes, "type"> & {
    label: string;
    name: string;
};
export { default as PasswordInput } from "./password-input.PasswordInput.svelte";
