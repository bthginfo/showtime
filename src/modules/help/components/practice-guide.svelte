<script lang="ts">
  import { onMount } from "svelte";
  import { useWorkspace } from "@/components/workspace-context";
  import { scopedBrowserKey } from "@/shared/browser-scope";
  import { Button, Badge } from "@/components/ui";
  import { hasPermission } from "@/platform/access";
  import { workspaceHome } from "@/shared/workspace-home";
  export let moduleId = "makeup";
  const store = useWorkspace();
  let completed: string[] = [];
  $: user = $store.workspace.user;
  $: subject = { id: user.id, grants: user.grants || [] };
  $: role =
    workspaceHome($store.workspace) === "intendance"
      ? "intendance"
      : workspaceHome($store.workspace) === "personnel"
        ? "personnel"
        : user.grants?.every((g) => g.role === "guest")
          ? "guest"
          : hasPermission(subject, "tenant.configure", {})
            ? "admin"
            : "trade";
  $: tasks =
    role === "admin"
      ? [
          {
            id: "modules",
            title: "Gewerke prüfen",
            text: "Öffne die Einrichtung und prüfe die Zuordnung der aktiven Module. Lege gemeinsame Räume an oder beauftrage die technische Leitung.",
            url: "/?module=theater&view=administration",
          },
          {
            id: "rights",
            title: "Rechtevorschau prüfen",
            text: "Wähle eine Rolle und ihren Geltungsbereich. Prüfe die angezeigten Zusatzrechte, bevor du sie einer Person zuweist.",
            url: "/?module=theater&view=administration",
          },
          {
            id: "setup",
            title: "Einrichtung abschließen",
            text: "Prüfe Zuständigkeiten und Regeln mit den Leitungen. Bestätige örtliche Regelprofile erst nach Klärung und schließe die Einrichtung ausdrücklich ab.",
            url: "/?module=theater&view=administration",
          },
        ]
      : role === "personnel"
        ? [
            {
              id: "week",
              title: "Teamwoche prüfen",
              text: "Öffne die Teamzeiten, wähle Person und Woche und vergleiche die Buchungen mit Abwesenheiten.",
              url: "/?module=time",
            },
            {
              id: "correction",
              title: "Korrektur nachvollziehen",
              text: "Bearbeite eine berechtigte Testbuchung und prüfe die aktualisierte Wochensumme. Eine Löschung benötigt den vorgesehenen Bestätigungsschritt.",
              url: "/?module=time",
            },
            {
              id: "export",
              title: "Export abgrenzen",
              text: "Wähle den nötigen Zeitraum und Personenkreis. Prüfe den Export, bevor du ihn an ein Lohnsystem übergibst.",
              url: "/?module=exports",
            },
          ]
        : role === "intendance"
          ? [
              {
                id: "coverage",
                title: "Berichtsabdeckung lesen",
                text: "Wähle einen Zeitraum in der Hausübersicht. Vergleiche Berichte und vergangene Vorstellungen, bevor du Auslastung oder Einnahmen beurteilst.",
                url: "/?module=theater&view=overview",
              },
              {
                id: "budget",
                title: "Prognose einordnen",
                text: "Vergleiche genehmigte Bedarfe mit Bestell- und Rechnungsständen. Öffne die Beschaffung für den konkreten Nachweis.",
                url: "/?module=theater&view=overview",
              },
              {
                id: "ready",
                title: "Ausnahmen prüfen",
                text: "Öffne eine Produktion. Prüfe veränderte Fachfassungen und die Begründung sowie Frist jeder Ausnahme.",
                url: "/?module=theater&view=readiness",
              },
            ]
          : role === "guest"
            ? [
                {
                  id: "scope",
                  title: "Deine Produktion finden",
                  text: "Öffne die für dich freigegebene Produktion und prüfe den aktuellen Tagesplan.",
                  url: "/?module=productions",
                },
                {
                  id: "availability",
                  title: "Verfügbarkeit melden",
                  text: "Erfasse im Ensemblebereich Datum und Status. Für eingeschränkte Verfügbarkeit gibst du das mögliche tägliche Zeitfenster an.",
                  url: "/?module=theater&view=trade",
                },
                {
                  id: "feedback",
                  title: "Rückmeldung geben",
                  text: "Öffne eine an dein Gewerk gerichtete Abstimmung. Lies den Arbeitsauftrag und kommentiere die konkrete Fassung.",
                  url: "/?module=theater&view=collaborations",
                },
              ]
            : [
                {
                  id: "version",
                  title: "Einen Fachstand nachvollziehen",
                  text: "Wähle die richtige Produktion. Öffne Details, Fassungen & Anlagen eines Beispiels und vergleiche zwei Fassungen.",
                  url: "/?module=theater&view=trade",
                },
                {
                  id: "linked",
                  title: "Referenzen und Anlagen prüfen",
                  text: "Prüfe Personen, Figuren, Raum oder Gerät am Fachstand. Öffne die zugehörige Anlage und vergleiche deren Fassung.",
                  url: "/?module=theater&view=trade",
                },
                {
                  id: "workflow",
                  title: "Eine Abstimmung durchlaufen",
                  text: "Sende einen Teststand an das beteiligte Gewerk oder kommentiere eine empfangene Anfrage. Die andere zuständige Leitung prüft und bestätigt den unveränderten Stand.",
                  url: "/?module=theater&view=collaborations",
                },
              ];
  onMount(() => {
    try {
      completed = JSON.parse(
        localStorage.getItem(scopedBrowserKey("practice:" + moduleId + ":" + role + ":v1")) || "[]",
      );
    } catch {
      completed = [];
    }
  });
  function check(id: string, done: boolean) {
    completed = done
      ? [...completed.filter((x) => x !== id), id]
      : completed.filter((x) => x !== id);
    try {
      localStorage.setItem(
        scopedBrowserKey("practice:" + moduleId + ":" + role + ":v1"),
        JSON.stringify(completed),
      );
    } catch {
      /* Optional device-local progress. */
    }
  }
</script>

<section class="surface">
  <div class="section-heading">
    <h3>Übungsablauf für deine Rolle</h3>
    <Badge
      >{tasks.filter((t) => completed.includes(t.id)).length} / {tasks.length} selbst geprüft</Badge
    >
  </div>
  <p>
    Nutze die gekennzeichneten Beispieldaten. Die Schritte ändern von sich aus keine Theaterdaten.
    Markiere einen Schritt erst, wenn du seinen Ablauf ausprobiert hast.
  </p>
  <ol>
    {#each tasks as task (task.id)}<li>
        <h4>{task.title}</h4>
        <p>{task.text}</p>
        <div class="button-row">
          <a class="button secondary" href={task.url}>Arbeitsbereich öffnen</a><label
            class="check-label"
            ><input
              type="checkbox"
              checked={completed.includes(task.id)}
              on:change={(e) => check(task.id, e.currentTarget.checked)}
            />Ablauf selbst geprüft</label
          >
        </div>
      </li>{/each}
  </ol>
  {#if tasks.every((t) => completed.includes(t.id))}<p role="status">
      Übung abgeschlossen. Du kannst die Schritte jederzeit erneut öffnen; formale Fachfreigaben
      bleiben separate Entscheidungen.
    </p>{/if}
</section>
