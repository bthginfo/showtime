<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import { ArrowUpRight, BookOpen, ChevronRight, Compass, Search } from "@lucide/svelte";
import { Button, Empty, PageHeader } from "@/components/ui";
import { helpArticles, helpFaq } from "../content";
import { helpTutorials, type HelpTutorial } from "../tutorials";
import { FeedbackPanel } from "./feedback-panel";
import { HelpTutorialList, HelpTutorialPlayer } from "./help-tutorials";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
const effects=createEffects();
type ViewProps = {
    navigate: (module: string) => void;
    onStartTour: () => void;
    initialGuide?: string;
};
export let navigate: ViewProps["navigate"] = undefined as any;
export let onStartTour: ViewProps["onStartTour"] = undefined as any;
export let initialGuide: ViewProps["initialGuide"] = undefined as any;
let tab: string = "guides";
const setTab = (next: typeof tab | ((current: typeof tab) => typeof tab)) => { tab = typeof next === "function" ? (next as (current: typeof tab) => typeof tab)(tab) : next; };
let search: string = "";
const setSearch = (next: typeof search | ((current: typeof search) => typeof search)) => { search = typeof next === "function" ? (next as (current: typeof search) => typeof search)(search) : next; };
let selected = (() => helpArticles.find((article) => article.id === initialGuide)?.id ?? helpArticles[0].id)();
const setSelected = (next: typeof selected | ((current: typeof selected) => typeof selected)) => { selected = typeof next === "function" ? (next as (current: typeof selected) => typeof selected)(selected) : next; };
let playing: HelpTutorial | null = initialState<HelpTutorial | null>(null);
const setPlaying = (next: HelpTutorial | null | ((current: HelpTutorial | null) => HelpTutorial | null)) => { playing = typeof next === "function" ? (next as (current: HelpTutorial | null) => HelpTutorial | null)(playing) : next; };
let query = search.trim().toLowerCase();
let articles = helpArticles.filter((article) => `${article.title} ${article.intro} ${article.steps.join(" ")} ${helpTutorials
    .filter((tutorial) => tutorial.guideId === article.id)
    .map((tutorial) => `${tutorial.title} ${tutorial.description} ${tutorial.steps.join(" ")}`)
    .join(" ")}`
    .toLowerCase()
    .includes(query));
let article = articles.find((article) => article.id === selected) || articles[0];
let faq = helpFaq.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(query));
let tutorials = helpTutorials.filter((tutorial) => `${tutorial.title} ${tutorial.description} ${tutorial.steps.join(" ")} ${tutorial.platform === "ios"
    ? "iPhone iPad iOS Apple"
    : tutorial.platform === "android"
        ? "Android"
        : "alle Geräte"}`
    .toLowerCase()
    .includes(query));

$: query = search.trim().toLowerCase();
$: articles = helpArticles.filter((article) => `${article.title} ${article.intro} ${article.steps.join(" ")} ${helpTutorials
    .filter((tutorial) => tutorial.guideId === article.id)
    .map((tutorial) => `${tutorial.title} ${tutorial.description} ${tutorial.steps.join(" ")}`)
    .join(" ")}`
    .toLowerCase()
    .includes(query));
$: article = articles.find((article) => article.id === selected) || articles[0];
$: faq = helpFaq.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(query));
$: tutorials = helpTutorials.filter((tutorial) => `${tutorial.title} ${tutorial.description} ${tutorial.steps.join(" ")} ${tutorial.platform === "ios"
    ? "iPhone iPad iOS Apple"
    : tutorial.platform === "android"
        ? "Android"
        : "alle Geräte"}`
    .toLowerCase()
    .includes(query));

