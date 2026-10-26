<script>
  import { 
    recentActivity, 
    activityStats, 
    showActivityLog, 
    clearActivityLog, 
    exportActivityLog 
  } from './stores.js';
  import { 
    Activity, X, Download, Trash2, CheckCircle, AlertCircle, 
    Info, AlertTriangle, Loader2, Clock, TrendingUp, Filter
  } from 'lucide-svelte';
  import { slide } from 'svelte/transition';

  let selectedFilter = 'all';
  let autoScroll = true;
  let logContainer;
  let userScrolling = false;
  let scrollTimeout;

  // Filter activities based on selected type
  $: filteredActivities = $recentActivity.filter(activity => {
    if (selectedFilter === 'all') return true;
    return activity.type === selectedFilter;
  });

  // Auto-scroll to bottom when new activities arrive, but only if user isn't scrolling
  $: if (autoScroll && logContainer && $recentActivity.length > 0 && !userScrolling) {
    setTimeout(() => {
      if (logContainer && !userScrolling) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }, 100);
  }

  function handleScroll() {
    if (!logContainer) return;
    
    userScrolling = true;
    clearTimeout(scrollTimeout);
    
    // Check if user scrolled to the bottom
    const isAtBottom = logContainer.scrollTop >= (logContainer.scrollHeight - logContainer.clientHeight - 5);
    
    if (isAtBottom) {
      // User is at bottom, re-enable auto-scroll
      scrollTimeout = setTimeout(() => {
        userScrolling = false;
      }, 1000);
    } else {
      // User is scrolling up, disable auto-scroll temporarily
      scrollTimeout = setTimeout(() => {
        userScrolling = false;
      }, 3000);
    }
  }

  function getActivityIcon(type) {
    switch (type) {
      case 'success': return CheckCircle;
      case 'error': return AlertCircle;
      case 'warning': return AlertTriangle;
      case 'processing': return Loader2;
      default: return Info;
    }
  }

  function getActivityClass(type) {
    switch (type) {
      case 'success': return 'text-success';
      case 'error': return 'text-error';
      case 'warning': return 'text-warning';
      case 'processing': return 'text-primary';
      default: return 'text-info';
    }
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  function closeActivityLog() {
    showActivityLog.set(false);
  }

  function toggleAutoScroll() {
    autoScroll = !autoScroll;
    if (autoScroll) {
      userScrolling = false;
      // Immediately scroll to bottom when auto-scroll is enabled
      setTimeout(() => {
        if (logContainer) {
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      }, 50);
    }
  }
</script>

{#if $showActivityLog}
  <div 
    class="fixed inset-y-0 right-0 w-80 bg-base-100 border-l border-base-content/20 shadow-2xl z-50"
    transition:slide={{ axis: 'x', duration: 300 }}
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-base-content/20 bg-base-200/50">
      <div class="flex items-center gap-2">
        <Activity size={20} class="text-primary" />
        <h3 class="font-semibold">Activity Log</h3>
        <div class="badge badge-primary badge-sm">{$recentActivity.length}</div>
      </div>
      
      <button 
        class="btn btn-sm btn-ghost btn-square" 
        on:click={closeActivityLog}
        title="Close activity log"
      >
        <X size={16} />
      </button>
    </div>

    <!-- Stats Overview -->
    <div class="p-4 border-b border-base-content/10 bg-gradient-to-r from-primary/5 to-secondary/5">
      <div class="grid grid-cols-4 gap-2 text-xs">
        <div class="text-center">
          <div class="font-semibold text-lg">{$activityStats.last24h}</div>
          <div class="text-base-content/70">Last 24h</div>
        </div>
        <div class="text-center">
          <div class="font-semibold text-lg text-success">{$activityStats.successes}</div>
          <div class="text-base-content/70">Success</div>
        </div>
        <div class="text-center">
          <div class="font-semibold text-lg text-error">{$activityStats.errors}</div>
          <div class="text-base-content/70">Errors</div>
        </div>
        <div class="text-center">
          <div class="font-semibold text-lg text-primary">{$activityStats.processing}</div>
          <div class="text-base-content/70">Active</div>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="p-4 border-b border-base-content/10 space-y-3">
      <!-- Filter -->
      <div class="flex items-center gap-2">
        <Filter size={14} />
        <select 
          bind:value={selectedFilter}
          class="select select-sm select-bordered flex-1"
        >
          <option value="all">All Activities</option>
          <option value="success">Success</option>
          <option value="error">Errors</option>
          <option value="warning">Warnings</option>
          <option value="info">Info</option>
          <option value="processing">Processing</option>
        </select>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-2">
        <button 
          class="btn btn-xs btn-outline gap-1 flex-1"
          on:click={toggleAutoScroll}
          class:btn-active={autoScroll && !userScrolling}
          class:btn-warning={userScrolling}
          title={userScrolling ? 'Manual scrolling detected - auto-scroll paused' : autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
        >
          <TrendingUp size={12} />
          {userScrolling ? 'Paused' : autoScroll ? 'Auto-scroll' : 'Manual'}
        </button>
        
        <button 
          class="btn btn-xs btn-outline gap-1"
          on:click={exportActivityLog}
          title="Export log"
        >
          <Download size={12} />
        </button>
        
        <button 
          class="btn btn-xs btn-outline btn-error gap-1"
          on:click={clearActivityLog}
          title="Clear log"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>

    <!-- Activity List -->
    <div 
      bind:this={logContainer}
      on:scroll={handleScroll}
      class="flex-1 overflow-y-auto p-4 space-y-2 max-h-[calc(100vh-280px)]"
    >
      {#if filteredActivities.length === 0}
        <div class="text-center py-8 text-base-content/50">
          <Activity size={32} class="mx-auto mb-2 opacity-50" />
          <p class="text-sm">
            {selectedFilter === 'all' ? 'No activities yet' : `No ${selectedFilter} activities`}
          </p>
        </div>
      {:else}
        {#each filteredActivities as activity (activity.id)}
          <div 
            class="card card-compact bg-base-200/50 border border-base-content/10 
                   hover:bg-base-200/80 transition-all duration-200 hover:scale-[1.02]"
          >
            <div class="card-body p-3">
              <div class="flex items-start gap-3">
                <!-- Activity Icon -->
                <div class="flex-shrink-0 mt-0.5">
                  {#if activity.type === 'processing'}
                    <Loader2 size={14} class="{getActivityClass(activity.type)} animate-spin" />
                  {:else}
                    <svelte:component this={getActivityIcon(activity.type)} size={14} class={getActivityClass(activity.type)} />
                  {/if}
                </div>
                
                <!-- Activity Content -->
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium leading-tight break-words">
                    {activity.message}
                  </div>
                  
                  <!-- Timestamp -->
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs text-base-content/60 flex items-center gap-1">
                      <Clock size={10} />
                      {formatTimestamp(activity.timestamp)}
                    </span>
                    <span class="text-xs text-base-content/40">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  
                  <!-- Details (if available) -->
                  {#if activity.details}
                    <details class="mt-2">
                      <summary class="text-xs cursor-pointer text-base-content/70 hover:text-base-content">
                        View details
                      </summary>
                      <div class="mt-1 p-2 bg-base-300/50 rounded text-xs font-mono overflow-auto max-h-20">
                        <pre>{JSON.stringify(activity.details, null, 2)}</pre>
                      </div>
                    </details>
                  {/if}
                </div>
                
                <!-- Activity Type Badge -->
                <div class="flex-shrink-0">
                  <div class="badge badge-xs {activity.type === 'success' ? 'badge-success' : 
                                            activity.type === 'error' ? 'badge-error' : 
                                            activity.type === 'warning' ? 'badge-warning' : 
                                            activity.type === 'processing' ? 'badge-primary' : 'badge-info'}">
                    {activity.type}
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Footer -->
    <div class="border-t border-base-content/10 p-3 bg-base-200/50">
      <div class="text-xs text-base-content/60 text-center">
        Showing {filteredActivities.length} of {$recentActivity.length} activities
      </div>
    </div>
  </div>

  <!-- Backdrop -->
  <div 
    class="fixed inset-0 bg-black/20 z-40 lg:hidden" 
    on:click={closeActivityLog}
    transition:slide={{ duration: 300 }}
  ></div>
{/if}

<style>
  .card {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .card:hover {
    transform: translateY(-1px) scale(1.01);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }

  /* Custom scrollbar */
  .overflow-y-auto::-webkit-scrollbar {
    width: 4px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb {
    /* fallback color instead of theme(...) to avoid build errors */
    background: rgba(0,0,0,0.12);
    border-radius: 2px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(0,0,0,0.18);
  }

  /* Smooth animations */
  details[open] summary ~ * {
    animation: slideDown 0.2s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Badge animations */
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