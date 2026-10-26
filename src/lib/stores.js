import { writable, derived, readable } from 'svelte/store';
import { nanoid } from 'nanoid';

// Theme store
export const theme = writable('pid-dark');

// UI state
export const sidebarOpen = writable(false);
export const currentView = writable('upload'); // 'upload', 'analysis', 'comparison'
export const isLoading = writable(false);
export const notification = writable(null);

// Document management
export const documents = writable([]);
export const currentDocument = writable(null);
export const selectedDocuments = writable([]); // for comparison view

// AI model state
export const aiModel = writable(null);
export const isAILoaded = writable(false);
export const aiProcessing = writable(false);
export const aiServiceInstance = writable(null); // Store the actual AI service instance

// Enhanced AI configuration store
export const aiConfig = writable({
  name: 'Blueprint Assistant', // Default AI name
  model: 'gemini-1.5-pro',
  temperature: 0.7,
  maxTokens: 1000,
  systemPrompt: 'You are a helpful P&ID analysis assistant specialized in blueprint analysis and engineering drawings.',
});

// Chat state
export const chatMessages = writable([]);
export const chatInputValue = writable('');

// Document analysis state
export const analysisResults = writable({});
export const validationResults = writable({});
export const extractedElements = writable({});

// Activity logging system
export const activityLog = writable([]);
export const showActivityLog = writable(false);

// Derived stores
export const hasDocuments = derived(
  documents,
  $documents => $documents.length > 0
);

export const canCompare = derived(
  documents,
  $documents => $documents.length >= 2
);

export const currentDocumentData = derived(
  [documents, currentDocument],
  ([$documents, $currentDocument]) => {
    if (!$currentDocument) return null;
    return $documents.find(doc => doc.id === $currentDocument);
  }
);

// Recent activity derived store (last 50 entries)
export const recentActivity = derived(
  activityLog,
  $activityLog => $activityLog.slice(-50).reverse()
);

// Activity statistics
export const activityStats = derived(
  activityLog,
  $activityLog => {
    const last24h = $activityLog.filter(entry => 
      Date.now() - entry.timestamp < 24 * 60 * 60 * 1000
    );
    
    return {
      total: $activityLog.length,
      last24h: last24h.length,
      errors: last24h.filter(entry => entry.type === 'error').length,
      successes: last24h.filter(entry => entry.type === 'success').length,
      processing: last24h.filter(entry => entry.type === 'processing').length
    };
  }
);

// Utility functions for stores
export function addDocument(document) {
  documents.update(docs => [...docs, {
    ...document,
    id: nanoid(),
    uploadedAt: new Date(),
    analyzed: false,
    validation: null
  }]);
}

export function removeDocument(documentId) {
  documents.update(docs => docs.filter(doc => doc.id !== documentId));
  
  // Clear current document if it was removed
  currentDocument.update(current => 
    current === documentId ? null : current
  );
}

export function updateDocument(documentId, updates) {
  documents.update(docs => 
    docs.map(doc => 
      doc.id === documentId 
        ? { ...doc, ...updates }
        : doc
    )
  );
}

export function addChatMessage(message) {
  chatMessages.update(messages => [...messages, {
    ...message,
    id: nanoid(),
    timestamp: new Date()
  }]);
}

export function clearChat() {
  chatMessages.set([]);
}

export function showNotification(message, type = 'info', duration = 5000) {
  notification.set({ message, type, id: nanoid() });
  
  setTimeout(() => {
    notification.set(null);
  }, duration);
}

// Enhanced activity logging system
export function addActivityLog(message, type = 'info', details = null) {
  const entry = {
    id: nanoid(),
    timestamp: Date.now(),
    message,
    type, // 'info', 'success', 'warning', 'error', 'processing'
    details,
    source: 'system'
  };
  
  activityLog.update(logs => [...logs, entry]);
  
  // Keep only last 1000 entries to prevent memory issues
  activityLog.update(logs => logs.slice(-1000));
}

// AI activity specific logging
export function logAIActivity(action, status, details = null) {
  const message = `AI: ${action}`;
  addActivityLog(message, status, details);
}

export function setAnalysisResult(documentId, result) {
  analysisResults.update(results => ({
    ...results,
    [documentId]: result
  }));
  
  updateDocument(documentId, { 
    analyzed: true, 
    analysisTimestamp: new Date() 
  });
  
  addActivityLog(`Analysis completed for document ${documentId}`, 'success');
}

export function setValidationResult(documentId, validation) {
  validationResults.update(results => ({
    ...results,
    [documentId]: validation
  }));
  
  updateDocument(documentId, { 
    validation,
    validationTimestamp: new Date()
  });
  
  addActivityLog(`Validation completed for document ${documentId}`, 'success');
}

export function setExtractedElements(documentId, elements) {
  extractedElements.update(results => ({
    ...results,
    [documentId]: elements
  }));
  
  addActivityLog(`Extracted ${Object.keys(elements).length} element types from document`, 'success');
}

