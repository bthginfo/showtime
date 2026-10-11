<script lang="ts">
  import { onMount, tick } from "svelte";
  import { goto } from "$app/navigation";
  import {
    Building2,
    Plus,
    ArrowUpRight,
    Users,
    Layers,
    Copy,
    Check,
    LogOut,
    Search,
    RotateCw,
    ChevronRight,
  } from "@lucide/svelte";
  import { api, post, ApiFailure } from "@/shared/client-api";
  import {
    theaterSlug,
    tenantInput,
    tenantStatusLabels,
    type TenantSummary,
  } from "@/shared/tenant-management";
  import { BrandMark } from "./brand-mark";
  import { ThemeSwitch } from "./theme-switch";
  import { Modal } from "./ui";
  import { LinkedText } from "./linked-text";
  import PlatformHealth from "./platform-health.svelte";

  type Scope = {
    organizationId: string;
    organizationName: string;
    departmentId: string;
    departmentName: string;
    status: string;
  };
  type Details = {
    timezone: string;
    departments: { id: string; name: string }[];
    modules: { id: string; enabled: boolean }[];
  };
  type Support = {
    id: string;
    theater: string;
    title: string;
    description: string;
    type: string;
    status: string;
    version: number;
  };
  export let onSelect:
    ((organizationId: string, departmentId: string) => Promise<void>) | undefined = undefined;
  let theaters: TenantSummary[] = [];
  let scopes: Scope[] = [];
  let support: Support[] = [];
  let selected = "";
  let details: Details | null = null;
  let detailLoading = false;
  let detailError = "";
  let detailGeneration = 0;
  let loading = true;
  let busy = false;
  let error = "";
  let notice = "";
  let userName = "";
  let tab: "theaters" | "support" = "theaters";
  let search = "";
  let statusFilter = "all";
  let creating = false;
  let name = "";
  let slug = "";
  let slugTouched = false;
  let administrator: "self" | "invite" = "self";
  let formError = "";
  let invitationUrl = "";
  let invitationTenant = "";
  let copied = false;
  let departmentId = "";
  let lockTarget: TenantSummary | null = null;
  let supportError = "";
  let supportLoading = false;
  let authorized = false;
  const statuses: Record<string, string> = {
    new: "Neu",
    review: "In Prüfung",
    planned: "Geplant",
    doing: "In Bearbeitung",
    done: "Abgeschlossen",
    closed: "Geschlossen",
  };

  $: if (!slugTouched) slug = theaterSlug(name);
  $: current = theaters.find((t) => t.id === selected);
  $: available = scopes.filter((s) => s.organizationId === selected && s.status === "active");
  $: filtered = theaters.filter(
    (t) =>
      `${t.name} ${t.slug}`.toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de")) &&
      (statusFilter === "all" || t.status === statusFilter),
  );

  function message(e: unknown) {
    return e instanceof Error ? e.message : "Die Aktion konnte nicht abgeschlossen werden.";
  }
  async function choose(id: string, moveFocus = false) {
    selected = id;
    creating = false;
    detailError = "";
    details = null;
    departmentId =
      scopes.find((s) => s.organizationId === id && s.status === "active")?.departmentId || "";
    if (invitationTenant !== id) {
      invitationUrl = "";
      copied = false;
    }
    const generation = ++detailGeneration;
    detailLoading = true;
    try {
      const result = await api<Details>(`/api/platform/tenants/${id}`);
      if (generation === detailGeneration) details = result;
    } catch (e) {
      if (generation === detailGeneration) detailError = message(e);
    } finally {
      if (generation === detailGeneration) {
        detailLoading = false;
        if (moveFocus) {
          await tick();
          document.getElementById("tenant-detail-heading")?.focus();
        }
      }
    }
  }
  async function load() {
    loading = true;
    error = "";
    try {
      const identity = await api<{
        scopes: Scope[];
        platformAdmin: boolean;
        user: { name: string };
      }>("/api/platform/scopes");
      if (!identity.platformAdmin) {
        error = "Diese Verwaltung ist der Plattformadministration vorbehalten.";
        return;
      }
      authorized = true;
      scopes = identity.scopes;
      userName = identity.user.name;
      theaters = await api<TenantSummary[]>("/api/platform/tenants");
      if (!creating && theaters.length)
        await choose(theaters.some((t) => t.id === selected) ? selected : theaters[0].id);
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 401) {
        await goto("/login");
        return;
      }
      error = message(e);
    } finally {
      loading = false;
    }
  }
  async function startCreate() {
    creating = true;
    name = "";
    slugTouched = false;
    administrator = "self";
    formError = "";
    notice = "";
    invitationUrl = "";
    copied = false;
    await tick();
    document.getElementById("tenant-name")?.focus();
  }
  async function create() {
    if (busy) return;
    const parsed = tenantInput.safeParse({ name, slug });
    if (!parsed.success) {
      formError = parsed.error.issues[0].message;
      return;
    }
    busy = true;
    formError = "";
    notice = "";
    try {
      const result = await post<{ id: string; invitationUrl?: string }>("/api/platform/tenants", {
        ...parsed.data,
        administrator,
      });
      selected = result.id;
      creating = false;
      invitationTenant = result.id;
      invitationUrl = result.invitationUrl || "";
      await load();
      notice =
        administrator === "self"
          ? "Theater eingerichtet. Du kannst jetzt einen Arbeitsbereich öffnen."
          : "Theater eingerichtet. Lade jetzt die Theateradministration ein.";
    } catch (e) {
      formError = message(e);
      if (e instanceof ApiFailure && e.status === 503) {
        creating = false;
        await load();
        error = formError;
      }
    } finally {
      busy = false;
    }
  }
  async function openArea() {
    if (!departmentId || !current || busy) return;
    busy = true;
    detailError = "";
    try {
      if (onSelect) await onSelect(current.id, departmentId);
      else {
        await post("/api/platform/switch", { organizationId: current.id, departmentId });
        await goto("/");
      }
    } catch (e) {
      detailError = message(e);
    } finally {
      busy = false;
    }
  }
  async function toggle(theater: TenantSummary) {
    busy = true;
    detailError = "";
    notice = "";
    try {
      await api("/api/platform/tenants", {
        method: "PATCH",
        body: JSON.stringify({
          id: theater.id,
          status: theater.status === "active" ? "disabled" : "active",
          expectedVersion: theater.version,
        }),
      });
      lockTarget = null;
      await load();
      notice =
        theater.status === "active"
          ? "Das Theater ist gesperrt. Bestehende Theaterzugänge sind deaktiviert."
          : "Das Theater ist wieder freigegeben.";
    } catch (e) {
      detailError = message(e);
      lockTarget = null;
    } finally {
      busy = false;
    }
  }
  async function resume() {
    if (!current) return;
    busy = true;
    detailError = "";
    try {
      await post(`/api/platform/tenants/${current.id}/setup`, {});
      await load();
      notice = "Die Einrichtung ist abgeschlossen.";
    } catch (e) {
      detailError = message(e);
    } finally {
      busy = false;
    }
  }
  async function invite() {
    if (!current) return;
    busy = true;
    detailError = "";
    copied = false;
    try {
      const result = await post<{ url: string }>(
        `/api/platform/tenants/${current.id}/invitation`,
        {},
      );
      invitationTenant = current.id;
      invitationUrl = result.url;
    } catch (e) {
      detailError = message(e);
    } finally {
      busy = false;
    }
  }
  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      copied = true;
    } catch {
      detailError =
        "Kopieren ist in diesem Browser nicht verfügbar. Markiere den Link und kopiere ihn manuell.";
    }
  }
  async function showSupport() {
    tab = "support";
    supportError = "";
    supportLoading = true;
    try {
      support = await api<Support[]>("/api/platform/support");
    } catch (e) {
      supportError = message(e);
    } finally {
      supportLoading = false;
    }
  }
  async function update(item: Support, status: string) {
    busy = true;
    supportError = "";
    try {
      await api("/api/platform/support", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, version: item.version, status }),
      });
      await showSupport();
    } catch (e) {
      supportError = message(e);
    } finally {
      busy = false;
    }
  }
  async function logout() {
    try {
      await post("/api/logout", {});
      await goto("/login");
    } catch (e) {
      error = message(e);
    }
  }
  onMount(() => {
    void load();
  });
