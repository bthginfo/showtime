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
  import { ResetPasswordForm } from "./auth-form";
  const effects = createEffects();
  type ViewProps = {
    register?: boolean;
  };
  export let register: NonNullable<ViewProps["register"]> = false;
  export let initialError = "";
  export let notice = "";
  export let invitation = "";
  const router = useRouter();
  let busy: boolean = false;
  const setBusy = (next: typeof busy | ((current: typeof busy) => typeof busy)) => {
    busy =
      typeof next === "function" ? (next as (current: typeof busy) => typeof busy)(busy) : next;
  };
  let error: string = initialError;
  const setError = (next: typeof error | ((current: typeof error) => typeof error)) => {
    error =
      typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next;
  };
  let done: boolean = false;
  const setDone = (next: typeof done | ((current: typeof done) => typeof done)) => {
    done =
      typeof next === "function" ? (next as (current: typeof done) => typeof done)(done) : next;
  };
  let resetOpen: boolean = false;
  const setResetOpen = (
    next: typeof resetOpen | ((current: typeof resetOpen) => typeof resetOpen),
  ) => {
    resetOpen =
      typeof next === "function"
        ? (next as (current: typeof resetOpen) => typeof resetOpen)(resetOpen)
        : next;
  };
  let submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await post<{ twoFactorRedirect?: boolean }>(
        register ? "/api/register" : "/api/login",
        {
          username: form.get("username"),
          password: form.get("password"),
          ...(register ? { name: form.get("name"), invitation: form.get("invitation") || "" } : {}),
        },
      );
      if (register) setDone(true);
      else router.replace(result.twoFactorRedirect ? "/login/mfa" : "/");
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Keine Verbindung zum Server. Prüfe deine Internetverbindung und versuche es erneut."
          : e instanceof Error
            ? e.message
            : "Anmeldung fehlgeschlagen",
      );
    } finally {
      setBusy(false);
    }
  };
</script>

<main class="auth-page">
  <aside class="auth-story">
    <a href="/" class="brand">
      <BrandMark></BrandMark>
      <span>
        showtime<span class="brand-sub">GEMEINSAM HINTER DER BÜHNE</span>
      </span>
    </a>
    <div>
      <p class="eyebrow">HINTER DER BÜHNE. ALLES IM BLICK.</p>
      <h1>
        Mehr Zeit
        <br /> für dein Theater.
      </h1>
      <p>
        Der gemeinsame Ort für Produktionen, Menschen und die vielen kleinen Dinge, die eine große
        Vorstellung möglich machen.
      </p>
      <div class="auth-line"></div>
      <span class="small">Dein Theater. Dein Team. Dein Arbeitsraum.</span>
    </div>
    <p class="small muted">Ein Arbeitsraum für alle Gewerke.</p>
  </aside>
  <section class="auth-main">
    <div class="auth-theme">
      <ThemeSwitch></ThemeSwitch>
    </div>
    <div class="auth-form">
      {#if done}
        <ShieldCheck size={40} className="accent"></ShieldCheck>
        <h2>Du bist registriert.</h2>
        <p class="muted">
          Deine Einladung wurde angenommen. Du kannst dich jetzt mit deinem Benutzernamen anmelden.
        </p>
        <a class="button primary" href="/login">
          Zur Anmeldung
          <ArrowRight size={16}></ArrowRight>
        </a>
      {:else}
        <p class="eyebrow">WILLKOMMEN IN DEINEM THEATER</p>
        <h2>{register ? "Dein Zugang." : "Schön, dass du da bist."}</h2>
        <p class="muted">
          {register
            ? "Registriere dich für den gemeinsamen Arbeitsraum."
            : "Melde dich an und starte in deinen Tag."}
        </p>
        {#if notice}<p class="success-message" role="status">{notice}</p>{/if}
        <form method="POST" action={register ? "/api/register" : "/api/login"} on:submit={submit}>
          {#if register}<input type="hidden" name="invitation" value={invitation} />{/if}
          {#if register}<label>
              Name
              <input
                name="name"
                autocomplete="name"
                required
                maxLength={100}
                placeholder="Vor- und Nachname"
              />
            </label>{/if}
          <label>
            Benutzername
            <input
              name="username"
              aria-label="Benutzername"
              aria-describedby="username-help"
              autocomplete="username"
              autoCapitalize="none"
              required
              minLength={3}
              maxLength={32}
              placeholder="Dein Benutzername"
            />
            <span class="small muted" id="username-help">
              {register
                ? "3–32 Zeichen: Buchstaben, Zahlen, Punkt, Bindestrich oder Unterstrich."
                : "Dein bei der Registrierung gewählter Benutzername – nicht dein Anzeigename."}
            </span>
          </label>
          <PasswordInput
            label="Passwort"
            name="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 10 : undefined}
            placeholder={register ? "Mindestens 10 Zeichen" : "Dein Passwort"}
          ></PasswordInput>
          <ErrorMessage message={error}></ErrorMessage>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Einen Moment …" : register ? "Zugang erstellen" : "Anmelden"}
            <ArrowRight size={16}></ArrowRight>
          </Button>
        </form>
        <p class="auth-switch">
          {register ? "Du hast bereits einen Zugang?" : "Neu im Team?"}{" "}
          <a href={register ? "/login" : "/register"}>
            {register ? "Anmelden" : "Jetzt registrieren"}
          </a>
        </p>
        {#if !register}<div class="auth-reset">
            <p class="small muted">
              Passwort vergessen? Ein Admin kann dir einen Wiederherstellungscode geben.
            </p>
            <button type="button" class="text-button" on:click={() => setResetOpen(true)}>
              Passwort mit Code zurücksetzen
            </button>
          </div>{/if}
      {/if}
    </div>
  </section>
  {#if resetOpen}<ResetPasswordForm onClose={() => setResetOpen(false)}></ResetPasswordForm>{/if}
</main>
