<script>
  import { onMount, onDestroy } from "svelte";
  import {
    isAILoaded,
    aiProcessing,
    aiModel,
    currentDocumentData,
    analysisResults,
  } from "./stores.js";
  import { Brain, Zap, AlertCircle, CheckCircle, X, Move } from "lucide-svelte";

  $: currentDoc = $currentDocumentData;
  $: analysis = currentDoc ? $analysisResults[currentDoc.id] : null;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;
  let isMinimized = false;
  let aiStatusElement;

  // Position state
  let position = { x: 0, y: 0 };
  let isVisible = true;

  function getStatusColor() {
    if (!$isAILoaded) return "bg-error";
    if ($aiProcessing) return "bg-warning";
    return "bg-success";
  }

  function getStatusText() {
    if (!$isAILoaded) return "AI Loading...";
    if ($aiProcessing) return "AI Processing...";
    return "AI Ready";
  }

  function getStatusIcon() {
    if (!$isAILoaded) return AlertCircle;
    if ($aiProcessing) return Brain;
    return CheckCircle;
  }

  function startDrag(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    // If currently docked (0,0), we need to set the initial position to the current visual position
    // so it doesn't jump to 0,0 when we start dragging
    if (position.x === 0 && position.y === 0 && aiStatusElement) {
      const rect = aiStatusElement.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      // Update position immediately to switch to absolute positioning mode
      position = { x: initialX, y: initialY };
    } else {
      initialX = position.x;
      initialY = position.y;
    }

    // Prevent text selection during drag
    e.preventDefault();
    if (document?.body) {
      document.body.style.userSelect = "none";
    }

    // Add global event listeners
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", endDrag);
  }

  function drag(e) {
    if (!isDragging) return;

    e.preventDefault();

    // Calculate new position based on mouse movement
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newX = initialX + deltaX;
    let newY = initialY + deltaY;

    // Get window and element dimensions for boundary constraints
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const rect = aiStatusElement?.getBoundingClientRect();

    if (rect) {
      // Constrain to window boundaries
      // Ensure we don't drag off screen
      newX = Math.max(0, Math.min(newX, windowWidth - rect.width));
      newY = Math.max(0, Math.min(newY, windowHeight - rect.height));
    }

    position = { x: newX, y: newY };
  }

  function endDrag() {
    isDragging = false;
    if (document?.body) {
      document.body.style.userSelect = "";
    }

    // Remove global event listeners
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", endDrag);

    // Save position to localStorage
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("aiStatus-position", JSON.stringify(position));
    }
  }

  function toggleMinimized() {
    isMinimized = !isMinimized;
    localStorage.setItem("aiStatus-minimized", isMinimized.toString());
  }

  function hideWindow() {
    isVisible = false;
    localStorage.setItem("aiStatus-visible", "false");
  }

  function resetPosition() {
    position = { x: 0, y: 0 };
    localStorage.removeItem("aiStatus-position");
  }

  // Load saved state on mount
  onMount(() => {
    // Load position
    const savedPosition = localStorage.getItem("aiStatus-position");
    if (savedPosition) {
      try {
        position = JSON.parse(savedPosition);
      } catch (e) {
        position = { x: 0, y: 0 };
      }
    }

    // Load minimized state
    const savedMinimized = localStorage.getItem("aiStatus-minimized");
    if (savedMinimized) {
      isMinimized = savedMinimized === "true";
    }

    // Load visibility state
    const savedVisible = localStorage.getItem("aiStatus-visible");
    if (savedVisible) {
      isVisible = savedVisible === "true";
    }
  });

  onDestroy(() => {
    // Clean up event listeners
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", endDrag);
  });
</script>

