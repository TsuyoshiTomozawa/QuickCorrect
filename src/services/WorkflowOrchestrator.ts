/**
 * WorkflowOrchestrator - 添削ワークフロー統合管理
 * 
 * ホットキー → テキスト選択 → 添削 → クリップボード → UIの
 * 一連のワークフローを管理
 */

import { BrowserWindow } from 'electron';
import { eventBus, EventType } from './EventBus';
import { HotkeyController } from '../controllers/HotkeyController';
import { ClipboardController } from '../controllers/ClipboardController';
import { CorrectionController } from '../controllers/CorrectionController';
import { CorrectionMode } from '../types/interfaces';

export interface WorkflowState {
  isActive: boolean;
  currentStep: WorkflowStep;
  selectedText: string;
  correctionRequestId: string;
  startTime: Date;
  errors: any[];
}

export enum WorkflowStep {
  IDLE = 'idle',
  TEXT_SELECTION = 'text-selection',
  CORRECTION = 'correction',
  CLIPBOARD_COPY = 'clipboard-copy',
  UI_UPDATE = 'ui-update',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export class WorkflowOrchestrator {
  private correctionController: CorrectionController;
  private mainWindow: BrowserWindow | null = null;
  
  private workflowState: WorkflowState = {
    isActive: false,
    currentStep: WorkflowStep.IDLE,
    selectedText: '',
    correctionRequestId: '',
    startTime: new Date(),
    errors: []
  };

  constructor(
    _hotkeyController: HotkeyController,
    _clipboardController: ClipboardController,
    correctionController: CorrectionController
  ) {
    this.correctionController = correctionController;
    
    this.setupWorkflowListeners();
  }

  /**
   * メインウィンドウを設定
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * ワークフローイベントリスナーの設定
   */
  private setupWorkflowListeners(): void {
    // ホットキー押下でワークフロー開始
    eventBus.on(EventType.HOTKEY_PRESSED, () => {
      this.startWorkflow();
    });

    // テキスト選択完了
    eventBus.on(EventType.TEXT_SELECTED, async (payload) => {
      if (this.workflowState.isActive && this.workflowState.currentStep === WorkflowStep.TEXT_SELECTION) {
        this.workflowState.selectedText = payload.text;
        this.workflowState.currentStep = WorkflowStep.CORRECTION;
        
        // ウィンドウを表示
        await this.showWindow(payload.text);
        
        // 添削を開始
        const requestId = await this.correctionController.startCorrection(payload.text);
        this.workflowState.correctionRequestId = requestId;
      }
    });

    // テキスト選択失敗
    eventBus.on(EventType.TEXT_SELECTION_FAILED, () => {
      if (this.workflowState.isActive) {
        this.handleWorkflowError('テキストが選択されていません');
      }
    });

    // 添削完了
    eventBus.on(EventType.CORRECTION_COMPLETED, async (payload) => {
      if (this.workflowState.isActive && 
          payload.requestId === this.workflowState.correctionRequestId) {
        this.workflowState.currentStep = WorkflowStep.CLIPBOARD_COPY;
        
        // UIを更新
        await this.updateUI(payload.result);
        
        // 完了処理
        this.completeWorkflow();
      }
    });

    // 添削失敗
    eventBus.on(EventType.CORRECTION_FAILED, (payload) => {
      if (this.workflowState.isActive && 
          payload.requestId === this.workflowState.correctionRequestId) {
        this.handleWorkflowError(payload.error.message);
      }
    });

    // クリップボードコピー完了
    eventBus.on(EventType.CLIPBOARD_COPIED, () => {
      if (this.workflowState.isActive && 
          this.workflowState.currentStep === WorkflowStep.CLIPBOARD_COPY) {
        this.workflowState.currentStep = WorkflowStep.UI_UPDATE;
      }
    });
  }

  /**
   * ワークフローを開始
   */
  private startWorkflow(): void {
    // 既存のワークフローが実行中の場合はキャンセル
    if (this.workflowState.isActive) {
      this.cancelWorkflow();
    }

    // ワークフロー状態を初期化
    this.workflowState = {
      isActive: true,
      currentStep: WorkflowStep.TEXT_SELECTION,
      selectedText: '',
      correctionRequestId: '',
      startTime: new Date(),
      errors: []
    };

    console.log('Workflow started');
  }

  /**
   * ウィンドウを表示
   */
  private async showWindow(selectedText: string): Promise<void> {
    if (!this.mainWindow) return;

    try {
      // ウィンドウを表示
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      
      // フォーカスを設定
      this.mainWindow.focus();
      
      // 選択されたテキストをレンダラーに送信
      this.mainWindow.webContents.send('workflow:text-selected', {
        text: selectedText,
        mode: this.correctionController.getMode()
      });
      
      eventBus.emit(EventType.WINDOW_SHOW, {
        reason: 'workflow',
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Window show error:', error);
    }
  }

  /**
   * UIを更新
   */
  private async updateUI(correctionResult: any): Promise<void> {
    if (!this.mainWindow) return;

    try {
      // 添削結果をレンダラーに送信
      this.mainWindow.webContents.send('workflow:correction-completed', {
        original: this.workflowState.selectedText,
        corrected: correctionResult.text,
        explanation: correctionResult.explanation,
        changes: correctionResult.changes,
        confidence: correctionResult.confidence,
        processingTime: correctionResult.processingTime
      });
      
      this.workflowState.currentStep = WorkflowStep.UI_UPDATE;
      
    } catch (error) {
      console.error('UI update error:', error);
    }
  }

  /**
   * ワークフローを完了
   */
  private completeWorkflow(): void {
    const duration = Date.now() - this.workflowState.startTime.getTime();
    
    this.workflowState.currentStep = WorkflowStep.COMPLETED;
    this.workflowState.isActive = false;
    
    // 統計情報を更新
    eventBus.emit(EventType.STATS_UPDATED, {
      workflow: 'correction',
      duration,
      success: true,
      timestamp: new Date()
    });
    
    console.log(`Workflow completed in ${duration}ms`);
  }

  /**
   * ワークフローエラーを処理
   */
  private handleWorkflowError(message: string): void {
    this.workflowState.errors.push({
      message,
      step: this.workflowState.currentStep,
      timestamp: new Date()
    });
    
    this.workflowState.currentStep = WorkflowStep.FAILED;
    this.workflowState.isActive = false;
    
    // エラーをUIに通知
    if (this.mainWindow) {
      this.mainWindow.webContents.send('workflow:error', {
        message,
        errors: this.workflowState.errors
      });
    }
    
    // 統計情報を更新
    eventBus.emit(EventType.STATS_UPDATED, {
      workflow: 'correction',
      duration: Date.now() - this.workflowState.startTime.getTime(),
      success: false,
      error: message,
      timestamp: new Date()
    });
    
    console.error('Workflow failed:', message);
  }

  /**
   * ワークフローをキャンセル
   */
  private cancelWorkflow(): void {
    this.workflowState.isActive = false;
    this.workflowState.currentStep = WorkflowStep.IDLE;
    
    console.log('Workflow cancelled');
  }

  /**
   * 手動でテキスト添削を開始
   */
  async processManualText(text: string, mode?: CorrectionMode): Promise<void> {
    // ワークフローを開始
    this.startWorkflow();
    
    // テキスト選択をスキップして直接添削へ
    this.workflowState.selectedText = text;
    this.workflowState.currentStep = WorkflowStep.CORRECTION;
    
    // ウィンドウを表示
    await this.showWindow(text);
    
    // 添削を開始
    const requestId = await this.correctionController.startCorrection(text, mode);
    this.workflowState.correctionRequestId = requestId;
  }

  /**
   * ワークフロー状態を取得
   */
  getWorkflowState(): WorkflowState {
    return { ...this.workflowState };
  }

  /**
   * ワークフローが実行中かチェック
   */
  isWorkflowActive(): boolean {
    return this.workflowState.isActive;
  }

  /**
   * ワークフロー統計を取得
   */
  getWorkflowStatistics(): any {
    const eventStats = eventBus.getEventStatistics();
    
    return {
      totalWorkflows: eventStats.get(EventType.HOTKEY_PRESSED) || 0,
      completedWorkflows: eventStats.get(EventType.CORRECTION_COMPLETED) || 0,
      failedWorkflows: eventStats.get(EventType.CORRECTION_FAILED) || 0,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      lastWorkflowTime: this.workflowState.startTime
    };
  }

  /**
   * 平均処理時間を計算
   */
  private calculateAverageProcessingTime(): number {
    const history = eventBus.getEventHistory(EventType.CORRECTION_COMPLETED, 50);
    
    if (history.length === 0) return 0;
    
    const totalTime = history.reduce((sum, event) => sum + (event.payload.duration || 0), 0);
    return Math.round(totalTime / history.length);
  }

  /**
   * クリーンアップ処理
   */
  destroy(): void {
    this.cancelWorkflow();
    this.mainWindow = null;
  }
}