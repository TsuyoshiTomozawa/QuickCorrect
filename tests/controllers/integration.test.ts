/**
 * Controller Integration Tests
 * 
 * 各コントローラーの統合テスト
 */

import { 
  hotkeyController, 
  clipboardController, 
  correctionController,
  initializeControllers,
  cleanupControllers
} from '../../src/controllers';
import { CorrectionMode, CorrectionResult } from '../../src/types/interfaces';

// モックAIプロバイダー
class MockAIProvider {
  name = 'mock';
  
  async correctText(text: string, mode: CorrectionMode): Promise<CorrectionResult> {
    return {
      text: text.replace('テスト', 'テスト（修正済み）'),
      explanation: 'テスト用の修正',
      changes: [{
        original: 'テスト',
        corrected: 'テスト（修正済み）',
        reason: 'テスト修正',
        position: { start: 0, end: 3 }
      }],
      confidence: 0.95,
      processingTime: 100,
      model: 'mock-model'
    };
  }
  
  isAvailable(): boolean {
    return true;
  }
}

describe('Controller Integration Tests', () => {
  beforeAll(() => {
    initializeControllers();
  });

  afterAll(() => {
    cleanupControllers();
  });

  describe('HotkeyController', () => {
    it('should emit events when initialized', (done) => {
      hotkeyController.once('registered', (event) => {
        expect(event.hotkey).toBeDefined();
        done();
      });

      hotkeyController.register('Ctrl+Shift+T');
    });

    it('should check hotkey availability', () => {
      const isValid = hotkeyController.isAcceleratorValid('Ctrl+Shift+Y');
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('ClipboardController', () => {
    it('should copy text to clipboard', async () => {
      const result = await clipboardController.copyText('テストテキスト');
      expect(result).toBe(true);
    });

    it('should read text from clipboard', () => {
      const text = clipboardController.readText();
      expect(typeof text).toBe('string');
    });

    it('should format correction results', async () => {
      const mockResult: CorrectionResult = {
        text: '修正されたテキスト',
        explanation: '説明',
        changes: [],
        confidence: 0.9,
        processingTime: 50,
        model: 'test'
      };

      const result = await clipboardController.copyCorrectionResult(mockResult);
      expect(result).toBe(true);
    });
  });

  describe('CorrectionController', () => {
    beforeEach(() => {
      const mockProvider = new MockAIProvider();
      correctionController.registerProvider(mockProvider);
    });

    it('should register AI providers', (done) => {
      correctionController.once('provider-registered', (event) => {
        expect(event.name).toBe('mock');
        done();
      });

      const provider = new MockAIProvider();
      correctionController.registerProvider(provider);
    });

    it('should correct text using mock provider', async () => {
      const result = await correctionController.correctText({
        text: 'これはテストです',
        mode: 'business',
        provider: 'mock'
      });

      expect(result).toBeDefined();
      expect(result?.text).toContain('修正済み');
      expect(result?.changes.length).toBeGreaterThan(0);
    });

    it('should handle mode changes', () => {
      correctionController.setMode('academic');
      expect(correctionController.getMode()).toBe('academic');
    });

    it('should generate diff between texts', () => {
      const original = 'これはテストです';
      const corrected = 'これはテスト（修正済み）です';
      const diff = correctionController.generateDiff(original, corrected);
      
      expect(diff.length).toBeGreaterThan(0);
    });
  });

  describe('Controller Interactions', () => {
    it('should integrate hotkey -> correction -> clipboard flow', (done) => {
      let correctionStarted = false;
      let clipboardCopied = false;

      correctionController.once('correction-started', () => {
        correctionStarted = true;
      });

      clipboardController.once('copied', () => {
        clipboardCopied = true;
        
        // 全てのイベントが発火したことを確認
        expect(correctionStarted).toBe(true);
        expect(clipboardCopied).toBe(true);
        done();
      });

      // 手動で添削フローをトリガー
      correctionController.correctText({
        text: 'テストテキスト',
        mode: 'business',
        provider: 'mock'
      });
    });

    it('should handle clipboard monitoring', (done) => {
      clipboardController.once('watching-started', () => {
        clipboardController.stopWatching();
      });

      clipboardController.once('watching-stopped', () => {
        done();
      });

      clipboardController.startWatching(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty text correction', async () => {
      const result = await correctionController.correctText({
        text: '',
        mode: 'business'
      });

      expect(result).toBeNull();
    });

    it('should emit error on invalid provider', (done) => {
      correctionController.once('error', (error) => {
        expect(error.code).toBe('API_ERROR');
        done();
      });

      correctionController.correctText({
        text: 'テスト',
        mode: 'business',
        provider: 'invalid-provider'
      });
    });
  });
});