<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    ShieldCheck,
    Plus,
    ExternalLink,
    Download,
    Smartphone,
    LockKeyhole,
  } from "@lucide/svelte";
  import { PageHeader, Button, ErrorMessage, Badge } from "@/components/ui";
  import { useWorkspace } from "@/components/workspace-context";
  import { api, post, dateLabel, localDateTime, instantDate } from "@/shared/client-api";
  import { clearPrivateBrowserData } from "@/shared/private-browser-data";
  import {
    policySchema,
    type PrivacyWorkspace,
    type PrivacyEntry,
    type PrivacyEntryKind,
    type PrivacyPolicy,
  } from "./model";
  import { fields, kindLabels, groupLabels, rightsLabels } from "./form-fields";
  import styles from "./privacy.module.css";
  const store = useWorkspace();
  $: workspace = $store.workspace;
  let state: PrivacyWorkspace | null = null;
  let loading = true;
  let busy = false;
  let error = "";
  let message = "";
  let tab =
    typeof location === "undefined"
      ? "overview"
      : new URLSearchParams(location.search).get("tab") || "overview";
  let editor: PrivacyEntryKind | null = null;
  let editing: PrivacyEntry | null = null;
  let entryData: Record<string, any> = {};
  let status = "open";
  let formHeading: HTMLHeadingElement;
  let policy: PrivacyPolicy = policySchema.parse({
    controller: {},
    purposes: ["employees", "actors", "contacts"].map((group) => ({ group })),
  });
  let reviewed = false;
  let password = "";
  let code = "";
  let backupMode = false;
  let setup: { totpURI: string; qr: string; backupCodes: string[] } | null = null;
  let deletionPreview: {
    requestId: string;
    candidates: { id: string; kind: string; title: string; date: string; held: boolean }[];
    more: boolean;
    reviewRequired: string[];
  } | null = null;
  let deletionSelection: string[] = [];
  let deletionHeading: HTMLHeadingElement;
  let formOpener: HTMLElement | null = null;
  async function restoreFocus() {
    await tick();
    if (formOpener?.isConnected) formOpener.focus();
    else document.getElementById("privacy-section-heading")?.focus();
  }
  async function closeEditor() {
    editor = null;
    editing = null;
    error = "";
    await restoreFocus();
  }
  const tabs = [
    { id: "overview", label: "Überblick" },
    { id: "requests", label: "Meine Anfragen" },
    { id: "security", label: "Zugang & Gerät" },
  ];
  const adminTabs = [
    { id: "policy", label: "Theaterangaben" },
    { id: "providers", label: "Anbieter & Nachweise" },
    { id: "retention", label: "Aufbewahrung" },
    { id: "incidents", label: "Vorfälle" },
    { id: "images", label: "Personen & Bilder" },
  ];
  const tabKinds: Record<string, PrivacyEntryKind[]> = {
    requests: ["request"],
    providers: ["provider", "document"],
    retention: ["retention", "hold"],
    incidents: ["incident"],
    images: ["image"],
  };
  const statusLabels: Record<string, string> = {
    open: "Offen",
    review: "In Prüfung",
    answered: "Beantwortet",
    closed: "Abgeschlossen",
    verified: "Geprüft",
    withdrawn: "Zurückgezogen",
  };
  $: visibleTabs = state?.manage
    ? tabs
        .map((t) => (t.id === "requests" ? { ...t, label: "Betroffenenanfragen" } : t))
        .concat(adminTabs)
    : tabs;
  $: entries = state?.entries.filter((e) => (tabKinds[tab] || []).includes(e.kind)) || [];
  async function load() {
    loading = true;
    try {
      state = await api<PrivacyWorkspace>("/api/privacy");
      if (state.policy) {
        policy = state.policy;
        reviewed = !!policy.reviewedAt;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Angaben konnten nicht geladen werden.";
    } finally {
      loading = false;
    }
  }
  onMount(load);
  async function switchTab(next: string) {
    tab = next;
    editor = null;
    editing = null;
    error = "";
    message = "";
    await tick();
    document.getElementById("privacy-section-heading")?.focus();
  }
  async function edit(kind: PrivacyEntryKind, entry: PrivacyEntry | null = null) {
    formOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editor = kind;
    editing = entry;
    status = entry?.status || "open";
    entryData = entry
      ? { ...entry.data }
      : {
          title: "",
          ...Object.fromEntries(
            fields[kind].filter((f) => f.options).map((f) => [f.key, f.options![0][0]]),
          ),
        };
    if (kind === "request") {
      entryData.subjectId ||= workspace.user.id;
      entryData.receivedAt ||= new Date().toISOString();
    }
    if (kind === "incident") entryData.awareAt ||= new Date().toISOString();
    error = "";
    message = "";
    await tick();
    formHeading?.focus();
  }
  async function saveEntry() {
    busy = true;
    error = "";
    try {
      const data = { ...entryData };
      for (const f of fields[editor!]) {
        if (f.type === "number")
          data[f.key] =
            data[f.key] === "" || data[f.key] === undefined ? null : Number(data[f.key]);
        if (f.type === "ids" && typeof data[f.key] === "string")
          data[f.key] = data[f.key]
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
      }
      await post("/api/privacy", {
        action: "entry",
        kind: editor,
        id: editing?.id,
        version: editing?.version || 0,
        status,
        data,
      });
      editor = null;
      editing = null;
      await load();
      message = "Gespeichert. Frist und Status sind aktualisiert.";
      await restoreFocus();
    } catch (e) {
      error = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    } finally {
      busy = false;
    }
  }
  async function savePolicy(publish = false) {
    busy = true;
    error = "";
    try {
      await post("/api/privacy", {
        action: "policy",
        version: state?.policyVersion || 0,
        data: {
          ...policy,
          reviewedAt: reviewed ? policy.reviewedAt || new Date().toISOString() : "",
          publishedAt: publish ? new Date().toISOString() : "",
        },
      });
      await load();
      message = publish
        ? "Geprüfte Information veröffentlicht."
        : "Entwurf gespeichert. Die aktuelle öffentliche Information bleibt bestehen.";
    } catch (e) {
      error = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    } finally {
      busy = false;
    }
  }
  async function mfa(action: "enable" | "verify" | "backup") {
    busy = true;
    error = "";
    try {
      if (action === "enable") {
        setup = await post("/api/auth/mfa", { action, password });
        password = "";
      } else {
        await post("/api/auth/mfa", { action, code });
        code = "";
        setup = null;
        await load();
        message = "Zweiter Faktor bestätigt. Dein Zugang ist geschützt.";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Prüfung fehlgeschlagen.";
    } finally {
      busy = false;
    }
  }
  async function clearDevice() {
    if (
      !confirm(
        "Lokale Entwürfe und Dokumentkopien dieses Kontos entfernen? Gespeicherte Theaterdaten bleiben erhalten.",
      )
    )
      return;
    try {
      const r = await clearPrivateBrowserData(workspace.user.id);
      message = r.blocked.length
        ? "Einige Kopien sind noch geöffnet. Schließe andere Showtime-Tabs und versuche es erneut."
        : "Lokale Kopien dieses Kontos wurden entfernt.";
    } catch {
      error = "Kopien konnten nicht vollständig entfernt werden. Prüfe die Browsereinstellungen.";
    }
  }
  function download(data: unknown, name: string) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function exportSubject(e: PrivacyEntry) {
    busy = true;
    error = "";
    try {
      download(
        await post("/api/privacy", { action: "subject-export", id: e.id }),
        "showtime-betroffenen-auszug.json",
      );
      message = "Auszug erstellt. Prüfe ihn vor der Weitergabe auf Rechte anderer Personen.";
    } catch (e) {
      error = e instanceof Error ? e.message : "Export fehlgeschlagen.";
    } finally {
      busy = false;
    }
  }
  async function preview(entry: PrivacyEntry) {
    formOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    busy = true;
    error = "";
    try {
      if (entry.kind === "retention") {
        download(
          await post("/api/privacy", { action: "retention-preview", id: entry.id }),
          "showtime-aufbewahrung-vorschau.json",
        );
        message = "Prüfliste erstellt. Es wurden keine Daten gelöscht.";
      } else {
        deletionPreview = await post("/api/privacy", { action: "erasure-preview", id: entry.id });
        deletionSelection = [];
        await tick();
        deletionHeading?.focus();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Vorschau fehlgeschlagen.";
    } finally {
      busy = false;
    }
  }
  async function erase() {
    if (
      !deletionPreview ||
      !deletionSelection.length ||
      !confirm(
        deletionSelection.length +
          " geprüfte Datensätze endgültig löschen? Der globale Zugang wird dadurch nicht gelöscht.",
      )
    )
      return;
    busy = true;
    error = "";
    try {
      const result = await post<{ erased: number }>("/api/privacy", {
        action: "erase",
        id: deletionPreview.requestId,
        data: { confirmation: "GEPRÜFTE DATEN LÖSCHEN", recordIds: deletionSelection },
      });
      message =
        result.erased +
        " Datensätze gelöscht. Prüfe anschließend den vollständigen Löschplan und die Backup-Aufbewahrung.";
      deletionPreview = null;
      deletionSelection = [];
      await load();
      await restoreFocus();
    } catch (e) {
      error = e instanceof Error ? e.message : "Löschung fehlgeschlagen.";
    } finally {
      busy = false;
    }
  }
  async function providerDrafts() {
    busy = true;
    error = "";
    try {
      const result = await post<{ added: number }>("/api/privacy", { action: "provider-drafts" });
      await load();
      message = result.added + " Anbietervorlagen als ungeprüfte Entwürfe ergänzt.";
    } catch (e) {
      error = e instanceof Error ? e.message : "Vorlagen konnten nicht ergänzt werden.";
    } finally {
      busy = false;
    }
  }
  const dateInput = (v: unknown) =>
    v ? localDateTime(String(v), workspace.timezone || "Europe/Berlin") : "";
</script>

<PageHeader
  title="Datenschutz & Sicherheit"
  description="Dein Zugang, deine Rechte und die Datenschutzangaben deines Theaters."
/>
<div class={styles.tabs}>
  <label class={styles.mobileSelect}
    >Bereich<select value={tab} on:change={(e) => switchTab(e.currentTarget.value)}
      >{#each visibleTabs as t}<option value={t.id}>{t.label}</option>{/each}</select
    ></label
  >
  <nav class={styles.desktopTabs} aria-label="Datenschutzbereiche">
    {#each visibleTabs as t}<button
        type="button"
        class:active={tab === t.id}
        aria-current={tab === t.id ? "page" : undefined}
        on:click={() => switchTab(t.id)}>{t.label}</button
      >{/each}
  </nav>
</div>
<div class={styles.body}>
  <ErrorMessage message={error} />{#if deletionPreview}<section class={styles.section}>
      <h2 bind:this={deletionHeading} tabindex="-1">Löschvorschau prüfen</h2>
      <p>
        Prüfe jeden Eintrag und wähle ausdrücklich aus, was gelöscht werden soll. Gemeinsam genutzte
        Inhalte, Profile und Backups gehören zusätzlich zum vollständigen Löschplan.
      </p>
      {#if deletionPreview.more}<p role="status">
          Es sind mehr als 100 Datensätze vorhanden. Diese Vorschau zeigt nur die ersten 100;
          weitere Einträge benötigen eine weitere Prüfung.
        </p>{/if}
      <div class={styles.deletionCandidates}>
        {#each deletionPreview.candidates as candidate}<label class={styles.deletionCandidate}
            ><input
              type="checkbox"
              disabled={candidate.held}
              checked={deletionSelection.includes(candidate.id)}
              on:change={(e) =>
                (deletionSelection = e.currentTarget.checked
                  ? [...deletionSelection, candidate.id]
                  : deletionSelection.filter((id) => id !== candidate.id))}
            /><span
              ><strong>{candidate.title}</strong><span class="small muted"
                >{candidate.kind === "time"
                  ? "Produktionsstunden"
                  : candidate.kind === "attendance"
                    ? "Anwesenheit"
                    : candidate.kind === "leave"
                      ? "Freiwunsch"
                      : "Personendaten"}{candidate.date ? " · " + dateLabel(candidate.date) : ""} · {candidate.held
                  ? "Aufbewahrungssperre aktiv"
                  : "Zur Prüfung verfügbar"}</span
              ><span class="small muted">Kennung: {candidate.id}</span></span
            ></label
          >{/each}
      </div>
      {#if !deletionPreview.candidates.some((c) => !c.held)}<p role="status">
          Alle angezeigten Einträge sind gesperrt oder es gibt keine passenden Datensätze. Eine
          Löschung ist hier nicht möglich.
        </p>{/if}
      <div class={styles.actions}>
        <Button disabled={busy || !deletionSelection.length} onClick={erase}
          >{deletionSelection.length
            ? deletionSelection.length + " geprüfte Einträge endgültig löschen"
            : "Zuerst Einträge auswählen"}</Button
        ><Button
          onClick={async () => {
            deletionPreview = null;
            deletionSelection = [];
            await restoreFocus();
          }}>Vorschau schließen</Button
        >
      </div>
    </section>{/if}{#if message}<p class="success-message" role="status">{message}</p>{/if}
  {#if loading}<div class={styles.loading} aria-busy="true">
      <span></span><span></span>
      <p>Datenschutzangaben werden geladen …</p>
    </div>{:else if state}
    {#if state.manage && !state.mfaVerified && tab !== "security"}<div class={styles.notice}>
        <LockKeyhole size={20} />
        <div>
          <h2>Verwaltung mit zweitem Faktor öffnen</h2>
          <p>Bestätige deinen Zugang für interne Vorgänge und Änderungen.</p>
          <Button onClick={() => switchTab("security")}>Zugang bestätigen</Button>
        </div>
      </div>{/if}
    {#if tab === "overview"}<h2 id="privacy-section-heading" tabindex="-1">
        Was du hier erledigen kannst
      </h2>
      <div class={styles.overview}>
        <section class={styles.section}>
          <ShieldCheck size={24} />
          <h3>Deine Daten im Theater</h3>
          <p>
            {state.noticePublished
              ? "Die Datenschutzangaben deines Theaters sind veröffentlicht. Dort findest du Verantwortliche, Zwecke und Kontakte."
              : "Die Theaterverwaltung muss Verantwortliche, Zwecke und Kontakte noch vervollständigen."}
          </p>
          <a class="button secondary" href={state.noticeUrl} target="_blank" rel="noopener"
            >Information öffnen <ExternalLink size={16} /></a
          >
        </section>
        <section class={styles.section}>
          <h3>Eine Anfrage stellen</h3>
          <p>
            Auskunft, Berichtigung oder Löschung: Starte eine Anfrage und verfolge die Antwort hier.
          </p>
          <Button
            onClick={() => {
              tab = "requests";
              edit("request");
            }}>Neue Anfrage</Button
          >
        </section>
      </div>
      <div class={styles.notice}>
        <LockKeyhole size={20} />
        <div>
          <h3>Abwesenheiten ohne medizinischen Grund</h3>
          <p>
            Medizinische Funktionen sind auf der aktuellen Infrastruktur gesperrt. Persönliche
            Tagesgutschriften bleiben separat möglich; das Team sieht neutrale Abwesenheiten.
          </p>
        </div>
      </div>
    {:else if tab === "security"}<h2 id="privacy-section-heading" tabindex="-1">Zugang & Gerät</h2>
      <div class={styles.securityGrid}>
        <section class={styles.section}>
          <LockKeyhole size={24} />
          <h3>Zweiter Faktor</h3>
          <p class="small" role="status">
            {state.mfaEnabled
              ? "Authenticator eingerichtet"
              : "Authenticator noch nicht eingerichtet"} · {state.mfaVerified
              ? "Zugang bestätigt"
              : "Zugang noch bestätigen"}
          </p>
          <p>
            Für Administration und Support erforderlich. Nutze eine Authenticator-App und bewahre
            Wiederherstellungscodes sicher auf.
          </p>
          {#if setup}<img
              src={setup.qr}
              alt="QR-Code für die Authenticator-App"
              width="220"
              height="220"
              class={styles.qr}
            />
            <details>
              <summary>Ohne Kamera einrichten</summary>
              <p class={styles.wrap}>{setup.totpURI}</p>
            </details>
            <details open>
              <summary>Wiederherstellungscodes aufbewahren</summary>
              <p class="small muted">
                Diese Codes werden nur jetzt angezeigt. Bewahre sie getrennt vom Passwort auf.
              </p>
              <ul class={styles.codes}>
                {#each setup.backupCodes as c}<li>{c}</li>{/each}
              </ul>
              <Button
                onClick={() =>
                  download(
                    { backupCodes: setup!.backupCodes },
                    "showtime-wiederherstellungscodes.json",
                  )}>Codes speichern</Button
              >
            </details>{/if}
          {#if !state.mfaEnabled && !setup}<form on:submit|preventDefault={() => mfa("enable")}>
              <label
                >Dein aktuelles Passwort<input
                  type="password"
                  bind:value={password}
                  autocomplete="current-password"
                  required
                  maxlength={128}
                /></label
              ><Button type="submit" disabled={busy} variant="primary"
                >Authenticator einrichten</Button
              >
            </form>{:else}<form
              on:submit|preventDefault={() => mfa(backupMode ? "backup" : "verify")}
            >
              <label
                >{backupMode ? "Wiederherstellungscode" : "Authenticator-Code"}<input
                  bind:value={code}
                  autocomplete="one-time-code"
                  inputmode={backupMode ? "text" : "numeric"}
                  required
                  maxlength={100}
                /></label
              >
              <div class={styles.actions}>
                <Button type="submit" disabled={busy} variant="primary">Code bestätigen</Button
                ><Button
                  onClick={() => {
                    backupMode = !backupMode;
                    code = "";
                  }}>{backupMode ? "Authenticator verwenden" : "Wiederherstellungscode"}</Button
                >
              </div>
            </form>{/if}
        </section>
        <section class={styles.section}>
          <Smartphone size={24} />
          <h3>Lokale Kopien entfernen</h3>
          <p>
            Entwürfe und Dokumentkopien auf diesem Gerät entfernen. Nach entzogenem Dokumentzugriff
            wird die lokale Kopie automatisch entfernt.
          </p>
          <Button onClick={clearDevice}>Kopien dieses Kontos entfernen</Button>
          <p class="small muted">
            Speichere benötigte Entwürfe vorher im Theater. Andere offene Tabs können die Entfernung
            blockieren.
          </p>
          <h3>Benachrichtigungen & Freigaben</h3>
          <p>
            Push-Mitteilungen enthalten nur einen Hinweis. Kalenderabos kannst du in den
            Profileinstellungen widerrufen.
          </p>
          <a class="button secondary" href="/?module=settings">Profileinstellungen öffnen</a>
        </section>
      </div>
    {:else if tab === "policy" && state.manage}<h2 id="privacy-section-heading" tabindex="-1">
        Theaterangaben und Information
      </h2>
      <p class="muted">
        Das Theater bestätigt diese Angaben. Ein Entwurf ist noch keine veröffentlichte Information.
      </p>
      <form class={styles.section} on:submit|preventDefault={() => savePolicy(false)}>
        <h3>Verantwortlicher Träger</h3>
        <div class={styles.formGrid}>
          <label
            >Rechtlicher Name<input bind:value={policy.controller.name} maxlength={200} /></label
          ><label
            >Datenschutzkontakt<input
              bind:value={policy.controller.contact}
              maxlength={200}
            /></label
          ><label class={styles.wide}
            >Anschrift<textarea bind:value={policy.controller.address} rows="2" maxlength={4000}
            ></textarea></label
          ><label
            >Datenschutzbeauftragte (falls benannt)<input
              bind:value={policy.controller.dpo}
              maxlength={200}
            /></label
          ><label
            >Kontakt für Betroffenenanfragen<input
              bind:value={policy.rightsContact}
              maxlength={200}
            /></label
          >
        </div>
        <h3>SaaS-Anbieter</h3>
        <div class={styles.formGrid}>
          <label>Rechtlicher Name<input bind:value={policy.provider.name} maxlength={200} /></label
          ><label>Kontakt<input bind:value={policy.provider.contact} maxlength={200} /></label
          ><label class={styles.wide}
            >Anschrift<textarea bind:value={policy.provider.address} rows="2" maxlength={4000}
            ></textarea></label
          >
        </div>
        {#each policy.purposes as p}<fieldset>
            <legend>{groupLabels[p.group]}</legend>
            <div class={styles.formGrid}>
              <label
                >Verarbeitungszweck<textarea bind:value={p.purpose} rows="2" maxlength={4000}
                ></textarea></label
              ><label
                >Bestätigte Rechtsgrundlage<textarea bind:value={p.basis} rows="2" maxlength={4000}
                ></textarea></label
              ><label
                >Empfänger<textarea bind:value={p.recipients} rows="2" maxlength={4000}
                ></textarea></label
              ><label
                >Aufbewahrung<textarea bind:value={p.retention} rows="2" maxlength={4000}
                ></textarea></label
              ><label class={styles.wide}
                >Zusätzliche Information<textarea bind:value={p.notice} rows="2" maxlength={4000}
                ></textarea></label
              >
            </div>
          </fieldset>{/each}<label
          >Datenschutzinformation<textarea bind:value={policy.notice} rows="5" maxlength={4000}
          ></textarea></label
        ><label
          >Beteiligung von Betriebs- / Personalrat<textarea
            bind:value={policy.worksCouncilReview}
            rows="2"
            maxlength={4000}></textarea></label
        ><label class={styles.check}
          ><input type="checkbox" bind:checked={reviewed} />Angaben wurden vom zuständigen Theater
          fachlich geprüft</label
        >
        <div class={styles.actions}>
          <Button type="submit" disabled={busy || !state.mfaVerified}>Entwurf speichern</Button
          ><Button
            variant="primary"
            disabled={busy || !state.mfaVerified || !reviewed}
            onClick={() => savePolicy(true)}>Geprüfte Information veröffentlichen</Button
          >
        </div>
      </form>
    {:else}<div class={styles.sectionHeading}>
        <h2 id="privacy-section-heading" tabindex="-1">
          {visibleTabs.find((t) => t.id === tab)?.label || "Vorgänge"}
        </h2>
        {#if !editor}<div class={styles.actions}>
            {#if tab === "providers"}<Button
                disabled={busy || !state.mfaVerified}
                onClick={providerDrafts}>Bekannte Dienste als Entwurf ergänzen</Button
              >{/if}{#each tabKinds[tab] || [] as k}<Button
                disabled={k !== "request" && !state.mfaVerified}
                onClick={() => edit(k)}><Plus size={16} />{kindLabels[k]} anlegen</Button
              >{/each}
          </div>{/if}
      </div>
      {#if editor}<form class={styles.section} on:submit|preventDefault={saveEntry}>
          <div class={styles.sectionHeading}>
            <h3 bind:this={formHeading} tabindex="-1">
              {kindLabels[editor]}
              {editing ? "bearbeiten" : "anlegen"}
            </h3>
            <Button onClick={closeEditor}>Zur Übersicht</Button>
          </div>
          <label
            >Kurzer Titel<input
              bind:value={entryData.title}
              required
              maxlength={200}
              placeholder="Worum geht es?"
            /></label
          >
          <div class={styles.formGrid}>
            {#each fields[editor].filter((f) => (state?.manage && state.mfaVerified) || !["subjectType", "subjectId", "receivedAt", "identityVerifiedAt", "decision", "response", "respondedAt", "extensionReason", "extensionNotifiedAt"].includes(f.key)) as f}<label
                class:wide={f.type === "long"}
                >{f.label}
                {#if ["subjectId", "actorId"].includes(f.key)}<select
                    value={Array.isArray(entryData[f.key])
                      ? entryData[f.key].join(", ")
                      : entryData[f.key] || ""}
                    on:input={(e) => (entryData = { ...entryData, [f.key]: e.currentTarget.value })}
                    required={f.required}
                    ><option value="">Person wählen</option
                    >{#if f.key === "actorId" || entryData.subjectType === "actor"}{#each workspace.records.actors as p}<option
                          value={p.id}>{String(p.data.name || "Unbenannt")}</option
                        >{/each}{:else if entryData.subjectType === "contact"}{#each workspace.records.people as p}<option
                          value={p.id}>{String(p.data.name || "Unbenannt")}</option
                        >{/each}{:else}{#each workspace.members as p}<option value={p.id}
                          >{p.name}</option
                        >{/each}{/if}</select
                  >
                {:else if f.options}<select
                    value={Array.isArray(entryData[f.key])
                      ? entryData[f.key].join(", ")
                      : entryData[f.key] || ""}
                    on:input={(e) => (entryData = { ...entryData, [f.key]: e.currentTarget.value })}
                    >{#each f.options as [key, label]}<option value={key}>{label}</option
                      >{/each}</select
                  >{:else if f.type === "long"}<textarea
                    value={Array.isArray(entryData[f.key])
                      ? entryData[f.key].join(", ")
                      : entryData[f.key] || ""}
                    on:input={(e) => (entryData = { ...entryData, [f.key]: e.currentTarget.value })}
                    rows="3"
                    maxlength={4000}></textarea>{:else if f.type === "date"}<input
                    type="datetime-local"
                    value={dateInput(entryData[f.key])}
                    on:input={(e) =>
                      (entryData[f.key] = e.currentTarget.value
                        ? instantDate(
                            e.currentTarget.value,
                            workspace.timezone || "Europe/Berlin",
                          ).toISOString()
                        : "")}
                  />{:else}<input
                    value={Array.isArray(entryData[f.key])
                      ? entryData[f.key].join(", ")
                      : entryData[f.key] || ""}
                    on:input={(e) => (entryData = { ...entryData, [f.key]: e.currentTarget.value })}
                    type={f.type === "number" ? "number" : "text"}
                    required={f.required}
                    min={f.type === "number" ? 1 : undefined}
                    maxlength={f.type === "ids" ? undefined : 200}
                  />{/if}{#if f.help}<span class="small muted">{f.help}</span>{/if}</label
              >{/each}
          </div>
          {#if state.manage && state.mfaVerified}<label
              >Status<select bind:value={status}
                >{#each Object.entries(statusLabels) as [key, label]}<option value={key}
                    >{label}</option
                  >{/each}</select
              ></label
            >{/if}
          <p class="small muted">
            Bitte keine Gesundheitsgründe, Zugangsdaten oder vollständigen Ausweisdokumente
            eintragen.
          </p>
          <ErrorMessage message={error} />
          <div class={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              disabled={busy || ((!!editing || editor !== "request") && !state.mfaVerified)}
              >{busy ? "Wird gespeichert …" : "Vorgang speichern"}</Button
            ><Button onClick={closeEditor}>Abbrechen</Button>
          </div>
        </form>
      {:else if entries.length}<div class={styles.entryGrid}>
          {#each entries as e}<article class={styles.entry}>
              <div class={styles.sectionHeading}>
                <span class="small muted">{kindLabels[e.kind]}</span><Badge
                  >{statusLabels[e.status]}</Badge
                >
              </div>
              <h3>{String(e.data.title)}</h3>
              {#if e.dueAt}<p>Frist: {dateLabel(e.dueAt, true)}</p>{/if}{#if e.kind === "request"}<p
                >
                  {rightsLabels[String(e.data.requestType)]}
                </p>{:else if e.kind === "provider"}<p>
                  {String(e.data.service || "Dienstbeschreibung ergänzen")}
                </p>{:else if e.kind === "retention"}<p>
                  {e.data.days ? e.data.days + " Tage" : "Frist noch nicht bestätigt"} · {groupLabels[
                    String(e.data.group)
                  ]}
                </p>{/if}
              <div class={styles.actions}>
                {#if state.manage && state.mfaVerified}<Button
                    disabled={!state.mfaVerified}
                    onClick={() => edit(e.kind, e)}>Öffnen & bearbeiten</Button
                  >{#if e.kind === "request"}<Button
                      disabled={busy || !state.mfaVerified}
                      onClick={() => exportSubject(e)}
                      ><Download size={16} />Auszug zur Prüfung</Button
                    >{#if e.data.requestType === "erasure"}<Button
                        disabled={busy || !state.mfaVerified}
                        onClick={() => preview(e)}>Löschvorschau prüfen</Button
                      >{/if}{/if}{#if e.kind === "retention"}<Button
                      disabled={busy || !state.mfaVerified}
                      onClick={() => preview(e)}>Aufbewahrung prüfen</Button
                    >{/if}{:else}<p class="small muted">
                    {e.data.response
                      ? String(e.data.response)
                      : "Dein Theater prüft die Anfrage. Die Antwort erscheint hier."}
                  </p>{/if}
              </div>
            </article>{/each}
        </div>{:else}<section class={styles.empty}>
          <h3>{tab === "requests" ? "Noch keine Anfrage" : "Hier beginnen deine Nachweise"}</h3>
          <p>
            {tab === "requests"
              ? "Stelle eine Anfrage zu deinen Daten. Eingang, Frist und Antwort bleiben nachvollziehbar."
              : "Erfasse geprüfte Angaben schrittweise. Offene Nachweise bleiben ausdrücklich offen."}
          </p>
        </section>{/if}
    {/if}
  {/if}
</div>
