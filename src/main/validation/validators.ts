/**
 * Data Validators - Input validation for IPC communication
 * 
 * Provides validation functions to ensure data integrity and security
 * for all IPC communication between renderer and main processes.
 */

import { CorrectionMode } from '../../types/interfaces';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates text correction request data
 */
export function validateCorrectionRequest(data: any): ValidationResult {
  const errors: string[] = [];

  // Validate text
  if (!data.text || typeof data.text !== 'string') {
    errors.push('Text must be a non-empty string');
  } else {
    if (data.text.trim().length === 0) {
      errors.push('Text cannot be empty');
    }
    if (data.text.length > 10000) {
      errors.push('Text exceeds maximum length of 10000 characters');
    }
  }

  // Validate mode
  const validModes: CorrectionMode[] = ['business', 'academic', 'casual', 'presentation'];
  if (!data.mode || typeof data.mode !== 'string') {
    errors.push('Mode must be specified');
  } else if (!validModes.includes(data.mode as CorrectionMode)) {
    errors.push(`Mode must be one of: ${validModes.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates settings data
 */
export function validateSettings(settings: any): ValidationResult {
  const errors: string[] = [];

  if (!settings || typeof settings !== 'object') {
    errors.push('Settings must be an object');
    return { valid: false, errors };
  }

  // Validate API keys if provided
  if (settings.apiKeys) {
    if (typeof settings.apiKeys !== 'object') {
      errors.push('API keys must be an object');
    } else {
      // Validate individual API keys
      if ('openai' in settings.apiKeys && settings.apiKeys.openai) {
        if (typeof settings.apiKeys.openai !== 'string' || !isValidApiKey(settings.apiKeys.openai)) {
          errors.push('OpenAI API key format is invalid');
        }
      }
      if ('anthropic' in settings.apiKeys && settings.apiKeys.anthropic) {
        if (typeof settings.apiKeys.anthropic !== 'string' || !isValidApiKey(settings.apiKeys.anthropic)) {
          errors.push('Anthropic API key format is invalid');
        }
      }
      if ('google' in settings.apiKeys && settings.apiKeys.google) {
        if (typeof settings.apiKeys.google !== 'string' || !isValidApiKey(settings.apiKeys.google)) {
          errors.push('Google API key format is invalid');
        }
      }
    }
  }

  // Validate default mode if provided
  if ('defaultMode' in settings) {
    const validModes: CorrectionMode[] = ['business', 'academic', 'casual', 'presentation'];
    if (!validModes.includes(settings.defaultMode)) {
      errors.push(`Default mode must be one of: ${validModes.join(', ')}`);
    }
  }

  // Validate hotkey if provided
  if ('hotkey' in settings) {
    if (typeof settings.hotkey !== 'string' || !isValidHotkey(settings.hotkey)) {
      errors.push('Invalid hotkey format');
    }
  }

  // Validate window settings if provided
  if (settings.windowSettings) {
    if (typeof settings.windowSettings !== 'object') {
      errors.push('Window settings must be an object');
    } else {
      if ('opacity' in settings.windowSettings) {
        const opacity = settings.windowSettings.opacity;
        if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
          errors.push('Window opacity must be a number between 0 and 1');
        }
      }
      if ('alwaysOnTop' in settings.windowSettings) {
        if (typeof settings.windowSettings.alwaysOnTop !== 'boolean') {
          errors.push('Always on top must be a boolean');
        }
      }
    }
  }

  // Validate AI settings if provided
  if (settings.aiSettings) {
    if (typeof settings.aiSettings !== 'object') {
      errors.push('AI settings must be an object');
    } else {
      if ('temperature' in settings.aiSettings) {
        const temp = settings.aiSettings.temperature;
        if (typeof temp !== 'number' || temp < 0 || temp > 2) {
          errors.push('Temperature must be a number between 0 and 2');
        }
      }
      if ('maxTokens' in settings.aiSettings) {
        const maxTokens = settings.aiSettings.maxTokens;
        if (typeof maxTokens !== 'number' || maxTokens < 1 || maxTokens > 4000) {
          errors.push('Max tokens must be a number between 1 and 4000');
        }
      }
      if ('primaryProvider' in settings.aiSettings) {
        const validProviders = ['openai', 'anthropic', 'google'];
        if (!validProviders.includes(settings.aiSettings.primaryProvider)) {
          errors.push(`Primary provider must be one of: ${validProviders.join(', ')}`);
        }
      }
    }
  }

  // Validate privacy settings if provided
  if (settings.privacy) {
    if (typeof settings.privacy !== 'object') {
      errors.push('Privacy settings must be an object');
    } else {
      if ('saveHistory' in settings.privacy) {
        if (typeof settings.privacy.saveHistory !== 'boolean') {
          errors.push('Save history must be a boolean');
        }
      }
      if ('analyticsEnabled' in settings.privacy) {
        if (typeof settings.privacy.analyticsEnabled !== 'boolean') {
          errors.push('Analytics enabled must be a boolean');
        }
      }
    }
  }

  // Validate appearance settings if provided
  if (settings.appearance) {
    if (typeof settings.appearance !== 'object') {
      errors.push('Appearance settings must be an object');
    } else {
      if ('theme' in settings.appearance) {
        const validThemes = ['light', 'dark', 'system'];
        if (!validThemes.includes(settings.appearance.theme)) {
          errors.push(`Theme must be one of: ${validThemes.join(', ')}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates history search options
 */
export function validateHistorySearchOptions(options: any): ValidationResult {
  const errors: string[] = [];

  if (!options || typeof options !== 'object') {
    return { valid: true, errors: [] }; // Options are optional
  }

  // Validate query
  if ('query' in options && options.query !== undefined) {
    if (typeof options.query !== 'string') {
      errors.push('Query must be a string');
    } else if (options.query.length > 200) {
      errors.push('Query exceeds maximum length of 200 characters');
    }
  }

  // Validate mode
  if ('mode' in options && options.mode !== undefined) {
    const validModes: CorrectionMode[] = ['business', 'academic', 'casual', 'presentation'];
    if (!validModes.includes(options.mode)) {
      errors.push(`Mode must be one of: ${validModes.join(', ')}`);
    }
  }

  // Validate dates
  if ('startDate' in options && options.startDate !== undefined) {
    if (!isValidDate(options.startDate)) {
      errors.push('Start date must be a valid date');
    }
  }
  if ('endDate' in options && options.endDate !== undefined) {
    if (!isValidDate(options.endDate)) {
      errors.push('End date must be a valid date');
    }
  }

  // Validate limit
  if ('limit' in options && options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000) {
      errors.push('Limit must be an integer between 1 and 1000');
    }
  }

  // Validate offset
  if ('offset' in options && options.offset !== undefined) {
    if (!Number.isInteger(options.offset) || options.offset < 0) {
      errors.push('Offset must be a non-negative integer');
    }
  }

  // Validate onlyFavorites
  if ('onlyFavorites' in options && options.onlyFavorites !== undefined) {
    if (typeof options.onlyFavorites !== 'boolean') {
      errors.push('Only favorites must be a boolean');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates clipboard text
 */
export function validateClipboardText(text: any): ValidationResult {
  const errors: string[] = [];

  if (typeof text !== 'string') {
    errors.push('Clipboard text must be a string');
  } else if (text.length > 100000) {
    errors.push('Clipboard text exceeds maximum length');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to validate API key format
 */
function isValidApiKey(key: string): boolean {
  // Basic validation - check if it's a reasonable API key format
  // Most API keys are alphanumeric with some special characters
  const apiKeyPattern = /^[a-zA-Z0-9\-_]{20,}$/;
  return apiKeyPattern.test(key);
}

/**
 * Helper function to validate hotkey format
 */
function isValidHotkey(hotkey: string): boolean {
  // Validate hotkey format (e.g., "Ctrl+T", "Cmd+Shift+A")
  const hotkeyPattern = /^(Ctrl|Cmd|Alt|Shift|CommandOrControl)(\+(Ctrl|Cmd|Alt|Shift|[A-Za-z0-9]))*$/;
  return hotkeyPattern.test(hotkey);
}

/**
 * Helper function to validate date
 */
function isValidDate(date: any): boolean {
  if (date instanceof Date) {
    return !isNaN(date.getTime());
  }
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }
  return false;
}

/**
 * Sanitizes text input to prevent XSS and injection attacks
 */
export function sanitizeText(text: string): string {
  // Remove any HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Remove any script-like content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Escape special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return sanitized;
}

/**
 * Validates file path for security
 */
export function validateFilePath(filePath: string, allowedPaths: string[]): boolean {
  // Normalize the path
  const normalizedPath = path.normalize(filePath);
  
  // Check if path contains any dangerous patterns
  const dangerousPatterns = ['..', '~', '$', '|', '>', '<', '&', ';'];
  for (const pattern of dangerousPatterns) {
    if (normalizedPath.includes(pattern)) {
      return false;
    }
  }
  
  // Check if path starts with any allowed path
  return allowedPaths.some(allowed => normalizedPath.startsWith(allowed));
}

// Re-export for backward compatibility
import * as path from 'path';

export default {
  validateCorrectionRequest,
  validateSettings,
  validateHistorySearchOptions,
  validateClipboardText,
  sanitizeText,
  validateFilePath
};