// App configuration
export const appConfig = readable({
  name: 'P&ID Blueprint Analyzer',
  version: '2.0.0',
  supportedFormats: ['.pdf', '.png', '.jpg', '.jpeg', '.zip'],
  maxFileSize: 100 * 1024 * 1024, // 100MB
  aiModel: {
    name: 'Blueprint Analyzer',
    capabilities: [
      'P&ID symbol recognition',
      'Equipment identification', 
      'Piping analysis',
      'Instrumentation detection',
      'Text extraction',
      'Validation checking',
      'Revision comparison',
      'Color markup detection',
      'Batch processing',
      'ZIP archive extraction'
    ]
  }
});

// View management helpers
export function switchToUploadView() {
  currentView.set('upload');
  addActivityLog('Switched to upload view', 'info');
}

export function switchToAnalysisView(documentId = null) {
  if (documentId) {
    currentDocument.set(documentId);
  }
  currentView.set('analysis');
  addActivityLog('Switched to analysis view', 'info');
}

export function switchToComparisonView(documentIds = []) {
  if (documentIds.length > 0) {
    selectedDocuments.set(documentIds);
  }
  currentView.set('comparison');
  addActivityLog('Switched to comparison view', 'info');
}

// Theme management
export function toggleTheme() {
  theme.update(current => {
    const newTheme = current === 'pid-dark' ? 'pid-light' : 'pid-dark';
    addActivityLog(`Theme switched to ${newTheme}`, 'info');
    return newTheme;
  });
}

// AI configuration management
export function updateAIConfig(newConfig) {
  aiConfig.update(config => ({ ...config, ...newConfig }));
  addActivityLog(`AI configuration updated: ${Object.keys(newConfig).join(', ')}`, 'info');
}

export function updateAIName(newName) {
  aiConfig.update(config => ({ ...config, name: newName }));
  addActivityLog(`AI renamed to "${newName}"`, 'info');
}

// Activity log management
export function clearActivityLog() {
  activityLog.set([]);
  addActivityLog('Activity log cleared', 'info');
}

export function exportActivityLog() {
  const logs = activityLog.get();
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalEntries: logs.length,
    logs: logs.map(log => ({
      timestamp: new Date(log.timestamp).toISOString(),
      type: log.type,
      message: log.message,
      details: log.details
    }))
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  addActivityLog('Activity log exported', 'success');
}

// Enhanced error handling
export function handleError(error, context = 'Unknown') {
  console.error(`[${context}]`, error);
  addActivityLog(`Error in ${context}: ${error.message}`, 'error', {
    stack: error.stack,
    context
  });
  showNotification(`Error: ${error.message}`, 'error');
}

// Performance monitoring
export function logPerformance(operation, duration, details = null) {
  const message = `Performance: ${operation} took ${duration}ms`;
  const type = duration > 5000 ? 'warning' : duration > 1000 ? 'info' : 'success';
  
  addActivityLog(message, type, {
    operation,
    duration,
    ...details
  });
}

// Local storage persistence with enhanced error handling
if (typeof window !== 'undefined') {
  // Save documents to localStorage
  documents.subscribe(value => {
    try {
      localStorage.setItem('pid-documents', JSON.stringify(value));
    } catch (error) {
      handleError(error, 'Document Storage');
    }
  });
  
  // Load documents from localStorage
  try {
    const savedDocs = localStorage.getItem('pid-documents');
    if (savedDocs) {
      documents.set(JSON.parse(savedDocs));
      addActivityLog(`Restored ${JSON.parse(savedDocs).length} documents from storage`, 'info');
    }
  } catch (error) {
    handleError(error, 'Document Loading');
  }
  
  // Save AI configuration
  aiConfig.subscribe(value => {
    try {
      localStorage.setItem('pid-ai-config', JSON.stringify(value));
    } catch (error) {
      handleError(error, 'AI Config Storage');
    }
  });
  
  // Load AI configuration
  try {
    const savedAIConfig = localStorage.getItem('pid-ai-config');
    if (savedAIConfig) {
      aiConfig.set(JSON.parse(savedAIConfig));
    }
  } catch (error) {
    handleError(error, 'AI Config Loading');
  }
  
  // Save activity log (last 100 entries)
  activityLog.subscribe(value => {
    try {
      const recentLogs = value.slice(-100);
      localStorage.setItem('pid-activity-log', JSON.stringify(recentLogs));
    } catch (error) {
      console.warn('Failed to save activity log:', error);
    }
  });
  
  // Load activity log
  try {
    const savedLog = localStorage.getItem('pid-activity-log');
    if (savedLog) {
      activityLog.set(JSON.parse(savedLog));
    }
  } catch (error) {
    console.warn('Failed to load activity log:', error);
  }
  
  // Save chat messages
  chatMessages.subscribe(value => {
    try {
      localStorage.setItem('pid-chat', JSON.stringify(value));
    } catch (error) {
      handleError(error, 'Chat Storage');
    }
  });
  
  // Load chat messages
  try {
    const savedChat = localStorage.getItem('pid-chat');
    if (savedChat) {
      chatMessages.set(JSON.parse(savedChat));
    }
  } catch (error) {
    handleError(error, 'Chat Loading');
  }
}