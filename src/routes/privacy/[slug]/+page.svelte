<script lang="ts">
  import { BrandMark } from "@/components/brand-mark";
  import type { PageData } from "./$types";
  export let data: PageData;
  const groups: Record<string, string> = {
    employees: "Beschäftigte",
    actors: "Schauspielerinnen und Schauspieler",
    contacts: "Externe Ansprechpersonen",
  };
</script>

<svelte:head
  ><title>Datenschutzinformation · Showtime</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<main class="privacy-notice">
  <a class="brand" href="/login"><BrandMark /><span>showtime</span></a>
  <h1>Datenschutzinformation</h1>
  {#if data.notice}
    <p>
      {data.notice.theater} · Stand {new Date(data.notice.published).toLocaleDateString("de-DE")}
    </p>
    <section>
      <h2>Wer verantwortlich ist</h2>
      <p>{data.notice.controller.name}<br />{data.notice.controller.address}</p>
      <p>Datenschutzkontakt: {data.notice.controller.contact}</p>
      {#if data.notice.controller.dpo}<p>
          Datenschutzbeauftragte: {data.notice.controller.dpo}
        </p>{/if}
    </section>
    <p class="prose">{data.notice.notice}</p>
    {#each data.notice.purposes as purpose}<section>
        <h2>{groups[purpose.group] || purpose.group}</h2>
        <dl>
          <dt>Wofür</dt>
          <dd>{purpose.purpose}</dd>
          <dt>Rechtsgrundlage</dt>
          <dd>{purpose.basis}</dd>
          <dt>Empfänger</dt>
          <dd>{purpose.recipients}</dd>
          <dt>Aufbewahrung</dt>
          <dd>{purpose.retention}</dd>
        </dl>
        <p>{purpose.notice}</p>
      </section>{/each}
    <section>
      <h2>Deine Rechte</h2>
      <p>
        Du kannst Auskunft, Berichtigung, Löschung oder Einschränkung verlangen und dich an die
        zuständige Datenschutzaufsicht wenden. Je nach Verarbeitung bestehen außerdem Rechte auf
        Datenübertragbarkeit und Widerspruch. Eine Anfrage ist auch ohne Showtime-Konto möglich.
      </p>
      <p>Kontakt: {data.notice.rightsContact}</p>
    </section>
  {:else}<section>
      <h2>Angaben werden eingerichtet</h2>
      <p>
        Für dieses Theater liegt noch keine veröffentlichte Datenschutzinformation vor. Wende dich
        bitte an die Theaterverwaltung, um den verantwortlichen Träger und Datenschutzkontakt zu
        erhalten.
      </p>
    </section>{/if}
  <a href="/login">Zur Anmeldung</a>
</main>

<style>
  .privacy-notice {
    max-width: 48rem;
    margin: 3rem auto;
    padding: 1.5rem;
    display: grid;
    gap: 1.75rem;
    line-height: 1.65;
  }
  .privacy-notice h1 {
    font-size: 1.8rem;
  }
  .privacy-notice h2 {
    font-size: 1.2rem;
    margin-bottom: 1rem;
  }
  .privacy-notice section {
    padding: 1.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .privacy-notice dd {
    margin: 0 0 1rem;
  }
  .privacy-notice dt {
    font-weight: 600;
  }
  .prose {
    white-space: pre-line;
  }
</style>
