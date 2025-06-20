/**
 * CorrectionController - 添削処理フロー制御
 * 
 * Issue #4: 添削処理フローの実装
 * - AI APIとの連携管理
 * - 添削モード切り替え
 * - エラーハンドリングとリトライ機能
 * - 処理結果の履歴保存連携
 */

import { EventEmitter } from 'events';
import { 
  CorrectionResult, 
  CorrectionMode, 
  AppSettings, 
  ErrorCode,
  CorrectionChange,
  APIProvider
} from '../types/interfaces';
import { hotkeyController, HotkeyEvent } from './HotkeyController';
import { clipboardController } from './ClipboardController';

export interface CorrectionRequest {
  text: string;
  mode: CorrectionMode;
  provider?: 'openai' | 'anthropic' | 'google';
  options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };
}

export interface CorrectionOptions {
  autoCorrect: boolean;
  autoCopy: boolean;
  saveHistory: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export interface AIProviderInterface {
  name: string;
  correctText(text: string, mode: CorrectionMode, options?: any): Promise<CorrectionResult>;
  isAvailable(): boolean;
}

export class CorrectionController extends EventEmitter {
  private providers: Map<string, AIProviderInterface> = new Map();
  private currentMode: CorrectionMode = 'business';
  private isProcessing: boolean = false;
  private options: CorrectionOptions;
  private settings: AppSettings | null = null;
  
  constructor(options: Partial<CorrectionOptions> = {}) {
    super();
    
    this.options = {
      autoCorrect: true,
      autoCopy: true,
      saveHistory: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
    
    this.setupEventListeners();
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    // ホットキーイベントを監視
    hotkeyController.on('hotkey-pressed', async (event: HotkeyEvent) => {
      if (this.options.autoCorrect && !this.isProcessing) {
        await this.correctText({
          text: event.selectedText,
          mode: this.currentMode
        });
      }
    });
  }

  /**
   * AIプロバイダーを登録
   */
  registerProvider(provider: AIProviderInterface): void {
    this.providers.set(provider.name, provider);
    this.emit('provider-registered', { name: provider.name });
  }

  /**
   * 設定を更新
   */
  updateSettings(settings: AppSettings): void {
    this.settings = settings;
    this.currentMode = settings.defaultMode;
    this.emit('settings-updated', settings);
  }

  /**
   * テキストを添削
   */
  async correctText(request: CorrectionRequest): Promise<CorrectionResult | null> {
    if (this.isProcessing) {
      this.emit('error', {
        code: 'VALIDATION_ERROR' as ErrorCode,
        message: '既に処理中です',
        details: { request }
      });
      return null;
    }

    this.isProcessing = true;
    this.emit('correction-started', request);

    try {
      // 入力検証
      if (!request.text || request.text.trim().length === 0) {
        throw new Error('テキストが空です');
      }

      // プロバイダーの選択
      const providerName = request.provider || this.getDefaultProvider();
      const provider = this.providers.get(providerName);
      
      if (!provider || !provider.isAvailable()) {
        throw new Error(`プロバイダー ${providerName} が利用できません`);
      }

      // 添削実行（リトライ機能付き）
      const result = await this.executeWithRetry(
        () => provider.correctText(request.text, request.mode, request.options),
        this.options.retryAttempts,
        this.options.retryDelay
      );

      // 後処理
      await this.postProcessResult(result, request);

      this.emit('correction-completed', result);
      return result;

    } catch (error) {
      const errorEvent = {
        code: 'API_ERROR' as ErrorCode,
        message: '添削処理中にエラーが発生しました',
        details: error,
        request
      };
      
      this.emit('error', errorEvent);
      return null;
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * バッチ添削（複数テキストの一括処理）
   */
  async correctBatch(texts: string[], mode: CorrectionMode): Promise<CorrectionResult[]> {
    const results: CorrectionResult[] = [];
    
    this.emit('batch-started', { count: texts.length, mode });
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.correctText({
          text: texts[i],
          mode
        });
        
        if (result) {
          results.push(result);
        }
        
        this.emit('batch-progress', {
          current: i + 1,
          total: texts.length,
          result
        });
        
      } catch (error) {
        this.emit('batch-error', {
          index: i,
          text: texts[i],
          error
        });
      }
    }
    
    this.emit('batch-completed', results);
    return results;
  }

  /**
   * 添削モードを変更
   */
  setMode(mode: CorrectionMode): void {
    this.currentMode = mode;
    this.emit('mode-changed', mode);
  }

  /**
   * 現在のモードを取得
   */
  getMode(): CorrectionMode {
    return this.currentMode;
  }

  /**
   * リトライ機能付き実行
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries: number,
    delay: number
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i < retries - 1) {
          this.emit('retry', {
            attempt: i + 1,
            maxAttempts: retries,
            error
          });
          
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 結果の後処理
   */
  private async postProcessResult(
    result: CorrectionResult,
    request: CorrectionRequest
  ): Promise<void> {
    // 自動コピー
    if (this.options.autoCopy) {
      await clipboardController.copyCorrectionResult(result);
    }

    // 履歴保存
    if (this.options.saveHistory) {
      this.emit('save-history', {
        originalText: request.text,
        correctedText: result.text,
        mode: request.mode,
        model: result.model
      });
    }

    // 統計情報の更新
    this.emit('usage-updated', {
      provider: result.model,
      tokensUsed: this.estimateTokens(request.text + result.text),
      processingTime: result.processingTime
    });
  }

  /**
   * デフォルトプロバイダーを取得
   */
  private getDefaultProvider(): string {
    if (this.settings?.aiSettings.primaryProvider) {
      return this.settings.aiSettings.primaryProvider;
    }
    
    // 利用可能な最初のプロバイダーを返す
    for (const [name, provider] of this.providers) {
      if (provider.isAvailable()) {
        return name;
      }
    }
    
    throw new Error('利用可能なプロバイダーがありません');
  }

  /**
   * トークン数を推定（簡易版）
   */
  private estimateTokens(text: string): number {
    // 日本語の場合、1文字≒2トークンとして概算
    const japaneseChars = (text.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g) || []).length;
    const otherChars = text.length - japaneseChars;
    
    return Math.ceil(japaneseChars * 2 + otherChars * 0.25);
  }