{#if isVisible}
  <!-- Floating AI Status Indicator -->
  <div
    bind:this={aiStatusElement}
    class="fixed z-50 {isDragging
      ? 'cursor-grabbing select-none'
      : ''} transition-opacity duration-200"
    style="
      right: {position.x === 0 ? '1.5rem' : 'auto'}; 
      bottom: {position.y === 0 ? '1.5rem' : 'auto'}; 
      transform: {position.x !== 0 || position.y !== 0
      ? `translate(${position.x}px, ${position.y}px)`
      : 'none'};
      {position.x !== 0 ? 'left: 0;' : ''}
      {position.y !== 0 ? 'top: 0;' : ''}
    "
  >
    <div
      class="card bg-base-100 shadow-xl border border-base-content/10 transition-all duration-300 {isMinimized
        ? 'w-auto'
        : 'w-80'}"
    >
      <div class="card-body {isMinimized ? 'p-2' : 'p-4'}">
        <!-- AI Status Header -->
        <div
          class="flex items-center justify-between {isMinimized
            ? 'mb-0'
            : 'mb-3'}"
        >
          <div class="flex items-center gap-2">
            <!-- Drag handle -->
            <button
              class="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-base-200 transition-colors"
              on:mousedown={startDrag}
              title="Drag to move"
            >
              <Move size={14} class="text-base-content/60" />
            </button>

            <div
              class="w-8 h-8 rounded-full {getStatusColor()} flex items-center justify-center shadow-sm"
            >
              <svelte:component
                this={getStatusIcon()}
                size={16}
                class="text-white"
              />
            </div>

            {#if !isMinimized}
              <div class="flex-1">
                <h3 class="font-semibold text-sm">{getStatusText()}</h3>
                <p class="text-xs text-base-content/60">
                  {$aiModel || "Local AI Model"}
                </p>
              </div>
            {/if}
          </div>

          <div class="flex items-center gap-1">
            <!-- Processing indicator -->
            {#if !isMinimized}
              {#if $aiProcessing}
                <div class="loading loading-spinner loading-sm"></div>
              {:else if $isAILoaded}
                <Zap size={14} class="text-success animate-pulse" />
              {/if}
            {/if}

            <!-- Controls -->
            <button
              class="btn btn-ghost btn-xs btn-circle"
              on:click={toggleMinimized}
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {#if isMinimized}
                <svg
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  ></path>
                </svg>
              {:else}
                <svg
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 12H4"
                  ></path>
                </svg>
              {/if}
            </button>

            <button
              class="btn btn-ghost btn-xs btn-circle"
              on:click={hideWindow}
              title="Hide window"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {#if !isMinimized}
          <!-- Current Task -->
          {#if $aiProcessing}
            <div class="mb-3">
              <div class="text-xs text-base-content/60 mb-1">Processing...</div>
              <div class="w-full bg-base-300 rounded-full h-2">
                <div
                  class="bg-primary h-2 rounded-full animate-pulse transition-all duration-1000"
                  style="width: 60%"
                ></div>
              </div>
            </div>
          {/if}

          <!-- Document Status -->
          {#if currentDoc}
            <div class="border-t border-base-content/10 pt-3">
              <div class="text-xs text-base-content/60 mb-2">
                Current Document
              </div>
              <div class="flex items-center justify-between">
                <span
                  class="text-sm font-medium truncate"
                  title={currentDoc.name}
                >
                  {currentDoc.name.length > 18
                    ? currentDoc.name.substring(0, 18) + "..."
                    : currentDoc.name}
                </span>

                {#if analysis}
                  <div class="badge badge-success badge-xs">Analyzed</div>
                {:else}
                  <div class="badge badge-ghost badge-xs">Pending</div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- AI Capabilities -->
          {#if $isAILoaded && !$aiProcessing}
            <div class="border-t border-base-content/10 pt-3">
              <div class="text-xs text-base-content/60 mb-2">Ready For</div>
              <div class="flex flex-wrap gap-1">
                <div class="badge badge-outline badge-xs">Analysis</div>
                <div class="badge badge-outline badge-xs">Validation</div>
                <div class="badge badge-outline badge-xs">Q&A</div>
              </div>
            </div>
          {/if}

          <!-- Controls -->
          <div class="border-t border-base-content/10 pt-3">
            <div class="flex gap-1">
              <button
                class="btn btn-ghost btn-xs flex-1"
                on:click={resetPosition}
                title="Reset position"
              >
                <svg
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8 8 0 1115.356 2m-15.356 0H9"
                  ></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Error State -->
          {#if !$isAILoaded && !$aiProcessing}
            <div class="border-t border-base-content/10 pt-3">
              <div class="alert alert-error alert-sm">
                <AlertCircle size={14} />
                <span class="text-xs">AI failed to load</span>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Show button to restore if hidden -->
{#if !isVisible}
  <button
    class="fixed bottom-4 right-4 z-40 btn btn-primary btn-sm btn-circle"
    on:click={() => {
      isVisible = true;
      localStorage.setItem("aiStatus-visible", "true");
    }}
    title="Show AI Status"
  >
    <Brain size={16} />
  </button>
{/if}

<!-- Compact mobile version -->
<div class="fixed bottom-4 left-4 z-40 lg:hidden">
  <div class="tooltip tooltip-top" data-tip={getStatusText()}>
    <div class="btn btn-circle btn-sm {getStatusColor()} border-none">
      {#if $aiProcessing}
        <span class="loading loading-spinner loading-xs text-white"></span>
      {:else}
        <svelte:component this={getStatusIcon()} size={16} class="text-white" />
      {/if}
    </div>
  </div>
</div>

<style>
  .card {
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.95);
  }

  :global([data-theme="pid-dark"]) .card {
    background: rgba(31, 41, 55, 0.95);
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
