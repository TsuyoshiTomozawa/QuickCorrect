/**
 * QuickCorrect - Correction Controller
 * 
 * Handles text correction logic and AI provider integration
 */

import { CorrectionResult, CorrectionMode, CorrectionChange } from '../types/interfaces';

export class CorrectionController {
  /**
   * Correct text using AI
   */
  async correctText(text: string, mode: CorrectionMode): Promise<CorrectionResult> {
    const startTime = Date.now();
    
    try {
      // TODO: Implement actual AI provider integration
      // For now, return a mock result
      const result = await this.mockCorrection(text, mode);
      
      return {
        ...result,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Error correcting text:', error);
      throw new Error('テキストの添削中にエラーが発生しました');
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
      processingTime: 0,
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
}