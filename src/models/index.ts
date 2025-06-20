/**
 * Model Layer Exports
 * 
 * Central export point for all model layer components
 */

// AI Providers
export { AIProvider, AIProviderConfig, AIProviderMetadata } from './providers/AIProvider';
export { OpenAIProvider } from './providers/OpenAIProvider';

// History Management
export { HistoryManager, HistorySearchOptions, HistoryStats } from './history/HistoryManager';

// Re-export types from interfaces for convenience
export type { 
  CorrectionResult, 
  CorrectionMode, 
  CorrectionHistory,
  CorrectionChange 
} from '../types/interfaces';

// Import needed types for ProviderFactory
import { AIProvider, AIProviderConfig } from './providers/AIProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';

// Provider Factory for easy instantiation
export class ProviderFactory {
  static createProvider(
    type: 'openai' | 'anthropic' | 'google',
    config: AIProviderConfig
  ): AIProvider {
    switch (type) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        // TODO: Implement AnthropicProvider
        throw new Error('Anthropic provider not yet implemented');
      case 'google':
        // TODO: Implement GoogleProvider
        throw new Error('Google provider not yet implemented');
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }
}