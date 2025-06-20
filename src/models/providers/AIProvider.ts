/**
 * AIProvider Stub
 * 
 * Placeholder for the actual AIProvider implementation
 */

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
}

export abstract class AIProvider {
  // Stub implementation
}