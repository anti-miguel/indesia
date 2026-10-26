<script>
  import { onMount, onDestroy } from "svelte";
  import {
    currentDocumentData,
    analysisResults,
    validationResults,
    extractedElements,
    aiProcessing,
    aiServiceInstance,
  } from "./stores.js";
  import {
    setAnalysisResult,
    setValidationResult,
    setExtractedElements,
    showNotification,
  } from "./stores.js";
  import { documentService } from "./services/documentService.js";
  import {
    ZoomIn,
    ZoomOut,
    RotateCw,
    Download,
    RefreshCw,
    FileText,
    BarChart3,
    Loader,
  } from "lucide-svelte";

  let imageContainer;
  let scale = 1;
  let rotation = 0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let currentPage = 1;
  let analyzing = false;
  let currentPageData = null;
  let imageElement = null;
  let isLoading = false;

  $: document = $currentDocumentData;
  $: analysis = document ? $analysisResults[document.id] : null;
  $: validation = document ? $validationResults[document.id] : null;
  $: elements = document ? $extractedElements[document.id] : null;

  // Watch for document changes
  $: if (document) {
    currentPage = 1;
    loadCurrentPage();
  }

  $: if (document && currentPage) {
    loadCurrentPage();
  }

  onMount(() => {
    if (document) {
      loadCurrentPage();
    }
  });

  async function loadCurrentPage() {
    if (!document) return;

    isLoading = true;
    console.log("Loading page:", currentPage, "for document:", document.name);

    try {
      const pageData = await documentService.getPageData(document, currentPage);
      console.log("Page data loaded:", pageData);

      if (pageData) {
        currentPageData = pageData;

        // Create image element for display
        if (pageData.imageUrl) {
          console.log("Using imageUrl:", pageData.imageUrl);
          createImageElement(pageData.imageUrl);
        } else if (pageData.canvas) {
          console.log("Converting canvas to image URL");
          const imageUrl = pageData.canvas.toDataURL("image/png");
          createImageElement(imageUrl);
        } else {
          console.warn("No image data available for page");
          currentPageData = null;
        }
      } else {
        console.warn("No page data available");
        currentPageData = null;
      }
    } catch (error) {
      console.error("Failed to load page:", error);
      showNotification(`Failed to load page: ${error.message}`, "error");
      currentPageData = null;
    } finally {
      isLoading = false;
    }
  }

  function createImageElement(src) {
    if (imageElement) {
      imageElement.onload = null;
      imageElement.onerror = null;
    }

    imageElement = new Image();
    imageElement.onload = () => {
      console.log(
        "Image loaded successfully:",
        imageElement.width,
        "x",
        imageElement.height,
      );
      // Trigger reactivity
      imageElement = imageElement;
    };
    imageElement.onerror = (error) => {
      console.error("Failed to load image:", error);
      showNotification("Failed to load document image", "error");
      imageElement = null;
    };
    imageElement.src = src;
  }

  // Control functions
  function handleZoomIn() {
    scale = Math.min(scale * 1.2, 5);
  }

  function handleZoomOut() {
    scale = Math.max(scale / 1.2, 0.1);
  }

  function handleRotate() {
    rotation = (rotation + 90) % 360;
  }

  function handleReset() {
    scale = 1;
    rotation = 0;
    panX = 0;
    panY = 0;
  }

  function handleMouseDown(e) {
    if (!imageElement) return;
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function handleMouseMove(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    panX += deltaX;
    panY += deltaY;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function nextPage() {
    if (document && currentPage < document.pageCount) {
      currentPage++;
    }
  }

  function prevPage() {
    if (document && currentPage > 1) {
      currentPage--;
    }
  }

  async function runAnalysis() {
    // Check if we have an image to analyze
    if (!imageElement || !imageElement.src) {
      showNotification(
        "Please wait for the document image to load before analyzing.",
        "warning",
      );
      return;
    }

    if (!document || !$aiServiceInstance || analyzing) return;

    analyzing = true;

    try {
      showNotification("Starting document analysis...", "info");

      // Extract document text and elements
      const text = await documentService.extractText(document);
      const pidElements = documentService.extractPIDElements(text);

      // Store extracted elements
      setExtractedElements(document.id, pidElements);

      // Run AI analysis if available
      if (
        !$aiServiceInstance ||
        typeof $aiServiceInstance.analyzeBlueprint !== "function"
      ) {
        throw new Error(
          "AI service is not fully initialized. Please wait a moment and try again.",
        );
      }

      const analysis = await $aiServiceInstance.analyzeBlueprint(
        imageElement.src,
        text,
      );
      setAnalysisResult(document.id, analysis);

      showNotification("Analysis completed successfully", "success");
    } catch (error) {
      console.error("Analysis failed:", error);
      showNotification(`Analysis failed: ${error.message}`, "error");
    } finally {
      analyzing = false;
    }
  }

  function downloadDocument() {
    if (!document || !imageElement) return;

    try {
      const link = document.createElement("a");
      link.href = imageElement.src;
      link.download = `${document.name.split(".")[0]}_page_${currentPage}.png`;
      link.click();
    } catch (error) {
      console.error("Download failed:", error);
      showNotification("Download failed", "error");
    }
  }
  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.min(Math.max(scale * delta, 0.1), 5);
  }
</script>

<svelte:window
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:keydown={(e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "-")) {
      e.preventDefault();
      if (e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
    }
  }}
