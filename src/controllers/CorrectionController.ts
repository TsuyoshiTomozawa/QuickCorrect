/**
 * CorrectionController - 統合版添削処理制御
 * 
 * EventBusと連携して添削ワークフローを管理
 */

import { eventBus, EventType } from '../services/EventBus';
import { 
  CorrectionResult, 
  CorrectionMode, 
  AppSettings,
  ErrorCode,
  CorrectionChange 
} from '../types/interfaces';
import { v4 as uuidv4 } from 'uuid';

// AI Providerインターフェース（両方の実装を統合）
export interface AIProvider {
  name: string;
  correctText(text: string, mode: CorrectionMode, options?: any): Promise<CorrectionResult>;
  isAvailable(): boolean;
}

export interface AIProviderInterface extends AIProvider {}

// 添削リクエスト
export interface CorrectionRequest {
  id: string;
  text: string;
  mode: CorrectionMode;
  provider?: string;
  timestamp: Date;
  retryCount: number;
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
  timeout?: number;
}

export class CorrectionController {
  private providers: Map<string, AIProvider> = new Map();
  private activeRequests: Map<string, CorrectionRequest> = new Map();
  private currentMode: CorrectionMode = 'business';
  private isProcessing: boolean = false;
  private settings: AppSettings | null = null;
  private options: CorrectionOptions = {
    autoCorrect: true,
    autoCopy: true,
    saveHistory: true,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000
  };
  
  constructor(options?: Partial<CorrectionOptions>) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    this.setupEventListeners();
    this.setupWorkflow();
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    // テキスト選択イベントを監視
    eventBus.on(EventType.TEXT_SELECTED, async (payload) => {
      if (this.options.autoCorrect) {
        await this.startCorrection(payload.text, this.currentMode);
      }
    });