  /**
   * 添削の差分を生成
   */
  generateDiff(original: string, corrected: string): CorrectionChange[] {
    const changes: CorrectionChange[] = [];
    
    // 簡易的な差分検出（実際の実装では、より高度なdiffアルゴリズムを使用）
    const originalWords = original.split(/(\s+|[。、])/);
    const correctedWords = corrected.split(/(\s+|[。、])/);
    
    let position = 0;
    for (let i = 0; i < Math.max(originalWords.length, correctedWords.length); i++) {
      const origWord = originalWords[i] || '';
      const corrWord = correctedWords[i] || '';
      
      if (origWord !== corrWord && origWord && corrWord) {
        changes.push({
          original: origWord,
          corrected: corrWord,
          reason: '表現の改善',
          position: {
            start: position,
            end: position + origWord.length
          }
        });
      }
      
      position += origWord.length;
    }
    
    return changes;
  }

  /**
   * プロバイダーの状態を確認
   */
  checkProvidersHealth(): Map<string, boolean> {
    const health = new Map<string, boolean>();
    
    for (const [name, provider] of this.providers) {
      health.set(name, provider.isAvailable());
    }
    
    return health;
  }

  /**
   * 処理中かどうかを取得
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * オプションを更新
   */
  updateOptions(options: Partial<CorrectionOptions>): void {
    this.options = { ...this.options, ...options };
    this.emit('options-updated', this.options);
  }

  /**
   * 統計情報をリセット
   */
  resetStatistics(): void {
    this.emit('statistics-reset');
  }

  /**
   * クリーンアップ処理
   */
  destroy(): void {
    this.providers.clear();
    this.removeAllListeners();
  }
}

// シングルトンインスタンスをエクスポート
export const correctionController = new CorrectionController();