/>

<div class="h-full flex flex-col bg-base-100" on:wheel={handleWheel}>
  {#if document}
    <!-- Toolbar -->
    <div
      class="border-b border-base-content/10 p-3 flex items-center justify-between bg-base-100"
    >
      <div class="flex items-center gap-3">
        <h3 class="font-medium truncate max-w-xs">{document.name}</h3>

        {#if document.pageCount > 1}
          <div class="flex items-center gap-2">
            <button
              class="btn btn-xs btn-outline"
              on:click={prevPage}
              disabled={currentPage <= 1}
            >
              ←
            </button>
            <span class="text-sm">
              Page {currentPage} of {document.pageCount}
            </span>
            <button
              class="btn btn-xs btn-outline"
              on:click={nextPage}
              disabled={currentPage >= document.pageCount}
            >
              →
            </button>
          </div>
        {/if}

        {#if isLoading}
          <div class="flex items-center gap-2 text-base-content/60">
            <Loader size={14} class="animate-spin" />
            <span class="text-xs">Loading...</span>
          </div>
        {/if}
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-1">
        <button
          class="btn btn-sm btn-ghost"
          on:click={handleZoomOut}
          disabled={scale <= 0.1}
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>

        <span class="text-xs px-2 py-1 bg-base-200 rounded">
          {Math.round(scale * 100)}%
        </span>

        <button
          class="btn btn-sm btn-ghost"
          on:click={handleZoomIn}
          disabled={scale >= 5}
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>

        <div class="divider divider-horizontal mx-1"></div>

        <button
          class="btn btn-sm btn-ghost"
          on:click={handleRotate}
          title="Rotate"
        >
          <RotateCw size={16} />
        </button>

        <button
          class="btn btn-sm btn-ghost"
          on:click={handleReset}
          title="Reset view"
        >
          <RefreshCw size={16} />
        </button>

        <div class="divider divider-horizontal mx-1"></div>

        <button
          class="btn btn-sm btn-primary"
          on:click={runAnalysis}
          disabled={analyzing || $aiProcessing}
          title="Analyze document"
        >
          {#if analyzing}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <BarChart3 size={16} />
          {/if}
        </button>

        <button
          class="btn btn-sm btn-ghost"
          on:click={downloadDocument}
          disabled={!imageElement}
          title="Download"
        >
          <Download size={16} />
        </button>
      </div>
    </div>

    <!-- Document Viewer -->
    <div
      class="flex-1 relative overflow-hidden bg-base-200"
      bind:this={imageContainer}
    >
      {#if imageElement && !isLoading}
        <div
          class="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
          on:mousedown={handleMouseDown}
          style="transform: translate({panX}px, {panY}px) scale({scale}) rotate({rotation}deg); transform-origin: center;"
        >
          <!-- svelte-ignore a11y-missing-attribute -->
          <img
            src={imageElement.src}
            class="max-w-none max-h-none select-none"
            draggable="false"
            alt="P&ID Document"
            style="width: auto; height: auto;"
          />
        </div>
      {:else if isLoading}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <Loader size={32} class="animate-spin text-primary mx-auto mb-2" />
            <div class="text-base-content/60">Loading document...</div>
          </div>
        </div>
      {:else}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <FileText size={48} class="mx-auto mb-4 text-base-content/30" />
            <div class="text-base-content/60">No image data available</div>
            <button
              class="btn btn-sm btn-outline mt-2"
              on:click={loadCurrentPage}
            >
              Retry
            </button>
          </div>
        </div>
      {/if}

      <!-- Overlay indicators -->
      {#if analysis}
        <div
          class="absolute top-4 left-4 bg-success/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs"
        >
          ✓ Analyzed
        </div>
      {/if}

      {#if elements}
        <div
          class="absolute top-4 right-4 bg-primary/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs"
        >
          {Object.values(elements).flat().length} Elements Found
        </div>
      {/if}

      {#if document?.colorDetection}
        <div
          class="absolute bottom-4 left-4 bg-base-100/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs border border-base-content/20"
        >
          {#if document.colorDetection.analysis === "colored"}
            🎨 Colored Document
          {:else if document.colorDetection.analysis === "mixed"}
            📄 Mixed Content
          {:else}
            📄 Black & White
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <!-- No document selected -->
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <FileText size={48} class="mx-auto mb-4 text-base-content/30" />
        <h3 class="text-lg font-medium text-base-content/60">
          No document selected
        </h3>
        <p class="text-sm text-base-content/40">
          Upload and select a document to view it here.
        </p>
      </div>
    </div>
  {/if}
</div>

<style>
  .cursor-grab {
    cursor: grab;
  }

  .cursor-grabbing {
    cursor: grabbing;
  }

  img {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
</style>
