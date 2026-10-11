<script lang="ts">
  import { BrandMark } from "./brand-mark";
  import { useRouter } from "@/shared/svelte-navigation";
  import { ArrowRight, ShieldCheck } from "@lucide/svelte";
  import { post } from "@/shared/client-api";
  import { Button, ErrorMessage, Modal } from "./ui";
  import { ThemeSwitch } from "./theme-switch";
  import { PasswordInput } from "./password-input";
  import {
    createEffects,
    createId,
    externalStore,
    styleString,
    applyRef,
  } from "@/shared/svelte-runtime";
  import type {
    ReactNode,
    CSSProperties,
    Dispatch,
    SetStateAction,
    FormEvent,
    ChangeEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    ComponentProps,
    RefObject,
  } from "@/shared/ui-types";
  import { AuthForm } from "./auth-form";
  const effects = createEffects();
  type ViewProps = {
    onClose: () => void;
  };
  export let onClose: ViewProps["onClose"] = undefined as any;
  let busy: boolean = false;
  const setBusy = (next: typeof busy | ((current: typeof busy) => typeof busy)) => {
    busy =
      typeof next === "function" ? (next as (current: typeof busy) => typeof busy)(busy) : next;
  };
  let error: string = "";
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let done: boolean = false;
  const setDone = (next: typeof done | ((current: typeof done) => typeof done)) => {
    done =
      typeof next === "function" ? (next as (current: typeof done) => typeof done)(done) : next;
  };
  let submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("repeat")) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/api/reset-password", {
        username: form.get("username"),
        code: form.get("code"),
        password: form.get("password"),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Zurücksetzen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };
</script>

<Modal title={done ? "Dein Passwort wurde geändert." : "Passwort mit Code zurücksetzen"} {onClose}>
  {#if done}
    <p class="muted">
      Du kannst dich jetzt mit deinem Benutzernamen und dem neuen Passwort anmelden.
    </p>
    <footer class="dialog-footer">
      <Button variant="primary" onClick={onClose}>Zur Anmeldung</Button>
    </footer>
  {:else}<form method="POST" action="/api/reset-password" on:submit={submit}>
      <p class="muted">
        Ein Admin erstellt deinen persönlichen Wiederherstellungscode. Verwende ihn hier, um ein
        neues Passwort festzulegen.
      </p>
      <label>
        Benutzername
        <input name="username" autocomplete="username" required />
      </label>
      <label>
        Wiederherstellungscode
        <input name="code" autocomplete="off" required />
      </label>
      <PasswordInput
        label="Neues Passwort"
        name="password"
        minLength={10}
        autoComplete="new-password"
        required
      ></PasswordInput>
      <PasswordInput
        label="Neues Passwort wiederholen"
        name="repeat"
        minLength={10}
        autoComplete="new-password"
        required
      ></PasswordInput>
      <ErrorMessage message={error}></ErrorMessage>
      <footer class="dialog-footer">
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? "Wird geändert …" : "Neues Passwort speichern"}
        </Button>
      </footer>
    </form>{/if}
</Modal>
