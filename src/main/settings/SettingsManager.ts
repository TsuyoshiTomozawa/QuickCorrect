/**
 * SettingsManager - Manages application settings persistence
 * 
 * Handles loading, saving, and validation of application settings
 * using electron-store for secure storage.
 */

import Store from 'electron-store';
import { AppSettings } from '../../types/interfaces';
import * as crypto from 'crypto';

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  apiKeys: {
    openai: undefined,
    anthropic: undefined,
    google: undefined
  },
  defaultMode: 'business',
  hotkey: 'CommandOrControl+T',
  autoCorrect: false,
  autoCopy: true,
  windowSettings: {
    alwaysOnTop: false,
    opacity: 1.0,
    position: {
      x: -1,
      y: -1
    },
    size: {
      width: 800,
      height: 500
    }
  },
  aiSettings: {
    primaryProvider: 'openai',
    temperature: 0.7,
    maxTokens: 2000,
    timeout: 30000
  },
  privacy: {
    saveHistory: true,
    analyticsEnabled: false
  },
  appearance: {
    theme: 'system'
  }
};

export class SettingsManager {
  private store: Store<AppSettings>;
  private encryptionKey: string;

  constructor(userDataPath: string) {
    // Generate encryption key based on machine ID for API key encryption
    this.encryptionKey = this.generateEncryptionKey();

    // Initialize electron-store with encryption for sensitive data
    this.store = new Store<AppSettings>({
      name: 'quickcorrect-settings',
      cwd: userDataPath,
      encryptionKey: this.encryptionKey,
      defaults: DEFAULT_SETTINGS,
      schema: this.getSettingsSchema(),
      migrations: {
        '0.1.0': (store) => {
          // Migration example: rename old settings keys
          const oldSettings = store.store;
          if ('api_keys' in oldSettings) {
            store.set('apiKeys', oldSettings.api_keys);
            store.delete('api_keys' as any);
          }
        }
      }
    });

    // Ensure default settings are applied
    this.ensureDefaults();
  }

