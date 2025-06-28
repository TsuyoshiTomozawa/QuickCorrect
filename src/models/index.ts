/**
 * Model Layer Exports
 *
 * Central export point for all model layer components
 */

// AI Providers
export {
  AIProvider,
  AIProviderConfig,
  AIProviderMetadata,
} from "./providers/AIProvider";
export { OpenAIProvider } from "./providers/OpenAIProvider";
export { GeminiProvider } from "./providers/GeminiProvider";

// History Management
export {
  HistoryManager,
  HistorySearchOptions,
  HistoryStats,
} from "./history/HistoryManager";

// Re-export types from interfaces for convenience
export type {
  CorrectionResult,
  CorrectionMode,
  CorrectionHistory,
  CorrectionChange,
} from "../types/interfaces";

// Import needed types for ProviderFactory
import { AIProvider, AIProviderConfig } from "./providers/AIProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { GeminiProvider } from "./providers/GeminiProvider";
import { GeminiModel } from "../types/interfaces";

// Provider Factory for easy instantiation
export class ProviderFactory {
  static createProvider(
    type: "openai" | "anthropic" | "google",
    config: AIProviderConfig & { geminiModel?: GeminiModel },
  ): AIProvider {
    switch (type) {
      case "openai":
        return new OpenAIProvider(config);
      case "anthropic":
        throw new Error("Anthropic provider not yet implemented");
      case "google":
        return new GeminiProvider(config);
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }
}