    // 設定変更イベントを監視
    eventBus.on(EventType.SETTINGS_CHANGED, (payload) => {
      if (payload.correction) {
        this.updateOptions(payload.correction);
      }
      if (payload.defaultMode) {
        this.currentMode = payload.defaultMode;
      }
    });
  }

  /**
   * ワークフローの設定
   */
  private setupWorkflow(): void {
    // 添削開始 → プロバイダー選択 → API呼び出し → 結果処理 → 完了通知
    
    eventBus.on(EventType.CORRECTION_STARTED, async (payload) => {
      const request = this.activeRequests.get(payload.requestId);
      if (!request) return;
      
      try {
        // プロバイダーの選択と実行
        const result = await this.executeCorrection(request);
        
        // 成功イベントを発行
        eventBus.emit(EventType.CORRECTION_COMPLETED, {
          result,
          requestId: request.id,
          duration: Date.now() - request.timestamp.getTime()
        });
        
      } catch (error) {
        // エラーハンドリング
        await this.handleCorrectionError(request, error);
      } finally {
        // リクエストをクリーンアップ
        this.activeRequests.delete(request.id);
      }
    });
  }

  /**
   * AIプロバイダーを登録
   */
  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
    console.log(`AI Provider registered: ${provider.name}`);
  }

  /**
   * 設定を更新
   */
  updateSettings(settings: AppSettings): void {
    this.settings = settings;
    this.currentMode = settings.defaultMode;
    eventBus.emit(EventType.SETTINGS_CHANGED, settings);
  }

  /**
   * Correct text using AI (簡易版API互換メソッド)
   */
  async correctText(text: string, mode: CorrectionMode): Promise<CorrectionResult> {
    const requestId = await this.startCorrection(text, mode);
    
    if (!requestId) {
      throw new Error('テキストの添削を開始できませんでした');
    }
    
    // 結果を待つ
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('添削タイムアウト'));
      }, this.options.timeout || 30000);
      
      const successHandler = (payload: any) => {
        if (payload.requestId === requestId) {
          clearTimeout(timeout);
          eventBus.off(EventType.CORRECTION_COMPLETED, successHandler);
          eventBus.off(EventType.CORRECTION_FAILED, failHandler);
          resolve(payload.result);
        }
      };
      
      const failHandler = (payload: any) => {
        if (payload.requestId === requestId) {
          clearTimeout(timeout);
          eventBus.off(EventType.CORRECTION_COMPLETED, successHandler);
          eventBus.off(EventType.CORRECTION_FAILED, failHandler);
          reject(new Error(payload.error.message));
        }
      };
      
      eventBus.on(EventType.CORRECTION_COMPLETED, successHandler);
      eventBus.on(EventType.CORRECTION_FAILED, failHandler);
    });
  }

  /**
   * 添削を開始
   */
  async startCorrection(text: string, mode?: CorrectionMode): Promise<string> {
    // 入力検証
    if (!text || text.trim().length === 0) {
      eventBus.emit(EventType.CORRECTION_FAILED, {
        error: {
          code: 'VALIDATION_ERROR' as ErrorCode,
          message: 'テキストが空です',
          timestamp: new Date()
        },
        requestId: '',
        text
      });
      return '';
    }

    // リクエストを作成
    const request: CorrectionRequest = {
      id: uuidv4(),
      text: text.trim(),
      mode: mode || this.currentMode,
      timestamp: new Date(),
      retryCount: 0
    };

    // アクティブリクエストに追加
    this.activeRequests.set(request.id, request);

    // 添削開始イベントを発行
    eventBus.emit(EventType.CORRECTION_STARTED, {
      text: request.text,
      mode: request.mode,
      requestId: request.id
    });

    return request.id;
  }

  /**
   * 添削を実行
   */
  private async executeCorrection(request: CorrectionRequest): Promise<CorrectionResult> {
    // プロバイダーの選択
    const provider = this.selectProvider(request.provider);
    if (!provider) {
      // プロバイダーが利用できない場合、モック結果を返す
      return await this.mockCorrection(request.text, request.mode);
    }

    // タイムアウト付きで実行
    const correctionPromise = provider.correctText(
      request.text, 
      request.mode,
      { timeout: this.options.timeout }
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('添削タイムアウト')), this.options.timeout || 30000);
    });

    try {
      const result = await Promise.race([correctionPromise, timeoutPromise]);
      
      // 変更箇所を検出
      if (!result.changes || result.changes.length === 0) {
        result.changes = this.detectChanges(request.text, result.text);
      }
      
      // 統計情報を記録
      eventBus.emit(EventType.USAGE_RECORDED, {
        provider: provider.name,
        mode: request.mode,
        inputLength: request.text.length,
        outputLength: result.text.length,
        processingTime: result.processingTime,
        timestamp: new Date()
      });
      
      return result;
      
    } catch (error) {
      // リトライ処理
      if (request.retryCount < this.options.retryAttempts) {
        request.retryCount++;
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * request.retryCount));
        return await this.executeCorrection(request);
      }
      
      throw error;
    }
  }

  /**
   * Mock correction for development
   */
  private async mockCorrection(text: string, mode: CorrectionMode): Promise<CorrectionResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simple mock corrections based on mode
    let correctedText = text;
    const changes: CorrectionChange[] = [];
    
    // Apply different corrections based on mode
    switch (mode) {
      case 'business':
        correctedText = this.applyBusinessCorrections(text, changes);
        break;
      case 'academic':
        correctedText = this.applyAcademicCorrections(text, changes);
        break;
      case 'casual':
        correctedText = this.applyCasualCorrections(text, changes);
        break;
      case 'presentation':
        correctedText = this.applyPresentationCorrections(text, changes);
        break;
    }
    
    return {
      text: correctedText,
      explanation: `${mode}モードで添削しました。`,
      changes,
      confidence: 0.95,
      processingTime: 1500,
      model: 'mock-model-v1'
    };
  }
  
  private applyBusinessCorrections(text: string, changes: CorrectionChange[]): string {
    let result = text;
    
    // Example: Replace casual expressions with formal ones
    const replacements = [
      { from: 'です。', to: 'でございます。', reason: 'より丁寧な表現' },
      { from: 'ありがとう', to: 'ありがとうございます', reason: '敬語表現' },
      { from: 'すみません', to: '申し訳ございません', reason: 'ビジネス敬語' }
    ];
    
    replacements.forEach(({ from, to, reason }) => {
      if (result.includes(from)) {
        const position = result.indexOf(from);
        changes.push({
          original: from,
          corrected: to,
          reason,
          position: { start: position, end: position + from.length }
        });
        result = result.replace(new RegExp(from, 'g'), to);
      }
    });
    
    return result;
  }
  
  private applyAcademicCorrections(text: string, changes: CorrectionChange[]): string {
    // Academic style corrections
    return text + '\n\n（学術的な添削が適用されました）';
  }
  
  private applyCasualCorrections(text: string, changes: CorrectionChange[]): string {
    // Casual style corrections
    return text + '\n\n（カジュアルな添削が適用されました）';
  }
  
  private applyPresentationCorrections(text: string, changes: CorrectionChange[]): string {
    // Presentation style corrections
    return text + '\n\n（プレゼンテーション向けの添削が適用されました）';
  }

  /**
   * プロバイダーを選択
   */
  private selectProvider(preferredProvider?: string): AIProvider | null {
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider && provider.isAvailable()) {
        return provider;
      }
    }

    // 利用可能な最初のプロバイダーを返す
    for (const [_, provider] of this.providers) {
      if (provider.isAvailable()) {
        return provider;
      }
    }

    return null;
  }

  /**
   * エラーハンドリング
   */
  private async handleCorrectionError(request: CorrectionRequest, error: any): Promise<void> {
    const errorCode = this.determineErrorCode(error);
    
    eventBus.emit(EventType.CORRECTION_FAILED, {
      error: {
        code: errorCode,
        message: error.message || '添削中にエラーが発生しました',
        details: error,
        timestamp: new Date()
      },
      requestId: request.id,
      text: request.text
    });

    // システムエラーも発行
    if (errorCode === 'UNKNOWN_ERROR') {
      eventBus.emit(EventType.SYSTEM_ERROR, {
        error: {
          code: errorCode,
          message: '予期しないエラーが発生しました',
          details: error,
          timestamp: new Date()
        },
        context: { request }
      });
    }
  }

  /**
   * エラーコードを判定
   */
  private determineErrorCode(error: any): ErrorCode {
    if (error.message?.includes('ネットワーク') || error.code === 'ENOTFOUND') {
      return 'NETWORK_ERROR';
    }
    if (error.message?.includes('API') || error.response?.status >= 400) {
      return 'API_ERROR';
    }
    if (error.message?.includes('権限') || error.message?.includes('Permission')) {
      return 'PERMISSION_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * テキストの変更箇所を検出
   */
  private detectChanges(original: string, corrected: string): CorrectionChange[] {
    const changes: CorrectionChange[] = [];
    
    // 単純な単語レベルの差分検出
    const originalWords = original.split(/(\s+|[。、！？])/);
    const correctedWords = corrected.split(/(\s+|[。、！？])/);
    
    let position = 0;
    const maxLength = Math.max(originalWords.length, correctedWords.length);
    
    for (let i = 0; i < maxLength; i++) {
      const origWord = originalWords[i] || '';
      const corrWord = correctedWords[i] || '';
      
      if (origWord !== corrWord && origWord && corrWord) {
        changes.push({
          original: origWord,
          corrected: corrWord,
          reason: this.inferChangeReason(origWord, corrWord),
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
   * 変更理由を推測
   */
  private inferChangeReason(original: string, corrected: string): string {
    // 敬語変換
    if (corrected.includes('です') || corrected.includes('ます')) {
      return '敬語表現への変換';
    }
    
    // 漢字変換
    if (original.match(/[\u3040-\u309f]/) && corrected.match(/[\u4e00-\u9faf]/)) {
      return '漢字変換';
    }
    
    // 句読点
    if (original.match(/[、。]/) || corrected.match(/[、。]/)) {
      return '句読点の修正';
    }
    
    return '表現の改善';
  }

  /**
   * 添削モードを設定
   */
  setMode(mode: CorrectionMode): void {
    this.currentMode = mode;
    eventBus.emit(EventType.SETTINGS_CHANGED, { defaultMode: mode });
  }

  /**
   * 現在のモードを取得
   */
  getMode(): CorrectionMode {
    return this.currentMode;
  }

  /**
   * バッチ添削（複数テキストの一括処理）
   */
  async correctBatch(texts: string[], mode?: CorrectionMode): Promise<string[]> {
    const requestIds: string[] = [];
    
    // 全てのリクエストを開始
    for (const text of texts) {
      const requestId = await this.startCorrection(text, mode);
      if (requestId) {
        requestIds.push(requestId);
      }
    }
    
    // 全ての完了を待つ
    return new Promise((resolve) => {
      const results: string[] = [];
      let completed = 0;
      
      const listener = (payload: any) => {
        if (requestIds.includes(payload.requestId)) {
          results.push(payload.result.text);
          completed++;
          
          if (completed === requestIds.length) {
            eventBus.off(EventType.CORRECTION_COMPLETED, listener);
            resolve(results);
          }
        }
      };
      
      eventBus.on(EventType.CORRECTION_COMPLETED, listener);
    });
  }

  /**
   * 添削の差分を生成
   */
  generateDiff(original: string, corrected: string): CorrectionChange[] {
    return this.detectChanges(original, corrected);
  }

  /**
   * オプションを更新
   */
  updateOptions(options: Partial<CorrectionOptions>): void {
    this.options = { ...this.options, ...options };
    eventBus.emit(EventType.SETTINGS_CHANGED, { correction: this.options });
  }

  /**
   * アクティブなリクエスト数を取得
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
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
    return this.activeRequests.size > 0;
  }

  /**
   * 統計情報をリセット
   */
  resetStatistics(): void {
    eventBus.emit(EventType.STATISTICS_RESET, { timestamp: new Date() });
  }

  /**
   * クリーンアップ処理
   */
  destroy(): void {
    this.activeRequests.clear();
    this.providers.clear();
  }
}