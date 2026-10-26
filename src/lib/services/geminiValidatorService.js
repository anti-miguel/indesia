import { aiProcessing } from '../stores.js';

const PRIMARY_MODEL = 'gemini-flash-latest';
const FALLBACK_MODEL = 'gemini-3-pro-preview';
const RENDER_DPI = 400;
const MAX_SIDE = 4096;
const MAX_PAGES = 1;

const SYSTEM_PROMPT = `
You are an expert engineer specializing in P&ID (Piping and Instrumentation Diagram) revision control. 

Your task is to compare two drawings:

• MASTER → contains colored markups that indicate requested changes.
• DRAF   → the modified drawing submitted after updates.

Your goal is to clearly and concisely explain whether the drafting version correctly applies all required modifications from the MASTER.

──────────────────────────────────────────

HOW YOU MUST ANALYZE

──────────────────────────────────────────

1. Focus ONLY on the colored markups in the MASTER, which represent instructions.

2. Interpretation of markup colors:

   RED = Something must be added or changed to match the red text or symbol.
   YELLOW UNDERLINE/HIGHLIGHT = Something must be removed entirely.
   BLUE = Indicates movement or modification. It does NOT mean remove or add text. If a blue element includes arrows, relocation marks, or a change bubble → it must be altered in the DRAF. If the blue markup is just a tag or label without arrows or change indication → it is informational and does NOT mandate a change.

3. Avoid false alarms. If you are unsure, if visibility is unclear, or if the intent of a markup cannot be determined with confidence, assume the element has been handled correctly.

4. Do NOT evaluate unrelated drawing differences.

──────────────────────────────────────────

HOW YOU MUST RESPOND

──────────────────────────────────────────

• Start with a short overall summary.
• Then list each issue clearly.
• Reference each item/location as best you can.
• If ALL instructions appear correctly implemented, explicitly say there are no problems.

You must respond with a JSON object in the following format:
{
  "status": "OK" | "ERROR" | "INDETERMINATE_NO_TAGS",
  "errors": ["array of specific error descriptions"],
  "red": {
    "total": 0,
    "ok": 0,
    "error": 0
  },
  "yellow": {
    "total": 0,
    "ok": 0,
    "error": 0
  },
  "blue": {
    "total": 0,
    "ok": 0,
    "error": 0
  }
}
`;

class GeminiValidatorService {
  constructor() {
    this.initialized = false;
    this.apiKey = null;
  }

  async initialize() {
    try {
      this.apiKey = localStorage.getItem('gemini_api_key') ||
                   sessionStorage.getItem('gemini_api_key');
      
      if (!this.apiKey) {
        console.warn('Gemini API key not found. Provide your own key through settings.');
        this.initialized = false;
        return false;
      }

      // Dynamically import Google AI SDK
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      
      this.initialized = true;
      console.log('Gemini Validator Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini service:', error);
      this.initialized = false;
      return false;
    }
  }

  async setApiKey(apiKey) {
    this.apiKey = apiKey;
    localStorage.setItem('gemini_api_key', apiKey);
    return await this.initialize();
  }

  isAvailable() {
    return this.initialized && this.apiKey;
  }

