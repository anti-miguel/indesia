<script>
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  // Components
  import Header from "./lib/Header.svelte";
  import Sidebar from "./lib/Sidebar.svelte";
  import DocumentViewer from "./lib/DocumentViewerSimple.svelte";
  import ChatInterface from "./lib/ChatInterface.svelte";
  import ComparisonView from "./lib/ComparisonViewEnhanced.svelte";
  import UploadZoneEnhanced from "./lib/UploadZoneEnhanced.svelte";
  import AIStatus from "./lib/AIStatus.svelte";
  import LoadingScreen from "./lib/LoadingScreen.svelte";
  import ActivityLog from "./lib/ActivityLog.svelte";
  import AISettings from "./lib/AISettings.svelte";

  // Stores
  import {
    documents,
    currentDocument,
    aiModel,
    isAILoaded,
    currentView,
    sidebarOpen,
    theme,
    aiServiceInstance,
    showActivityLog,
    aiConfig,
    addActivityLog,
    handleError,
  } from "./lib/stores.js";

  // Services
  import { loadAIService } from "./lib/services/adaptiveAiService.js";
  import { documentService } from "./lib/services/documentService.js";

  let aiService;
  let initializeAI;

  let loading = true;
  let errorMessage = "";
  let appReady = false;
  let showSettings = false;

  onMount(async () => {
    const startTime = Date.now();

    try {
      addActivityLog("Application initialization started", "info");

      // Initialize document service
      await documentService.initialize();
      addActivityLog("Document service initialized", "success");

      // Load appropriate AI service (full or simple)
      try {
        const { aiService: loadedAI, initializeAI: initFunc } =
          await loadAIService();
        aiService = loadedAI;
        initializeAI = initFunc;

        // Store the AI service instance immediately
        aiServiceInstance.set(loadedAI);

        await initializeAI();
        addActivityLog("AI service loaded and initialized", "success");
      } catch (aiError) {
        console.log(
          "AI service initialization failed, but continuing:",
          aiError,
        );
        addActivityLog(
          "AI service initialization failed, continuing with limited functionality",
          "warning",
        );
        // Don't treat this as a fatal error - some features may not work but the app can still function
      }

      // Check for saved theme
      const savedTheme = localStorage.getItem("pid-theme") || "pid-dark";
      theme.set(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
      addActivityLog(`Theme loaded: ${savedTheme}`, "info");

      const initTime = Date.now() - startTime;
      addActivityLog(`Application initialized in ${initTime}ms`, "success");

      appReady = true;
    } catch (error) {
      console.error("Failed to initialize application:", error);
      errorMessage =
        "Failed to initialize the application. Some features may not work properly.";
      handleError(error, "Application Initialization");
      appReady = true; // Still allow the app to load
    } finally {
      // Keep loading screen visible longer for user appreciation
      setTimeout(() => {
        loading = false;
        addActivityLog("Welcome to P&ID Blueprint Analyzer v2.0!", "success");
      }, 2500); // Extended loading time
    }
  });

  // Theme subscription
  theme.subscribe((value) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", value);
      localStorage.setItem("pid-theme", value);
    }
  });

  // Handle AI settings
  function openSettings() {
    showSettings = true;
    addActivityLog("Settings panel opened", "info");
  }

  function closeSettings() {
    showSettings = false;
    addActivityLog("Settings panel closed", "info");
  }
</script>

{#if loading}
  <LoadingScreen />
{:else if errorMessage}
  <div class="min-h-screen bg-base-300 flex items-center justify-center p-4">
    <div class="card bg-error/10 border border-error/30 max-w-md">
      <div class="card-body text-center">
        <h2 class="card-title text-error justify-center">
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          Initialization Error
        </h2>
        <p class="text-base-content/70">{errorMessage}</p>
        <div class="card-actions justify-center mt-4">
          <button
            class="btn btn-error btn-outline"
            onclick={() => location.reload()}
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  </div>
{:else if appReady}
  <div class="min-h-screen bg-base-300 flex flex-col relative overflow-hidden">
    <!-- Header -->
    <Header {openSettings} />

    <!-- Main content area -->
    <div class="flex flex-1 overflow-hidden min-h-0">
      <!-- Sidebar -->
      <Sidebar />

      <!-- Main content -->
      <main class="flex-1 flex overflow-hidden min-w-0">
        {#if $currentView === "upload" || $documents.length === 0}
          <!-- Upload view with enhanced component -->
          <div
            class="flex-1 flex items-center justify-center p-6 overflow-hidden"
          >
            <div class="max-w-full w-full">
              <div class="text-center mb-8">
                <h1 class="text-4xl font-bold gradient-text mb-4">
                  P&ID Blueprint Analyzer
                </h1>
                <p class="text-xl text-base-content/70">
                  Enhanced AI-powered analysis with batch processing and
                  real-time monitoring
                </p>
                <div
                  class="flex items-center justify-center gap-4 mt-4 text-sm text-base-content/60"
                >
                  <span class="flex items-center gap-1">
                    <svg
                      class="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clip-rule="evenodd"
                      ></path>
                    </svg>
                    AI Assistant: {$aiConfig.name}
                  </span>
                  <span class="flex items-center gap-1">
                    <svg
                      class="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      ></path>
                    </svg>
                    Enhanced Upload v2.0
                  </span>
                </div>
              </div>
              <UploadZoneEnhanced />
            </div>
          </div>
        {:else if $currentView === "analysis"}
          <!-- Analysis view with document viewer and chat -->
          <div class="flex flex-1 gap-2 p-2 overflow-hidden min-h-0">
            <!-- Document viewer - Take most of the space -->
            <div class="flex-1 min-w-0 overflow-hidden">
              <DocumentViewer />
            </div>

            <!-- Chat interface - Fixed width with overflow handling -->
            <div class="w-80 flex-shrink-0 min-w-0 overflow-hidden">
              <ChatInterface />
            </div>
          </div>
        {:else if $currentView === "comparison"}
          <!-- Comparison view -->
          <div class="flex-1 p-6 overflow-hidden">
            <ComparisonView />
          </div>
        {/if}
      </main>
    </div>

    <!-- AI Status indicator -->
    <AIStatus />

    <!-- Activity Log Panel -->
    <ActivityLog />

    <!-- AI Settings Modal -->
    <AISettings bind:showSettings />

    <!-- Mobile sidebar overlay -->
    {#if $sidebarOpen}
      <div
        class="fixed inset-0 bg-black/50 z-40 lg:hidden"
        on:click={() => sidebarOpen.set(false)}
      ></div>
    {/if}
  </div>
{/if}

<style>
  :global(html) {
    scroll-behavior: smooth;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }

  .gradient-text {
    background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #06b6d4 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: gradient-shift 4s ease-in-out infinite;
  }

  @keyframes gradient-shift {
    0%,
    100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }

  /* Enhanced smooth transitions */
  * {
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease,
      color 0.3s ease;
  }
</style>
