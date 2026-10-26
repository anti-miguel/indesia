<script>
  import { 
    documents, 
    currentDocument, 
    sidebarOpen, 
    analysisResults, 
    validationResults,
    currentView
  } from './stores.js';
  import { removeDocument, switchToAnalysisView, showNotification } from './stores.js';
  import { documentService } from './services/documentService.js';
  import { formatDistanceToNow } from 'date-fns';
  import { 
    FileText, 
    Image, 
    Trash2, 
    Eye, 
    CheckCircle, 
    AlertTriangle, 
    Clock,
    BarChart3,
    Settings
  } from 'lucide-svelte';

  function selectDocument(docId) {
    currentDocument.set(docId);
    switchToAnalysisView(docId);
    sidebarOpen.set(false); // Close sidebar on mobile
  }

  function handleDeleteDocument(docId) {
    if (confirm('Are you sure you want to delete this document?')) {
      removeDocument(docId);
      showNotification('Document deleted successfully', 'info');
    }
  }

  function getDocumentIcon(doc) {
    return doc.type === 'pdf' ? FileText : Image;
  }

  function getValidationStatus(docId) {
    const validation = $validationResults[docId];
    if (!validation) return null;
    
    if (validation.isValid) return 'valid';
    if (validation.issues && validation.issues.length > 0) return 'error';
    if (validation.warnings && validation.warnings.length > 0) return 'warning';
    
    return 'unknown';
  }

  function getValidationIcon(status) {
    switch (status) {
      case 'valid': return CheckCircle;
      case 'error': return AlertTriangle;
      case 'warning': return AlertTriangle;
      default: return Clock;
    }
  }

  function getValidationColor(status) {
    switch (status) {
      case 'valid': return 'text-success';
      case 'error': return 'text-error';
      case 'warning': return 'text-warning';
      default: return 'text-base-content/50';
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
</script>

<!-- Sidebar -->
<aside class="
  {$sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
  lg:translate-x-0
  fixed lg:relative 
  top-0 left-0 
  z-50 lg:z-auto
  w-80 h-full 
  bg-base-100 
  border-r border-base-content/10
  transition-transform duration-300 ease-in-out
  flex flex-col
">
  <!-- Sidebar header -->
  <div class="p-4 border-b border-base-content/10">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-semibold text-base-content">Documents</h2>
      <div class="badge badge-primary badge-sm">
        {$documents.length}
      </div>
    </div>
    
    {#if $documents.length > 0}
      <div class="text-sm text-base-content/60">
        Click any document to analyze
      </div>
    {/if}
  </div>

  <!-- Document list -->
  <div class="flex-1 overflow-y-auto">
    {#if $documents.length === 0}
      <!-- Empty state -->
      <div class="p-6 text-center text-base-content/50">
        <div class="w-16 h-16 mx-auto mb-4 bg-base-200 rounded-full flex items-center justify-center">
          <FileText size={24} />
        </div>
        <p class="font-medium mb-2">No documents uploaded</p>
        <p class="text-sm">Upload P&ID drawings to get started</p>
      </div>
    {:else}
      <!-- Document cards -->
      <div class="p-4 space-y-3">
        {#each $documents as doc (doc.id)}
          <div 
            class="card bg-base-200 hover:bg-base-300 cursor-pointer transition-all duration-200 {$currentDocument === doc.id ? 'ring-2 ring-primary' : ''}"
            on:click={() => selectDocument(doc.id)}
          >
            <div class="card-body p-4">
              <!-- Document header -->
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <svelte:component this={getDocumentIcon(doc)} size={16} class="text-primary" />
                </div>
                
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-sm truncate" title={doc.name}>
                    {doc.name}
                  </h3>
                  
                  <div class="flex items-center gap-2 mt-1 text-xs text-base-content/60">
                    <span>{formatFileSize(doc.size)}</span>
                    
                    {#if doc.type === 'pdf' && doc.pageCount}
                      <span>•</span>
                      <span>{doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}</span>
                    {/if}
                    
                    <span>•</span>
                    <span>{formatDistanceToNow(doc.uploadedAt)} ago</span>
                  </div>
                </div>
                
                <!-- Actions -->
                <div class="dropdown dropdown-end">
                  <button 
                    tabindex="0" 
                    class="btn btn-ghost btn-xs btn-circle"
                    on:click|stopPropagation
                  >
                    <Settings size={12} />
                  </button>
                  <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40">
                    <li>
                      <button 
                        class="text-sm"
                        on:click|stopPropagation={() => selectDocument(doc.id)}
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </li>
                    <li>
                      <button 
                        class="text-sm text-error hover:bg-error/10"
                        on:click|stopPropagation={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Analysis status -->
              {#if doc.analyzed}
                <div class="mt-3 space-y-2">
                  <!-- Analysis timestamp -->
                  <div class="flex items-center gap-2 text-xs text-base-content/60">
                    <BarChart3 size={12} />
                    <span>Analyzed {formatDistanceToNow(doc.analysisTimestamp)} ago</span>
                  </div>
                  
                  <!-- Validation status -->
                  {#if getValidationStatus(doc.id)}
                    {@const status = getValidationStatus(doc.id)}
                    {@const validation = $validationResults[doc.id]}
                    <div class="flex items-center gap-2 text-xs">
                      <svelte:component 
                        this={getValidationIcon(status)} 
                        size={12} 
                        class={getValidationColor(status)} 
                      />
                      <span class={getValidationColor(status)}>
                        {#if status === 'valid'}
                          Valid Drawing
                        {:else if status === 'error'}
                          {validation.issues?.length || 0} Issue{validation.issues?.length !== 1 ? 's' : ''}
                        {:else if status === 'warning'}
                          {validation.warnings?.length || 0} Warning{validation.warnings?.length !== 1 ? 's' : ''}
                        {:else}
                          Not Validated
                        {/if}
                      </span>
                    </div>
                  {/if}

                  <!-- Quick stats -->
                  {#if $analysisResults[doc.id]}
                    {@const analysis = $analysisResults[doc.id]}
                    <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
                      {#if analysis.equipment}
                        <div class="bg-base-300 rounded p-2 text-center">
                          <div class="font-medium text-primary">
                            {Object.values(analysis.equipment).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)}
                          </div>
                          <div class="text-base-content/60">Equipment</div>
                        </div>
                      {/if}
                      
                      {#if analysis.instrumentation}
                        <div class="bg-base-300 rounded p-2 text-center">
                          <div class="font-medium text-secondary">
                            {analysis.instrumentation.total || 0}
                          </div>
                          <div class="text-base-content/60">Instruments</div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {:else}
                <!-- Not analyzed yet -->
                <div class="mt-3 text-xs text-base-content/60 flex items-center gap-2">
                  <Clock size={12} />
                  <span>Click to analyze</span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Sidebar footer -->
  {#if $documents.length > 0}
    <div class="p-4 border-t border-base-content/10">
      <div class="text-xs text-base-content/60 text-center">
        {$documents.filter(d => d.analyzed).length} of {$documents.length} analyzed
      </div>
      
      {#if $currentView === 'comparison' && $documents.length >= 2}
        <div class="mt-2">
          <div class="text-xs text-accent text-center font-medium">
            Comparison Mode Active
          </div>
        </div>
      {/if}
    </div>
  {/if}
</aside>
