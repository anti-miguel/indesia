<script>
  import { onMount, afterUpdate } from "svelte";
  import {
    documents,
    selectedDocuments,
    analysisResults,
    validationResults,
    extractedElements,
    aiServiceInstance,
  } from "./stores.js";
  import { showNotification } from "./stores.js";
  import { documentService } from "./services/documentService.js";
  import {
    GitCompare,
    FileText,
    BarChart3,
    AlertTriangle,
    CheckCircle,
    ArrowRight,
    Shuffle,
    ZoomIn,
    ZoomOut,
    RotateCw,
    RefreshCw,
    Eye,
    EyeOff,
    Settings,
    Info,
  } from "lucide-svelte";

  let selectedDoc1 = null; // Black & White document
  let selectedDoc2 = null; // Colored document
  let comparisonResult = null;
  let isComparing = false;

  // Canvas and display state
  let canvas1, canvas2, ctx1, ctx2;
  let scale = 1;
  let panX1 = 0,
    panY1 = 0,
    panX2 = 0,
    panY2 = 0;
  let isDragging1 = false,
    isDragging2 = false;
  let lastMouseX = 0,
    lastMouseY = 0;
  let currentPage = 1;
  let showDifferences = true;
  let showOverlay = true;
  let differenceThreshold = 30; // Threshold for pixel difference detection
  let colorAnalysis = null;
  let mounted = false;
  let renderScheduled = false;

  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.1), 5);

    if (newScale !== scale) {
      scale = newScale;
      if (!renderScheduled) {
        renderScheduled = true;
        requestAnimationFrame(() => {
          renderComparison();
          renderScheduled = false;
        });
      }
    }
  }

  // Computed values
  $: availableDocs = $documents.filter((doc) => doc.processed);
  $: doc1Data = selectedDoc1
    ? availableDocs.find((d) => d.id === selectedDoc1)
    : null;
  $: doc2Data = selectedDoc2
    ? availableDocs.find((d) => d.id === selectedDoc2)
    : null;
  $: doc1Analysis = selectedDoc1 ? $analysisResults[selectedDoc1] : null;
  $: doc2Analysis = selectedDoc2 ? $analysisResults[selectedDoc2] : null;

  onMount(() => {
    mounted = true;
    setupCanvases();
    // Auto-select first two documents if available
    if ($selectedDocuments.length >= 2) {
      selectedDoc1 = $selectedDocuments[0];
      selectedDoc2 = $selectedDocuments[1];
    } else if (availableDocs.length >= 2) {
      selectedDoc1 = availableDocs[0].id;
      selectedDoc2 = availableDocs[1].id;
    }
  });

  afterUpdate(() => {
    // Only setup canvases if they're not already set up
    if (canvas1 && canvas2 && (!ctx1 || !ctx2)) {
      setupCanvases();
    }
  });

  function setupCanvases() {
    if (canvas1 && canvas2) {
      ctx1 = canvas1.getContext("2d");
      ctx2 = canvas2.getContext("2d");

      // Enable image smoothing for better quality
      ctx1.imageSmoothingEnabled = true;
      ctx2.imageSmoothingEnabled = true;
      ctx1.imageSmoothingQuality = "high";
      ctx2.imageSmoothingQuality = "high";
    }
  }

  async function renderDocument(
    ctx,
    pageData,
    width,
    height,
    panX,
    panY,
    overlay = null,
  ) {
    if (!pageData) {
      console.warn("No page data provided to renderDocument");
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const imageAspectRatio = img.width / img.height;
        const isPortrait = imageAspectRatio < 1;

        // For portrait images, we'll rotate 90 degrees
        // So we need to swap width/height for calculations
        const effectiveWidth = isPortrait ? img.height : img.width;
        const effectiveHeight = isPortrait ? img.width : img.height;
        const effectiveAspectRatio = effectiveWidth / effectiveHeight;

        const containerAspectRatio = width / height;

        let renderWidth, renderHeight;

        if (effectiveAspectRatio > containerAspectRatio) {
          renderWidth = width * scale;
          renderHeight = (width / effectiveAspectRatio) * scale;
        } else {
          renderHeight = height * scale;
          renderWidth = height * effectiveAspectRatio * scale;
        }

        const centerX = width / 2;
        const centerY = height / 2;

        ctx.save();
        ctx.translate(centerX + panX, centerY + panY);

        // If portrait, rotate 90 degrees clockwise
        if (isPortrait) {
          ctx.rotate(Math.PI / 2);
        }

        // Draw the image
        ctx.drawImage(
          img,
          -renderWidth / 2,
          -renderHeight / 2,
          renderWidth,
          renderHeight,
        );

        // Draw overlay if provided (with same transformation)
        if (
          overlay &&
          overlay.significantChanges &&
          overlay.significantChanges.length > 0
        ) {
          ctx.strokeStyle = "#ff0080";
          ctx.fillStyle = "rgba(255, 0, 128, 0.3)";
          ctx.lineWidth = 2 / scale;

          overlay.significantChanges.forEach((change) => {
            // Transform pixel coordinates to rendered coordinates
            // If rotated, we need to swap x/y coordinates
            let x, y;
            if (isPortrait) {
              // After 90° rotation: original (x,y) becomes (y, -x)
              // But we need to account for the image being rotated
              x = (change.y / img.height - 0.5) * renderWidth;
              y = -(change.x / img.width - 0.5) * renderHeight;
            } else {
              x = (change.x / img.width - 0.5) * renderWidth;
              y = (change.y / img.height - 0.5) * renderHeight;
            }

            ctx.beginPath();
            ctx.arc(x, y, 5 / scale, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          });
        }

        ctx.restore();
        resolve();
      };

      img.onerror = (e) => {
        console.warn("Failed to load image for rendering:", e);
        resolve();
      };

      if (pageData.imageUrl) {
        img.src = pageData.imageUrl;
      } else if (pageData.canvas) {
        // Fallback to canvas if available
        try {
          const dataUrl = pageData.canvas.toDataURL();
          img.src = dataUrl;
        } catch (e) {
          console.error("Failed to convert canvas to data URL:", e);
          resolve();
        }
      } else {
        console.warn("No image source available in pageData:", pageData);
        resolve();
      }
    });
  }

  function analyzeColorDifferences() {
    if (!canvas1 || !canvas2) return;

    try {
      const imageData1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
      const imageData2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);

      const data1 = imageData1.data;
      const data2 = imageData2.data;

      let totalPixels = 0;
      let differentPixels = 0;
      let significantChanges = [];

      for (let i = 0; i < data1.length; i += 4) {
        totalPixels++;

        const r1 = data1[i],
          g1 = data1[i + 1],
          b1 = data1[i + 2];
        const r2 = data2[i],
          g2 = data2[i + 1],
          b2 = data2[i + 2];

        const diff = Math.sqrt(
          Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2),
        );

        if (diff > differenceThreshold) {
          differentPixels++;

          // Track significant color changes
          if (diff > 100) {
            const x = (i / 4) % canvas1.width;
            const y = Math.floor(i / 4 / canvas1.width);
            significantChanges.push({
              x,
              y,
              diff,
              color1: [r1, g1, b1],
              color2: [r2, g2, b2],
            });
          }
        }
      }

      colorAnalysis = {
        totalPixels,
        differentPixels,
        changePercentage: (differentPixels / totalPixels) * 100,
        significantChanges: significantChanges.slice(0, 100), // Limit to 100 changes for performance
        averageDifference:
          differentPixels > 0
            ? significantChanges.reduce((sum, change) => sum + change.diff, 0) /
              significantChanges.length
            : 0,
      };

      // Draw overlay highlighting differences
      if (showOverlay && significantChanges.length > 0) {
        drawDifferenceOverlay();
      }
    } catch (error) {
      console.warn("Color analysis failed:", error);
    }
  }

  function drawDifferenceOverlay() {
    if (!colorAnalysis || !showOverlay || !canvas2 || !ctx2) return;
    if (colorAnalysis.significantChanges.length === 0) return;

    // We need to redraw the entire canvas with the overlay
    // because the overlay needs to use the same transform as the image
    const pageData = doc2Data?.pages?.[0] || doc2Data;
    if (!pageData || !pageData.imageUrl) return;

    const img = new Image();
    img.onload = () => {
      // Clear and redraw with overlay
      ctx2.fillStyle = "#ffffff";
      ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

      // Calculate render dimensions (same logic as renderDocument)
      const imageAspectRatio = img.width / img.height;
      const containerAspectRatio = canvas2.width / canvas2.height;
      let renderWidth, renderHeight;

      if (imageAspectRatio > containerAspectRatio) {
        renderWidth = canvas2.width * scale;
        renderHeight = (canvas2.width / imageAspectRatio) * scale;
      } else {
        renderHeight = canvas2.height * scale;
        renderWidth = canvas2.height * imageAspectRatio * scale;
      }

      const centerX = canvas2.width / 2;
      const centerY = canvas2.height / 2;

      ctx2.save();
      ctx2.translate(centerX + panX2, centerY + panY2);

      // Draw image
      ctx2.drawImage(
        img,
        -renderWidth / 2,
        -renderHeight / 2,
        renderWidth,
        renderHeight,
      );

      // Draw overlay circles with the SAME transformation
      ctx2.strokeStyle = "#ff0080";
      ctx2.fillStyle = "rgba(255, 0, 128, 0.3)";
      ctx2.lineWidth = 2 / scale; // Adjust line width for scale

      colorAnalysis.significantChanges.forEach((change) => {
        // Transform pixel coordinates to rendered coordinates
        const x = (change.x / img.width - 0.5) * renderWidth;
        const y = (change.y / img.height - 0.5) * renderHeight;

        ctx2.beginPath();
        ctx2.arc(x, y, 5 / scale, 0, 2 * Math.PI);
        ctx2.fill();
        ctx2.stroke();
      });

      ctx2.restore();
    };

    img.src = pageData.imageUrl;
  }

  async function renderComparison() {
    if (!mounted || !canvas1 || !canvas2) return;
    if (!selectedDoc1 || !selectedDoc2) return;
    if (!doc1Data || !doc2Data) {
      console.warn("Document data not available for rendering");
      return;
    }

    // Prevent concurrent renders
    if (isComparing) return;
    isComparing = true;

    try {
      // Get page data using the document objects, not IDs
      const page1Data = await documentService.getPageData(doc1Data, 1);
      const page2Data = await documentService.getPageData(doc2Data, 1);

      console.log("Render Comparison Data:", {
        doc1: page1Data ? "found" : "missing",
        doc2: page2Data ? "found" : "missing",
        page1HasImage: page1Data?.imageUrl ? "yes" : "no",
        page2HasImage: page2Data?.imageUrl ? "yes" : "no",
      });

      if (!page1Data || !page2Data) {
        console.error("Failed to get page data");
        showNotification("Failed to load document pages", "error");
        isComparing = false;
        return;
      }

      // Load images to get their actual dimensions
      const img1 = new Image();
      const img2 = new Image();

      await Promise.all([
        new Promise((resolve) => {
          img1.onload = resolve;
          img1.src = page1Data.imageUrl;
        }),
        new Promise((resolve) => {
          img2.onload = resolve;
          img2.src = page2Data.imageUrl;
        }),
      ]);

      // Get contexts
      const ctx1 = canvas1.getContext("2d", {
        alpha: false,
        willReadFrequently: true,
      });
      const ctx2 = canvas2.getContext("2d", {
        alpha: false,
        willReadFrequently: true,
      });

      // Calculate canvas dimensions based on image aspect ratio (force landscape)
      const container = canvas1.parentElement;
      if (container) {
        const containerWidth = container.clientWidth;

        // Use the image aspect ratio to determine canvas height
        const img1AspectRatio = img1.width / img1.height;
        const img2AspectRatio = img2.width / img2.height;

        // Check if images are portrait (aspect ratio < 1)
        const isPortrait = img1AspectRatio < 1 || img2AspectRatio < 1;

        // If portrait, we'll rotate 90 degrees, so swap width/height for aspect ratio
        const effectiveAspectRatio = isPortrait
          ? Math.max(1 / img1AspectRatio, 1 / img2AspectRatio) // Invert for rotation
          : Math.max(img1AspectRatio, img2AspectRatio);

        // Calculate height based on width and effective aspect ratio
        const canvasHeight = Math.min(
          containerWidth / effectiveAspectRatio,
          600,
        );

        console.log("Canvas sizing:", {
          containerWidth,
          img1AspectRatio,
          img2AspectRatio,
          isPortrait,
          effectiveAspectRatio,
          canvasHeight,
        });

        canvas1.width = containerWidth;
        canvas1.height = canvasHeight;
        canvas2.width = containerWidth;
        canvas2.height = canvasHeight;
      }

      // Clear canvases with white background
      ctx1.fillStyle = "#ffffff";
      ctx1.fillRect(0, 0, canvas1.width, canvas1.height);
      ctx2.fillStyle = "#ffffff";
      ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

      // Render both documents
      await Promise.all([
        renderDocument(
          ctx1,
          page1Data,
          canvas1.width,
          canvas1.height,
          panX1,
          panY1,
        ),
        renderDocument(
          ctx2,
          page2Data,
          canvas2.width,
          canvas2.height,
          panX2,
          panY2,
        ),
      ]);

      // Run comparison analysis (only if both rendered successfully)
      if (page1Data && page2Data) {
        await analyzeColorDifferences();

        // Re-render canvas2 with overlay if analysis found differences
        if (colorAnalysis && showOverlay) {
          await renderDocument(
            ctx2,
            page2Data,
            canvas2.width,
            canvas2.height,
            panX2,
            panY2,
            colorAnalysis,
          );
        }
      }
    } catch (error) {
      console.error("Comparison rendering failed:", error);
      showNotification("Failed to render comparison", "error");
    } finally {
      isComparing = false;
    }
  }

  async function performDetailedComparison() {
    if (!selectedDoc1 || !selectedDoc2 || !doc1Data || !doc2Data) {
      showNotification("Please select two documents to compare", "warning");
      return;
    }

    isComparing = true;

    try {
      const doc1Text = await documentService.extractText(doc1Data);
      const doc2Text = await documentService.extractText(doc2Data);

      // Ensure we have analysis data or use empty objects
      const safeDoc1Analysis = doc1Analysis || {
        equipment: {},
        instrumentation: {},
      };
      const safeDoc2Analysis = doc2Analysis || {
        equipment: {},
        instrumentation: {},
      };

      const comparison = {
        documents: {
          doc1: { name: doc1Data.name, id: selectedDoc1, type: "black_white" },
          doc2: { name: doc2Data.name, id: selectedDoc2, type: "colored" },
        },
        colorAnalysis: colorAnalysis || null,
        equipment: compareEquipment(),
        instruments: compareInstruments(),
        textual: compareTextual(doc1Text, doc2Text),
        summary: generateComparisonSummary(),
      };

      comparisonResult = comparison;
      showNotification("Enhanced comparison completed", "success");
    } catch (error) {
      console.error("Enhanced comparison failed:", error);
      showNotification(`Comparison failed: ${error.message}`, "error");
    } finally {
      isComparing = false;
    }
  }

  function compareEquipment() {
    const analysis1 = doc1Analysis?.equipment || {};
    const analysis2 = doc2Analysis?.equipment || {};

    const allTypes = new Set([
      ...Object.keys(analysis1),
      ...Object.keys(analysis2),
    ]);
    const comparison = {};

    for (const type of allTypes) {
      const items1 = Array.isArray(analysis1[type]) ? analysis1[type] : [];
      const items2 = Array.isArray(analysis2[type]) ? analysis2[type] : [];

      comparison[type] = {
        doc1: items1,
        doc2: items2,
        added: items2.filter((item) => !items1.includes(item)),
        removed: items1.filter((item) => !items2.includes(item)),
        common: items1.filter((item) => items2.includes(item)),
      };
    }

    return comparison;
  }

  function compareInstruments() {
    const inst1 = doc1Analysis?.instrumentation || {};
    const inst2 = doc2Analysis?.instrumentation || {};

    const categories = [
      "pressureInstruments",
      "temperatureInstruments",
      "flowInstruments",
      "levelInstruments",
    ];
    const comparison = {};

    for (const category of categories) {
      const items1 = Array.isArray(inst1[category]) ? inst1[category] : [];
      const items2 = Array.isArray(inst2[category]) ? inst2[category] : [];

      comparison[category] = {
        doc1: items1,
        doc2: items2,
        added: items2.filter((item) => !items1.includes(item)),
        removed: items1.filter((item) => !items2.includes(item)),
        common: items1.filter((item) => items2.includes(item)),
      };
    }

    return comparison;
  }

  function compareTextual(text1, text2) {
    // Handle null/undefined text
    const safeText1 = text1 || "";
    const safeText2 = text2 || "";

    const words1 = safeText1
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const words2 = safeText2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const uniqueWords1 = new Set(words1);
    const uniqueWords2 = new Set(words2);

    const commonWords = [...uniqueWords1].filter((word) =>
      uniqueWords2.has(word),
    );

    const maxSize = Math.max(uniqueWords1.size, uniqueWords2.size);
    const similarity = maxSize > 0 ? commonWords.length / maxSize : 0;

    return {
      similarity: Math.round(similarity * 100),
      wordCount1: words1.length,
      wordCount2: words2.length,
      uniqueWords1: uniqueWords1.size,
      uniqueWords2: uniqueWords2.size,
      commonWords: commonWords.length,
    };
  }

  function generateComparisonSummary() {
    const summary = {
      colorChanges: null,
      recommendation: getRecommendation(),
    };

    // Only add color changes if colorAnalysis exists and has valid data
    if (colorAnalysis && typeof colorAnalysis.differentPixels === "number") {
      summary.colorChanges = {
        totalChanges: colorAnalysis.differentPixels,
        changePercentage:
          Math.round((colorAnalysis.changePercentage || 0) * 100) / 100,
        significantChanges: (colorAnalysis.significantChanges || []).length,
        averageDifference:
          Math.round((colorAnalysis.averageDifference || 0) * 100) / 100,
      };
    }

    return summary;
  }

  function getRecommendation() {
    if (!colorAnalysis || typeof colorAnalysis.changePercentage !== "number") {
      return "Upload both documents to see comparison analysis.";
    }

    if (colorAnalysis.changePercentage < 5) {
      return "Minimal visual changes detected. Documents are very similar.";
    } else if (colorAnalysis.changePercentage < 20) {
      return "Moderate changes detected. Review highlighted areas carefully.";
    } else {
      return "Significant changes detected. Thorough review recommended.";
    }
  }

  // Control functions
  function handleZoom(direction) {
    if (direction === "in") {
      scale = Math.min(scale * 1.2, 5);
    } else {
      scale = Math.max(scale / 1.2, 0.1);
    }
    renderComparison();
  }

  function handleReset() {
    scale = 1;
    panX1 = panY1 = panX2 = panY2 = 0;
    renderComparison();
  }

  function handleMouseDown(canvas, e) {
    if (canvas === 1) {
      isDragging1 = true;
    } else {
      isDragging2 = true;
    }
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function handleMouseMove(e) {
    if (!isDragging1 && !isDragging2) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    if (isDragging1) {
      panX1 += deltaX;
      panY1 += deltaY;
    }

    if (isDragging2) {
      panX2 += deltaX;
      panY2 += deltaY;
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // Use requestAnimationFrame for smooth rendering during drag
    if (!renderScheduled) {
      renderScheduled = true;
      requestAnimationFrame(() => {
        renderComparison();
        renderScheduled = false;
      });
    }
  }

  function handleMouseUp() {
    isDragging1 = false;
    isDragging2 = false;
  }

  function syncPanAndZoom() {
    panX2 = panX1;
    panY2 = panY1;
    renderComparison();
  }
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div class="h-full flex flex-col bg-base-100" on:wheel={handleWheel}>
  <!-- Header -->
  <div class="border-b border-base-content/10 p-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold gradient-text">
          Enhanced P&ID Comparison
        </h2>
        <p class="text-sm text-base-content/60 mt-1">
          Compare black & white and colored versions
        </p>
      </div>

      <div class="flex gap-2">
        <button
          class="btn btn-sm btn-outline"
          on:click={() => handleZoom("out")}
          disabled={scale <= 0.1}
        >
          <ZoomOut size={14} />
        </button>
        <button
          class="btn btn-sm btn-outline"
          on:click={() => handleZoom("in")}
          disabled={scale >= 5}
        >
          <ZoomIn size={14} />
        </button>
        <button class="btn btn-sm btn-outline" on:click={handleReset}>
          <RefreshCw size={14} />
        </button>
        <button
          class="btn btn-sm btn-outline"
          on:click={syncPanAndZoom}
          title="Sync pan and zoom"
        >
          <Shuffle size={14} />
        </button>
      </div>
    </div>

    <!-- Document Selection -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div>
        <label class="label">
          <span class="label-text font-medium">Black & White Document</span>
        </label>
        <select
          bind:value={selectedDoc1}
          on:change={() => {
            if (selectedDoc1 && selectedDoc2 && mounted) {
              setTimeout(() => renderComparison(), 100);
            }
          }}
          class="select select-bordered w-full select-sm"
        >
          <option value={null}>Select B&W document...</option>
          {#each availableDocs as doc}
            <option value={doc.id}>
              {doc.name}
              {#if doc.colorDetection}
                - {doc.colorDetection.analysis === "black_white"
                  ? "📄 B&W"
                  : doc.colorDetection.analysis === "colored"
                    ? "🎨 Colored"
                    : "📄 Mixed"}
              {:else}
                - 📄 Unknown
              {/if}
            </option>
          {/each}
        </select>
      </div>

      <div>
        <label class="label">
          <span class="label-text font-medium">Colored Document</span>
        </label>
        <select
          bind:value={selectedDoc2}
          on:change={() => {
            if (selectedDoc1 && selectedDoc2 && mounted) {
              setTimeout(() => renderComparison(), 100);
            }
          }}
          class="select select-bordered w-full select-sm"
        >
          <option value={null}>Select colored document...</option>
          {#each availableDocs as doc}
            <option value={doc.id}>
              {doc.name}
              {#if doc.colorDetection}
                - {doc.colorDetection.analysis === "black_white"
                  ? "📄 B&W"
                  : doc.colorDetection.analysis === "colored"
                    ? "🎨 Colored"
                    : "📄 Mixed"}
              {:else}
                - 📄 Unknown
              {/if}
            </option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-4 mt-4">
      <label class="label cursor-pointer">
        <input
          type="checkbox"
          bind:checked={showDifferences}
          class="checkbox checkbox-sm"
        />
        <span class="label-text ml-2">Show Differences</span>
      </label>

      <label class="label cursor-pointer">
        <input
          type="checkbox"
          bind:checked={showOverlay}
          class="checkbox checkbox-sm"
        />
        <span class="label-text ml-2">Highlight Changes</span>
      </label>

      <div class="flex items-center gap-2">
        <span class="text-sm">Sensitivity:</span>
        <input
          type="range"
          min="10"
          max="100"
          bind:value={differenceThreshold}
          class="range range-sm"
          on:change={renderComparison}
        />
        <span class="text-xs">{differenceThreshold}</span>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex">
    {#if doc1Data && doc2Data}
      <!-- Dual Grid View -->
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <!-- Black & White View -->
        <div class="card bg-base-100 border border-base-content/10">
          <div class="card-body p-3">
            <h3 class="card-title text-sm">
              <FileText size={16} />
              Black & White: {doc1Data.name}
            </h3>

            <div class="relative">
              <canvas
                bind:this={canvas1}
                class="border border-base-content/20 rounded cursor-grab active:cursor-grabbing w-full"
                on:mousedown={(e) => handleMouseDown(1, e)}
              ></canvas>

              <div
                class="absolute top-2 left-2 bg-base-100/90 backdrop-blur-sm rounded px-2 py-1 text-xs"
              >
                Zoom: {Math.round(scale * 100)}%
              </div>
            </div>
          </div>
        </div>

        <!-- Colored View -->
        <div class="card bg-base-100 border border-base-content/10">
          <div class="card-body p-3">
            <h3 class="card-title text-sm">
              <FileText size={16} class="text-secondary" />
              Colored: {doc2Data.name}
            </h3>

            <div class="relative">
              <canvas
                bind:this={canvas2}
                class="border border-base-content/20 rounded cursor-grab active:cursor-grabbing w-full"
                on:mousedown={(e) => handleMouseDown(2, e)}
              ></canvas>

              <div
                class="absolute top-2 left-2 bg-base-100/90 backdrop-blur-sm rounded px-2 py-1 text-xs"
              >
                Zoom: {Math.round(scale * 100)}%
              </div>

              {#if colorAnalysis && showOverlay}
                <div
                  class="absolute top-2 right-2 bg-error/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-white"
                >
                  {colorAnalysis.significantChanges.length} changes highlighted
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Analysis Panel -->
      <div class="w-80 border-l border-base-content/10 p-4 overflow-y-auto">
        <div class="space-y-4">
          <!-- Quick Stats -->
          {#if colorAnalysis}
            <div class="card bg-base-100 border border-base-content/10">
              <div class="card-body p-3">
                <h3 class="card-title text-sm">Color Analysis</h3>

                <div class="stats stats-vertical">
                  <div class="stat py-2">
                    <div class="stat-title text-xs">Change Percentage</div>
                    <div class="stat-value text-lg">
                      {colorAnalysis.changePercentage.toFixed(2)}%
                    </div>
                  </div>

                  <div class="stat py-2">
                    <div class="stat-title text-xs">Significant Changes</div>
                    <div class="stat-value text-lg">
                      {colorAnalysis.significantChanges.length}
                    </div>
                  </div>

                  <div class="stat py-2">
                    <div class="stat-title text-xs">Avg Difference</div>
                    <div class="stat-value text-lg">
                      {colorAnalysis.averageDifference.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Detailed Comparison -->
          <button
            class="btn btn-primary w-full"
            on:click={performDetailedComparison}
            disabled={isComparing}
          >
            {#if isComparing}
              <span class="loading loading-spinner loading-sm"></span>
              Analyzing...
            {:else}
              <BarChart3 size={16} />
              Run Detailed Analysis
            {/if}
          </button>

          <!-- Comparison Results -->
          {#if comparisonResult}
            <div class="space-y-3">
              <!-- Summary -->
              {#if comparisonResult.summary}
                <div class="alert alert-info">
                  <Info size={16} />
                  <span class="text-sm"
                    >{comparisonResult.summary.recommendation}</span
                  >
                </div>
              {/if}

              <!-- Equipment Changes -->
              {#if comparisonResult.equipment && Object.keys(comparisonResult.equipment).length > 0}
                <div class="card bg-base-100 border border-base-content/10">
                  <div class="card-body p-3">
                    <h4 class="font-medium text-sm">Equipment Changes</h4>

                    {#each Object.entries(comparisonResult.equipment) as [type, data]}
                      {#if data.added.length > 0 || data.removed.length > 0}
                        <div class="text-xs space-y-1">
                          <div class="font-medium capitalize">{type}</div>
                          {#if data.added.length > 0}
                            <div class="text-success">
                              + {data.added.length} added
                            </div>
                          {/if}
                          {#if data.removed.length > 0}
                            <div class="text-error">
                              - {data.removed.length} removed
                            </div>
                          {/if}
                        </div>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- No Documents Selected -->
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div
            class="w-20 h-20 bg-primary/10 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <GitCompare size={32} class="text-primary" />
          </div>
          <h3 class="text-xl font-semibold mb-2">
            Select Documents to Compare
          </h3>
          <p class="text-base-content/60 mb-6">
            Choose a black & white document and its colored version to see what
            changed.
          </p>

          {#if availableDocs.length < 2}
            <div class="alert alert-warning max-w-md mx-auto">
              <AlertTriangle size={16} />
              <span
                >You need at least 2 processed documents to enable comparison.</span
              >
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .gradient-text {
    background: linear-gradient(135deg, #8b5cf6, #ec4899);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  canvas {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }

  .cursor-grab {
    cursor: grab;
  }

  .cursor-grabbing {
    cursor: grabbing;
  }
</style>
