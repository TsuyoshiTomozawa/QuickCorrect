/**
 * Workflow Integration Tests
 * 
 * 統合されたコントローラーとイベントシステムのテスト
 */

import { eventBus, EventType } from '../../src/services/EventBus';
import { HotkeyController } from '../../src/controllers/HotkeyController';
import { ClipboardController } from '../../src/controllers/ClipboardController';
import { CorrectionController, AIProvider } from '../../src/controllers/CorrectionController';
import { WorkflowOrchestrator } from '../../src/services/WorkflowOrchestrator';
import { CorrectionMode, CorrectionResult } from '../../src/types/interfaces';

// モックBrowserWindow
class MockBrowserWindow {
  webContents = {
    send: jest.fn(),
    executeJavaScript: jest.fn().mockResolvedValue('')
  };
  
  show = jest.fn();
  hide = jest.fn();
  focus = jest.fn();
  isVisible = jest.fn().mockReturnValue(true);
  on = jest.fn();
  once = jest.fn();
}

// モックAIプロバイダー
class MockAIProvider implements AIProvider {
  name = 'test-provider';
  
  async correctText(text: string, mode: CorrectionMode): Promise<CorrectionResult> {
    return {
      text: text.replace('テスト', 'テスト（修正済み）'),
      explanation: 'テスト用の修正を行いました',
      changes: [{
        original: 'テスト',
        corrected: 'テスト（修正済み）',
        reason: 'テスト修正',
        position: { start: 0, end: 3 }
      }],
      confidence: 0.95,
      processingTime: 100,
      model: 'test-model'
    };
  }
  
  isAvailable(): boolean {
    return true;
  }
}

