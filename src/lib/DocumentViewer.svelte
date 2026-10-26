<script>
  import { onMount, onDestroy } from 'svelte';
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
  // AI service will be loaded dynamically
  import { 
    ZoomIn, 
    ZoomOut, 
    RotateCw, 
    Download, 
    Maximize, 
    Play,
    RefreshCw,
    FileText,
    BarChart3
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

  $: document = $currentDocumentData;
  $: analysis = document ? $analysisResults[document.id] : null;
  $: validation = document ? $validationResults[document.id] : null;
  $: elements = document ? $extractedElements[document.id] : null;

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      renderDocument();
    }
  });

  onDestroy(() => {
    // Clean up any resources
  });

  $: if (document && canvas) {
    renderDocument();
  }

  async function renderDocument() {
    if (!document || !ctx) return;

    try {
      const pageData = await documentService.getPageData(document, currentPage);
      if (!pageData) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set canvas size
      const containerRect = canvasContainer.getBoundingClientRect();
      canvas.width = containerRect.width;
      canvas.height = containerRect.height;
      
      // Calculate image dimensions and position
      const img = new Image();
      img.onload = () => {
        const imageAspectRatio = img.width / img.height;
        const containerAspectRatio = canvas.width / canvas.height;
        
        let renderWidth, renderHeight;
        
        if (imageAspectRatio > containerAspectRatio) {
          renderWidth = canvas.width * scale;
          renderHeight = (canvas.width / imageAspectRatio) * scale;
        } else {
          renderHeight = canvas.height * scale;
          renderWidth = (canvas.height * imageAspectRatio) * scale;
        }
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.save();
        ctx.translate(centerX + panX, centerY + panY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(
          img, 
          -renderWidth / 2, 
          -renderHeight / 2, 
          renderWidth, 
          renderHeight
        );
        ctx.restore();
        
        // Draw analysis overlays if available
        if (analysis) {
          drawAnalysisOverlays(renderWidth, renderHeight, centerX + panX, centerY + panY);
        }
      };
      
      if (pageData.imageUrl) {
        img.src = pageData.imageUrl;
      } else if (pageData.canvas) {
        // For PDF pages rendered to canvas
        ctx.drawImage(pageData.canvas, 0, 0);
      }
      
    } catch (error) {
      console.error('Failed to render document:', error);
      showNotification('Failed to render document', 'error');
    }
  }

  function drawAnalysisOverlays(imgWidth, imgHeight, centerX, centerY) {
    if (!elements) return;
    
    ctx.save();
    
    // Draw equipment highlights
    if (elements.equipment) {
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2;
      elements.equipment.forEach((eq, index) => {
        // Simulate equipment positions (in a real app, these would come from image analysis)
        const x = centerX - imgWidth/2 + (index * 100) % imgWidth;
        const y = centerY - imgHeight/2 + Math.floor(index / (imgWidth/100)) * 80;
        
        ctx.strokeRect(x - 20, y - 20, 40, 40);
        
        // Label
        ctx.fillStyle = '#8B5CF6';
        ctx.font = '12px Inter';
        ctx.fillText(eq, x - 15, y + 35);
      });
    }
    
    // Draw instrument highlights
    if (elements.instruments) {
      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = 2;
      elements.instruments.forEach((inst, index) => {
        const x = centerX - imgWidth/2 + 50 + (index * 120) % imgWidth;
        const y = centerY - imgHeight/2 + 50 + Math.floor(index / (imgWidth/120)) * 100;
        
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Label
        ctx.fillStyle = '#EC4899';
        ctx.font = '10px Inter';
        ctx.fillText(inst, x - 15, y + 30);
      });
    }
    
    ctx.restore();
  }

  function handleZoomIn() {
    scale = Math.min(scale * 1.2, 5);
    renderDocument();
  }

  function handleZoomOut() {
    scale = Math.max(scale / 1.2, 0.1);
    renderDocument();
  }

  function handleRotate() {
    rotation = (rotation + 90) % 360;
    renderDocument();
  }

  function handleReset() {
    scale = 1;
    rotation = 0;
    panX = 0;
    panY = 0;
    renderDocument();
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
    
    renderDocument();
  }

  function handleMouseUp() {
    isDragging = false;
    canvas.style.cursor = 'grab';
  }

  function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.min(Math.max(scale * zoomFactor, 0.1), 5);
    renderDocument();
  }

  function nextPage() {
    if (document && document.pageCount && currentPage < document.pageCount) {
      currentPage++;
      renderDocument();
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
      renderDocument();
    }
  }

  function toggleFullscreen() {
    fullscreen = !fullscreen;
    setTimeout(() => renderDocument(), 100);
  }

  async function analyzeDocument() {
    if (!document || analyzing || $aiProcessing) {
      return;
    }
    
    if (!$aiServiceInstance) {
      showNotification('AI service not available. Please refresh the page and try again.', 'error');
      return;
    }
    
    analyzing = true;
    
    try {
      showNotification('Starting AI analysis...', 'info');
      
      // Get document data
      const pageData = await documentService.getPageData(document, currentPage);
      const documentText = await documentService.extractText(document);
      
      if (!pageData) {
        throw new Error('Could not extract page data for analysis');
      }
      
      // Analyze with AI service from store
      const analysis = await $aiServiceInstance.analyzeBlueprint(pageData?.imageBlob, documentText);
      
      // Store results
      setAnalysisResult(document.id, analysis);
      setValidationResult(document.id, analysis.validation);
      setExtractedElements(document.id, {
        equipment: analysis.text?.entities?.equipment || [],
        instruments: analysis.text?.entities?.instruments || [],
        piping: analysis.text?.entities?.pipes || []
      });
      
      showNotification('Analysis completed successfully!', 'success');
      
      // Re-render with overlays
      renderDocument();
      
    } catch (error) {
      console.error('Analysis failed:', error);
      showNotification(`Analysis failed: ${error.message}`, 'error');
    } finally {
      analyzing = false;
    }
  }

  async function downloadDocument() {
    if (!document) return;
    
    const link = document.createElement('a');
    link.href = document.imageUrl || URL.createObjectURL(document.file);
    link.download = document.name;
    link.click();
  }