</script>


      <PageHeader eyebrow="SICHER DURCH DEN ARBEITSALLTAG" title="Hilfe & Orientierung" >
        <Button onClick={onStartTour}>
          <Compass size={17}></Compass>
          Einführung neu starten
        </Button>
      </PageHeader>
      <div class="help-welcome">
        <BookOpen size={26} strokeWidth={1.6}></BookOpen>
        <div>
          <h2>Gut zu wissen, schnell zu finden.</h2>
          <p>Wähle eine Anleitung oder suche nach deinem nächsten Arbeitsschritt.</p>
        </div>
      </div>
      <div class="tabs help-tabs" aria-label="Hilfebereiche">
        {#each [
    ["guides", "Anleitungen"],
    ["videos", "Kurzvideos"],
    ["faq", "Häufige Fragen"],
    ["feedback", "Ideen & Fehler"],
] as [id, label] (id)}<button class={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} on:click={() => {
    setTab(id);
    setSearch("");
    setPlaying(null);
}}>
            {label}
          </button>{/each}
      </div>
      {#if tab !== "feedback"}<div class="help-search">
          <Search size={18}></Search>
          <input aria-label="Hilfe durchsuchen" placeholder="Zum Beispiel App installieren, Bilder oder Freiwunsch …" value={search} on:input={(event) => {
    setSearch(event.currentTarget.value);
    setPlaying(null);
}} />
        </div>{/if}
      {#if tab === "feedback"}<FeedbackPanel></FeedbackPanel>{:else}{#if tab === "videos"}<HelpTutorialList tutorials={tutorials} onOpen={setPlaying}></HelpTutorialList>{:else}{#if tab === "faq"}<section class="faq-list" aria-label="Häufige Fragen">
          {#if faq.length}{#each faq as [question, answer] (question)}<details>
                <summary>
                  {question}
                  <ChevronRight size={18}></ChevronRight>
                </summary>
                <p>{answer}</p>
              </details>{/each}{:else}<Empty title="Keine passende Antwort gefunden." description="Versuche einen anderen Begriff oder teile dein Anliegen unter Ideen & Fehler."></Empty>{/if}
        </section>{:else}{#if article}<div class="help-layout">
          <nav class="help-article-nav" aria-label="Anleitungen">
            {#each articles as item (item.id)}<button class={item.id === article.id ? "active" : ""} aria-current={item.id === article.id ? "page" : undefined} on:click={() => {
    setSelected(item.id);
    setPlaying(null);
}}>
                {item.title}
                <ChevronRight size={15}></ChevronRight>
              </button>{/each}
          </nav>
          <label class="help-mobile-select">
            Anleitung auswählen
            <select value={article.id} on:change={(event) => {
    setSelected(event.currentTarget.value);
    setPlaying(null);
}}>
              {#each articles as item (item.id)}<option value={item.id}>
                  {item.title}
                </option>{/each}
            </select>
          </label>
          <article class="help-article">
            <header>
              <p class="eyebrow">ARBEITSANLEITUNG</p>
              <h2>{article.title}</h2>
              <p class="muted">{article.intro}</p>
            </header>
            <HelpTutorialList tutorials={helpTutorials.filter((tutorial) => tutorial.guideId === article.id)} onOpen={setPlaying} compact></HelpTutorialList>
            <ol>
              {#each article.steps as step (step)}<li>{step}</li>{/each}
            </ol>
            {#if article.note}<p class="help-note">{article.note}</p>{/if}
            <footer>
              <Button onClick={() => navigate(article.module)}>
                Bereich öffnen
                <ArrowUpRight size={16}></ArrowUpRight>
              </Button>
              <button class="text-button" on:click={() => {
    setTab("feedback");
    setPlaying(null);
}}>
                Noch Fragen oder eine Idee?
              </button>
            </footer>
          </article>
        </div>{:else}<Empty title="Keine passende Anleitung gefunden." description="Versuche einen anderen Begriff. Unter Ideen & Fehler kannst du dein Anliegen beschreiben."></Empty>{/if}{/if}{/if}{/if}
      {#if playing}{#key playing.id}<HelpTutorialPlayer tutorial={playing} onClose={() => setPlaying(null)}></HelpTutorialPlayer>{/key}{/if}
