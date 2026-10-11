<script lang="ts">
  import {
    chartMaximum,
    chartPointLabel,
    overviewNumber,
    type OverviewChartPoint,
  } from "@/shared/overview-presentation";
  export let title: string;
  export let points: OverviewChartPoint[];
  export let unit = "";
  export let minimumMaximum = 0;
  $: maximum = chartMaximum(points, minimumMaximum);
  $: step = 464 / Math.max(points.length, 1);
  $: barWidth = Math.min(64, step * 0.6);
  const tickLabel = (value: number) => overviewNumber(value, value < 10 ? 1 : 0);
</script>

<figure class="overview-chart" class:chart-many-points={points.length > 3} aria-label={title}>
  <svg
    viewBox="0 0 560 228"
    role="img"
    aria-label={`${title}${unit ? ` in ${unit}` : ""}. Werte stehen in der Tabelle darunter.`}
  >
    <title>{title}</title>
    {#each [0, 0.5, 1] as fraction}
      <line
        x1="68"
        x2="532"
        y1={182 - fraction * 140}
        y2={182 - fraction * 140}
        class="chart-grid"
      />
      <text x="58" y={186 - fraction * 140} text-anchor="end" class="chart-axis"
        >{tickLabel(maximum * fraction)}</text
      >
    {/each}
    {#each points as point, index (point.label)}
      {@const center = 68 + step * (index + 0.5)}
      {@const height =
        point.value === null ? 0 : Math.min(140, Math.max(0, (point.value / maximum) * 140))}
      {#if point.value !== null}
        <rect
          x={center - barWidth / 2}
          y={182 - height}
          width={barWidth}
          {height}
          rx="3"
          class="chart-bar"
          ><title>{point.label}: {chartPointLabel(point.value, unit)}{unit ? ` ${unit}` : ""}</title
          ></rect
        >
        {#if points.length <= 6}<text
            x={center}
            y={Math.max(25, 172 - height)}
            text-anchor="middle"
            class="chart-value">{chartPointLabel(point.value, unit)}{unit === "%" ? " %" : ""}</text
          >{/if}
      {:else}<text x={center} y="171" text-anchor="middle" class="chart-axis">—</text>{/if}
      <text
        x={center}
        y="210"
        text-anchor="middle"
        class="chart-axis"
        class:chart-optional-label={points.length > 6 && index % 2 === 1}>{point.label}</text
      >
    {/each}
  </svg>
  <details class="chart-data">
    <summary>Diagrammwerte als Tabelle</summary>
    <table>
      <caption class="sr-only">{title}</caption><thead
        ><tr><th scope="col">Monat</th><th scope="col">Wert{unit ? ` (${unit})` : ""}</th></tr
        ></thead
      ><tbody
        >{#each points as point (point.label)}<tr
            ><th scope="row">{point.label}</th><td
              >{point.value === null
                ? "Keine Berichtsdaten"
                : chartPointLabel(point.value, unit)}</td
            ></tr
          >{/each}</tbody
      >
    </table>
  </details>
  <figcaption>
    {points.filter((point) => point.value !== null).length === 1
      ? "Ein Monat mit Berichten. Für einen Verlauf werden weitere Monate benötigt."
      : "Nur Monate mit abgeschlossenen Berichten. — bedeutet: keine Berichtsdaten."}
  </figcaption>
</figure>
