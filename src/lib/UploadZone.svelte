<script>
  import { createEventDispatcher } from 'svelte';
  import { addDocument, showNotification, isLoading, switchToAnalysisView, addActivityLog } from './stores.js';
  import { documentService } from './services/documentService.js';
  import JSZip from 'jszip';
  import { onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let dragActive = false;
  let dragCounter = 0;
  let fileInput;
  let uploadedFiles = [];
  let processing = false;
  let uploadProgress = 0;
  let currentProcessingFile = '';
  let dualUploadMode = false;

  const supportedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip'];

  onMount(async () => {
    try {
      await documentService.initialize();
    } catch (e) {
      console.warn('Document service init failed:', e);
    }
  });

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (dragCounter === 1) dragActive = true;
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) { dragActive = false; dragCounter = 0; }
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragActive = false;
    dragCounter = 0;

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    addActivityLog(`Received ${files.length} file(s) via drag & drop`, 'info');
    await handleFilesArray(files);
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    addActivityLog(`Selected ${files.length} file(s) from browser`, 'info');
    handleFilesArray(files);
    // reset input
    e.target.value = '';
  }

  function openFileDialog() {
    fileInput && fileInput.click();
  }

  async function handleFilesArray(files) {
    const zipFiles = files.filter(f => f.name.toLowerCase().endsWith('.zip'));
    const regularFiles = files.filter(f => !f.name.toLowerCase().endsWith('.zip'));

    try {
      const results = [];
      if (regularFiles.length > 0) {
        const r = await processFiles(regularFiles, false);
        if (Array.isArray(r)) results.push(...r);
      }
      if (zipFiles.length > 0) {
        for (const z of zipFiles) {
          const fromZip = await processZipFile(z);
          if (Array.isArray(fromZip) && fromZip.length) {
            const r = await processFiles(fromZip, true);
            if (Array.isArray(r)) results.push(...r);
          }
        }
      }
      // Optionally switch view after processing at least one doc
      if (results.length > 0) {
        switchToAnalysisView && switchToAnalysisView(); // call store action if available
      }
    } catch (err) {
      console.error('Batch processing failed:', err);
      addActivityLog(`Batch processing failed: ${err.message || err}`, 'error');
      showNotification && showNotification(`Batch processing error: ${err.message || err}`, 'error');
    } finally {
      uploadProgress = 0;
      currentProcessingFile = '';
    }
  }

  async function processZipFile(zipFile) {
    try {
      const arrayBuffer = await zipFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const extracted = [];
      const entries = Object.values(zip.files).filter(f => !f.dir);
      for (const entry of entries.slice(0, 50)) { // limit extraction
        const name = entry.name;
        const ext = name.split('.').pop().toLowerCase();
        if (['pdf','png','jpg','jpeg','gif','webp'].includes(ext)) {
          const blob = await entry.async('blob');
          // create File object so downstream processing expects same interface
          const file = new File([blob], name, { type: blob.type || getMimeType(ext) });
          extracted.push(file);
        }
      }
      addActivityLog(`Extracted ${extracted.length} file(s) from ${zipFile.name}`, 'info');
      return extracted;
    } catch (e) {
      console.warn('Failed to process zip file:', e);
      addActivityLog(`Failed to extract ZIP ${zipFile.name}: ${e.message}`, 'error');
      return [];
    }
  }

  function getMimeType(ext) {
    ext = ext.toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (['png','jpg','jpeg','gif','webp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return 'application/octet-stream';
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B','KB','MB','GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${Math.round(bytes*10)/10} ${units[i]}`;
  }

  function removeFile(index) {
    uploadedFiles.splice(index, 1);
  }

  function updateFileStatus(file, status, error = null) {
    const idx = uploadedFiles.findIndex(f => f.file === file);
    if (idx >= 0) {
      uploadedFiles[idx].status = status;
      if (error) uploadedFiles[idx].error = error;
    }
  }

  async function processFiles(files, fromZip = false) {
    if (!files || files.length === 0) return [];
    processing = true;
    isLoading && isLoading.set(true);

    const results = [];
    const prefix = fromZip ? 'ZIP: ' : '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      currentProcessingFile = file.name;
      uploadProgress = Math.round((i / files.length) * 100);

      try {
        // basic validation
        try { documentService.validateFile(file); } catch (validateErr) {
          addActivityLog(`Validation failed for ${file.name}: ${validateErr.message}`, 'warning');
          continue;
        }

        const processed = await documentService.processDocument(file);
        results.push(processed);
        addDocument && addDocument(processed);
        addActivityLog(`Processed ${prefix}${file.name}`, 'success');
      } catch (err) {
        console.warn(`Failed to process ${file.name}:`, err);
        addActivityLog(`Failed to process ${prefix}${file.name}: ${err.message || err}`, 'error');
      }
    }

    uploadProgress = 100;
    currentProcessingFile = '';
    processing = false;
    isLoading && isLoading.set(false);
    return results;
  }

  function clearFailedFiles() {
    uploadedFiles = uploadedFiles.filter(f => f.status !== 'failed');
  }

  function viewFileDetails(fileData) {
    showNotification && showNotification(`File details logged for ${fileData.name || fileData.file?.name}`, 'info');
    console.debug('File details:', fileData);
  }

  function toggleDualUpload() {
    dualUploadMode = !dualUploadMode;
  }
</script>

<div class="w-full max-w-4xl mx-auto">
  <div
    class="upload-zone border rounded-lg p-8 text-center"
    on:dragenter={handleDragEnter}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && openFileDialog()}
  >
    <p class="mb-4">Drag & drop PDFs or images here, or</p>
    <button class="btn btn-primary" on:click={openFileDialog}>Select files</button>
    <input bind:this={fileInput} type="file" multiple class="hidden" on:change={handleFileSelect} />
    {#if processing}
      <div class="mt-4">Processing: {currentProcessingFile} — {uploadProgress}%</div>
    {/if}
  </div>

  {#if uploadedFiles.length > 0}
    <div class="mt-4 space-y-2">
      {#each uploadedFiles as uf, i}
        <div class="card p-3 flex items-center justify-between">
          <div>
            <div class="font-medium">{uf.file.name}</div>
            <div class="text-sm text-muted">{formatFileSize(uf.file.size)}</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-ghost" on:click={() => viewFileDetails(uf)}>Details</button>
            <button class="btn btn-danger" on:click={() => removeFile(i)}>Remove</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .upload-zone {
    transition: box-shadow .2s ease, transform .15s ease;
    background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(250,250,250,0.8));
  }
  .upload-zone:focus { outline: none; box-shadow: 0 0 0 4px rgba(59,130,246,0.12); }
  .card { transition: transform .15s ease, box-shadow .15s ease; }
  .card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(2,6,23,0.08); }
  .btn { cursor: pointer; }
</style>