  async detectImageColors(canvas) {
    try {
      if (!canvas) return { isColored: false, confidence: 0 };

      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let colorVariance = 0;
      let grayPixels = 0;
      let coloredPixels = 0;
      const sampleStep = Math.max(1, Math.floor(data.length / (4 * 1000))); // Sample ~1000 pixels

      for (let i = 0; i < data.length; i += 4 * sampleStep) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        if (a < 128) continue; // Skip transparent pixels

        const avg = (r + g + b) / 3;
        const variance = Math.pow(r - avg, 2) + Math.pow(g - avg, 2) + Math.pow(b - avg, 2);
        
        if (variance > 300) { // Threshold for color detection
          coloredPixels++;
          colorVariance += variance;
        } else {
          grayPixels++;
        }
      }

      const totalSampledPixels = coloredPixels + grayPixels;
      const colorRatio = totalSampledPixels > 0 ? coloredPixels / totalSampledPixels : 0;
      const isColored = colorRatio > 0.05; // 5% colored pixels threshold
      
      return {
        isColored,
        confidence: isColored ? Math.min(0.95, colorRatio * 2) : Math.max(0.1, 1 - colorRatio * 2),
        colorRatio,
        colorVariance: coloredPixels > 0 ? colorVariance / coloredPixels : 0,
        metadata: {
          sampledPixels: totalSampledPixels,
          coloredPixels,
          grayPixels
        }
      };
    } catch (error) {
      console.error('Color detection failed:', error);
      return { isColored: false, confidence: 0, error: error.message };
    }
  }

  async canvasToJPEG(canvas, quality = 0.85) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      } catch (error) {
        reject(error);
      }
    });
  }

  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async validatePIDComparison(masterDocument, draftDocument) {
    if (!this.isAvailable()) {
      throw new Error('Gemini service not available. Please configure API key.');
    }

    if (!masterDocument?.pages || !draftDocument?.pages) {
      throw new Error('Documents must have rendered pages for comparison.');
    }

    aiProcessing.set(true);

    try {
      // Process first page of each document
      const masterPage = masterDocument.pages[0];
      const draftPage = draftDocument.pages[0];

      if (!masterPage.canvas || !draftPage.canvas) {
        throw new Error('Document pages must be rendered to canvas for analysis.');
      }

      // Detect colors in master document
      const colorAnalysis = await this.detectImageColors(masterPage.canvas);
      
      if (!colorAnalysis.isColored) {
        console.warn('Master document appears to be black and white. Color markups may not be detected reliably.');
      }

      // Convert canvases to images
      const masterBlob = await this.canvasToJPEG(masterPage.canvas);
      const draftBlob = await this.canvasToJPEG(draftPage.canvas);

      const masterBase64 = await this.blobToBase64(masterBlob);
      const draftBase64 = await this.blobToBase64(draftBlob);

      // Call Gemini for comparison
      const result = await this.callValidatorModel(PRIMARY_MODEL, masterBase64, draftBase64);
      
      return {
        validation: result.parsed,
        colorAnalysis,
        metadata: {
          masterDocument: masterDocument.name,
          draftDocument: draftDocument.name,
          model: result.model || PRIMARY_MODEL,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('P&ID validation failed:', error);
      throw error;
    } finally {
      aiProcessing.set(false);
    }
  }

  async callValidatorModel(modelName, masterBase64, draftBase64) {
    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      });

      const parts = [
        { text: 'MASTER images (with markups), followed by DRAF images (after revisions).' },
        { text: 'MASTER page 1:' },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: masterBase64
          }
        },
        { text: 'DRAF page 1:' },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: draftBase64
          }
        }
      ];

      const response = await model.generateContent({
        contents: [{
          role: 'user',
          parts
        }]
      });

      const rawResponse = response.response.text() || '';
      const parsed = this.normalizeResult(this.tryExtractJson(rawResponse));
      
      return { parsed, raw: rawResponse, model: modelName };

    } catch (error) {
      console.warn(`Model ${modelName} failed:`, error);
      
      // Try fallback model if available and not already using it
      if (modelName !== FALLBACK_MODEL && FALLBACK_MODEL) {
        console.log('Trying fallback model...');
        return await this.callValidatorModel(FALLBACK_MODEL, masterBase64, draftBase64);
      }
      
      throw error;
    }
  }

  tryExtractJson(rawText) {
    if (!rawText) {
      throw new Error('Empty model response.');
    }

    const trimmed = rawText.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON object found in response.');
    }

    const candidate = trimmed.slice(start, end + 1);
    return JSON.parse(candidate);
  }

  normalizeResult(parsed) {
    const status = parsed?.status;

    ['red', 'yellow', 'blue'].forEach((color) => {
      parsed[color] = parsed[color] || {};
      ['total', 'ok', 'error'].forEach((key) => {
        if (typeof parsed[color][key] !== 'number') {
          parsed[color][key] = 0;
        }
      });
    });

    if (status === 'INDETERMINATE_NO_TAGS') {
      ['red', 'yellow', 'blue'].forEach((color) => {
        parsed[color].total = 0;
        parsed[color].ok = 0;
        parsed[color].error = 0;
      });
      return parsed;
    }

    const errors = parsed.errors || [];

    const countPrefix = (prefix) =>
      errors.filter((entry) => String(entry).toUpperCase().startsWith(prefix)).length;

    parsed.red.error = countPrefix('RED');
    parsed.yellow.error = countPrefix('YELLOW');
    parsed.blue.error = countPrefix('BLUE');

    parsed.status = errors.length ? 'ERROR' : 'OK';
    return parsed;
  }

  async analyzeSingleDocument(document) {
    if (!this.isAvailable()) {
      throw new Error('Gemini service not available. Please configure API key.');
    }

    if (!document?.pages?.[0]?.canvas) {
      throw new Error('Document must have rendered pages for analysis.');
    }

    aiProcessing.set(true);

    try {
      const page = document.pages[0];
      const colorAnalysis = await this.detectImageColors(page.canvas);
      
      // Convert canvas to image
      const blob = await this.canvasToJPEG(page.canvas);
      const base64 = await this.blobToBase64(blob);

      // Analyze with Gemini for general P&ID analysis
      const model = this.genAI.getGenerativeModel({
        model: PRIMARY_MODEL,
        systemInstruction: `You are an expert P&ID analyst. Analyze this piping and instrumentation diagram and provide insights about:
        1. Equipment and instrumentation identified
        2. Process flow analysis
        3. Potential issues or recommendations
        4. Drawing quality and completeness
        
        Respond in a clear, structured format.`,
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      });

      const response = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: 'Please analyze this P&ID drawing:' },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64
              }
            }
          ]
        }]
      });

      const analysis = response.response.text() || 'Analysis completed.';

      return {
        analysis,
        colorAnalysis,
        metadata: {
          document: document.name,
          model: PRIMARY_MODEL,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Single document analysis failed:', error);
      throw error;
    } finally {
      aiProcessing.set(false);
    }
  }

  generateReport(validationResult) {
    const { validation, colorAnalysis, metadata } = validationResult;
    
    if (!validation) return 'No validation data available.';

    const status = validation.status ?? 'UNKNOWN';
    const red = validation.red || {};
    const yellow = validation.yellow || {};
    const blue = validation.blue || {};
    const errors = validation.errors || [];

    const lines = [
      `P&ID Validation Report`,
      `Generated: ${new Date().toLocaleString()}`,
      `Documents: ${metadata.masterDocument} vs ${metadata.draftDocument}`,
      '',
      `Overall Status: ${status}`,
      `Color Detection: ${colorAnalysis.isColored ? 'Colored markup detected' : 'Black & white or minimal colors'} (${(colorAnalysis.confidence * 100).toFixed(1)}% confidence)`,
      '',
      'Markup Analysis:',
      `  RED markups:    total=${red.total ?? 0}, ok=${red.ok ?? 0}, errors=${red.error ?? 0}`,
      `  YELLOW markups: total=${yellow.total ?? 0}, ok=${yellow.ok ?? 0}, errors=${yellow.error ?? 0}`,
      `  BLUE markups:   total=${blue.total ?? 0}, ok=${blue.ok ?? 0}, errors=${blue.error ?? 0}`,
      ''
    ];

    if (status === 'INDETERMINATE_NO_TAGS') {
      lines.push(
        'No red/yellow/blue markups reliably detected on the MASTER sheet.',
        'Either this sheet has no review comments or markups are too faint/ambiguous.'
      );
      return lines.join('\n');
    }

    if (!errors.length) {
      lines.push('✅ All marked instructions appear to be implemented correctly.');
      return lines.join('\n');
    }

    lines.push('Issues detected:');
    errors.forEach((error, idx) => {
      lines.push(`  ${idx + 1}. ${error}`);
    });

    lines.push('', 'Recommended actions:');
    if (red.error) lines.push('  - Review RED additions/replacements mentioned above.');
    if (yellow.error) lines.push('  - Ensure all YELLOW-underlined text/symbols are removed.');
    if (blue.error) lines.push('  - Verify BLUE movement/relocation instructions were applied.');

    return lines.join('\n');
  }
}

// Export singleton instance
export const geminiValidatorService = new GeminiValidatorService();

export default geminiValidatorService;