</script>

<div class="h-full flex flex-col bg-base-200 rounded-lg overflow-hidden {fullscreen ? 'fixed inset-0 z-50' : ''}">
  <!-- Toolbar -->
  <div class="bg-base-100 border-b border-base-content/10 p-3 flex items-center justify-between">
    <!-- Left controls -->
    <div class="flex items-center gap-2">
      <!-- Page navigation -->
      {#if document && document.pageCount > 1}
        <div class="flex items-center gap-2">
          <button 
            class="btn btn-ghost btn-sm" 
            disabled={currentPage <= 1}
            on:click={prevPage}
          >
            ←
          </button>
          <span class="text-sm font-medium">
            {currentPage} / {document.pageCount}
          </span>
          <button 
            class="btn btn-ghost btn-sm" 
            disabled={currentPage >= document.pageCount}
            on:click={nextPage}
          >
            →
          </button>
        </div>
        <div class="divider divider-horizontal"></div>
      {/if}
      
      <!-- Zoom controls -->
      <div class="flex items-center gap-1">
        <button 
          class="btn btn-ghost btn-sm btn-circle" 
          on:click={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <span class="text-xs font-medium px-2 min-w-[4rem] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button 
          class="btn btn-ghost btn-sm btn-circle" 
          on:click={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
      </div>
      
      <div class="divider divider-horizontal"></div>
      
      <!-- Transform controls -->
      <button 
        class="btn btn-ghost btn-sm btn-circle" 
        on:click={handleRotate}
        title="Rotate"
      >
        <RotateCw size={16} />
      </button>
      
      <button 
        class="btn btn-ghost btn-sm btn-circle" 
        on:click={handleReset}
        title="Reset View"
      >
        <RefreshCw size={16} />
      </button>
    </div>
    
    <!-- Document title -->
    <div class="flex-1 px-4 text-center">
      <h3 class="font-medium text-sm truncate" title={document?.name}>
        {document?.name || 'No document selected'}
      </h3>
    </div>
    
    <!-- Right controls -->
    <div class="flex items-center gap-2">
      <!-- Analysis button -->
      <button 
        class="btn btn-primary btn-sm"
        disabled={!document || analyzing || $aiProcessing}
        on:click={analyzeDocument}
      >
        {#if analyzing || $aiProcessing}
          <span class="loading loading-spinner loading-sm"></span>
          Analyzing...
        {:else}
          <Play size={16} />
          Analyze
        {/if}
      </button>
      
      <!-- Action buttons -->
      <button 
        class="btn btn-ghost btn-sm btn-circle" 
        on:click={downloadDocument}
        title="Download"
        disabled={!document}
      >
        <Download size={16} />
      </button>
      
      <button 
        class="btn btn-ghost btn-sm btn-circle" 
        on:click={toggleFullscreen}
        title="Fullscreen"
      >
        <Maximize size={16} />
      </button>
    </div>
  </div>
  
  <!-- Canvas container -->
  <div 
    bind:this={canvasContainer}
    class="flex-1 relative overflow-hidden bg-base-300"
  >
    {#if document}
      <canvas
        bind:this={canvas}
        class="absolute inset-0 cursor-grab blueprint-viewer"
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
        on:wheel={handleWheel}
      ></canvas>
      
      <!-- Analysis overlay info -->
      {#if analysis}
        <div class="absolute top-4 right-4 space-y-2">
          <!-- Validation status -->
          {#if validation}
            <div class="badge {validation.isValid ? 'badge-success' : 'badge-error'} gap-1">
              {#if validation.isValid}
                ✓ Valid
              {:else}
                ⚠ Issues
              {/if}
            </div>
          {/if}
          
          <!-- Equipment count -->
          {#if analysis.equipment}
            <div class="badge badge-primary gap-1">
              <BarChart3 size={12} />
              {Object.values(analysis.equipment).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)} Equipment
            </div>
          {/if}
          
          <!-- Instruments count -->
          {#if analysis.instrumentation?.total}
            <div class="badge badge-secondary gap-1">
              <FileText size={12} />
              {analysis.instrumentation.total} Instruments
            </div>
          {/if}
        </div>
      {/if}
    {:else}
      <!-- No document state -->
      <div class="absolute inset-0 flex items-center justify-center text-base-content/60">
        <div class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 bg-base-200 rounded-full flex items-center justify-center">
            <FileText size={24} />
          </div>
          <p class="font-medium mb-2">No Document Selected</p>
          <p class="text-sm">Select a document from the sidebar to view</p>
        </div>
      </div>
    {/if}
  </div>
  
  <!-- Status bar -->
  {#if document}
    <div class="bg-base-100 border-t border-base-content/10 px-4 py-2 flex items-center justify-between text-xs text-base-content/70">
      <div class="flex items-center gap-4">
        <span>{document.type.toUpperCase()}</span>
        <span>{document.size ? Math.round(document.size / 1024) : 0} KB</span>
        {#if document.width && document.height}
          <span>{document.width} × {document.height}px</span>
        {/if}
      </div>
      
      <div class="flex items-center gap-4">
        {#if analysis}
          <span class="text-success">✓ Analyzed</span>
        {:else}
          <span>Ready to analyze</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .blueprint-viewer {
    background-image: 
      linear-gradient(rgba(139, 92, 246, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(139, 92, 246, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  canvas {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }

  .divider-horizontal {
    margin: 0 0.5rem;
    width: 1px;
    height: 1rem;
  }
</style>
