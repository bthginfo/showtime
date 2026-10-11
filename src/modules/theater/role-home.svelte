<script lang="ts">
  import { useWorkspace } from "@/components/workspace-context";
  import { useTheaterTime } from "@/components/theater-time";
  const { localDate } = useTheaterTime();
  import { PageHeader, Button, Section, Empty } from "@/components/ui";
  import { CalendarDays, Clock3, Settings, Users } from "@lucide/svelte";
  export let role = "personnel";
  export let navigate: (url: string) => void;
  const store = useWorkspace();
  $: workspace = $store.workspace;
  $: active = workspace.members.filter((member) => member.status === "active");
  $: futureAbsences = workspace.records.leave.filter(
    (row) => String(row.data.end || "") >= localDate(),
  );
</script>

<div class="theater-workspace">
  <PageHeader title={role === "personnel" ? "Personal & Dienste" : "Dein Theater einrichten"}>
    <Button onClick={() => navigate("/?module=help&guide=collaboration")}>Hilfe & Einstieg</Button>
  </PageHeader>
  {#if role === "personnel"}
    <p class="muted">
      Prüfe die Zeiten und Abwesenheiten deines berechtigten Teams. Fach- und Budgetdaten bleiben in
      den zuständigen Bereichen.
    </p>
    <div class="toolbar">
      <Button variant="primary" onClick={() => navigate("time")}
        ><Clock3 size={16} />Teamzeiten prüfen</Button
      >
      <Button onClick={() => navigate("calendar")}
        ><CalendarDays size={16} />Dienste & Abwesenheiten</Button
      >
      <Button onClick={() => navigate("exports")}>Nachweise exportieren</Button>
    </div>
    <Section title="Dein Team" meta={`${active.length} aktive Zugänge`}>
      <div class="panel-content">
        <p>
          Wähle in den Teamzeiten die Person und den Zeitraum. Dort kannst du Buchungen prüfen und
          zulässige Korrekturen vornehmen.
        </p>
      </div>
    </Section>
    <Section title="Kommende Abwesenheiten" meta={`${futureAbsences.length} im geladenen Zeitraum`}>
      {#if futureAbsences.length}<div class="list">
          {#each futureAbsences.slice(0, 8) as row (row.id)}
            <div class="notification-row">
              <Users size={18} />
              <div>
                <strong
                  >{workspace.members.find((member) => member.id === row.data.userId)?.name ||
                    "Teammitglied"}</strong
                >
                <p class="small muted">
                  {String(row.data.start || "")} – {String(row.data.end || "")}
                </p>
              </div>
            </div>
          {/each}
        </div>{:else}<Empty
          title="Keine kommenden Abwesenheiten geladen."
          description="Im Kalender findest du die Abwesenheiten innerhalb deines Berechtigungsbereichs."
        />{/if}
    </Section>
  {:else}
    <p class="muted">
      Richte Gewerke, Zugänge und Zuständigkeiten ein. Für operative Mitarbeit vergib gezielt eine
      zusätzliche Fachrolle.
    </p>
    <div class="toolbar">
      <Button variant="primary" onClick={() => navigate("/?module=theater&view=administration")}
        ><Settings size={16} />Einrichtung öffnen</Button
      ><Button onClick={() => navigate("settings")}><Users size={16} />Zugänge verwalten</Button>
    </div>
    <Section title="Einrichtung in drei Schritten">
      <div class="panel-content">
        <ol>
          <li>Aktive Gewerke und gemeinsame Ressourcen festlegen.</li>
          <li>
            Personen einladen und Rollen mit passendem Gewerk- oder Produktionsbezug zuweisen.
          </li>
          <li>
            Dienstregeln und Bereitschaft gemeinsam mit den verantwortlichen Leitungen bestätigen.
          </li>
        </ol>
      </div>
    </Section>
  {/if}
</div>