</script>

<div class="platform-page">
  <a class="skip-link" href="#platform-main">Zur Theaterverwaltung</a>
  <header class="platform-header">
    <a class="brand" href="/"
      ><BrandMark /><span>showtime<span class="brand-sub">Plattformverwaltung</span></span></a
    >
    <div class="platform-header-actions">
      <span class="platform-user">{userName}</span><ThemeSwitch /><button
        class="icon-button"
        on:click={() => void logout()}
        aria-label="Abmelden"><LogOut size={19} /></button
      >
    </div>
  </header>
  <main id="platform-main" class="platform-main">
    <div class="platform-title">
      <div>
        <h1>Theater verwalten</h1>
        <p>Richte Theater ein, verwalte ihre Zugänge und wechsle in deine Arbeitsbereiche.</p>
      </div>
      <button
        class="button primary"
        on:click={startCreate}
        disabled={loading || busy || !authorized}><Plus size={18} /> Theater anlegen</button
      >
    </div>
    <nav class="platform-tabs" aria-label="Plattformverwaltung">
      <button aria-pressed={tab === "theaters"} on:click={() => (tab = "theaters")}>Theater</button
      ><button aria-pressed={tab === "support"} on:click={() => void showSupport()}>Support</button>
    </nav>
    {#if notice}<p class="platform-notice" role="status"><Check size={18} />{notice}</p>{/if}
    {#if error}<div class="platform-error" role="alert">
        <p>{error}</p>
        <button class="button secondary" on:click={() => void load()}>Erneut laden</button><a
          href="/">Zum Arbeitsbereich</a
        >
      </div>{/if}
    {#if tab === "theaters"}
      <PlatformHealth {theaters} />
      <div class="platform-management">
        <section class="platform-list" aria-label="Theaterübersicht" aria-busy={loading}>
          <div class="platform-toolbar">
            <label class="platform-search"
              ><Search size={17} /><input
                bind:value={search}
                type="search"
                placeholder="Theater suchen …"
                aria-label="Theater suchen"
              /></label
            ><select bind:value={statusFilter} aria-label="Theater nach Status filtern"
              ><option value="all">Alle Status</option><option value="active">Aktiv</option><option
                value="disabled">Gesperrt</option
              ><option value="setup_failed">Einrichtung unvollständig</option></select
            ><button
              class="icon-button"
              on:click={() => void load()}
              disabled={loading || busy}
              aria-label="Theaterübersicht aktualisieren"><RotateCw size={18} /></button
            >
          </div>
          {#if loading && !theaters.length}<p class="platform-empty" role="status">
              Theater werden geladen …
            </p>
          {:else if error && !authorized}<p class="platform-empty">
              Die Theaterübersicht ist für diesen Zugang nicht verfügbar.
            </p>
          {:else if !filtered.length}<div class="platform-empty">
              <Building2 size={30} />
              <h2>{theaters.length ? "Kein Theater gefunden" : "Dein erstes Theater"}</h2>
              <p>
                {theaters.length
                  ? "Versuche einen anderen Suchbegriff oder ändere den Statusfilter."
                  : "Lege ein Theater an. Gewerke und grundlegende Arbeitsbereiche werden automatisch vorbereitet."}
              </p>
              {#if theaters.length}<button
                  class="text-button"
                  on:click={() => {
                    search = "";
                    statusFilter = "all";
                  }}>Filter zurücksetzen</button
                >{:else}<button class="button primary" disabled={!authorized} on:click={startCreate}
                  >Theater anlegen</button
                >{/if}
            </div>
          {:else}<p class="platform-list-count">
              {filtered.length} Theater{#if filtered.length !== theaters.length}
                von {theaters.length}{/if}
            </p>
            <ul class="platform-theaters">
              {#each filtered as theater (theater.id)}<li>
                  <button
                    class:platform-selected={selected === theater.id && !creating}
                    class="platform-theater"
                    aria-pressed={selected === theater.id && !creating}
                    disabled={busy}
                    on:click={() => void choose(theater.id, true)}
                    ><span class="platform-theater-icon"><Building2 size={22} /></span><span
                      class="platform-theater-content"
                      ><strong>{theater.name}</strong><span class="platform-theater-meta"
                        >{theater.memberCount} Mitglieder · {theater.departmentCount} Gewerke</span
                      ></span
                    ><span
                      class="platform-status"
                      class:platform-status-active={theater.status === "active"}
                      >{tenantStatusLabels[theater.status]}</span
                    ><ChevronRight size={18} /></button
                  >
                </li>{/each}
            </ul>{/if}
        </section>
        <section
          class="platform-detail"
          aria-label={creating ? "Neues Theater einrichten" : "Theaterdetails"}
        >
          {#if creating}
            <h2>Neues Theater</h2>
            <p class="muted">
              Alle Gewerke werden vorbereitet. Die Daten dieses Theaters bleiben von anderen
              Theatern getrennt.
            </p>
            <form class="platform-create-form" on:submit|preventDefault={() => void create()}>
              <label
                >Theatername<input
                  id="tenant-name"
                  bind:value={name}
                  required
                  minlength="2"
                  maxlength="150"
                  autocomplete="organization"
                  placeholder="Zum Beispiel Stadttheater Ingolstadt"
                  disabled={busy}
                /></label
              >
              <label
                >Kennung<input
                  bind:value={slug}
                  on:input={() => (slugTouched = true)}
                  required
                  minlength="2"
                  maxlength="63"
                  aria-describedby="tenant-slug-help"
                  spellcheck={false}
                  autocapitalize="none"
                  disabled={busy}
                /></label
              >
              <p class="platform-field-help" id="tenant-slug-help">
                Wird automatisch aus dem Namen erstellt. Verwende kleine Buchstaben, Zahlen und
                Bindestriche.
              </p>
              <fieldset class="platform-ownership">
                <legend>Wer verwaltet das Theater?</legend><label
                  ><input
                    type="radio"
                    bind:group={administrator}
                    value="self"
                    disabled={busy}
                  /><span
                    ><strong>Ich richte es selbst ein</strong><small
                      >Du erhältst eine ausdrückliche Theaterzuordnung und kannst direkt starten.</small
                    ></span
                  ></label
                ><label
                  ><input
                    type="radio"
                    bind:group={administrator}
                    value="invite"
                    disabled={busy}
                  /><span
                    ><strong>Ich lade die Theateradministration ein</strong><small
                      >Nach der Anlage erhältst du einen einmaligen Einladungslink.</small
                    ></span
                  ></label
                >
              </fieldset>
              {#if formError}<p class="platform-error" role="alert">{formError}</p>{/if}
              <div class="platform-form-actions">
                <button class="button primary" disabled={busy}
                  >{busy ? "Theater wird eingerichtet …" : "Theater einrichten"}</button
                ><button
                  class="button ghost"
                  type="button"
                  disabled={busy}
                  on:click={() => {
                    creating = false;
                    if (selected) void choose(selected);
                  }}>Abbrechen</button
                >
              </div>
            </form>
          {:else if current}
            <div class="platform-detail-title">
              <Building2 size={26} />
              <div>
                <h2 id="tenant-detail-heading" tabindex="-1">{current.name}</h2>
                <p class="muted">{current.slug}</p>
              </div>
            </div>
            <span class="platform-status" class:platform-status-active={current.status === "active"}
              >{tenantStatusLabels[current.status]}</span
            >
            <dl class="platform-facts">
              <div>
                <dt><Users size={16} /> Mitglieder</dt>
                <dd>{current.memberCount}</dd>
              </div>
              <div>
                <dt><Layers size={16} /> Gewerke</dt>
                <dd>{current.departmentCount}</dd>
              </div>
              <div>
                <dt>Theateradministration</dt>
                <dd>
                  {current.administratorCount
                    ? `${current.administratorCount} zugeordnet`
                    : "Noch nicht zugeordnet"}
                </dd>
              </div>
            </dl>
            {#if detailLoading}<p role="status">
                Details werden geladen …
              </p>{:else if details}<details class="platform-trades">
                <summary>Gewerke und Module ansehen</summary>
                <p class="muted">
                  {details.modules.filter((m) => m.enabled).length} Module aktiv · {details.timezone}
                </p>
                <ul>
                  {#each details.departments as trade (trade.id)}<li>{trade.name}</li>{/each}
                </ul>
              </details>{/if}
            {#if detailError}<p class="platform-error" role="alert">{detailError}</p>{/if}
            {#if current.status === "active"}
              <div class="platform-detail-section">
                <h3>Arbeitsbereich</h3>
                {#if available.length}<label
                    >Gewerk auswählen<select aria-label="Gewerk auswählen" bind:value={departmentId}
                      >{#each available as scope (scope.departmentId)}<option
                          value={scope.departmentId}>{scope.departmentName}</option
                        >{/each}</select
                    ></label
                  ><button
                    class="button primary"
                    disabled={busy || !departmentId}
                    on:click={() => void openArea()}
                    >Arbeitsbereich öffnen <ArrowUpRight size={17} /></button
                  >{:else}<p class="muted">
                    Du hast hier noch keine Theaterzuordnung. Plattformrechte allein öffnen keine
                    theaterinternen Daten.
                  </p>{/if}
              </div>
              <div class="platform-detail-section">
                <h3>Theateradministration einladen</h3>
                <p class="muted">
                  Der Zugang gilt nur für dieses Theater. Ein neuer Link ersetzt ungenutzte
                  Admin-Einladungen.
                </p>
                <button class="button secondary" disabled={busy} on:click={() => void invite()}
                  >Einladungslink erstellen</button
                >{#if invitationUrl && invitationTenant === current.id}<div
                    class="platform-invitation"
                  >
                    <label
                      >Einladungslink<input
                        value={invitationUrl}
                        readonly
                        aria-describedby="invitation-help"
                      /></label
                    ><button class="button secondary" on:click={() => void copyInvitation()}
                      >{#if copied}<Check size={16} /> Kopiert{:else}<Copy size={16} /> Link kopieren{/if}</button
                    >
                    <p class="platform-field-help" id="invitation-help">
                      Einmal verwendbar, sieben Tage gültig. Teile ihn nur mit der vorgesehenen
                      Theateradministration.
                    </p>
                  </div>{/if}
              </div>
            {:else if current.status === "setup_failed" || current.status === "provisioning"}<div
                class="platform-detail-section"
              >
                <h3>Einrichtung abschließen</h3>
                <p class="muted">
                  Die Daten sind gespeichert. Du kannst die Vorbereitung der Gewerke erneut starten.
                </p>
                <button class="button primary" on:click={() => void resume()} disabled={busy}
                  >Einrichtung fortsetzen</button
                >
              </div>{/if}
            {#if current.status === "active" || current.status === "disabled"}<div
                class="platform-detail-section platform-access-section"
              >
                <h3>
                  {current.status === "active" ? "Zugang sperren" : "Zugang wieder freigeben"}
                </h3>
                <p class="muted">
                  {current.status === "active"
                    ? "Eine Sperre deaktiviert auch bestehende Sitzungen. Die Theaterdaten bleiben erhalten."
                    : "Mitglieder können ihre bestehenden Arbeitsbereiche wieder öffnen."}
                </p>
                <button
                  class="button secondary"
                  disabled={busy}
                  on:click={() => {
                    if (current) {
                      if (current.status === "active") lockTarget = current;
                      else void toggle(current);
                    }
                  }}
                  >{current.status === "active" ? "Theater sperren …" : "Theater freigeben"}</button
                >
              </div>{/if}
          {:else}<div class="platform-empty">
              <Building2 size={30} />
              <h2>Wähle ein Theater</h2>
              <p>Hier findest du Einrichtung, Zugänge und deine Arbeitsbereiche.</p>
            </div>{/if}
        </section>
      </div>
    {:else}
      <section class="platform-support" aria-busy={supportLoading}>
        <div class="section-heading">
          <div>
            <h2>Plattform-Support</h2>
            <p class="muted">
              Hier erscheinen nur Rückmeldungen, die ihre Verfasser ausdrücklich weitergegeben
              haben.
            </p>
          </div>
          <button
            class="button secondary"
            disabled={supportLoading || busy}
            on:click={() => void showSupport()}>Aktualisieren</button
          >
        </div>
        {#if supportError}<p class="platform-error" role="alert">
            {supportError}
          </p>{/if}{#if supportLoading && !support.length}<p role="status" class="platform-empty">
            Rückmeldungen werden geladen …
          </p>{:else if !support.length && !supportError}<div class="platform-empty">
            <h3>Keine offenen Rückmeldungen</h3>
            <p>
              Eingereichte Ideen und Fehlerberichte erscheinen hier mit ihrem Bearbeitungsstatus.
            </p>
          </div>{/if}{#each support as item (item.id)}<article class="platform-support-item">
            <div>
              <h3>{item.title}</h3>
              <p class="muted">{item.theater} · {item.type === "bug" ? "Fehler" : "Idee"}</p>
              <LinkedText text={item.description} />
            </div>
            <label
              >Status<select
                value={item.status}
                disabled={busy}
                on:change={(e) => void update(item, e.currentTarget.value)}
                >{#each Object.entries(statuses) as [key, label] (key)}<option value={key}
                    >{label}</option
                  >{/each}</select
              ></label
            >
          </article>{/each}
      </section>
    {/if}
  </main>
</div>
{#if lockTarget}<Modal
    title="Theater sperren?"
    onClose={() => {
      if (!busy) lockTarget = null;
    }}
    initialFocus=".lock-cancel"
    ><p>
      <strong>{lockTarget.name}</strong> wird für alle Mitglieder gesperrt. Bestehende Sitzungen verlieren
      ebenfalls ihren Zugang. Die Daten bleiben erhalten.
    </p>
    <div class="platform-form-actions">
      <button
        class="button secondary lock-cancel"
        disabled={busy}
        on:click={() => (lockTarget = null)}>Abbrechen</button
      ><button
        class="button danger"
        disabled={busy}
        on:click={() => {
          if (lockTarget) void toggle(lockTarget);
        }}>{busy ? "Wird gesperrt …" : "Theater sperren"}</button
      >
    </div></Modal
  >{/if}
