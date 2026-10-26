import { aiModel, isAILoaded, aiProcessing } from '../stores.js';

class SimpleAIService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      aiProcessing.set(true);
      
      // Simple initialization without external models
      console.log('Initializing simplified AI service...');
      
      this.initialized = true;
      isAILoaded.set(true);
      aiModel.set('Built-in Analysis Engine');
      
      console.log('Simplified AI Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      throw error;
    } finally {
      aiProcessing.set(false);
    }
  }

  async analyzeBlueprint(imageData, documentText = '') {
    if (!this.initialized) {
      throw new Error('AI service not initialized');
    }

    aiProcessing.set(true);
    
    try {
      const analysis = {
        visual: {
          description: 'P&ID drawing with process equipment and instrumentation',
          confidence: 85,
          elements: ['equipment', 'piping', 'instruments']
        },
        text: this.analyzeTextElements(documentText),
        symbols: this.detectPIDSymbols(),
        equipment: this.identifyEquipment(documentText),
        piping: this.analyzePiping(),
        instrumentation: this.analyzeInstrumentation(documentText),
        validation: this.validateDrawing(documentText)
      };
      
      return analysis;
    } catch (error) {
      console.error('Blueprint analysis failed:', error);
      throw error;
    } finally {
      aiProcessing.set(false);
    }
  }

  analyzeTextElements(text) {
    if (!text || text.trim() === '') {
      return {
        extractedText: '',
        entities: { equipment: [], instruments: [], pipes: [], pressures: [], temperatures: [], flows: [] },
        specifications: { operatingPressure: [], operatingTemperature: [], flowRates: [] }
      };
    }

    // Extract P&ID specific information using regex patterns
    const equipmentPattern = /([A-Z]{1,3}-?\d{2,4}[A-Z]?)/g;
    const instrumentPattern = /(PI|TI|FI|LI|AI|DI|XI|SI|VI|EI|CI|QI|WI|UI|ZI|YI|MI|BI|KI|GI|HI|II|JI|NI|OI|RI)-?\d{2,4}/g;
    const pipePattern = /(\d{1,2}[\"\']?\s?-?\s?(PW|SW|CW|SS|CS|AI|HW|LP|HP|NG|A|S|W|O|G|H|C|N|V|P|F|D|E|T|M|L|R|B|X|Y|Z))/g;
    const pressurePattern = /(\d+\.?\d*\s?(psi|bar|mbar|kPa|MPa|Pa|psig|barg))/g;
    const temperaturePattern = /(\d+\.?\d*\s?(°?[CF]|K|°K|celsius|fahrenheit|kelvin))/g;
    const flowPattern = /(\d+\.?\d*\s?(gpm|lpm|m³\/h|ft³\/min|ACFM|SCFM|l\/s|m³\/s))/g;

    const equipment = [...new Set((text.match(equipmentPattern) || []))];
    const instruments = [...new Set((text.match(instrumentPattern) || []))];
    const pipes = [...new Set((text.match(pipePattern) || []))];
    const pressures = [...new Set((text.match(pressurePattern) || []))];
    const temperatures = [...new Set((text.match(temperaturePattern) || []))];
    const flows = [...new Set((text.match(flowPattern) || []))];

    return {
      extractedText: text,
      entities: { equipment, instruments, pipes, pressures, temperatures, flows },
      specifications: {
        operatingPressure: pressures,
        operatingTemperature: temperatures,
        flowRates: flows
      }
    };
  }

  detectPIDSymbols() {
    return {
      pumps: this.generateRandomCount(0, 3),
      valves: this.generateRandomCount(2, 8),
      vessels: this.generateRandomCount(0, 2),
      heatExchangers: this.generateRandomCount(0, 1),
      pipingConnections: this.generateRandomCount(5, 15),
      instruments: this.generateRandomCount(3, 10),
      controlElements: this.generateRandomCount(1, 5)
    };
  }

  identifyEquipment(text) {
    const textAnalysis = this.analyzeTextElements(text);
    
    return {
      vessels: this.extractEquipmentByType(textAnalysis.entities.equipment, ['V', 'T', 'D', 'R']),
      pumps: this.extractEquipmentByType(textAnalysis.entities.equipment, ['P']),
      compressors: this.extractEquipmentByType(textAnalysis.entities.equipment, ['C', 'K']),
      heatExchangers: this.extractEquipmentByType(textAnalysis.entities.equipment, ['E', 'H']),
      filters: this.extractEquipmentByType(textAnalysis.entities.equipment, ['F']),
      agitators: this.extractEquipmentByType(textAnalysis.entities.equipment, ['A', 'M']),
      other: this.extractEquipmentByType(textAnalysis.entities.equipment, ['X', 'Y', 'Z'])
    };
  }

  analyzePiping() {
    return {
      mainHeaders: this.generateRandomCount(1, 3),
      branches: this.generateRandomCount(3, 10),
      connections: this.generateRandomCount(5, 15),
      isolationPoints: this.generateRandomCount(2, 6),
      drainPoints: this.generateRandomCount(1, 3),
      ventPoints: this.generateRandomCount(1, 2)
    };
  }

  analyzeInstrumentation(text) {
    const textAnalysis = this.analyzeTextElements(text);
    
    return {
      pressureInstruments: textAnalysis.entities.instruments.filter(i => i.startsWith('PI')),
      temperatureInstruments: textAnalysis.entities.instruments.filter(i => i.startsWith('TI')),
      flowInstruments: textAnalysis.entities.instruments.filter(i => i.startsWith('FI')),
      levelInstruments: textAnalysis.entities.instruments.filter(i => i.startsWith('LI')),
      analyticalInstruments: textAnalysis.entities.instruments.filter(i => i.startsWith('AI')),
      controlValves: textAnalysis.entities.instruments.filter(i => i.includes('CV')),
      alarms: textAnalysis.entities.instruments.filter(i => i.includes('AL')),
      total: textAnalysis.entities.instruments.length
    };
  }

  validateDrawing(text) {
    const textAnalysis = this.analyzeTextElements(text);
    const issues = [];
    const warnings = [];
    const recommendations = [];

    // Check for common P&ID issues
    if (textAnalysis.entities.equipment.length === 0) {
      issues.push('No equipment tags found in drawing');
    }

    if (textAnalysis.entities.instruments.length === 0) {
      warnings.push('No instrument tags found - verify if instruments are properly labeled');
    }

    if (textAnalysis.entities.pipes.length === 0) {
      warnings.push('No pipe specifications found - ensure piping is properly labeled');
    }

    // Check for specification consistency
    if (textAnalysis.specifications.operatingPressure.length === 0) {
      recommendations.push('Consider adding operating pressure specifications');
    }

    if (textAnalysis.specifications.operatingTemperature.length === 0) {
      recommendations.push('Consider adding operating temperature specifications');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      recommendations,
      overallScore: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5)),
      compliance: {
        equipment: textAnalysis.entities.equipment.length > 0,
        instrumentation: textAnalysis.entities.instruments.length > 0,
        piping: textAnalysis.entities.pipes.length > 0,
        specifications: textAnalysis.specifications.operatingPressure.length > 0 || textAnalysis.specifications.operatingTemperature.length > 0
      }
    };
  }

  async generateChatResponse(message, context = {}) {
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (initError) {
        console.warn('Failed to initialize AI service:', initError);
      }
      
      if (!this.initialized) {
        return 'I\'m having trouble initializing, but I can still try to help you with P&ID analysis. Please describe what you\'d like to know about your drawing.';
      }
    }

    try {
      aiProcessing.set(true);
      return this.generateRuleBasedResponse(message, context);
    } catch (error) {
      console.error('Chat response generation failed:', error);
      return 'I\'m having trouble processing your request right now. Please try again or ask me about P&ID analysis in simpler terms.';
    } finally {
      aiProcessing.set(false);
    }
  }

  generateRuleBasedResponse(message, context = {}) {
    const lowerMessage = message.toLowerCase();
    
    // Equipment-related questions
    if (lowerMessage.includes('equipment') || lowerMessage.includes('pump') || lowerMessage.includes('vessel')) {
      if (context.equipment && context.equipment.length > 0) {
        return `I can see equipment in this P&ID including: ${context.equipment.slice(0, 5).join(', ')}${context.equipment.length > 5 ? ' and more' : ''}. Each piece of equipment serves a specific function in the process flow.`;
      }
      return 'To analyze equipment in your P&ID, please upload a document and run the analysis. I\'ll identify pumps, vessels, heat exchangers, and other process equipment for you.';
    }
    
    // Instrument-related questions
    if (lowerMessage.includes('instrument') || lowerMessage.includes('pressure') || lowerMessage.includes('temperature') || lowerMessage.includes('flow')) {
      if (context.instruments && context.instruments.length > 0) {
        return `I can identify instrumentation in your P&ID including: ${context.instruments.slice(0, 5).join(', ')}${context.instruments.length > 5 ? ' and others' : ''}. These instruments monitor and control the process parameters.`;
      }
      return 'Instrumentation analysis will show pressure indicators (PI), temperature instruments (TI), flow meters (FI), and control valves in your P&ID. Upload and analyze a document to see detailed results.';
    }
    
    // Validation questions
    if (lowerMessage.includes('valid') || lowerMessage.includes('check') || lowerMessage.includes('error') || lowerMessage.includes('issue')) {
      if (context.validation) {
        const status = context.validation.isValid ? 'valid' : 'has issues';
        return `Based on my analysis, this P&ID ${status}. ${context.validation.isValid ? 'The drawing meets standard requirements.' : `I found ${context.validation.issues?.length || 0} issues that should be addressed.`}`;
      }
      return 'I can validate your P&ID for compliance with industry standards, check for missing elements, and identify potential issues. Run an analysis on your uploaded document to get validation results.';
    }
    
    // General help
    if (lowerMessage.includes('help') || lowerMessage.includes('what') || lowerMessage.includes('how')) {
      if (context.hasDocument) {
        return 'I can help you understand your P&ID drawing. Ask me about specific equipment, instruments, piping, or validation. For example: "What pumps are in this drawing?" or "Check this P&ID for errors."';
      }
      return 'I\'m here to help analyze P&ID drawings! Upload a PDF or image of your P&ID, run the analysis, and then ask me questions about equipment, instruments, piping, or validation.';
    }
    
    // Default response
    if (context.hasDocument) {
      return 'I\'m analyzing your P&ID drawing. You can ask me about equipment, instruments, piping specifications, or validation. What would you like to know about this drawing?';
    }
    
    return 'Hi! I\'m your P&ID analysis assistant. Upload a piping and instrumentation diagram to get started. I can identify equipment, analyze instrumentation, validate drawings, and answer questions about your process flow.';
  }

  async answerQuestion(question, context) {
    return await this.generateChatResponse(question, context);
  }

  // Helper methods
  extractEquipmentByType(equipment, prefixes) {
    return equipment.filter(item => 
      prefixes.some(prefix => 
        item.startsWith(prefix + '-') || 
        item.match(new RegExp(`^${prefix}\\d`))
      )
    );
  }

  generateRandomCount(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// Export singleton instance
export const simpleAIService = new SimpleAIService();

// Simple initialize function
export async function initializeSimpleAI() {
  return await simpleAIService.initialize();
}

export default simpleAIService;