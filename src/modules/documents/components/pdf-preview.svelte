<script lang="ts">
  import { onMount } from "svelte";
  import { ChevronLeft, ChevronRight, Loader2 } from "@lucide/svelte";
  import { Button } from "@/components/ui";
  import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
  import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

  export let fileId: string;
  export let page = 1;
  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;
  let scrollContainer: HTMLDivElement;
  let displayedPage = 0;
  let width = 0;
  let ready = false;
  let loading = true;
  let error = "";
  let pageCount = 1;
  let pageText = "";
  let document: PDFDocumentProxy | undefined;
  let loadingTask: PDFDocumentLoadingTask | undefined;
  let rendering: RenderTask | undefined;
  let generation = 0;
  let stopped = false;

  async function paint(selectedPage: number, availableWidth: number) {
    if (!document || !canvas || availableWidth < 1) return;
    const current = ++generation;
    const previous = rendering;
    previous?.cancel();
    loading = true;
    error = "";
    try {
      await previous?.promise.catch(() => {});
      const sheet = await document.getPage(selectedPage);
      if (stopped || current !== generation) return;
      const original = sheet.getViewport({ scale: 1 });
      const viewport = sheet.getViewport({
        scale: Math.min(Math.min(availableWidth, 1000) / original.width, 2000 / original.height),
      });
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * density);
      canvas.height = Math.floor(viewport.height * density);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      rendering = sheet.render({
        canvas,
        viewport,
        transform: density === 1 ? undefined : [density, 0, 0, density, 0, 0],
      });
      await rendering.promise;
      const text = await sheet.getTextContent();
      if (stopped || current !== generation) return;
      if (selectedPage !== displayedPage) {
        scrollContainer.scrollTop = 0;
        displayedPage = selectedPage;
      }
      pageText = text.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("");
    } catch {
      if (!stopped && current === generation)
        error =
          "Diese Seite konnte nicht angezeigt werden. Du kannst die Originaldatei öffnen oder herunterladen.";
    } finally {
      if (!stopped && current === generation) loading = false;
    }
  }

  onMount(() => {
    let resizeFrame = 0;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width || 0);
      if (nextWidth === width) return;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        width = nextWidth;
      });
    });
    observer.observe(container);
    void (async () => {
      try {
        const pdf = await import("pdfjs-dist");
        if (stopped) return;
        pdf.GlobalWorkerOptions.workerSrc = workerUrl;
        loadingTask = pdf.getDocument({
          url: `/api/files/${fileId}`,
          withCredentials: true,
          enableXfa: false,
          useSystemFonts: true,
          useWasm: false,
        });
        document = await loadingTask.promise;
        if (stopped) return;
        pageCount = document.numPages;
        page = Math.min(pageCount, Math.max(1, page));
        ready = true;
      } catch {
        if (!stopped) {
          error =
            "Die Vorschau ist gerade nicht verfügbar. Öffne die Originaldatei oder lade sie herunter.";
          loading = false;
        }
      }
    })();
    return () => {
      stopped = true;
      generation++;
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      rendering?.cancel();
      void loadingTask?.destroy().catch(() => {});
    };
  });

  $: if (ready && width > 0) void paint(page, width);
</script>

<div class="pdf-preview">
  <nav class="pdf-preview-pages" aria-label="PDF-Seiten">
    <Button aria-label="Vorherige PDF-Seite" disabled={!ready || page <= 1} onClick={() => page--}>
      <ChevronLeft size={16} />
    </Button>
    <span aria-live="polite">Seite {page} von {pageCount}</span>
    <Button
      aria-label="Nächste PDF-Seite"
      disabled={!ready || page >= pageCount}
      onClick={() => page++}
    >
      <ChevronRight size={16} />
    </Button>
  </nav>
  <div class="pdf-preview-scroll" bind:this={scrollContainer}>
    <div class="pdf-preview-page" bind:this={container} aria-busy={loading}>
      {#if loading}<p class="pdf-preview-message" role="status">
          <Loader2 size={18} class="spin" /> PDF wird geladen …
        </p>{/if}
      {#if error}<p class="pdf-preview-message" role="alert">{error}</p>{/if}
      <canvas
        bind:this={canvas}
        aria-label={`PDF-Vorschau, Seite ${page}`}
        hidden={!ready || !!error}>Der Text dieser Seite steht unter „Text der Seite“.</canvas
      >
    </div>
    {#if pageText && !error}<details class="pdf-preview-text">
        <summary>Text der Seite</summary>
        <p>{pageText}</p>
      </details>{/if}
  </div>
</div>
