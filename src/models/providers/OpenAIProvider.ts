/**
 * OpenAIProvider - OpenAI GPT-4 implementation for text correction
 * 
 * Implements the AIProvider interface for OpenAI's GPT models.
 */

import { AIProvider, AIProviderConfig, AIProviderMetadata } from './AIProvider';
import { CorrectionResult, CorrectionMode, CorrectionChange } from '../../types/interfaces';
import OpenAI from 'openai';

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIUsage {
  tokensUsed: number;
  requestCount: number;
  cost: number;
}

export class OpenAIProvider extends AIProvider {
  private openai: OpenAI;
  private usage: OpenAIUsage = {
    tokensUsed: 0,
    requestCount: 0,
    cost: 0
  };

  constructor(config: AIProviderConfig) {
    const metadata: AIProviderMetadata = {
      name: 'openai',
      displayName: 'OpenAI GPT-4',
      version: '4.0',
      maxInputLength: 8000,
      supportedModes: ['business', 'academic', 'casual', 'presentation'],
      costPerToken: 0.00003 // GPT-4 pricing per token
    };

    super(config, metadata);
    this.validateConfig();

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: 0 // We handle retries ourselves
    });
  }

  async correctText(
    text: string,
    mode: CorrectionMode,
    context?: string
  ): Promise<CorrectionResult> {
    this.validateInput(text);

    const startTime = Date.now();
    const prompt = this.generatePrompt(text, mode, context);

    try {
      const response = await this.retryWithBackoff(() => this.callOpenAIAPI(prompt));
      const correctionData = this.parseResponse(response, text);
      
      return {
        ...correctionData,
        processingTime: Date.now() - startTime,
        model: this.metadata.displayName
      };
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  private async callOpenAIAPI(prompt: string): Promise<any> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'あなたは日本語の文章校正の専門家です。文法、スタイル、表現を改善し、修正内容を説明してください。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      response_format: { type: "json_object" }
    });

    // Update usage statistics
    if (response.usage) {
      this.usage.tokensUsed += response.usage.total_tokens;
      this.usage.requestCount += 1;
      this.usage.cost += response.usage.total_tokens * this.metadata.costPerToken;
    }

    return response;
  }

  private parseResponse(response: any, originalText: string): Omit<CorrectionResult, 'processingTime' | 'model'> {
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      // Parse the JSON response
      const parsed = JSON.parse(content);
      
      // Extract corrected text and changes
      const correctedText = parsed.correctedText || parsed.text || '';
      const explanation = parsed.explanation || parsed.summary || '';
      const changes = this.extractChanges(originalText, correctedText, parsed.changes || []);

      return {
        text: correctedText,
        explanation,
        changes,
        confidence: this.calculateConfidence(originalText, correctedText, changes)
      };
    } catch (error) {
      // Fallback for non-JSON responses
      const lines = content.split('\n');
      const correctedText = lines[0] || originalText;
      
      return {
        text: correctedText,
        explanation: lines.slice(1).join('\n'),
        changes: this.extractChanges(originalText, correctedText, []),
        confidence: 0.7
      };
    }
  }

  private extractChanges(
    original: string,
    corrected: string,
    providedChanges: any[]
  ): CorrectionChange[] {
    const changes: CorrectionChange[] = [];

    // If changes are provided in the response, use them
    if (providedChanges.length > 0) {
      return providedChanges.map(change => ({
        original: change.original || '',
        corrected: change.corrected || '',
        reason: change.reason || change.explanation || '',
        position: {
          start: change.position?.start || 0,
          end: change.position?.end || 0
        }
      }));
    }

    // Otherwise, perform basic diff to identify changes
    const words = original.split(/(\s+)/);
    const correctedWords = corrected.split(/(\s+)/);
    let position = 0;

    for (let i = 0; i < Math.max(words.length, correctedWords.length); i++) {
      const originalWord = words[i] || '';
      const correctedWord = correctedWords[i] || '';

      if (originalWord !== correctedWord && originalWord.trim() && correctedWord.trim()) {
        changes.push({
          original: originalWord,
          corrected: correctedWord,
          reason: 'Text correction',
          position: {
            start: position,
            end: position + originalWord.length
          }
        });
      }

      position += originalWord.length;
    }

    return changes;
  }

  private calculateConfidence(
    original: string,
    corrected: string,
    changes: CorrectionChange[]
  ): number {
    if (original === corrected) {
      return 1.0;
    }

    const changeRatio = changes.length / (original.split(/\s+/).length || 1);
    const confidence = Math.max(0.5, 1 - changeRatio * 0.1);

    return Math.min(1.0, confidence);
  }

  async checkAvailability(): Promise<boolean> {
    try {
      const models = await this.openai.models.list();
      return models.data.length > 0;
    } catch (error) {
      return false;
    }
  }

  async getUsageStats(): Promise<{
    tokensUsed: number;
    requestCount: number;
    cost: number;
  }> {
    return { ...this.usage };
  }

  /**
   * Enhanced prompt generation for OpenAI
   */
  protected generatePrompt(text: string, mode: CorrectionMode, context?: string): string {
    const basePrompt = super.generatePrompt(text, mode, context);
    
    return `${basePrompt}

以下のJSON形式で回答してください:
{
  "correctedText": "修正後のテキスト",
  "explanation": "修正内容の説明",
  "changes": [
    {
      "original": "元の表現",
      "corrected": "修正後の表現",
      "reason": "修正理由",
      "position": {
        "start": 開始位置,
        "end": 終了位置
      }
    }
  ]
}`;
  }
}