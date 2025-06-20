/**
 * AIProvider - Base class for AI text correction providers
 * 
 * This abstract class defines the interface that all AI providers must implement
 * to integrate with QuickCorrect.
 */

import { CorrectionResult, CorrectionMode, AppError } from '../../types/interfaces';

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProviderMetadata {
  name: string;
  displayName: string;
  version: string;
  maxInputLength: number;
  supportedModes: CorrectionMode[];
  costPerToken: number;
}

export abstract class AIProvider {
  protected config: AIProviderConfig;
  protected metadata: AIProviderMetadata;

  constructor(config: AIProviderConfig, metadata: AIProviderMetadata) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      temperature: 0.7,
      maxTokens: 2000,
      ...config
    };
    this.metadata = metadata;
  }

  /**
   * Validates the provider configuration
   */
  protected validateConfig(): void {
    if (!this.config.apiKey || this.config.apiKey.trim() === '') {
      throw new Error(`${this.metadata.name}: API key is required`);
    }

    if (this.config.temperature && (this.config.temperature < 0 || this.config.temperature > 2)) {
      throw new Error(`${this.metadata.name}: Temperature must be between 0 and 2`);
    }

    if (this.config.maxTokens && this.config.maxTokens < 1) {
      throw new Error(`${this.metadata.name}: Max tokens must be positive`);
    }
  }

  /**
   * Main method to correct text - must be implemented by each provider
   */
  abstract correctText(
    text: string,
    mode: CorrectionMode,
    context?: string
  ): Promise<CorrectionResult>;

  /**
   * Checks if the provider is available and properly configured
   */
  abstract checkAvailability(): Promise<boolean>;

  /**
   * Gets the current usage statistics for the provider
   */
  abstract getUsageStats(): Promise<{
    tokensUsed: number;
    requestCount: number;
    cost: number;
  }>;

  /**
   * Common method to generate the correction prompt based on mode
   */
  protected generatePrompt(text: string, mode: CorrectionMode, context?: string): string {
    const modeInstructions = {
      business: `以下の日本語テキストをビジネス文書として適切に修正してください。
敬語、丁寧語、謙譲語を正しく使い、プロフェッショナルな表現にしてください。
文法的な誤りを修正し、より明確で説得力のある文章にしてください。`,
      academic: `以下の日本語テキストを学術的な文章として修正してください。
論理的で明確な構成にし、専門用語を適切に使用してください。
文法的な正確性を保ち、客観的で説得力のある表現にしてください。`,
      casual: `以下の日本語テキストを自然で親しみやすい表現に修正してください。
硬い表現を避け、読みやすく理解しやすい文章にしてください。
文法的な誤りは修正しつつ、カジュアルで温かみのあるトーンを保ってください。`,
      presentation: `以下の日本語テキストをプレゼンテーション用に修正してください。
簡潔で印象的な表現を使い、聴衆の注意を引く文章にしてください。
要点を明確にし、記憶に残りやすい構成にしてください。`
    };

    let prompt = modeInstructions[mode] || modeInstructions.business;
    
    if (context) {
      prompt += `\n\n文脈情報: ${context}`;
    }

    prompt += `\n\n修正対象テキスト:\n${text}\n\n修正後のテキストと、主な変更点の説明を提供してください。`;

    return prompt;
  }

  /**
   * Validates input text before processing
   */
  protected validateInput(text: string): void {
    if (!text || text.trim() === '') {
      throw new Error('Input text cannot be empty');
    }

    if (text.length > this.metadata.maxInputLength) {
      throw new Error(
        `Input text exceeds maximum length of ${this.metadata.maxInputLength} characters`
      );
    }
  }

  /**
   * Handles API errors consistently across providers
   */
  protected handleApiError(error: any): AppError {
    const baseError: AppError = {
      code: 'API_ERROR',
      message: `${this.metadata.displayName} API error`,
      timestamp: new Date(),
      details: error
    };

    if (error.response?.status === 401) {
      baseError.code = 'API_ERROR';
      baseError.message = 'Invalid API key';
    } else if (error.response?.status === 429) {
      baseError.code = 'API_ERROR';
      baseError.message = 'Rate limit exceeded';
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      baseError.code = 'NETWORK_ERROR';
      baseError.message = 'Request timeout';
    } else if (!navigator.onLine) {
      baseError.code = 'NETWORK_ERROR';
      baseError.message = 'No internet connection';
    }

    return baseError;
  }

  /**
   * Implements retry logic with exponential backoff
   */
  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries: number = this.config.maxRetries || 3
  ): Promise<T> {
    let lastError: any;

    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (i < retries - 1) {
          const delay = Math.min(1000 * Math.pow(2, i), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Gets provider metadata
   */
  getMetadata(): AIProviderMetadata {
    return { ...this.metadata };
  }

  /**
   * Updates provider configuration
   */
  updateConfig(newConfig: Partial<AIProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }
}