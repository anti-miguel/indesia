<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { 
    currentDocumentData, 
    analysisResults, 
    validationResults,
    extractedElements,
    aiProcessing,
    aiServiceInstance
  } from './stores.js';
  import { 
    setAnalysisResult, 
    setValidationResult, 
    setExtractedElements,
    showNotification
  } from './stores.js';
  import { documentService } from './services/documentService.js';
  import { 
    ZoomIn, 
    ZoomOut, 
    RotateCw, 
    Download, 
    Maximize, 
    Play,
    RefreshCw,
    FileText,
    BarChart3,
    Loader
  } from 'lucide-svelte';

  let canvasContainer;
  let canvas;
  let ctx;
  let scale = 1;
  let rotation = 0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let currentPage = 1;
  let fullscreen = false;
  let analyzing = false;
  let isRendering = false;
  let renderQueue = [];
  let currentRenderTask = null;

  // Caching for performance
  let imageCache = new Map();
  let lastDocument = null;
  let lastPage = null;

  $: document = $currentDocumentData;
  $: analysis = document ? $analysisResults[document.id] : null;
  $: validation = document ? $validationResults[document.id] : null;
  $: elements = document ? $extractedElements[document.id] : null;

  // Watch for document changes
  $: if (document && document !== lastDocument) {
    lastDocument = document;
    currentPage = 1;
    handleDocumentChange();
  }

  $: if (document && currentPage !== lastPage) {
    lastPage = currentPage;
    queueRender();
  }

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      setupCanvas();
      if (document) {
        queueRender();
      }
    }

    // Handle resize
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    clearRenderQueue();
    cleanupCache();
  });

  function setupCanvas() {
    if (!ctx) return;
    
    // Optimize canvas for better performance
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Set initial canvas size
    updateCanvasSize();
  }

  function updateCanvasSize() {
    if (!canvasContainer || !canvas) return { width: 800, height: 600 };
    
    const containerRect = canvasContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Ensure minimum sizes to prevent tiny canvas
    const minWidth = 400;
    const minHeight = 300;
    const width = Math.max(containerRect.width, minWidth);
    const height = Math.max(containerRect.height, minHeight);
    
    // Set actual canvas size (with device pixel ratio for crisp rendering)
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Set display size
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // Reset and configure context
    if (ctx) {
      // Reset any previous transformations
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Scale context to match device pixel ratio
      ctx.scale(dpr, dpr);
      // Ensure high quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    
    return { width, height };
  }

  function handleResize() {
    updateCanvasSize();
    queueRender();
  }

  function handleDocumentChange() {
    // Clear cache for old document
    if (lastDocument && lastDocument.id !== document?.id) {
      clearCacheForDocument(lastDocument.id);
    }
    
    // Reset view state
    scale = 1;
    rotation = 0;
    panX = 0;
    panY = 0;
    
    queueRender();
  }

  function queueRender() {
    // Cancel any pending render
    if (currentRenderTask) {
      currentRenderTask.cancelled = true;
    }
    
    // Create new render task
    const renderTask = {
      document,
      page: currentPage,
      scale,
      rotation,
      panX,
      panY,
      timestamp: Date.now(),
      cancelled: false
    };
    
    currentRenderTask = renderTask;
    
    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
      if (!renderTask.cancelled) {
        performRender(renderTask);
      }
    });
  }

  async function performRender(renderTask) {
    if (!document || !ctx || renderTask.cancelled) return;
    
    isRendering = true;
    console.log('Starting render for document:', document.name, 'page:', currentPage);
    
    try {
      const { width, height } = updateCanvasSize();
      console.log('Canvas size:', width, 'x', height);
      
      // Clear canvas with background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // Get cached image or load it
      const cacheKey = `${document.id}-${currentPage}`;
      let imageData = imageCache.get(cacheKey);
      
      if (!imageData) {
        console.log('Loading image data for:', cacheKey);
        // Load image data asynchronously
        imageData = await loadImageData(document, currentPage);
        if (imageData && !renderTask.cancelled) {
          console.log('Image data loaded:', imageData.type, imageData.width, 'x', imageData.height);
          imageCache.set(cacheKey, imageData);
        }
      } else {
        console.log('Using cached image data:', cacheKey);
      }
      
      if (!imageData || renderTask.cancelled) {
        console.warn('No image data available or render cancelled');
        return;
      }
      
      // Render the image
      console.log('Rendering image...');
      await renderImage(imageData, width, height, renderTask);
      console.log('Image rendered successfully');
      
      // Draw analysis overlays if available
      if (analysis && !renderTask.cancelled) {
        drawAnalysisOverlays(width, height);
      }
      
    } catch (error) {
      console.error('Render failed:', error);
      drawErrorState(error.message);
    } finally {
      isRendering = false;
    }
  }

  async function loadImageData(doc, page) {
    if (!doc) return null;
    
    try {
      console.log('Loading page data for document:', doc.name, 'page:', page);
      const pageData = await documentService.getPageData(doc, page);
      if (!pageData) {
        console.warn('No page data available');
        return null;
      }
      
      console.log('Page data loaded:', pageData);
      
      // For PDFs, use the pre-rendered imageUrl if available
      if (pageData.imageUrl) {
        console.log('Using imageUrl:', pageData.imageUrl);
        return {
          type: 'url',
          src: pageData.imageUrl,
          width: pageData.viewport?.width || 800,
          height: pageData.viewport?.height || 600
        };
      }
      
      // For canvas-based rendering
      if (pageData.canvas) {
        console.log('Using canvas:', pageData.canvas.width, 'x', pageData.canvas.height);
        return {
          type: 'canvas',
          canvas: pageData.canvas,
          width: pageData.canvas.width,
          height: pageData.canvas.height
        };
      }
      
      console.warn('No usable image data found in page data');
      return null;
    } catch (error) {
      console.error('Failed to load image data:', error);
      return null;
    }
  }

  async function renderImage(imageData, canvasWidth, canvasHeight, renderTask) {
    return new Promise((resolve) => {
      if (renderTask.cancelled) {
        resolve();
        return;
      }
      
      if (imageData.type === 'canvas') {
        // Direct canvas-to-canvas copy (fastest)
        try {
          const sourceCanvas = imageData.canvas;
          renderImageToCanvas(sourceCanvas, imageData.width, imageData.height, canvasWidth, canvasHeight);
          resolve();
        } catch (error) {
          console.warn('Canvas render failed:', error);
          resolve();
        }
      } else if (imageData.type === 'url') {
        // Image URL rendering
        const img = new Image();
        img.onload = () => {
          if (!renderTask.cancelled) {
            try {
              renderImageToCanvas(img, imageData.width, imageData.height, canvasWidth, canvasHeight);
            } catch (error) {
              console.warn('Image render failed:', error);
            }
          }
          resolve();
        };
        img.onerror = () => {
          console.warn('Failed to load image:', imageData.src);
          resolve();
        };
        img.src = imageData.src;
      } else {
        resolve();
      }
    });
  }

  function renderImageToCanvas(source, sourceWidth, sourceHeight, canvasWidth, canvasHeight) {
    if (!source || !ctx) {
      console.warn('Missing source or context for rendering');
      return;
    }
    
    console.log('Rendering to canvas:', sourceWidth, 'x', sourceHeight, '->', canvasWidth, 'x', canvasHeight);
    
    // Calculate rendering dimensions
    const imageAspectRatio = sourceWidth / sourceHeight;
    const containerAspectRatio = canvasWidth / canvasHeight;
    
    let renderWidth, renderHeight;
    
    if (imageAspectRatio > containerAspectRatio) {
      renderWidth = canvasWidth * scale;
      renderHeight = (canvasWidth / imageAspectRatio) * scale;
    } else {
      renderHeight = canvasHeight * scale;
      renderWidth = (canvasHeight * imageAspectRatio) * scale;
    }
    
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Apply transformations and render
    try {
      ctx.save();
      ctx.translate(centerX + panX, centerY + panY);
      ctx.rotate((rotation * Math.PI) / 180);
      
      // Use faster rendering for better performance
      ctx.imageSmoothingEnabled = scale < 1;
      ctx.drawImage(
        source, 
        -renderWidth / 2, 
        -renderHeight / 2, 
        renderWidth, 
        renderHeight
      );
      console.log('Successfully drew image to canvas');
    } catch (error) {
      console.error('Failed to draw image:', error);
    } finally {
      ctx.restore();
    }
  }

  function drawAnalysisOverlays(canvasWidth, canvasHeight) {
    if (!elements) return;
    
    ctx.save();
    
    // Calculate image bounds for overlay positioning
    const imageAspectRatio = 1; // Default, should be calculated from actual image
    const centerX = canvasWidth / 2 + panX;
    const centerY = canvasHeight / 2 + panY;
    
    let imgWidth, imgHeight;
    if (canvasWidth / canvasHeight > imageAspectRatio) {
      imgWidth = canvasHeight * imageAspectRatio * scale;
      imgHeight = canvasHeight * scale;
    } else {
      imgWidth = canvasWidth * scale;
      imgHeight = canvasWidth / imageAspectRatio * scale;
    }
    
    // Draw equipment highlights (purple)
    if (elements.equipment) {
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      
      elements.equipment.forEach((eq, index) => {
        const x = centerX - imgWidth/2 + (index * 100) % imgWidth;
        const y = centerY - imgHeight/2 + Math.floor(index / (imgWidth/100)) * 80;
        
        ctx.strokeRect(x - 20, y - 20, 40, 40);
        
        // Equipment label with background
        ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
        ctx.fillRect(x - 25, y + 25, eq.length * 8, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(eq, x - 20, y + 35);
      });
    }
    
    // Draw instrument highlights (pink)
    if (elements.instruments) {
      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      
      elements.instruments.forEach((inst, index) => {
        const x = centerX - imgWidth/2 + 50 + (index * 120) % imgWidth;
        const y = centerY - imgHeight/2 + 50 + Math.floor(index / (imgWidth/120)) * 100;
        
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Instrument label with background
        ctx.fillStyle = 'rgba(236, 72, 153, 0.9)';
        ctx.fillRect(x - 20, y + 20, inst.length * 7, 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(inst, x - 15, y + 30);
      });
    }
    
    ctx.restore();
  }

  function drawErrorState(message) {
    if (!ctx) return;
    
    const { width, height } = updateCanvasSize();
    
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Failed to render document', width / 2, height / 2 - 10);
    
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(message, width / 2, height / 2 + 10);
    ctx.textAlign = 'left';
  }

  // Control handlers
  function handleZoomIn() {
    scale = Math.min(scale * 1.2, 5);
    queueRender();
  }

  function handleZoomOut() {
    scale = Math.max(scale / 1.2, 0.1);
    queueRender();
  }

  function handleRotate() {
    rotation = (rotation + 90) % 360;
    queueRender();
  }

  function handleReset() {
    scale = 1;
    rotation = 0;
    panX = 0;
    panY = 0;
    queueRender();
  }

  function handleMouseDown(e) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;
    
    panX += deltaX;
    panY += deltaY;
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    queueRender();
  }

  function handleMouseUp() {
    isDragging = false;
    canvas.style.cursor = 'grab';
  }

  function handleWheel(e) {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, scale * zoomFactor));
    
    if (newScale !== scale) {
      scale = newScale;
      queueRender();
    }
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

  function clearRenderQueue() {
    if (currentRenderTask) {
      currentRenderTask.cancelled = true;
      currentRenderTask = null;
    }
  }

  function clearCacheForDocument(docId) {
    for (const [key] of imageCache.entries()) {
      if (key.startsWith(docId)) {
        imageCache.delete(key);
      }
    }
  }

  function cleanupCache() {
    // Clean up object URLs to prevent memory leaks
    for (const imageData of imageCache.values()) {
      if (imageData.type === 'url' && imageData.src.startsWith('blob:')) {
        URL.revokeObjectURL(imageData.src);
      }
    }
    imageCache.clear();
  }

  async function runAnalysis() {
    if (!document || !$aiServiceInstance || analyzing) return;
    
    analyzing = true;
    
    try {
      showNotification('Starting document analysis...', 'info');
      
      // Extract document text and elements
      const text = await documentService.extractText(document);
      const pidElements = documentService.extractPIDElements(text);
      
      // Store extracted elements
      setExtractedElements(document.id, pidElements);
      
      // Run AI analysis if available
      const analysis = await $aiServiceInstance.analyzeDocument(document, text, pidElements);
      setAnalysisResult(document.id, analysis);
      
      showNotification('Analysis completed successfully', 'success');
      
      // Trigger re-render to show overlays
      queueRender();
      
    } catch (error) {
      console.error('Analysis failed:', error);
      showNotification(`Analysis failed: ${error.message}`, 'error');
    } finally {
      analyzing = false;
    }
  }

  function downloadDocument() {
    if (!document) return;
    
    try {
      if (document.type === 'pdf') {
        // For PDFs, download the original file
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([document.data], { type: 'application/pdf' }));
        link.download = document.name;
        link.click();
      } else {
        // For images, download the current canvas view
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${document.name.split('.')[0]}_view.png`;
        link.click();
      }
    } catch (error) {
      console.error('Download failed:', error);
      showNotification('Download failed', 'error');
    }
  }
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div class="h-full flex flex-col bg-base-100">
  {#if document}
    <!-- Toolbar -->
    <div class="border-b border-base-content/10 p-3 flex items-center justify-between bg-base-100">
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
        
        {#if isRendering}
          <div class="flex items-center gap-2 text-base-content/60">
            <Loader size={14} class="animate-spin" />
            <span class="text-xs">Rendering...</span>
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
          title="Download"
        >
          <Download size={16} />
        </button>
      </div>
    </div>
    
    <!-- Document Viewer -->
    <div class="flex-1 relative overflow-hidden min-h-96" style="min-height: 500px;" bind:this={canvasContainer}>
      <canvas 
        bind:this={canvas}
        class="absolute inset-0 cursor-grab active:cursor-grabbing w-full h-full"
        on:mousedown={handleMouseDown}
        on:wheel={handleWheel}
      ></canvas>
      
      <!-- Overlay indicators -->
      {#if analysis}
        <div class="absolute top-4 left-4 bg-success/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs">
          ✓ Analyzed
        </div>
      {/if}
      
      {#if elements}
        <div class="absolute top-4 right-4 bg-primary/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs">
          {Object.values(elements).flat().length} Elements Found
        </div>
      {/if}
    </div>
    
  {:else}
    <!-- No document selected -->
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <FileText size={48} class="mx-auto mb-4 text-base-content/30" />
        <h3 class="text-lg font-medium text-base-content/60">No document selected</h3>
        <p class="text-sm text-base-content/40">Upload and select a document to view it here.</p>
      </div>
    </div>
  {/if}
</div>

<style>
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
