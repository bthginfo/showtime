<script lang="ts">
  import { onMount, tick } from "svelte";
  import { ArrowRight, BookOpen, Check, Compass } from "@lucide/svelte";
  import { Button } from "@/components/ui";
  import { useWorkspace } from "@/components/workspace-context";
  import { scopedBrowserKey } from "@/shared/browser-scope";
  import { tradeGuides } from "@/shared/trade-guides";
  import PracticeGuide from "./practice-guide.svelte";
  export let moduleId = "makeup";
  export let compact = false;
  export let showPrompt = true;
  export let onOpen: (view: string) => void = () => {};
  const store = useWorkspace();
  let active = false,
    step = 0,
    completed = false;
  let heading: HTMLHeadingElement;
  $: guide = tradeGuides[moduleId] || {
    label: $store.workspace.department.name,
    purpose: "Dein Gewerk im gemeinsamen Theaterbetrieb.",
    work: "Facheinträge und offene Punkte pflegen.",
    partners: "Die beteiligten Gewerke",
    example: "Eine Rückmeldung zwischen Gewerken abstimmen",
    target: "makeup",
    check: "Zuständigkeit, Termin und Rückmeldung sind geklärt.",
  };
  $: steps = [
    {
      title: "Dein Theater und dein Gewerk",
      text: `${guide.purpose} Du arbeitest gerade in ${$store.workspace.organization.name} / ${$store.workspace.department.name}.`,
      view: "trade",
      cta: "Mein Gewerk öffnen",
    },
    {
      title: "Die passende Produktion wählen",
      text: "Wähle die Produktion über dem Fachbereich. So gehören Pläne, Aufträge und Rückmeldungen zum richtigen Stück. Du siehst nur Produktionen, die für dich freigegeben sind.",
      view: "trade",
      cta: "Produktionen und Fachbereich öffnen",
    },
    { title: "Deine tägliche Arbeit", text: guide.work, view: "trade", cta: "Fachbereich öffnen" },
    {
      title: "Mit anderen Gewerken abstimmen",
      text: `${guide.partners} sind typische Partner. Beispiel: ${guide.example}. Unter Zusammenarbeit wählst du Empfänger, Auftrag und Termin; dort bleiben Rückmeldungen und Freigaben zusammen.`,
      view: "collaborations",
      cta: "Zusammenarbeit öffnen",
    },
    {
      title: "Bereitschaft bewusst bestätigen",
      text: `${guide.check} Die Teamleitung bestätigt die Bereitschaft im Fachbereich. Offene erforderliche Gewerke verhindern den Wechsel zur Generalprobe und zum Spielbetrieb.`,
      view: "readiness",
      cta: "Bereitschaft ansehen",
    },
  ];
  function save() {
    try {
      localStorage.setItem(
        scopedBrowserKey(`trade-onboarding:${moduleId}:v1`),
        JSON.stringify({ step, completed }),
      );
    } catch {
      /* The guide also works without local storage. */
    }
  }
  onMount(() => {
    try {
      const raw = JSON.parse(
        localStorage.getItem(scopedBrowserKey(`trade-onboarding:${moduleId}:v1`)) || "{}",
      );
      step = Number.isInteger(raw.step) ? Math.min(4, Math.max(0, raw.step)) : 0;
      completed = raw.completed === true;
    } catch {
      /* Start fresh if the device has no saved progress. */
    }
  });
  async function change(next: number) {
    step = next;
    save();
    await tick();
    heading?.focus();
  }
  async function start() {
    active = true;
    if (completed) {
      step = 0;
      completed = false;
    }
    await tick();
    heading?.focus();
  }
</script>

{#if (!compact || active || !completed) && (showPrompt || active)}
  <section class="trade-onboarding panel" aria-label={`Einführung ${guide.label}`}>
    {#if active}
      <div class="section-heading">
        <span class="small muted" role="status"
          >{guide.label} · Schritt {step + 1} von {steps.length}</span
        ><Button
          onClick={() => {
            active = false;
            save();
          }}>Später fortsetzen</Button
        >
      </div>
      <progress max={steps.length} value={step + 1} aria-label="Fortschritt der Einführung"
      ></progress>
      <h3 bind:this={heading} tabindex="-1">{steps[step].title}</h3>
      <p>{steps[step].text}</p>
      <div class="trade-guide-actions">
        <Button onClick={() => onOpen(steps[step].view)}
          ><ArrowRight size={16} />{steps[step].cta}</Button
        ><span class="action-spacer"></span>{#if step > 0}<Button
            onClick={() => void change(step - 1)}>Zurück</Button
          >{/if}<Button
          variant="primary"
          onClick={() => {
            if (step < steps.length - 1) void change(step + 1);
            else {
              completed = true;
              active = false;
              save();
            }
          }}
          >{step === steps.length - 1
            ? "Einführung abschließen"
            : "Weiter"}{#if step === steps.length - 1}<Check size={16} />{/if}</Button
        >
      </div>
    {:else}
      <div class="trade-guide-intro">
        <BookOpen size={23} />
        <div>
          <h3>
            {completed ? `Dein Leitfaden für ${guide.label}` : `Dein Einstieg in ${guide.label}`}
          </h3>
          <p class="muted">{guide.purpose}</p>
        </div>
        <Button onClick={() => void start()}
          ><Compass size={16} />{completed
            ? "Einführung erneut starten"
            : step > 0
              ? "Einführung fortsetzen"
              : "Geführt starten"}</Button
        >
      </div>
      {#if !compact}<div class="trade-guide-copy">
          <h4>Im Arbeitsalltag</h4>
          <p>{guide.work}</p>
          <h4>Typische Zusammenarbeit</h4>
          <p>{guide.partners}: {guide.example}.</p>
          <h4>Vor Übergabe und Spielbetrieb</h4>
          <p>{guide.check}</p>
          <p class="small muted">
            Dein Einführungsfortschritt wird auf diesem Gerät getrennt nach Theater, Zugang und
            Gewerk gespeichert. Deine Rolle bestimmt, welche Aktionen du ausführen kannst.
          </p>
        </div>{/if}
    {/if}
  </section>
{/if}
{#if !compact}{#key moduleId}<PracticeGuide {moduleId} />{/key}{/if}
