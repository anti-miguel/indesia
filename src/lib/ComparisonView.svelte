<script>
  import { onMount } from 'svelte';
  import { 
    documents, 
    selectedDocuments, 
    analysisResults, 
    validationResults,
    extractedElements,
    aiServiceInstance
  } from './stores.js';
  import { showNotification } from './stores.js';
  import { documentService } from './services/documentService.js';
  import { 
    GitCompare, 
    FileText, 
    BarChart3, 
    AlertTriangle, 
    CheckCircle, 
    ArrowRight,
    Shuffle
  } from 'lucide-svelte';

  let selectedDoc1 = null;
  let selectedDoc2 = null;
  let comparisonResult = null;
  let isComparing = false;

  $: availableDocs = $documents.filter(doc => doc.processed);
  $: doc1Data = selectedDoc1 ? availableDocs.find(d => d.id === selectedDoc1) : null;
  $: doc2Data = selectedDoc2 ? availableDocs.find(d => d.id === selectedDoc2) : null;
  $: doc1Analysis = selectedDoc1 ? $analysisResults[selectedDoc1] : null;
  $: doc2Analysis = selectedDoc2 ? $analysisResults[selectedDoc2] : null;
  $: doc1Validation = selectedDoc1 ? $validationResults[selectedDoc1] : null;
  $: doc2Validation = selectedDoc2 ? $validationResults[selectedDoc2] : null;

  onMount(() => {
    // Auto-select first two documents if available
    if ($selectedDocuments.length >= 2) {
      selectedDoc1 = $selectedDocuments[0];
      selectedDoc2 = $selectedDocuments[1];
    } else if (availableDocs.length >= 2) {
      selectedDoc1 = availableDocs[0].id;
      selectedDoc2 = availableDocs[1].id;
    }
  });

  async function performComparison() {
    if (!selectedDoc1 || !selectedDoc2 || !doc1Data || !doc2Data) {
      showNotification('Please select two documents to compare', 'warning');
      return;
    }

    isComparing = true;

    try {
      // Get document text for both
      const doc1Text = await documentService.extractText(doc1Data);
      const doc2Text = await documentService.extractText(doc2Data);
      
      // Compare analyses if available
      const comparison = {
        documents: {
          doc1: { name: doc1Data.name, id: selectedDoc1 },
          doc2: { name: doc2Data.name, id: selectedDoc2 }
        },
        equipment: compareEquipment(),
        instruments: compareInstruments(),
        validation: compareValidation(),
        textual: compareTextual(doc1Text, doc2Text),
        summary: generateComparisonSummary()
      };

      comparisonResult = comparison;
      showNotification('Comparison completed successfully', 'success');

    } catch (error) {
      console.error('Comparison failed:', error);
      showNotification(`Comparison failed: ${error.message}`, 'error');
    } finally {
      isComparing = false;
    }
  }

  function compareEquipment() {
    const analysis1 = doc1Analysis?.equipment || {};
    const analysis2 = doc2Analysis?.equipment || {};
    
    const allTypes = new Set([...Object.keys(analysis1), ...Object.keys(analysis2)]);
    const comparison = {};
    
    for (const type of allTypes) {
      const items1 = Array.isArray(analysis1[type]) ? analysis1[type] : [];
      const items2 = Array.isArray(analysis2[type]) ? analysis2[type] : [];
      
      comparison[type] = {
        doc1: items1,
        doc2: items2,
        added: items2.filter(item => !items1.includes(item)),
        removed: items1.filter(item => !items2.includes(item)),
        common: items1.filter(item => items2.includes(item))
      };
    }
    
    return comparison;
  }

  function compareInstruments() {
    const inst1 = doc1Analysis?.instrumentation || {};
    const inst2 = doc2Analysis?.instrumentation || {};
    
    const categories = ['pressureInstruments', 'temperatureInstruments', 'flowInstruments', 'levelInstruments'];
    const comparison = {};
    
    for (const category of categories) {
      const items1 = Array.isArray(inst1[category]) ? inst1[category] : [];
      const items2 = Array.isArray(inst2[category]) ? inst2[category] : [];
      
      comparison[category] = {
        doc1: items1,
        doc2: items2,
        added: items2.filter(item => !items1.includes(item)),
        removed: items1.filter(item => !items2.includes(item)),
        common: items1.filter(item => items2.includes(item))
      };
    }
    
    return comparison;
  }

  function compareValidation() {
    const val1 = doc1Validation || {};
    const val2 = doc2Validation || {};
    
    return {
      validity: {
        doc1: val1.isValid || false,
        doc2: val2.isValid || false,
        improved: !val1.isValid && val2.isValid,
        degraded: val1.isValid && !val2.isValid
      },
      scores: {
        doc1: val1.overallScore || 0,
        doc2: val2.overallScore || 0,
        difference: (val2.overallScore || 0) - (val1.overallScore || 0)
      },
      issues: {
        doc1: val1.issues || [],
        doc2: val2.issues || [],
        resolved: (val1.issues || []).filter(issue => !(val2.issues || []).includes(issue)),
        new: (val2.issues || []).filter(issue => !(val1.issues || []).includes(issue))
      }
    };
  }

  function compareTextual(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    const uniqueWords1 = new Set(words1);
    const uniqueWords2 = new Set(words2);
    
    const commonWords = [...uniqueWords1].filter(word => uniqueWords2.has(word));
    const similarity = commonWords.length / Math.max(uniqueWords1.size, uniqueWords2.size);
    
    return {
      similarity: Math.round(similarity * 100),
      wordCount1: words1.length,
      wordCount2: words2.length,
      uniqueWords1: uniqueWords1.size,
      uniqueWords2: uniqueWords2.size,
      commonWords: commonWords.length
    };
  }

  function generateComparisonSummary() {
    if (!comparisonResult) return null;
    
    const summary = {
      majorChanges: [],
      improvements: [],
      concerns: [],
      statistics: {}
    };
    
    // Analyze equipment changes
    const equipmentChanges = Object.values(comparisonResult.equipment || {})
      .reduce((acc, eq) => ({
        added: acc.added + eq.added.length,
        removed: acc.removed + eq.removed.length
      }), { added: 0, removed: 0 });
    
    if (equipmentChanges.added > 0) {
      summary.majorChanges.push(`${equipmentChanges.added} equipment item(s) added`);
    }
    if (equipmentChanges.removed > 0) {
      summary.majorChanges.push(`${equipmentChanges.removed} equipment item(s) removed`);
    }
    
    // Analyze validation changes
    if (comparisonResult.validation?.validity?.improved) {
      summary.improvements.push('Drawing validation improved');
    } else if (comparisonResult.validation?.validity?.degraded) {
      summary.concerns.push('Drawing validation degraded');
    }
    
    // Score difference
    const scoreDiff = comparisonResult.validation?.scores?.difference || 0;
    if (scoreDiff > 10) {
      summary.improvements.push(`Validation score improved by ${scoreDiff} points`);
    } else if (scoreDiff < -10) {
      summary.concerns.push(`Validation score decreased by ${Math.abs(scoreDiff)} points`);
    }
    
    return summary;
  }

  function swapDocuments() {
    const temp = selectedDoc1;
    selectedDoc1 = selectedDoc2;
    selectedDoc2 = temp;
    comparisonResult = null;
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
</script>

<div class="h-full flex flex-col">
  <!-- Header -->
  <div class="bg-base-100 border-b border-base-content/10 p-4">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-bold gradient-text mb-1">Document Comparison</h2>
        <p class="text-sm text-base-content/60">Compare two P&ID drawings to identify changes and improvements</p>
      </div>
      
      <div class="flex items-center gap-2">
        <button 
          class="btn btn-ghost btn-sm btn-circle"
          on:click={swapDocuments}
          title="Swap documents"
          disabled={!selectedDoc1 || !selectedDoc2}
        >
          <Shuffle size={16} />
        </button>
        
        <button 
          class="btn btn-primary btn-sm"
          on:click={performComparison}
          disabled={!selectedDoc1 || !selectedDoc2 || isComparing}
        >
          {#if isComparing}
            <span class="loading loading-spinner loading-sm"></span>
            Comparing...
          {:else}
            <GitCompare size={16} />
            Compare
          {/if}
        </button>
      </div>
    </div>

    <!-- Document selectors -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Document 1 -->
      <div class="card bg-base-200">
        <div class="card-body p-4">
          <h3 class="font-medium text-sm mb-2">Document 1 (Original)</h3>
          <select 
            bind:value={selectedDoc1}
            class="select select-bordered select-sm w-full"
            on:change={() => comparisonResult = null}
          >
            <option value={null}>Select first document...</option>
            {#each availableDocs as doc}
              <option value={doc.id}>{doc.name}</option>
            {/each}
          </select>
          
          {#if doc1Data}
            <div class="mt-2 text-xs text-base-content/60 space-y-1">
              <div>Size: {formatFileSize(doc1Data.size)}</div>
              <div>Type: {doc1Data.type.toUpperCase()}</div>
              {#if doc1Data.pageCount}
                <div>Pages: {doc1Data.pageCount}</div>
              {/if}
              {#if doc1Analysis}
                <div class="text-success">✓ Analyzed</div>
              {:else}
                <div class="text-warning">⚠ Not analyzed</div>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Document 2 -->
      <div class="card bg-base-200">
        <div class="card-body p-4">
          <h3 class="font-medium text-sm mb-2">Document 2 (Revision)</h3>
          <select 
            bind:value={selectedDoc2}
            class="select select-bordered select-sm w-full"
            on:change={() => comparisonResult = null}
          >
            <option value={null}>Select second document...</option>
            {#each availableDocs as doc}
              <option value={doc.id}>{doc.name}</option>
            {/each}
          </select>
          
          {#if doc2Data}
            <div class="mt-2 text-xs text-base-content/60 space-y-1">
              <div>Size: {formatFileSize(doc2Data.size)}</div>
              <div>Type: {doc2Data.type.toUpperCase()}</div>
              {#if doc2Data.pageCount}
                <div>Pages: {doc2Data.pageCount}</div>
              {/if}
              {#if doc2Analysis}
                <div class="text-success">✓ Analyzed</div>
              {:else}
                <div class="text-warning">⚠ Not analyzed</div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Comparison Results -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if !selectedDoc1 || !selectedDoc2}
      <!-- Selection prompt -->
      <div class="text-center py-16">
        <div class="w-20 h-20 bg-base-200 rounded-full mx-auto mb-4 flex items-center justify-center">
          <GitCompare size={32} class="text-base-content/50" />
        </div>
        <h3 class="text-xl font-semibold mb-2">Select Documents to Compare</h3>
        <p class="text-base-content/60 mb-6">Choose two P&ID drawings to analyze changes and differences</p>
        
        {#if availableDocs.length < 2}
          <div class="alert alert-warning max-w-md mx-auto">
            <AlertTriangle size={16} />
            <span>You need at least 2 documents to perform comparison. Please upload more documents.</span>
          </div>
        {/if}
      </div>
      
    {:else if !comparisonResult}
      <!-- Ready to compare -->
      <div class="text-center py-16">
        <div class="w-20 h-20 bg-primary/10 rounded-full mx-auto mb-4 flex items-center justify-center">
          <GitCompare size={32} class="text-primary" />
        </div>
        <h3 class="text-xl font-semibold mb-2">Ready to Compare</h3>
        <p class="text-base-content/60 mb-6">
          Compare <strong>{doc1Data.name}</strong> with <strong>{doc2Data.name}</strong>
        </p>
        <button 
          class="btn btn-primary"
          on:click={performComparison}
          disabled={isComparing}
        >
          {#if isComparing}
            <span class="loading loading-spinner loading-sm"></span>
            Analyzing Differences...
          {:else}
            <GitCompare size={18} />
            Start Comparison
          {/if}
        </button>
      </div>
      
    {:else}
      <!-- Comparison results -->
      <div class="space-y-6">
        <!-- Summary -->
        <div class="card bg-base-100 border border-base-content/10">
          <div class="card-body">
            <h3 class="card-title text-lg">Comparison Summary</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <!-- Document info -->
              <div class="space-y-3">
                <div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
                  <FileText size={16} class="text-primary" />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">{doc1Data.name}</div>
                    <div class="text-xs text-base-content/60">Original</div>
                  </div>
                </div>
                
                <div class="flex items-center justify-center py-2">
                  <ArrowRight size={20} class="text-base-content/50" />
                </div>
                
                <div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
                  <FileText size={16} class="text-secondary" />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">{doc2Data.name}</div>
                    <div class="text-xs text-base-content/60">Revision</div>
                  </div>
                </div>
              </div>
              
              <!-- Validation comparison -->
              {#if comparisonResult.validation}
                <div class="space-y-3">
                  <h4 class="font-medium text-sm">Validation Status</h4>
                  
                  <div class="space-y-2">
                    <div class="flex items-center justify-between p-2 bg-base-200 rounded">
                      <span class="text-sm">Original:</span>
                      <span class="flex items-center gap-1 text-sm">
                        {#if comparisonResult.validation.validity.doc1}
                          <CheckCircle size={12} class="text-success" />
                          Valid
                        {:else}
                          <AlertTriangle size={12} class="text-error" />
                          Issues
                        {/if}
                      </span>
                    </div>
                    
                    <div class="flex items-center justify-between p-2 bg-base-200 rounded">
                      <span class="text-sm">Revision:</span>
                      <span class="flex items-center gap-1 text-sm">
                        {#if comparisonResult.validation.validity.doc2}
                          <CheckCircle size={12} class="text-success" />
                          Valid
                        {:else}
                          <AlertTriangle size={12} class="text-error" />
                          Issues
                        {/if}
                      </span>
                    </div>
                    
                    {#if comparisonResult.validation.scores.difference !== 0}
                      <div class="text-center p-2 rounded {comparisonResult.validation.scores.difference > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}">
                        <div class="text-sm font-medium">
                          {comparisonResult.validation.scores.difference > 0 ? '+' : ''}
                          {comparisonResult.validation.scores.difference} points
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
              
              <!-- Text similarity -->
              {#if comparisonResult.textual}
                <div class="space-y-3">
                  <h4 class="font-medium text-sm">Content Similarity</h4>
                  
                  <div class="text-center">
                    <div class="text-2xl font-bold text-primary mb-1">
                      {comparisonResult.textual.similarity}%
                    </div>
                    <div class="text-xs text-base-content/60">Text Similarity</div>
                  </div>
                  
                  <div class="space-y-1 text-xs text-base-content/60">
                    <div>Common words: {comparisonResult.textual.commonWords}</div>
                    <div>Word count change: {comparisonResult.textual.wordCount2 - comparisonResult.textual.wordCount1}</div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Equipment Changes -->
        {#if comparisonResult.equipment && Object.keys(comparisonResult.equipment).length > 0}
          <div class="card bg-base-100 border border-base-content/10">
            <div class="card-body">
              <h3 class="card-title text-lg">Equipment Changes</h3>
              
              <div class="overflow-x-auto">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th class="text-center">Original</th>
                      <th class="text-center">Revision</th>
                      <th class="text-center">Added</th>
                      <th class="text-center">Removed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each Object.entries(comparisonResult.equipment) as [type, data]}
                      <tr>
                        <td class="font-medium capitalize">{type}</td>
                        <td class="text-center">{data.doc1.length}</td>
                        <td class="text-center">{data.doc2.length}</td>
                        <td class="text-center {data.added.length > 0 ? 'text-success' : ''}">{data.added.length}</td>
                        <td class="text-center {data.removed.length > 0 ? 'text-error' : ''}">{data.removed.length}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        {/if}

        <!-- Validation Issues -->
        {#if comparisonResult.validation && (comparisonResult.validation.issues.resolved.length > 0 || comparisonResult.validation.issues.new.length > 0)}
          <div class="card bg-base-100 border border-base-content/10">
            <div class="card-body">
              <h3 class="card-title text-lg">Validation Issues</h3>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Resolved issues -->
                {#if comparisonResult.validation.issues.resolved.length > 0}
                  <div>
                    <h4 class="font-medium text-sm text-success mb-2">Resolved Issues ({comparisonResult.validation.issues.resolved.length})</h4>
                    <div class="space-y-1">
                      {#each comparisonResult.validation.issues.resolved as issue}
                        <div class="text-sm p-2 bg-success/10 rounded border-l-4 border-success">
                          {issue}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
                
                <!-- New issues -->
                {#if comparisonResult.validation.issues.new.length > 0}
                  <div>
                    <h4 class="font-medium text-sm text-error mb-2">New Issues ({comparisonResult.validation.issues.new.length})</h4>
                    <div class="space-y-1">
                      {#each comparisonResult.validation.issues.new as issue}
                        <div class="text-sm p-2 bg-error/10 rounded border-l-4 border-error">
                          {issue}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .gradient-text {
    background: linear-gradient(135deg, #8B5CF6, #EC4899);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
</style>