describe('Workflow Integration Tests', () => {
  let hotkeyController: HotkeyController;
  let clipboardController: ClipboardController;
  let correctionController: CorrectionController;
  let workflowOrchestrator: WorkflowOrchestrator;
  let mockWindow: MockBrowserWindow;
  
  beforeEach(() => {
    // イベントバスをクリア
    eventBus.removeAllListeners();
    eventBus.clearHistory();
    
    // コントローラーの初期化
    hotkeyController = new HotkeyController();
    clipboardController = new ClipboardController();
    correctionController = new CorrectionController();
    
    // AIプロバイダーを登録
    correctionController.registerProvider(new MockAIProvider());
    
    // ワークフローオーケストレーターの初期化
    workflowOrchestrator = new WorkflowOrchestrator(
      hotkeyController,
      clipboardController,
      correctionController
    );
    
    // モックウィンドウを設定
    mockWindow = new MockBrowserWindow();
    workflowOrchestrator.setMainWindow(mockWindow as any);
  });
  
  afterEach(() => {
    // クリーンアップ
    hotkeyController.destroy();
    clipboardController.destroy();
    correctionController.destroy();
    workflowOrchestrator.destroy();
  });
  
  describe('Event Bus', () => {
    it('should emit and receive events correctly', (done) => {
      const testPayload = { text: 'テスト', timestamp: new Date() };
      
      eventBus.once(EventType.TEXT_SELECTED, (payload) => {
        expect(payload).toEqual(testPayload);
        done();
      });
      
      eventBus.emit(EventType.TEXT_SELECTED, testPayload);
    });
    
    it('should maintain event history', () => {
      eventBus.emit(EventType.HOTKEY_PRESSED, { hotkey: 'Ctrl+T', timestamp: new Date() });
      eventBus.emit(EventType.TEXT_SELECTED, { text: 'test', source: 'hotkey', timestamp: new Date() });
      
      const history = eventBus.getEventHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should track event statistics', () => {
      eventBus.emit(EventType.CORRECTION_STARTED, { text: 'test', mode: 'business', requestId: '123' });
      eventBus.emit(EventType.CORRECTION_STARTED, { text: 'test2', mode: 'academic', requestId: '456' });
      
      const stats = eventBus.getEventStatistics();
      expect(stats.get(EventType.CORRECTION_STARTED)).toBe(2);
    });
  });
  
  describe('Complete Workflow', () => {
    it('should execute hotkey → selection → correction → clipboard flow', async () => {
      const events: string[] = [];
      
      // イベントリスナーを設定
      eventBus.on(EventType.HOTKEY_PRESSED, () => events.push('hotkey'));
      eventBus.on(EventType.TEXT_SELECTED, () => events.push('selected'));
      eventBus.on(EventType.CORRECTION_STARTED, () => events.push('correction-start'));
      eventBus.on(EventType.CORRECTION_COMPLETED, () => events.push('correction-complete'));
      eventBus.on(EventType.CLIPBOARD_COPIED, () => events.push('clipboard'));
      
      // ホットキー押下をシミュレート
      eventBus.emit(EventType.HOTKEY_PRESSED, { 
        hotkey: 'Ctrl+T', 
        timestamp: new Date() 
      });
      
      // テキスト選択をシミュレート
      eventBus.emit(EventType.TEXT_SELECTED, {
        text: 'これはテストです',
        source: 'hotkey',
        timestamp: new Date()
      });
      
      // 非同期処理を待つ
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // イベントが正しい順序で発火したか確認
      expect(events).toContain('hotkey');
      expect(events).toContain('selected');
      expect(events).toContain('correction-start');
      expect(events.indexOf('correction-start')).toBeLessThan(events.indexOf('correction-complete'));
    });
    
    it('should handle workflow errors gracefully', async () => {
      let errorCaught = false;
      
      eventBus.on(EventType.CORRECTION_FAILED, () => {
        errorCaught = true;
      });
      
      // 空のテキストで添削を開始（エラーになるはず）
      await correctionController.startCorrection('');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(errorCaught).toBe(true);
    });
  });
  
  describe('Controller Integration', () => {
    it('should register AI providers correctly', () => {
      const health = correctionController.checkProvidersHealth();
      expect(health.get('test-provider')).toBe(true);
    });
    
    it('should handle correction mode changes', () => {
      correctionController.setMode('academic');
      expect(correctionController.getMode()).toBe('academic');
      
      correctionController.setMode('business');
      expect(correctionController.getMode()).toBe('business');
    });
    
    it('should process batch corrections', async () => {
      const texts = ['テスト1', 'テスト2', 'テスト3'];
      const results = await correctionController.correctBatch(texts, 'business');
      
      expect(results).toHaveLength(3);
      expect(results[0]).toContain('修正済み');
    });
  });
  
  describe('Workflow State Management', () => {
    it('should track workflow state correctly', async () => {
      // 初期状態
      let state = workflowOrchestrator.getWorkflowState();
      expect(state.isActive).toBe(false);
      
      // 手動でワークフローを開始
      await workflowOrchestrator.processManualText('テストテキスト');
      
      state = workflowOrchestrator.getWorkflowState();
      expect(state.isActive).toBe(true);
      expect(state.selectedText).toBe('テストテキスト');
    });
    
    it('should calculate workflow statistics', () => {
      const stats = workflowOrchestrator.getWorkflowStatistics();
      
      expect(stats).toHaveProperty('totalWorkflows');
      expect(stats).toHaveProperty('completedWorkflows');
      expect(stats).toHaveProperty('failedWorkflows');
      expect(stats).toHaveProperty('averageProcessingTime');
    });
  });
  
  describe('Error Handling', () => {
    it('should emit system error events', (done) => {
      eventBus.once(EventType.SYSTEM_ERROR, (payload) => {
        expect(payload.error.code).toBe('API_ERROR');
        done();
      });
      
      eventBus.emit(EventType.SYSTEM_ERROR, {
        error: {
          code: 'API_ERROR',
          message: 'Test error',
          timestamp: new Date()
        }
      });
    });
    
    it('should handle permission errors', async () => {
      let permissionError = false;
      
      eventBus.on(EventType.SYSTEM_ERROR, (payload) => {
        if (payload.error.code === 'PERMISSION_ERROR') {
          permissionError = true;
        }
      });
      
      // 権限エラーをシミュレート
      eventBus.emit(EventType.SYSTEM_ERROR, {
        error: {
          code: 'PERMISSION_ERROR',
          message: 'アクセシビリティ権限が必要です',
          timestamp: new Date()
        }
      });
      
      expect(permissionError).toBe(true);
    });
  });
  
  describe('Performance', () => {
    it('should handle high-frequency events', async () => {
      const eventCount = 1000;
      let receivedCount = 0;
      
      eventBus.on(EventType.CLIPBOARD_CHANGED, () => {
        receivedCount++;
      });
      
      // 高頻度でイベントを発火
      for (let i = 0; i < eventCount; i++) {
        eventBus.emit(EventType.CLIPBOARD_CHANGED, {
          content: `text-${i}`,
          timestamp: new Date()
        });
      }
      
      expect(receivedCount).toBe(eventCount);
    });
    
    it('should maintain performance with many listeners', () => {
      const listenerCount = 50;
      const listeners: Function[] = [];
      
      // 多数のリスナーを登録
      for (let i = 0; i < listenerCount; i++) {
        const listener = jest.fn();
        listeners.push(listener);
        eventBus.on(EventType.CORRECTION_COMPLETED, listener);
      }
      
      // イベントを発火
      eventBus.emit(EventType.CORRECTION_COMPLETED, {
        result: { text: 'test' },
        requestId: '123',
        duration: 100
      });
      
      // 全てのリスナーが呼ばれたか確認
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });
});