import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

let workerConfigured = false;

async function checkUrlAccessible(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function configurePDFWorker() {
  if (workerConfigured) return;

  if (typeof window === 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    workerConfigured = true;
    return;
  }

  const candidates = [
    '/workers/pdf.worker.min.mjs', // serve from public/workers/pdf.worker.min.mjs (Vite)
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString(),
    'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs'
  ];

  let workerFound = false;

  for (const url of candidates) {
    try {
      const ok = await checkUrlAccessible(url);
      if (ok) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = url;
        workerConfigured = true;
        workerFound = true;
        console.log('PDF worker configured with:', url);
        return;
      } else {
        console.warn('PDF worker candidate not available:', url);
      }
    } catch (error) {
      console.warn('Error checking PDF worker candidate:', url, error);
    }
  }

  // Enhanced fallback: disable worker (will use main-thread mode)
  if (!workerFound) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    workerConfigured = true;
    console.warn('No usable PDF worker found; using fallback (main-thread) mode. This may impact performance but should still work.');
  }
}

class DocumentService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      await configurePDFWorker();
      console.log('Document service initialized');
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize document service:', error);
      // Don't throw error - allow service to work in fallback mode
      this.initialized = true; // Set to true to allow fallback processing
      console.warn('Document service initialized in fallback mode');
    }
  }

  async processDocument(file) {
    if (!this.initialized) {
      throw new Error('Document service not initialized');
    }

    const fileType = this.getFileType(file);

    switch (fileType) {
      case 'pdf':
        try {
          return await this.processPDF(file);
        } catch (pdfError) {
          console.warn('Standard PDF processing failed, trying fallback:', pdfError);
          return await this.processPDFAsFallback(file);
        }
      case 'image':
        return await this.processImage(file);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  async processPDFAsFallback(file) {
    try {
      console.warn('Using fallback PDF processing for:', file.name);
      return {
        type: 'pdf',
        name: file.name,
        size: file.size,
        pageCount: 1,
        pages: [{
          number: 1,
          text: 'PDF content could not be extracted. Please ensure this is a valid P&ID document.',
          canvas: null,
          imageUrl: null,
          imageBlob: null,
          viewport: null
        }],
        text: 'PDF processing failed - text extraction unavailable.',
        images: [],
        metadata: { title: file.name, fallbackMode: true },
        processed: true,
        fallback: true
      };
    } catch (error) {
      throw new Error(`PDF fallback processing failed: ${error.message}`);
    }
  }

  async processPDF(file) {
    try {
      await configurePDFWorker(); // ensure worker config complete
      const arrayBuffer = await file.arrayBuffer();

      // Create a copy to prevent detached ArrayBuffer issues
      const bufferCopy = arrayBuffer.slice(0);

      let pdfDoc;
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: bufferCopy,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
          cMapPacked: true,
          isEvalSupported: false,
          enableXfa: false,
          maxImageSize: 8388608,
          disableAutoFetch: false,
          disableStream: false,
          disableRange: false,
          verbosity: 0,
          ignoreErrors: true,
          standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
        });

        loadingTask.onProgress = (progressData) => {
          if (progressData && progressData.total > 0) {
            const percent = Math.round((progressData.loaded / progressData.total) * 100);
            // keep minimal logging; callers may hook into events if needed
            if (percent % 20 === 0) console.debug(`PDF load ${file.name}: ${percent}%`);
          }
        };

        pdfDoc = await Promise.race([
          loadingTask.promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('PDF loading timeout')), 30000))
        ]);
      } catch (workerError) {
        throw workerError;
      }

      const maxPages = Math.min(pdfDoc.numPages || 1, 20);
      const pages = [];
      const textParts = [];
      const images = [];
      let colorDetection = { hasColor: false, colorScore: 0, analysis: 'black_white' };

      // Use async rendering with yielding for better performance
      const yieldControl = async (pageNum) => {
        const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
        await new Promise(resolve => setTimeout(resolve, isLowMemory ? 800 : 100));
        if (window.requestIdleCallback) {
          await new Promise(resolve => window.requestIdleCallback(resolve, { timeout: 500 }));
        }
      };

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const page = await Promise.race([
            pdfDoc.getPage(pageNum),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Page ${pageNum} timeout`)), 10000))
          ]);

          // Yield control to prevent blocking
          await yieldControl(pageNum);

          let pageText = '';
          try {
            const textContent = await Promise.race([
              page.getTextContent({ normalizeWhitespace: true }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Text extraction timeout')), 5000))
            ]);
            pageText = (textContent.items || []).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
          } catch (e) {
            console.warn(`Text extraction failed page ${pageNum}:`, e);
            pageText = `[Text extraction failed for page ${pageNum}]`;
          }
          textParts.push(pageText);

          // render to canvas safely with async approach
          let canvas = null;
          let imageUrl = null;
          let isColorPage = false;

          try {
            const baseViewport = page.getViewport({ scale: 1 });
            let scale = 1.0; // Reduced scale for faster rendering
            if (baseViewport.width > 2000 || baseViewport.height > 2000) scale = 0.6;
            const viewport = page.getViewport({ scale });
            const maxCanvasSide = 3072; // Reduced max size
            const canvasW = Math.min(viewport.width, maxCanvasSide);
            const canvasH = Math.min(viewport.height, maxCanvasSide);

            canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = canvasW;
            canvas.height = canvasH;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvasW, canvasH);

            const renderTask = page.render({
              canvasContext: ctx,
              viewport,
              // Add rendering options for better performance
              renderTextLayer: false,
              renderAnnotationLayer: false
            });

            await Promise.race([
              renderTask.promise,
              new Promise((_, reject) => setTimeout(() => {
                try { renderTask.cancel(); } catch (_) { }
                reject(new Error('Render timeout'));
              }, 8000))
            ]);

            // Analyze colors in the rendered canvas
            isColorPage = this.analyzeCanvasForColor(ctx, canvasW, canvasH);
            if (isColorPage) {
              colorDetection.hasColor = true;
              colorDetection.colorScore++;
            }

            // Use smaller quality for faster processing
            const blob = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Canvas toBlob timeout')), 3000);
              canvas.toBlob(b => { clearTimeout(timeout); resolve(b); }, 'image/jpeg', 0.7);
            });

            if (blob) {
              imageUrl = URL.createObjectURL(blob);
              images.push(imageUrl);
            }
          } catch (renderErr) {
            console.warn(`Render failed page ${pageNum}:`, renderErr);
            canvas = null;
            imageUrl = null;
          }

          pages.push({
            number: pageNum,
            text: pageText,
            canvas,
            imageUrl,
            imageBlob: null,
            viewport: canvas ? { width: canvas.width, height: canvas.height, scale: 1 } : null,
            isColor: isColorPage
          });

          if (page.cleanup) {
            try { page.cleanup(); } catch (_) { /* ignore */ }
          }
        } catch (pageErr) {
          console.warn(`Processing page ${pageNum} failed:`, pageErr);
          pages.push({
            number: pageNum,
            text: `[Page ${pageNum} processing failed: ${pageErr.message}]`,
            canvas: null,
            imageUrl: null,
            imageBlob: null,
            viewport: null,
            isColor: false
          });
        }
      }

      // Determine overall color analysis
      const colorPercentage = (colorDetection.colorScore / maxPages) * 100;
      if (colorPercentage > 10) {
        colorDetection.analysis = 'colored';
      } else if (colorPercentage > 2) {
        colorDetection.analysis = 'mixed';
      } else {
        colorDetection.analysis = 'black_white';
      }

      const allText = textParts.join('\n\n');

      try { if (pdfDoc.destroy) pdfDoc.destroy(); } catch (_) { /* ignore */ }
      if (window.gc) try { window.gc(); } catch (_) { /* ignore */ }

      return {
        type: 'pdf',
        name: file.name,
        size: file.size,
        pageCount: pdfDoc.numPages || pages.length,
        processedPages: pages.length,
        pages,
        text: allText,
        images,
        metadata: await this.extractPDFMetadata(arrayBuffer),
        processed: true,
        colorDetection,
        isColored: colorDetection.analysis !== 'black_white',
        stability: { processedPages: pages.length, totalPages: pdfDoc.numPages || pages.length, fallbackMode: pdfjsLib.GlobalWorkerOptions.workerSrc === '' }
      };
    } catch (error) {
      console.error('PDF processing failed:', error);
      const msg = (error && error.message) ? error.message.toLowerCase() : '';
      let errorMessage = 'Failed to process PDF. ';
      if (msg.includes('timeout')) errorMessage += 'The PDF is too complex or large.';
      else if (msg.includes('invalid')) errorMessage += 'The PDF appears corrupted or invalid.';
      else if (msg.includes('password')) errorMessage += 'The PDF is password protected.';
      else errorMessage += 'Possible unsupported features or browser limitations.';
      throw new Error(errorMessage);
    }
  }

  analyzeCanvasForColor(ctx, width, height) {
    try {
      // Sample pixels from the canvas to detect color
      const sampleSize = 50; // Sample every 50 pixels for performance
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      let colorPixels = 0;
      let totalSamples = 0;

      for (let y = 0; y < height; y += sampleSize) {
        for (let x = 0; x < width; x += sampleSize) {
          const i = (y * width + x) * 4;
          if (i + 2 < data.length) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Convert RGB to HSV to check saturation
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const d = max - min;
            let s = max === 0 ? 0 : d / max;

            // Check if pixel has significant saturation (is colored)
            // Saturation threshold > 0.15 (15%) avoids slight color noise in scans
            if (s > 0.15 && max > 30) { // max > 30 ensures we don't check very dark pixels
              colorPixels++;
            }
            totalSamples++;
          }
        }
      }

      const colorRatio = totalSamples > 0 ? colorPixels / totalSamples : 0;
      // Threshold: > 2% of pixels must be colored to consider the page colored
      // This is more robust than the previous method
      return colorRatio > 0.02;
    } catch (error) {
      console.warn('Color analysis failed:', error);
      return false; // Assume black & white if analysis fails
    }
  }

  async processImage(file) {
    try {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imageUrl; });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      return { type: 'image', name: file.name, size: file.size, width: img.width, height: img.height, imageUrl, imageBlob: blob, canvas, text: '', processed: true };
    } catch (error) {
      console.error('Image processing failed:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  async extractPDFMetadata(arrayBuffer) {
    try {
      // Create a copy of the ArrayBuffer to prevent detached buffer error
      const bufferCopy = arrayBuffer.slice(0);
      const pdfDoc = await PDFDocument.load(bufferCopy);
      const metadata = { title: '', author: '', subject: '', creator: '', producer: '', creationDate: null, modificationDate: null };
      try {
        const info = pdfDoc.getDocumentInfo ? pdfDoc.getDocumentInfo() : {};
        if (info) {
          Object.keys(metadata).forEach(k => {
            if (info[k] !== undefined && info[k] !== null) {
              metadata[k] = info[k];
            }
          });
        }
      } catch (e) {
        console.warn('Metadata extraction issue:', e);
      }
      return metadata;
    } catch (e) {
      console.warn('Failed to extract metadata:', e);
      return {
        title: '',
        author: '',
        subject: '',
        creator: '',
        producer: '',
        creationDate: null,
        modificationDate: null
      };
    }
  }

  getFileType(file) {
    const ext = (file.name || '').toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
    return 'unknown';
  }

  validateFile(file) {
    const maxSize = 50 * 1024 * 1024;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (file.size > maxSize) throw new Error(`File too large (${(maxSize / 1024 / 1024)}MB max)`);
    if (!allowed.includes(file.type)) throw new Error('Unsupported file type');
    return true;
  }

  async extractText(document) {
    if (document.type === 'pdf') return document.text || '';
    if (document.type === 'image') return '';
    return '';
  }

  async getDocumentImages(document) {
    if (document.type === 'pdf') return document.images || [];
    if (document.type === 'image') return [document.imageUrl];
    return [];
  }

  async getPageData(documentOrId, pageNumber = 1) {
    // Handle both document objects and document IDs
    let document = documentOrId;

    // If we received an ID (string), we need to find the document
    // This is a workaround - ideally the caller should pass the document object
    if (typeof documentOrId === 'string') {
      console.warn('getPageData received ID instead of document object. This may not work correctly.');
      return null;
    }

    if (!document) return null;

    if (document.type === 'pdf' && document.pages) {
      const page = document.pages.find(p => p.number === pageNumber);
      return page || null;
    }

    if (document.type === 'image') {
      return {
        number: 1,
        text: document.text || '',
        imageUrl: document.imageUrl,
        imageBlob: document.imageBlob,
        canvas: document.canvas,
        viewport: { width: document.width, height: document.height, scale: 1 }
      };
    }

    return null;
  }

  extractPIDElements(text) {
    const elements = { equipment: [], instruments: [], piping: [], specifications: [] };
    const equipmentPattern = /([A-Z]{1,3}-?\d{2,4}[A-Z]?)/g;
    elements.equipment = [...new Set((text.match(equipmentPattern) || []))];
    const instrumentPattern = /(PI|TI|FI|LI|AI|DI|XI|SI|VI|EI|CI|QI|WI|UI|ZI|YI|MI|BI|KI|GI|HI|II|JI|NI|OI|RI|PIC|TIC|FIC|LIC|AIC|DIC|XIC|SIC|VIC|EIC|CIC|QIC|WIC|UIC|ZIC|YIC|MIC|BIC|KIC|GIC|HIC|IIC|JIC|NIC|OIC|RIC)-?\d{2,4}/g;
    elements.instruments = [...new Set((text.match(instrumentPattern) || []))];
    const pipingPattern = /(\d{1,2}[\"\']?\s?-?\s?(PW|SW|CW|SS|CS|AI|HW|LP|HP|NG|A|S|W|O|G|H|C|N|V|P|F|D|E|T|M|L|R|B|X|Y|Z)-?\d{2,4})/g;
    elements.piping = [...new Set((text.match(pipingPattern) || []))];
    const pressurePattern = /(\d+\.?\d*\s?(psi|bar|mbar|kPa|MPa|Pa|psig|barg))/g;
    const temperaturePattern = /(\d+\.?\d*\s?(°?[CF]|K|°K|celsius|fahrenheit|kelvin))/g;
    const flowPattern = /(\d+\.?\d*\s?(gpm|lpm|m³\/h|ft³\/min|ACFM|SCFM|l\/s|m³\/s))/g;
    elements.specifications = { pressure: [...new Set((text.match(pressurePattern) || []))], temperature: [...new Set((text.match(temperaturePattern) || []))], flow: [...new Set((text.match(flowPattern) || []))] };
    return elements;
  }

  cleanup(document) {
    if (!document) return;
    if (document.type === 'pdf' && document.pages) {
      document.pages.forEach(p => { if (p.imageUrl) try { URL.revokeObjectURL(p.imageUrl); } catch (_) { } });
    } else if (document.type === 'image' && document.imageUrl) {
      try { URL.revokeObjectURL(document.imageUrl); } catch (_) { }
    }
  }
}

export const documentService = new DocumentService();
export default documentService;