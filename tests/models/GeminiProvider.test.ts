/**
 * GeminiProvider Test Suite
 */

import { GeminiProvider } from '../../src/models/providers/GeminiProvider';
import { CorrectionMode } from '../../src/types/interfaces';

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  
  beforeEach(() => {
    // Use a test API key (would be mocked in real tests)
    provider = new GeminiProvider({
      apiKey: 'test-api-key',
      temperature: 0.7,
      maxTokens: 2000
    });
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = provider.getMetadata();
      expect(metadata.name).toBe('gemini');
      expect(metadata.displayName).toBe('Google Gemini Pro');
      expect(metadata.maxInputLength).toBe(30000);
      expect(metadata.supportedModes).toEqual(['business', 'academic', 'casual', 'presentation']);
    });

    it('should throw error if API key is missing', () => {
      expect(() => {
        new GeminiProvider({
          apiKey: ''
        });
      }).toThrow('gemini: API key is required');
    });
  });

  describe('validateInput', () => {
    it('should accept valid text', () => {
      // This should not throw
      expect(() => {
        provider['validateInput']('これはテストテキストです。');
      }).not.toThrow();
    });

    it('should reject empty text', () => {
      expect(() => {
        provider['validateInput']('');
      }).toThrow('Input text cannot be empty');
    });

    it('should reject text exceeding max length', () => {
      const longText = 'あ'.repeat(30001);
      expect(() => {
        provider['validateInput'](longText);
      }).toThrow('Input text exceeds maximum length of 30000 characters');
    });
  });

  describe('generatePrompt', () => {
    it('should generate business mode prompt', () => {
      const prompt = provider['generatePrompt']('テスト', 'business');
      expect(prompt).toContain('ビジネス文書として適切に修正');
      expect(prompt).toContain('テスト');
      expect(prompt).toContain('JSON形式で回答');
    });

    it('should generate academic mode prompt', () => {
      const prompt = provider['generatePrompt']('テスト', 'academic');
      expect(prompt).toContain('学術的な文章として修正');
    });

    it('should include context when provided', () => {
      const prompt = provider['generatePrompt']('テスト', 'business', 'メールの文脈');
      expect(prompt).toContain('文脈情報: メールの文脈');
    });
  });

  // Note: Actual API calls would be mocked in real tests
  describe('checkAvailability', () => {
    it('should return boolean', async () => {
      // In real tests, we would mock the API call
      provider['model'] = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => 'test response'
          }
        })
      } as any;

      const result = await provider.checkAvailability();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        correctedText: '修正されたテキスト',
        explanation: '文法を修正しました',
        changes: [
          { type: 'grammar', original: 'テスト', corrected: '修正されたテキスト' }
        ]
      });
      
      const result = provider['parseResponse'](response, 'テスト');
      
      expect(result.text).toBe('修正されたテキスト');
      expect(result.explanation).toBe('文法を修正しました');
      expect(result.changes).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle response with alternative field names', () => {
      const response = JSON.stringify({
        text: '修正されたテキスト',
        summary: '文法を修正しました'
      });
      
      const result = provider['parseResponse'](response, 'テスト');
      
      expect(result.text).toBe('修正されたテキスト');
      expect(result.explanation).toBe('文法を修正しました');
    });

    it('should handle non-JSON response with 修正後 marker', () => {
      const response = `以下が修正後のテキストです：
修正後：
これは修正されたテキストです。
文法と表現を改善しました。`;
      
      const result = provider['parseResponse'](response, 'テスト');
      
      expect(result.text).toBe('これは修正されたテキストです。');
      expect(result.explanation).toBe('文法と表現を改善しました。');
    });

    it('should handle non-JSON response with 訂正後 marker', () => {
      const response = `訂正後：
修正されたテキスト
理由：文法エラーを修正`;
      
      const result = provider['parseResponse'](response, 'テスト');
      
      expect(result.text).toBe('修正されたテキスト');
      expect(result.explanation).toBe('理由：文法エラーを修正');
    });

    it('should use first line as corrected text for simple responses', () => {
      const response = `これは修正されたテキストです。
追加の説明情報`;
      
      const result = provider['parseResponse'](response, 'テスト');
      
      expect(result.text).toBe('これは修正されたテキストです。');
      expect(result.explanation).toBe('追加の説明情報');
    });

    it('should handle empty response', () => {
      expect(() => {
        provider['parseResponse']('', 'テスト');
      }).toThrow('Empty response from Gemini');
    });

    it('should handle response with embedded JSON', () => {
      const response = `APIからの応答：
{"correctedText": "修正済み", "explanation": "修正しました"}
以上が結果です。`;
      
      const result = provider['parseResponse'](response, 'テスト');
      
      expect(result.text).toBe('修正済み');
      expect(result.explanation).toBe('修正しました');
    });

    it('should handle malformed JSON gracefully', () => {
      const response = '{ "text": "修正済み", invalid json }';
      
      const result = provider['parseResponse'](response, 'テスト');
      
      // Should fall back to treating it as plain text
      expect(result.text).toBe('{ "text": "修正済み", invalid json }');
      expect(result.explanation).toContain('テキストを修正しました');
    });
  });
});