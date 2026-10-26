// Utility functions for the P&ID Blueprint Analyzer
import { nanoid } from 'nanoid';

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return nanoid();
}

/**
 * Debounce function for performance optimization
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Download data as a file
 */
export function downloadFile(data, filename, mimeType = 'application/octet-stream') {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
}

/**
 * Validate file type and size
 */
export function validateFile(file, allowedTypes = [], maxSize = 50 * 1024 * 1024) {
  const errors = [];
  
  // Check file type
  if (allowedTypes.length > 0) {
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension) && !allowedTypes.includes(file.type)) {
      errors.push(`File type not supported. Allowed types: ${allowedTypes.join(', ')}`);
    }
  }
  
  // Check file size
  if (file.size > maxSize) {
    errors.push(`File too large. Maximum size: ${formatFileSize(maxSize)}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Parse P&ID text for equipment and instruments
 */
export function parsePIDText(text) {
  const patterns = {
    // Equipment patterns (e.g., P-101, T-201, V-301)
    equipment: /([A-Z]{1,3}-?\d{2,4}[A-Z]?)/g,
    
    // Instrument patterns (e.g., PI-101, TIC-201)
    instruments: /(PI|TI|FI|LI|AI|DI|XI|SI|VI|EI|CI|QI|WI|UI|ZI|YI|MI|BI|KI|GI|HI|II|JI|NI|OI|RI|PIC|TIC|FIC|LIC|AIC|DIC|XIC|SIC|VIC|EIC|CIC|QIC|WIC|UIC|ZIC|YIC|MIC|BIC|KIC|GIC|HIC|IIC|JIC|NIC|OIC|RIC)-?\d{2,4}/g,
    
    // Piping specifications (e.g., 6"-PW-150, 2"-SS-300)
    piping: /(\d{1,2}[\"\']?\s?-?\s?(PW|SW|CW|SS|CS|AI|HW|LP|HP|NG|A|S|W|O|G|H|C|N|V|P|F|D|E|T|M|L|R|B|X|Y|Z)-?\d{2,4})/g,
    
    // Process conditions
    pressure: /(\d+\.?\d*\s?(psi|bar|mbar|kPa|MPa|Pa|psig|barg))/gi,
    temperature: /(\d+\.?\d*\s?(°?[CF]|K|°K|celsius|fahrenheit|kelvin))/gi,
    flow: /(\d+\.?\d*\s?(gpm|lpm|m³\/h|ft³\/min|ACFM|SCFM|l\/s|m³\/s))/gi,
    
    // Drawing numbers and revisions
    drawingNumber: /(DWG|Drawing|DRG)[\s\-#:]*([A-Z0-9\-]+)/gi,
    revision: /(REV|Revision|Rev)[\s\-#:]*([A-Z0-9]+)/gi
  };

  const results = {};
  
  Object.entries(patterns).forEach(([key, pattern]) => {
    const matches = text.match(pattern);
    results[key] = matches ? [...new Set(matches)] : [];
  });
  
  return results;
}

/**
 * Color utilities for theme management
 */
export const colorUtils = {
  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  /**
   * Convert RGB to hex
   */
  rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  /**
   * Calculate color contrast ratio
   */
  getContrastRatio(color1, color2) {
    const getLuminance = (r, g, b) => {
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return 1;
    
    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }
};

/**
 * Canvas utilities for image processing
 */
export const canvasUtils = {
  /**
   * Resize image while maintaining aspect ratio
   */
  resizeImage(canvas, maxWidth, maxHeight) {
    const { width, height } = canvas;
    const aspectRatio = width / height;
    
    let newWidth = width;
    let newHeight = height;
    
    if (width > maxWidth) {
      newWidth = maxWidth;
      newHeight = maxWidth / aspectRatio;
    }
    
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = maxHeight * aspectRatio;
    }
    
    if (newWidth !== width || newHeight !== height) {
      const resizedCanvas = document.createElement('canvas');
      const ctx = resizedCanvas.getContext('2d');
      
      resizedCanvas.width = newWidth;
      resizedCanvas.height = newHeight;
      
      ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
      return resizedCanvas;
    }
    
    return canvas;
  },

  /**
   * Convert canvas to blob
   */
  canvasToBlob(canvas, type = 'image/png', quality = 0.9) {
    return new Promise(resolve => {
      canvas.toBlob(resolve, type, quality);
    });
  },

  /**
   * Load image from URL
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
};

/**
 * Local storage utilities with error handling
 */
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to get item from localStorage: ${key}`, error);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Failed to set item in localStorage: ${key}`, error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove item from localStorage: ${key}`, error);
      return false;
    }
  },

  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('Failed to clear localStorage', error);
      return false;
    }
  }
};

/**
 * Date formatting utilities
 */
export const dateUtils = {
  /**
   * Format date for display
   */
  formatDate(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
  },

  /**
   * Get relative time string
   */
  timeAgo(date) {
    const now = new Date();
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    return 'Just now';
  }
};

/**
 * Animation utilities
 */
export const animationUtils = {
  /**
   * Smooth scroll to element
   */
  scrollToElement(element, behavior = 'smooth') {
    element.scrollIntoView({ behavior, block: 'center' });
  },

  /**
   * Fade in animation
   */
  fadeIn(element, duration = 300) {
    element.style.opacity = '0';
    element.style.transition = `opacity ${duration}ms ease-in-out`;
    
    requestAnimationFrame(() => {
      element.style.opacity = '1';
    });
  },

  /**
   * Slide up animation
   */
  slideUp(element, duration = 300) {
    element.style.transform = 'translateY(20px)';
    element.style.opacity = '0';
    element.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
    
    requestAnimationFrame(() => {
      element.style.transform = 'translateY(0)';
      element.style.opacity = '1';
    });
  }
};

/**
 * Error handling utilities
 */
export const errorUtils = {
  /**
   * Create user-friendly error message
   */
  getErrorMessage(error) {
    if (error.name === 'QuotaExceededError') {
      return 'Storage quota exceeded. Please free up some space.';
    }
    if (error.name === 'NetworkError') {
      return 'Network error. Please check your connection.';
    }
    if (error.name === 'SecurityError') {
      return 'Security error. Operation not allowed.';
    }
    
    return error.message || 'An unexpected error occurred.';
  },

  /**
   * Log error with context
   */
  logError(error, context = {}) {
    console.error('Application Error:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }
};

export default {
  formatFileSize,
  generateId,
  debounce,
  throttle,
  downloadFile,
  copyToClipboard,
  validateFile,
  parsePIDText,
  colorUtils,
  canvasUtils,
  storage,
  dateUtils,
  animationUtils,
  errorUtils
};
