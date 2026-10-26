<script>
  import { 
    theme, sidebarOpen, currentView, documents, isAILoaded, hasDocuments,
    aiConfig, showActivityLog, activityStats, exportActivityLog, clearActivityLog 
  } from './stores.js';
  import { toggleTheme, switchToUploadView, switchToAnalysisView, switchToComparisonView } from './stores.js';
  import { 
    Sun, Moon, Menu, Upload, BarChart3, GitCompare, Settings, 
    Bot, Activity, Brain, Download, Trash2, Palette, Sparkles 
  } from 'lucide-svelte';
  
  export let openSettings; // Function to open AI settings
</script>

<header class="bg-base-100 border-b border-base-content/10 px-4 py-3 flex items-center justify-between shadow-sm">
  <!-- Left section -->
  <div class="flex items-center gap-4">
    <!-- Mobile menu button -->
    <button 
      class="btn btn-ghost btn-sm lg:hidden"
      on:click={() => sidebarOpen.set(!$sidebarOpen)}
    >
      <Menu size={20} />
    </button>
    
    <!-- Logo and title -->
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg flex items-center justify-center shadow-md">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      </div>
      <div class="hidden sm:block">
        <h1 class="text-xl font-bold gradient-text">P&ID Analyzer v2.0</h1>
        <p class="text-xs text-base-content/60">Enhanced AI-Powered Blueprint Analysis</p>
      </div>
    </div>
  </div>

  <!-- Center navigation -->
  <nav class="hidden md:flex items-center gap-2">
    <!-- Upload view -->
    <button 
      class="btn btn-ghost btn-sm {$currentView === 'upload' ? 'btn-active' : ''} transition-all duration-200"
      on:click={switchToUploadView}
    >
      <Upload size={16} />
      Upload
    </button>
    
    <!-- Analysis view -->
    <button 
      class="btn btn-ghost btn-sm {$currentView === 'analysis' ? 'btn-active' : ''} {!$hasDocuments ? 'btn-disabled' : ''} transition-all duration-200"
      on:click={switchToAnalysisView}
      disabled={!$hasDocuments}
    >
      <BarChart3 size={16} />
      Analysis
    </button>
    
    <!-- Comparison view -->
    <button 
      class="btn btn-ghost btn-sm {$currentView === 'comparison' ? 'btn-active' : ''} {$documents.length < 2 ? 'btn-disabled' : ''} transition-all duration-200"
      on:click={switchToComparisonView}
      disabled={$documents.length < 2}
    >
      <GitCompare size={16} />
      Compare
    </button>
  </nav>

  <!-- Right section -->
  <div class="flex items-center gap-3">
    <!-- Enhanced AI Status with name -->
    <div class="hidden sm:flex items-center gap-2 text-sm bg-base-200/50 px-3 py-1 rounded-full">
      {#if $isAILoaded}
        <Bot size={14} class="text-primary" />
        <span class="font-medium text-primary">{$aiConfig.name}</span>
        <div class="w-2 h-2 bg-success rounded-full animate-pulse"></div>
      {:else}
        <Brain size={14} class="text-warning animate-pulse" />
        <span class="text-warning">Loading AI...</span>
        <div class="w-2 h-2 bg-warning rounded-full animate-pulse"></div>
      {/if}
    </div>
    
    <!-- Activity Log Button -->
    <button 
      class="btn btn-ghost btn-sm btn-circle relative transition-all duration-200 hover:scale-110"
      on:click={() => showActivityLog.set(!$showActivityLog)}
      class:btn-active={$showActivityLog}
      title="Activity Log"
    >
      <Activity size={18} class={$showActivityLog ? 'text-primary' : ''} />
      
      <!-- Activity counter badge -->
      {#if $activityStats.last24h > 0}
        <div class="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
          <span class="text-xs text-white font-bold">
            {$activityStats.last24h > 99 ? '99+' : $activityStats.last24h}
          </span>
        </div>
      {/if}
    </button>

    <!-- Document counter -->
    {#if $documents.length > 0}
      <div class="badge badge-primary badge-sm animate-pulse">
        {$documents.length} doc{$documents.length !== 1 ? 's' : ''}
      </div>
    {/if}
    
    <!-- Theme toggle -->
    <button 
      class="btn btn-ghost btn-sm btn-circle transition-all duration-200 hover:scale-110"
      on:click={toggleTheme}
      title="Toggle theme"
    >
      {#if $theme === 'pid-dark'}
        <Sun size={18} class="text-yellow-400" />
      {:else}
        <Moon size={18} class="text-blue-400" />
      {/if}
    </button>
    
    <!-- Enhanced Settings dropdown -->
    <div class="dropdown dropdown-end">
      <button 
        tabindex="0" 
        role="button" 
        class="btn btn-ghost btn-sm btn-circle transition-all duration-200 hover:scale-110"
        title="Settings"
      >
        <Settings size={18} />
      </button>
      
      <div tabindex="0" class="dropdown-content z-[1] menu p-2 shadow-xl bg-base-100 rounded-box w-64 mt-2 border border-base-content/10">
        <!-- AI Settings Section -->
        <li class="menu-title">
          <span class="flex items-center gap-2">
            <Bot size={14} />
            AI Assistant
          </span>
        </li>
        <li>
          <button on:click={openSettings} class="gap-3">
            <Brain size={16} class="text-primary" />
            <div class="flex-1 text-left">
              <div class="font-medium">Configure AI</div>
              <div class="text-xs opacity-70">Name: {$aiConfig.name}</div>
            </div>
          </button>
        </li>
        
        <div class="divider my-1"></div>
        
        <!-- Activity Section -->
        <li class="menu-title">
          <span class="flex items-center gap-2">
            <Activity size={14} />
            Activity & Logs
          </span>
        </li>
        <li>
          <button on:click={() => showActivityLog.set(!$showActivityLog)} class="gap-3">
            <Activity size={16} class="text-secondary" />
            <div class="flex-1 text-left">
              <div class="font-medium">{$showActivityLog ? 'Hide' : 'Show'} Activity Log</div>
              <div class="text-xs opacity-70">{$activityStats.last24h} activities today</div>
            </div>
          </button>
        </li>
        <li>
          <button on:click={exportActivityLog} class="gap-3">
            <Download size={16} class="text-info" />
            <span>Export Activity Log</span>
          </button>
        </li>
        <li>
          <button on:click={clearActivityLog} class="gap-3">
            <Trash2 size={16} class="text-warning" />
            <span>Clear Activity Log</span>
          </button>
        </li>
        
        <div class="divider my-1"></div>
        
        <!-- Data Management Section -->
        <li class="menu-title">
          <span class="flex items-center gap-2">
            <Settings size={14} />
            Data Management
          </span>
        </li>
        <li>
          <button on:click={() => console.log('Export settings')} class="gap-3">
            <Download size={16} />
            <span>Export All Data</span>
          </button>
        </li>
        <li>
          <button on:click={() => localStorage.clear()} class="gap-3 text-error">
            <Trash2 size={16} />
            <span>Clear All Data</span>
          </button>
        </li>
        
        <div class="divider my-1"></div>
        
        <!-- Theme Section -->
        <li class="menu-title">
          <span class="flex items-center gap-2">
            <Palette size={14} />
            Appearance
          </span>
        </li>
        <li>
          <button 
            class="{$theme === 'pid-dark' ? 'active' : ''} gap-3" 
            on:click={() => theme.set('pid-dark')}
          >
            <Moon size={16} />
            <span>Dark Mode</span>
          </button>
        </li>
        <li>
          <button 
            class="{$theme === 'pid-light' ? 'active' : ''} gap-3" 
            on:click={() => theme.set('pid-light')}
          >
            <Sun size={16} />
            <span>Light Mode</span>
          </button>
        </li>
      </div>
    </div>
  </div>
</header>

<!-- Enhanced Mobile navigation -->
<div class="md:hidden bg-base-100 border-b border-base-content/10 px-4 py-2 shadow-sm">
  <div class="flex gap-2">
    <button 
      class="btn btn-ghost btn-sm flex-1 {$currentView === 'upload' ? 'btn-active' : ''} transition-all duration-200"
      on:click={switchToUploadView}
    >
      <Upload size={14} />
      Upload
    </button>
    
    <button 
      class="btn btn-ghost btn-sm flex-1 {$currentView === 'analysis' ? 'btn-active' : ''} {!$hasDocuments ? 'btn-disabled' : ''} transition-all duration-200"
      on:click={switchToAnalysisView}
      disabled={!$hasDocuments}
    >
      <BarChart3 size={14} />
      Analysis
    </button>
    
    <button 
      class="btn btn-ghost btn-sm flex-1 {$currentView === 'comparison' ? 'btn-active' : ''} {$documents.length < 2 ? 'btn-disabled' : ''} transition-all duration-200"
      on:click={switchToComparisonView}
      disabled={$documents.length < 2}
    >
      <GitCompare size={14} />
      Compare
    </button>
    
    <!-- Mobile AI Settings & Activity -->
    <button 
      class="btn btn-ghost btn-sm {$showActivityLog ? 'btn-active' : ''}"
      on:click={() => showActivityLog.set(!$showActivityLog)}
      title="Activity"
    >
      <Activity size={14} />
    </button>
    
    <button 
      class="btn btn-ghost btn-sm"
      on:click={openSettings}
      title="AI Settings"
    >
      <Bot size={14} />
    </button>
  </div>
</div>

<style>
  .gradient-text {
    background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #06B6D4 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: gradient-shift 4s ease-in-out infinite;
  }

  @keyframes gradient-shift {
    0%, 100% { 
      background-position: 0% 50%; 
    }
    50% { 
      background-position: 100% 50%; 
    }
  }

  /* Enhanced button hover effects */
  .btn {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .btn:hover {
    transform: translateY(-1px);
  }
  
  .btn-circle:hover {
    transform: scale(1.1);
  }

  /* Enhanced dropdown styling */
  .dropdown-content {
    animation: dropdownSlide 0.2s ease-out;
  }
  
  @keyframes dropdownSlide {
    from {
      opacity: 0;
      transform: translateY(-10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Badge animation */
  .badge {
    animation: fadeInScale 0.3s ease-out;
  }
  
  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