  /**
   * Get all settings
   */
  async getSettings(): Promise<AppSettings> {
    try {
      const settings = this.store.store;
      
      // Decrypt API keys
      if (settings.apiKeys) {
        settings.apiKeys = this.decryptApiKeys(settings.apiKeys);
      }

      return settings;
    } catch (error) {
      console.error('Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update settings (partial update)
   */
  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    try {
      // Encrypt API keys if provided
      if (updates.apiKeys) {
        updates.apiKeys = this.encryptApiKeys(updates.apiKeys);
      }

      // Merge with existing settings
      const currentSettings = await this.getSettings();
      const newSettings = this.deepMerge(currentSettings, updates);

      // Validate merged settings
      this.validateSettings(newSettings);

      // Save settings
      this.store.store = newSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<void> {
    this.store.clear();
    this.ensureDefaults();
  }

  /**
   * Get a specific setting value
   */
  async getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    const value = this.store.get(key);
    
    // Decrypt API keys if requested
    if (key === 'apiKeys' && value) {
      return this.decryptApiKeys(value as any) as AppSettings[K];
    }
    
    return value;
  }

  /**
   * Set a specific setting value
   */
  async setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    // Encrypt API keys if setting them
    if (key === 'apiKeys' && value) {
      value = this.encryptApiKeys(value as any) as AppSettings[K];
    }
    
    this.store.set(key, value);
  }

  /**
   * Export settings (without sensitive data)
   */
  async exportSettings(): Promise<Partial<AppSettings>> {
    const settings = await this.getSettings();
    
    // Remove sensitive data
    const exported: Partial<AppSettings> = { ...settings };
    delete exported.apiKeys;
    
    return exported;
  }

  /**
   * Import settings
   */
  async importSettings(settings: Partial<AppSettings>): Promise<void> {
    // Don't import API keys for security
    delete settings.apiKeys;
    
    await this.updateSettings(settings);
  }

  /**
   * Ensure default values are set
   */
  private ensureDefaults(): void {
    const currentSettings = this.store.store;
    const merged = this.deepMerge(DEFAULT_SETTINGS, currentSettings);
    this.store.store = merged;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    
    return output;
  }

  /**
   * Validate settings structure
   */
  private validateSettings(settings: AppSettings): void {
    // Check required fields
    if (!settings.defaultMode || !['business', 'academic', 'casual', 'presentation'].includes(settings.defaultMode)) {
      throw new Error('Invalid default mode');
    }

    if (!settings.hotkey || typeof settings.hotkey !== 'string') {
      throw new Error('Invalid hotkey');
    }

    if (!settings.windowSettings || typeof settings.windowSettings !== 'object') {
      throw new Error('Invalid window settings');
    }

    if (!settings.aiSettings || typeof settings.aiSettings !== 'object') {
      throw new Error('Invalid AI settings');
    }

    // Validate numeric ranges
    if (settings.windowSettings.opacity < 0 || settings.windowSettings.opacity > 1) {
      throw new Error('Window opacity must be between 0 and 1');
    }

    if (settings.aiSettings.temperature < 0 || settings.aiSettings.temperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }

    if (settings.aiSettings.maxTokens < 1 || settings.aiSettings.maxTokens > 4000) {
      throw new Error('Max tokens must be between 1 and 4000');
    }
  }

  /**
   * Generate encryption key for API keys
   */
  private generateEncryptionKey(): string {
    // Use machine-specific data to generate a consistent key
    const machineId = require('os').hostname() + require('os').platform();
    return crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 32);
  }

  /**
   * Encrypt API keys
   */
  private encryptApiKeys(apiKeys: any): any {
    const encrypted: any = {};
    
    for (const [provider, key] of Object.entries(apiKeys)) {
      if (key && typeof key === 'string') {
        try {
          const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
          let encryptedKey = cipher.update(key, 'utf8', 'hex');
          encryptedKey += cipher.final('hex');
          encrypted[provider] = encryptedKey;
        } catch (error) {
          console.error(`Error encrypting ${provider} API key:`, error);
          encrypted[provider] = undefined;
        }
      } else {
        encrypted[provider] = key;
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt API keys
   */
  private decryptApiKeys(apiKeys: any): any {
    const decrypted: any = {};
    
    for (const [provider, encryptedKey] of Object.entries(apiKeys)) {
      if (encryptedKey && typeof encryptedKey === 'string') {
        try {
          const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
          let key = decipher.update(encryptedKey, 'hex', 'utf8');
          key += decipher.final('utf8');
          decrypted[provider] = key;
        } catch (error) {
          console.error(`Error decrypting ${provider} API key:`, error);
          decrypted[provider] = undefined;
        }
      } else {
        decrypted[provider] = encryptedKey;
      }
    }
    
    return decrypted;
  }

  /**
   * Get settings schema for validation
   */
  private getSettingsSchema(): any {
    return {
      apiKeys: {
        type: 'object',
        properties: {
          openai: { type: ['string', 'null'] },
          anthropic: { type: ['string', 'null'] },
          google: { type: ['string', 'null'] }
        }
      },
      defaultMode: {
        type: 'string',
        enum: ['business', 'academic', 'casual', 'presentation']
      },
      hotkey: {
        type: 'string'
      },
      autoCorrect: {
        type: 'boolean'
      },
      autoCopy: {
        type: 'boolean'
      },
      windowSettings: {
        type: 'object',
        properties: {
          alwaysOnTop: { type: 'boolean' },
          opacity: { type: 'number', minimum: 0, maximum: 1 },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' }
            }
          },
          size: {
            type: 'object',
            properties: {
              width: { type: 'number', minimum: 400 },
              height: { type: 'number', minimum: 300 }
            }
          }
        }
      },
      aiSettings: {
        type: 'object',
        properties: {
          primaryProvider: {
            type: 'string',
            enum: ['openai', 'anthropic', 'google']
          },
          temperature: {
            type: 'number',
            minimum: 0,
            maximum: 2
          },
          maxTokens: {
            type: 'number',
            minimum: 1,
            maximum: 4000
          },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 120000
          }
        }
      },
      privacy: {
        type: 'object',
        properties: {
          saveHistory: { type: 'boolean' },
          analyticsEnabled: { type: 'boolean' }
        }
      }
    };
  }
}

/**
 * Helper function to check if value is an object
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}