/**
 * Models Layer Placeholder
 * 
 * This is a placeholder for the models layer that will be implemented
 * by the worker responsible for Model layer (worker1 in another branch).
 * For now, we export stub implementations to allow IPC integration.
 */

import { AIProvider, AIProviderConfig } from './providers/AIProvider';
export { HistoryManager } from './history/HistoryManager';

// Stub provider factory until real implementation is merged
export class ProviderFactory {
  static createProvider(type: string, config: AIProviderConfig): any {
    console.log(`Creating ${type} provider with config:`, config);
    // Return a stub provider that can be used for testing
    return {
      correctText: async (text: string, mode: string) => {
        return {
          text: `[STUB] Corrected: ${text}`,
          explanation: 'This is a stub response',
          changes: [],
          confidence: 0.5,
          processingTime: 100,
          model: 'stub'
        };
      },
      checkAvailability: async () => true,
      getUsageStats: async () => ({ tokensUsed: 0, requestCount: 0, cost: 0 })
    };
  }
}

// Export stub interfaces
export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
}