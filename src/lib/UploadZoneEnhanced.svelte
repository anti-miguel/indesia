<script>
  import { createEventDispatcher } from 'svelte';
  import { 
    addDocument, 
    showNotification, 
    isLoading, 
    switchToAnalysisView,
    addActivityLog 
  } from './stores.js';
  import { documentService } from './services/documentService.js';
  import { geminiValidatorService } from './services/geminiValidatorService.js';
  import { 
    Upload, FileText, Image, X, CheckCircle, Plus, Palette, Eye, 
    Archive, FolderOpen, FileX, Loader2, Sparkles, Zap, Grid3x3,
    Download, Play, Trash2, Info
  } from 'lucide-svelte';
  import JSZip from 'jszip';

  const dispatch = createEventDispatcher();

  let dragActive = false;
  let isDragOverZip = false;
  let fileInput;
  let uploadedFiles = [];
  let processing = false;
  let colorAnalysisResults = new Map();
  let dragCounter = 0;
  let uploadProgress = 0;
  let currentProcessingFile = '';
  let showFileGrid = false;

  // Enhanced file support
  const supportedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip'];
  const maxFileSize = 100 * 1024 * 1024; // 100MB
  const maxFilesInZip = 50;

  // Enhanced drag and drop with better visual feedback
  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    
    if (dragCounter === 1) {
      dragActive = true;
      addActivityLog('Files detected in drop zone', 'info');
      
      const items = Array.from(e.dataTransfer.items);
      isDragOverZip = items.some(item => 
        item.kind === 'file' && item.type === 'application/zip'
      );
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const items = Array.from(e.dataTransfer.items);
    const hasZip = items.some(item => item.type === 'application/zip');
    
    if (hasZip) {
      isDragOverZip = true;
    }
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    
    if (dragCounter === 0) {
      dragActive = false;
      isDragOverZip = false;
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragActive = false;
    isDragOverZip = false;
    dragCounter = 0;
    
    const files = Array.from(e.dataTransfer.files);
    
    if (files.length === 0) return;
    
    addActivityLog(`Received ${files.length} file(s) via drag & drop`, 'info');
    
    const zipFiles = files.filter(f => f.name.endsWith('.zip'));
    const regularFiles = files.filter(f => !f.name.endsWith('.zip'));
    
    if (zipFiles.length > 0) {
      zipFiles.forEach(zipFile => processZipFile(zipFile));
    }
    
    if (regularFiles.length > 0) {
      processFiles(regularFiles);
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;
    
    addActivityLog(`Selected ${files.length} file(s) from browser`, 'info');
    
    const zipFiles = files.filter(f => f.name.endsWith('.zip'));
    const regularFiles = files.filter(f => !f.name.endsWith('.zip'));
    
    if (zipFiles.length > 0) {
      zipFiles.forEach(zipFile => processZipFile(zipFile));
    }
    
    if (regularFiles.length > 0) {
      processFiles(regularFiles);
    }
    
    e.target.value = '';
  }

  function openFileDialog() {
    fileInput?.click();
  }

  // Enhanced zip file processing
  async function processZipFile(zipFile) {
    processing = true;
    isLoading.set(true);
    uploadProgress = 0;
    
    addActivityLog(`Opening ZIP file: ${zipFile.name}`, 'info');
    
    try {
      const zip = new JSZip();
      const zipData = await zip.loadAsync(zipFile);
      
      const filesToProcess = [];
      let fileCount = 0;
      
      for (const [filename, file] of Object.entries(zipData.files)) {
        if (!file.dir && fileCount < maxFilesInZip) {
          const extension = filename.toLowerCase().split('.').pop();
          
          if (['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
            try {
              const blob = await file.async('blob');
              const extractedFile = new File([blob], filename, {
                type: getMimeType(extension)
              });
              
              filesToProcess.push(extractedFile);
              fileCount++;
              
              uploadProgress = (fileCount / Object.keys(zipData.files).length) * 50;
              addActivityLog(`Extracted: ${filename}`, 'success');
            } catch (extractError) {
              addActivityLog(`Failed to extract ${filename}: ${extractError.message}`, 'error');
            }
          }
        }
      }
      
      addActivityLog(`Successfully extracted ${filesToProcess.length} files from ZIP`, 'success');
      
      if (filesToProcess.length === 0) {
        throw new Error('No supported files found in ZIP archive');
      }
      
      uploadProgress = 50;
      await processFiles(filesToProcess, true);
      
    } catch (error) {
      console.error('ZIP processing failed:', error);
      addActivityLog(`ZIP processing failed: ${error.message}`, 'error');
      showNotification(`Failed to process ZIP file: ${error.message}`, 'error');
    } finally {
      processing = false;
      isLoading.set(false);
      uploadProgress = 100;
    }
  }

  function getMimeType(extension) {
    const mimeTypes = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function removeFile(index) {
    const file = uploadedFiles[index];
    addActivityLog(`Removed file: ${file.file.name}`, 'info');
    uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
  }

  function updateFileStatus(file, status, error = null) {
    uploadedFiles = uploadedFiles.map(f => 
      f.file === file ? { ...f, status, error, progress: status === 'completed' ? 100 : f.progress } : f
    );
  }

  // Enhanced async processing with better error handling
  async function processDocumentAsync(file) {
    return new Promise(async (resolve, reject) => {
      try {
        currentProcessingFile = file.name;
        addActivityLog(`Processing ${file.name}...`, 'processing');
        
        const fileData = uploadedFiles.find(f => f.file === file);
        if (fileData) {
          fileData.progress = 10;
        }
        
        const memoryInfo = navigator.deviceMemory || 4;
        const isLowMemory = memoryInfo < 4;
        
        const fileSizeMB = file.size / (1024 * 1024);
        const processingDelay = isLowMemory ? (fileSizeMB * 100) : (fileSizeMB * 50);
        
        if (fileSizeMB > 20) {
          addActivityLog(`Large file detected (${fileSizeMB.toFixed(1)}MB) - using optimized processing`, 'warning');
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.min(processingDelay, 1000)));
        
        if (fileData) {
          fileData.progress = 30;
        }
        
        const result = await documentService.processDocument(file);
        
        if (fileData) {
          fileData.progress = 70;
        }
        
        if (file.type === 'application/pdf' && result.pages?.[0]?.canvas) {
          try {
            addActivityLog(`Analyzing colors in ${file.name}`, 'processing');
            const colorAnalysis = await analyzeDocumentColors(result, file.name);
            colorAnalysisResults.set(file.name, colorAnalysis);
            result.colorAnalysis = colorAnalysis;
            
            addActivityLog(`Color analysis complete: ${colorAnalysis.isColored ? 'Colored' : 'B&W'} document`, 'success');
          } catch (colorError) {
            addActivityLog(`Color analysis failed for ${file.name}: ${colorError.message}`, 'warning');
          }
        }
        
        if (fileData) {
          fileData.progress = 90;
        }
        
        addActivityLog(`Successfully processed ${file.name}`, 'success');
        resolve(result);
        
      } catch (error) {
        addActivityLog(`Failed to process ${file.name}: ${error.message}`, 'error');
        reject(error);
      }
    });
  }

  // Enhanced color analysis
  async function analyzeDocumentColors(document, fileName) {
    if (!document.pages?.[0]?.canvas || !geminiValidatorService) {
      return { isColored: false, confidence: 0 };
    }

    try {
      const colorAnalysis = await geminiValidatorService.detectImageColors(document.pages[0].canvas);
      return colorAnalysis;
    } catch (error) {
      console.warn('Failed to analyze colors for', fileName, ':', error);
      return { isColored: false, confidence: 0, error: error.message };
    }
  }

  // Enhanced batch processing
  async function processFiles(files, fromZip = false) {
    if (files.length === 0) return;
    
    processing = true;
    isLoading.set(true);
    
    const zipPrefix = fromZip ? 'from ZIP ' : '';
    addActivityLog(`Starting batch processing of ${files.length} files ${zipPrefix}`, 'info');
    
    try {
      const memoryInfo = navigator.deviceMemory || 4;
      const hardwareConcurrency = navigator.hardwareConcurrency || 4;
      
      let batchSize = 1;
      if (memoryInfo >= 8 && hardwareConcurrency >= 8) {
        batchSize = 2;
      }
      
      let processedCount = 0;
      let allResults = []; // Track all results from all batches
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(batch.map(async (file) => {
          try {
            documentService.validateFile(file);
            
            const fileData = {
              file,
              status: 'processing',
              progress: 0,
              error: null,
              startTime: Date.now(),
              fromZip
            };
            
            uploadedFiles = [...uploadedFiles, fileData];
            uploadedFiles = uploadedFiles;
            
            const result = await processDocumentAsync(file);
            
            updateFileStatus(file, 'processing');
            
            addDocument(result);
            updateFileStatus(file, 'completed');
            
            processedCount++;
            uploadProgress = fromZip ? 50 + (processedCount / files.length) * 50 : (processedCount / files.length) * 100;
            
            return { success: true, file: file.name };
            
          } catch (error) {
            updateFileStatus(file, 'error', error.message);
            addActivityLog(`Processing failed for ${file.name}: ${error.message}`, 'error');
            return { success: false, file: file.name, error: error.message };
          }
        }));
        
        allResults.push(...batchResults);
        
        if (i + batchSize < files.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const successCount = allResults.filter(r => r.value?.success).length;
      const errorCount = allResults.filter(r => !r.value?.success).length;
      
      if (successCount > 0) {
        addActivityLog(`Successfully processed ${successCount}/${files.length} files`, 'success');
        showNotification(`Successfully processed ${successCount} file(s)`, 'success');
        
        setTimeout(() => {
          switchToAnalysisView();
        }, 1500);
      }
      
      if (errorCount > 0) {
        addActivityLog(`${errorCount} files failed to process`, 'error');
        showNotification(`${errorCount} file(s) failed to process`, 'warning');
      }
      
    } catch (error) {
      console.error('Batch processing failed:', error);
      addActivityLog(`Batch processing failed: ${error.message}`, 'error');
      showNotification('Batch processing failed', 'error');
    } finally {
      processing = false;
      isLoading.set(false);
      uploadProgress = 100;
      currentProcessingFile = '';
    }
  }

  function clearFailedFiles() {
    const failedFiles = uploadedFiles.filter(f => f.status === 'error');
    failedFiles.forEach(f => addActivityLog(`Cleared failed file: ${f.file.name}`, 'info'));
    uploadedFiles = uploadedFiles.filter(f => f.status !== 'error');
  }

  function clearAllFiles() {
    uploadedFiles.forEach(f => addActivityLog(`Cleared file: ${f.file.name}`, 'info'));
    uploadedFiles = [];
  }

  function retryFailedFiles() {
    const failedFiles = uploadedFiles.filter(f => f.status === 'error');
    if (failedFiles.length > 0) {
      const filesToRetry = failedFiles.map(f => f.file);
      uploadedFiles = uploadedFiles.filter(f => f.status !== 'error');
      processFiles(filesToRetry);
    }
  }

  function viewFileDetails(fileData) {
    const details = {
      name: fileData.file.name,
      size: formatFileSize(fileData.file.size),
      type: fileData.file.type,
      lastModified: new Date(fileData.file.lastModified).toLocaleString(),
      fromZip: fileData.fromZip || false,
      processingTime: fileData.startTime ? `${Date.now() - fileData.startTime}ms` : 'N/A'
    };
    
    addActivityLog(`File details for ${fileData.file.name}: ${JSON.stringify(details)}`, 'info');
    showNotification(`File details logged for ${fileData.file.name}`, 'info');
  }

  function toggleFileGrid() {
    showFileGrid = !showFileGrid;
    addActivityLog(`File grid view ${showFileGrid ? 'enabled' : 'disabled'}`, 'info');
  }

  // Auto-show file grid when files are uploaded
  $: if (uploadedFiles.length > 0 && !showFileGrid) {
    showFileGrid = true;
  }
</script>

<div class="max-w-6xl mx-auto space-y-6">
  <!-- Enhanced upload drop zone -->
  <div 
    class="upload-zone relative overflow-hidden
      border-2 border-dashed rounded-xl p-8 text-center 
      transition-all duration-300 ease-in-out transform
      {dragActive ? 'border-primary bg-gradient-to-br from-primary/10 to-secondary/10 scale-105 shadow-2xl' : 'border-base-content/20 hover:border-primary/50 hover:shadow-lg'}
      {isDragOverZip ? 'border-accent bg-accent/5' : ''}
      {processing ? 'pointer-events-none' : 'cursor-pointer hover:-translate-y-1'}
    "
    on:dragenter={handleDragEnter}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
    on:click={openFileDialog}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && openFileDialog()}
  >
    <!-- Processing overlay -->
    {#if processing}
      <div class="absolute inset-0 bg-base-100/80 backdrop-blur-sm flex items-center justify-center z-10">
        <div class="text-center space-y-4">
          <Loader2 size={48} class="text-primary animate-spin mx-auto" />
          <div>
            <div class="text-lg font-semibold">Processing Files...</div>
            <div class="text-sm text-base-content/70">{currentProcessingFile}</div>
            <div class="w-64 bg-base-300 rounded-full h-2 mt-3 mx-auto">
              <div 
                class="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-500"
                style="width: {uploadProgress}%"
              ></div>
            </div>
          </div>
        </div>
      </div>
    {/if}
    
    <div class="flex flex-col items-center gap-6 relative z-0">
      <!-- Enhanced upload icon -->
      <div class="relative">
        <div class="w-20 h-20 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center
                    transition-all duration-300 {dragActive ? 'scale-110 rotate-12' : ''}">
          {#if isDragOverZip}
            <Archive size={40} class="text-accent transition-all duration-300" />
          {:else if dragActive}
            <Sparkles size={40} class="text-primary animate-bounce" />
          {:else}
            <Upload size={40} class="text-primary transition-all duration-300" />
          {/if}
        </div>
        
        {#if dragActive}
          <div class="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping"></div>
          <div class="absolute inset-0 rounded-full border-2 border-secondary/30 animate-ping" style="animation-delay: 0.5s;"></div>
        {/if}
      </div>
      
      <!-- Enhanced main text -->
      <div>
        <h3 class="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {#if isDragOverZip}
            Drop ZIP Archive Here
          {:else if dragActive}
            Release to Upload Files
          {:else}
            Upload P&ID Drawings
          {/if}
        </h3>
        <p class="text-base-content/70 mb-4 max-w-md">
          {#if isDragOverZip}
            ZIP archive detected! We'll extract and process all supported files inside.
          {:else if dragActive}
            Drop your files now and we'll process them automatically
          {:else}
            Drag & drop files, ZIP archives, or click to browse. Multiple files supported!
          {/if}
        </p>
      </div>
      
      <!-- Enhanced supported formats -->
      <div class="grid grid-cols-3 md:grid-cols-7 gap-3 max-w-lg">
        {#each supportedTypes as type}
          <div class="flex flex-col items-center gap-1 p-2 rounded-lg bg-base-200/50 hover:bg-primary/10 transition-colors duration-200">
            {#if type === '.zip'}
              <Archive size={16} class="text-accent" />
            {:else if type === '.pdf'}
              <FileText size={16} class="text-primary" />
            {:else}
              <Image size={16} class="text-secondary" />
            {/if}
            <span class="text-xs font-medium">{type}</span>
          </div>
        {/each}
      </div>
      
      <!-- Enhanced file size info -->
      <div class="flex items-center gap-4 text-sm text-base-content/60">
        <div class="flex items-center gap-1">
          <Zap size={14} />
          <span>Up to {formatFileSize(maxFileSize)} per file</span>
        </div>
        <div class="flex items-center gap-1">
          <Archive size={14} />
          <span>ZIP extraction supported</span>
        </div>
      </div>
      
      <!-- Enhanced browse button -->
      <button 
        class="btn btn-primary btn-lg gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        disabled={processing}
        on:click|stopPropagation={openFileDialog}
      >
        {#if processing}
          <Loader2 size={20} class="animate-spin" />
          Processing...
        {:else}
          <FolderOpen size={20} />
          Browse Files & Archives
        {/if}
      </button>
    </div>
  </div>

  <!-- Enhanced file input -->
  <input 
    type="file" 
    bind:this={fileInput}
    on:change={handleFileSelect}
    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.zip"
    multiple
    class="hidden"
  />

  <!-- Enhanced upload progress with improved grid layout -->
  {#if uploadedFiles.length > 0}
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-lg font-semibold flex items-center gap-2">
          <FileText size={18} class="text-primary" />
          Upload Progress
          <span class="badge badge-primary">{uploadedFiles.length}</span>
        </h4>
        
        <div class="flex gap-2">
          <button 
            class="btn btn-sm btn-outline gap-1"
            on:click={toggleFileGrid}
            class:btn-active={showFileGrid}
          >
            <Grid3x3 size={14} />
            {showFileGrid ? 'List' : 'Grid'} View
          </button>
          
          <button 
            class="btn btn-sm btn-outline btn-warning gap-1"
            on:click={retryFailedFiles}
            disabled={!uploadedFiles.some(f => f.status === 'error')}
          >
            <Play size={14} />
            Retry Failed
          </button>
          
          <button 
            class="btn btn-sm btn-outline btn-error gap-1"
            on:click={clearFailedFiles}
            disabled={!uploadedFiles.some(f => f.status === 'error')}
          >
            <FileX size={14} />
            Clear Failed
          </button>
          
          <button 
            class="btn btn-sm btn-outline btn-error gap-1"
            on:click={clearAllFiles}
          >
            <Trash2 size={14} />
            Clear All
          </button>
        </div>
      </div>
      
      <!-- Enhanced grid layout -->
      <div class="{showFileGrid ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}">
        {#each uploadedFiles as fileData, index (fileData.file.name + index)}
          <div class="card bg-base-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1
                      {fileData.status === 'completed' ? 'border border-success/30 bg-success/5' : ''}
                      {fileData.status === 'error' ? 'border border-error/30 bg-error/5' : ''}
                      {fileData.status === 'processing' ? 'border border-primary/30 bg-primary/5' : ''}">
            <div class="card-body p-4">
              <div class="flex items-start gap-3">
                <!-- Enhanced file icon -->
                <div class="flex-shrink-0 relative">
                  {#if fileData.file.type === 'application/pdf'}
                    <FileText size={24} class="text-primary" />
                  {:else}
                    <Image size={24} class="text-secondary" />
                  {/if}
                  
                  {#if fileData.fromZip}
                    <Archive size={10} class="absolute -top-1 -right-1 text-accent" />
                  {/if}
                </div>
                
                <!-- File info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-medium text-sm truncate">{fileData.file.name}</span>
                    
                    <!-- Status indicator -->
                    <div class="flex items-center gap-1">
                      {#if fileData.status === 'processing'}
                        <Loader2 size={14} class="animate-spin text-primary" />
                      {:else if fileData.status === 'completed'}
                        <CheckCircle size={14} class="text-success" />
                      {:else if fileData.status === 'error'}
                        <X size={14} class="text-error" />
                      {/if}
                    </div>
                  </div>
                  
                  <!-- File details -->
                  <div class="text-xs text-base-content/60 space-y-1">
                    <div class="flex items-center justify-between">
                      <span>{formatFileSize(fileData.file.size)}</span>
                      {#if colorAnalysisResults.has(fileData.file.name)}
                        {@const colorResult = colorAnalysisResults.get(fileData.file.name)}
                        <span class="flex items-center gap-1">
                          <Palette size={10} />
                          {colorResult.isColored ? 'Color' : 'B&W'}
                        </span>
                      {/if}
                    </div>
                    
                    {#if fileData.fromZip}
                      <div class="text-accent text-xs">From ZIP archive</div>
                    {/if}
                  </div>
                  
                  <!-- Enhanced progress bar -->
                  {#if fileData.status === 'processing'}
                    <div class="w-full bg-base-300 rounded-full h-2 mt-2 overflow-hidden">
                      <div 
                        class="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-primary to-secondary"
                        style="width: {fileData.progress || 0}%; animation: shimmer 2s infinite;"
                      ></div>
                    </div>
                  {/if}
                  
                  <!-- Error message -->
                  {#if fileData.error}
                    <div class="text-xs text-error mt-1 bg-error/10 p-2 rounded border border-error/20">
                      {fileData.error}
                    </div>
                  {/if}
                </div>
                
                <!-- Action buttons -->
                <div class="flex flex-col gap-1">
                  <button 
                    class="btn btn-ghost btn-xs btn-square"
                    on:click={() => viewFileDetails(fileData)}
                    title="View details"
                  >
                    <Info size={12} />
                  </button>
                  
                  {#if fileData.status !== 'processing'}
                    <button 
                      class="btn btn-ghost btn-xs btn-square"
                      on:click={() => removeFile(index)}
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Enhanced features overview -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
    <div class="card bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <div class="card-body p-6 text-center">
        <div class="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/30 rounded-xl mx-auto mb-4 flex items-center justify-center">
          <Sparkles size={24} class="text-primary" />
        </div>
        <h3 class="font-bold text-lg mb-2">AI Analysis</h3>
        <p class="text-sm text-base-content/70">Advanced P&ID symbol recognition with intelligent equipment identification and color markup detection</p>
      </div>
    </div>

    <div class="card bg-gradient-to-br from-secondary/5 to-secondary/10 border border-secondary/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <div class="card-body p-6 text-center">
        <div class="w-16 h-16 bg-gradient-to-br from-secondary/20 to-secondary/30 rounded-xl mx-auto mb-4 flex items-center justify-center">
          <Archive size={24} class="text-secondary" />
        </div>
        <h3 class="font-bold text-lg mb-2">Batch Processing</h3>
        <p class="text-sm text-base-content/70">Upload multiple files or entire ZIP archives. Intelligent extraction and processing of all supported formats</p>
      </div>
    </div>

    <div class="card bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <div class="card-body p-6 text-center">
        <div class="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/30 rounded-xl mx-auto mb-4 flex items-center justify-center">
          <Zap size={24} class="text-accent" />
        </div>
        <h3 class="font-bold text-lg mb-2">Smart Processing</h3>
        <p class="text-sm text-base-content/70">Adaptive processing with device optimization, progress tracking, and comprehensive error handling</p>
      </div>
    </div>
  </div>
</div>

<style>
  .upload-zone {
    background: 
      linear-gradient(135deg, transparent 0%, rgba(139,92,246,0.02) 50%, transparent 100%),
      radial-gradient(circle at 20% 80%, rgba(236,72,153,0.05) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(6,182,212,0.05) 0%, transparent 50%);
  }

  .card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .card:hover {
    transform: translateY(-4px) scale(1.02);
  }

  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  
  .animate-bounce {
    animation: bounce 1s infinite;
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .upload-zone.border-primary {
    box-shadow: 
      0 0 0 4px rgba(139,92,246,0.10),
      0 10px 25px rgba(139,92,246,0.15);
  }
</style>