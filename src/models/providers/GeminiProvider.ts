/**
 * GeminiProvider - Google Gemini AI implementation for text correction
 *
 * Implements the AIProvider interface for Google's Gemini models.
 */

import { AIProvider, AIProviderConfig, AIProviderMetadata } from "./AIProvider";
import {
  CorrectionResult,
  CorrectionMode,
  CorrectionChange,
  GEMINI_MODELS,
  GeminiModel,
} from "../../types/interfaces";
import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

interface GeminiUsage {
  tokensUsed: number;
  requestCount: number;
  cost: number;
}

export class GeminiProvider extends AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private usage: GeminiUsage = {
    tokensUsed: 0,
    requestCount: 0,
    cost: 0,
  };
  private modelName: string;

  constructor(config: AIProviderConfig & { geminiModel?: GeminiModel }) {
    // Determine model and pricing based on configuration
    const modelName = config.geminiModel || GEMINI_MODELS.FLASH_1_5;
    const modelPricing: Record<GeminiModel, { costPerToken: number }> = {
      [GEMINI_MODELS.FLASH_2_0_EXP]: { costPerToken: 0.0 }, // Free during experimental phase
      [GEMINI_MODELS.FLASH_1_5]: { costPerToken: 0.00000025 }, // $0.25 per 1M tokens
      [GEMINI_MODELS.FLASH_1_5_8B]: { costPerToken: 0.0000000625 }, // $0.0625 per 1M tokens
    };
    const pricing =
      modelPricing[modelName] || modelPricing[GEMINI_MODELS.FLASH_1_5];

    const displayNames: Record<GeminiModel, string> = {
      [GEMINI_MODELS.FLASH_2_0_EXP]: "Gemini 2.0 Flash (実験版)",
      [GEMINI_MODELS.FLASH_1_5]: "Gemini 1.5 Flash",
      [GEMINI_MODELS.FLASH_1_5_8B]: "Gemini 1.5 Flash 8B (最安価)",
    };
    const displayName = displayNames[modelName] || modelName;

    const metadata: AIProviderMetadata = {
      name: "gemini",
      displayName: `Google ${displayName}`,
      version: "2.0",
      maxInputLength: 30000, // Support up to 30k characters
      supportedModes: ["business", "academic", "casual", "presentation"],
      costPerToken: pricing.costPerToken,
    };

    super(config, metadata);
    this.modelName = modelName;
    this.validateConfig();

    this.genAI = new GoogleGenerativeAI(this.config.apiKey);

    // Initialize Gemini model with safety settings
    this.model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: this.config.temperature || 0.7,
        maxOutputTokens: this.config.maxTokens || 2048,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json",
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
      systemInstruction:
        "あなたは日本語の文章校正の専門家です。文法、スタイル、表現を改善し、修正内容を説明してください。",
    });
  }

  async correctText(
    text: string,
    mode: CorrectionMode,
    context?: string,
  ): Promise<CorrectionResult> {
    this.validateInput(text);

    const startTime = Date.now();
    const prompt = this.generatePrompt(text, mode, context);

    try {
      const response = await this.retryWithBackoff(() =>
        this.callGeminiAPI(prompt),
      );
      const correctionData = this.parseResponse(response, text);

      return {
        ...correctionData,
        processingTime: Date.now() - startTime,
        model: this.metadata.displayName,
      };
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  private async callGeminiAPI(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Update usage statistics
    if (response.usageMetadata) {
      const totalTokens =
        (response.usageMetadata.promptTokenCount || 0) +
        (response.usageMetadata.candidatesTokenCount || 0);
      this.usage.tokensUsed += totalTokens;
      this.usage.requestCount += 1;
      this.usage.cost += totalTokens * this.metadata.costPerToken;
    } else {
      // Fallback: estimate tokens if metadata not available
      const estimatedTokens = Math.ceil((prompt.length + text.length) / 4);
      this.usage.tokensUsed += estimatedTokens;
      this.usage.requestCount += 1;
      this.usage.cost += estimatedTokens * this.metadata.costPerToken;
    }

    return text;
  }

  private parseResponse(
    response: string,
    originalText: string,
  ): Omit<CorrectionResult, "processingTime" | "model"> {
    if (!response) {
      throw new Error("Empty response from Gemini");
    }

    try {
      // Try to extract JSON from the response - look for a complete JSON object
      const jsonStartIndex = response.indexOf("{");
      const jsonEndIndex = response.lastIndexOf("}");

      if (
        jsonStartIndex !== -1 &&
        jsonEndIndex !== -1 &&
        jsonEndIndex > jsonStartIndex
      ) {
        const jsonString = response.substring(jsonStartIndex, jsonEndIndex + 1);
        const parsed = JSON.parse(jsonString);

        // Extract corrected text and changes
        const correctedText = parsed.correctedText || parsed.text || "";
        const explanation = parsed.explanation || parsed.summary || "";
        const changes = this.extractChanges(
          originalText,
          correctedText,
          parsed.changes || [],
        );

        return {
          text: correctedText,
          explanation,
          changes,
          confidence: this.calculateConfidence(
            originalText,
            correctedText,
            changes,
          ),
        };
      }
    } catch {
      // Continue to fallback parsing
    }

    // Fallback parsing for non-JSON responses
    const lines = response.split("\n").filter((line) => line.trim());

    // Try to find the corrected text (usually the first substantial paragraph)
    let correctedText = originalText;
    let explanation = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("修正後") || line.includes("訂正後")) {
        // Found corrected text marker
        correctedText = lines[i + 1] || correctedText;
        explanation = lines.slice(i + 2).join("\n");
        break;
      } else if (i === 0 && line.length > 20) {
        // First line might be the corrected text
        correctedText = line;
        explanation = lines.slice(1).join("\n");
      }
    }

    return {
      text: correctedText,
      explanation: explanation || "テキストを修正しました。",
      changes: this.extractChanges(originalText, correctedText, []),
      confidence: 0.8,
    };
  }

  private extractChanges(
    original: string,
    corrected: string,
    providedChanges: Array<{
      type?: string;
      original?: string;
      corrected?: string;
      reason?: string;
      explanation?: string;
      position?: {
        start?: number;
        end?: number;
      };
    }>,
  ): CorrectionChange[] {
    const changes: CorrectionChange[] = [];

    // If changes are provided in the response, use them
    if (providedChanges.length > 0) {
      return providedChanges.map((change) => ({
        original: change.original || "",
        corrected: change.corrected || "",
        reason: change.reason || change.explanation || "",
        position: {
          start: change.position?.start || 0,
          end: change.position?.end || 0,
        },
      }));
    }

    // Otherwise, perform basic diff to identify changes
    const words = original.split(/(\s+)/);
    const correctedWords = corrected.split(/(\s+)/);
    let position = 0;

    for (let i = 0; i < Math.max(words.length, correctedWords.length); i++) {
      const originalWord = words[i] || "";
      const correctedWord = correctedWords[i] || "";

      if (
        originalWord !== correctedWord &&
        originalWord.trim() &&
        correctedWord.trim()
      ) {
        changes.push({
          original: originalWord,
          corrected: correctedWord,
          reason: "Text correction",
          position: {
            start: position,
            end: position + [...originalWord].length,
          },
        });
      }

      position += [...originalWord].length;
    }

    return changes;
  }

  private calculateConfidence(
    original: string,
    corrected: string,
    changes: CorrectionChange[],
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
      // Test the API with a simple prompt
      const result = await this.model.generateContent("テスト");
      const response = await result.response;
      return response.text().length > 0;
    } catch {
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
  protected generatePrompt(
    text: string,
    mode: CorrectionMode,
    context?: string,
  ): string {
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
