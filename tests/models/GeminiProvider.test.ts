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
});