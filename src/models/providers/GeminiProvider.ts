/**
 * GeminiProvider - Google Gemini implementation for text correction
 * 
 * Implements the AIProvider interface for Google's Gemini models.
 */

import { AIProvider, AIProviderConfig, AIProviderMetadata } from './AIProvider';
import { CorrectionResult, CorrectionMode, CorrectionChange } from '../../types/interfaces';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeminiUsage {
  tokensUsed: number;
  requestCount: number;
  cost: number;
}

export class GeminiProvider extends AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private usage: GeminiUsage = {
    tokensUsed: 0,
    requestCount: 0,
    cost: 0
  };

  constructor(config: AIProviderConfig) {
    const metadata: AIProviderMetadata = {
      name: 'gemini',
      displayName: 'Google Gemini 2.5 Flash Lite',
      version: '2.0',
      maxInputLength: 12800,
      supportedModes: ['business', 'academic', 'casual', 'presentation'],
      costPerToken: 0.00000025 // Gemini Flash pricing per token
    };

    super(config, metadata);
    this.validateConfig();

    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite-preview-06-17",
      generationConfig: {
        temperature: this.config.temperature || 0.7,
        maxOutputTokens: this.config.maxTokens || 2000,
        responseMimeType: "application/json"
      }
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
      const response = await this.retryWithBackoff(() => this.callGeminiAPI(prompt));
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

  private async callGeminiAPI(prompt: string): Promise<any> {
    const result = await this.model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: prompt
        }]
      }],
      systemInstruction: 'あなたは日本語の文章校正の専門家です。文法、スタイル、表現を改善し、修正内容を説明してください。'
    });

    const response = await result.response;
    
    // Update usage statistics
    if (result.response.usageMetadata) {
      const totalTokens = (result.response.usageMetadata.promptTokenCount || 0) + 
                         (result.response.usageMetadata.candidatesTokenCount || 0);
      this.usage.tokensUsed += totalTokens;
      this.usage.requestCount += 1;
      this.usage.cost += totalTokens * this.metadata.costPerToken;
    }

    return response;
  }

  private parseResponse(response: any, originalText: string): Omit<CorrectionResult, 'processingTime' | 'model'> {
    const content = response.text();
    
    if (!content) {
      throw new Error('Empty response from Gemini');
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
      const result = await this.model.generateContent('テスト');
      return !!result.response;
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
   * Enhanced prompt generation for Gemini
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