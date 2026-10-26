// Adaptive AI service loader - tries full AI first, falls back to simple version

let aiService;
let initializeAI;

async function loadAIService() {
  try {
    // Try to load the full AI service with transformers
    const fullAIModule = await import('./aiService.js');
    aiService = fullAIModule.aiService;
    initializeAI = fullAIModule.initializeAI;
    console.log('Loaded full AI service with transformers');
    return { aiService, initializeAI };
  } catch (error) {
    console.warn('Failed to load full AI service, using simple version:', error);
    
    // Fall back to simple AI service
    const simpleAIModule = await import('./simpleAiService.js');
    aiService = simpleAIModule.simpleAIService;
    initializeAI = simpleAIModule.initializeSimpleAI;
    console.log('Loaded simple AI service');
    return { aiService, initializeAI };
  }
}

// Export the loaded services
export { loadAIService };

// Default export for backward compatibility
export default loadAIService;
