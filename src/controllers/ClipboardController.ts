/**
 * ClipboardController - クリップボード操作管理
 * 
 * Issue #6: クリップボード連携機能を実装
 * - 添削結果の自動コピー機能
 * - リッチテキスト対応
 * - 履歴からの再コピー機能
 * - クリップボード監視機能
 */

import { clipboard, nativeImage } from 'electron';
import { EventEmitter } from 'events';
import { CorrectionResult, CorrectionHistory, ErrorCode } from '../types/interfaces';

export interface ClipboardEvent {
  type: 'copy' | 'paste' | 'changed';
  content: string;
  format: 'text' | 'html' | 'rtf';
  timestamp: Date;
}

export interface ClipboardOptions {
  autoFormat: boolean;
  preserveFormatting: boolean;
  notifyOnCopy: boolean;
}

export class ClipboardController extends EventEmitter {
  private watchInterval: NodeJS.Timeout | null = null;
  private lastClipboardContent: string = '';
  private options: ClipboardOptions;
  
  constructor(options: Partial<ClipboardOptions> = {}) {
    super();
    this.options = {
      autoFormat: true,
      preserveFormatting: true,
      notifyOnCopy: true,
      ...options
    };
    
    // 初期のクリップボード内容を記録
    this.lastClipboardContent = this.readText();
  }

  /**
   * テキストをクリップボードにコピー
   */
  async copyText(text: string): Promise<boolean> {
    try {
      clipboard.writeText(text);
      
      if (this.options.notifyOnCopy) {
        this.emit('copied', {
          type: 'copy',
          content: text,
          format: 'text',
          timestamp: new Date()
        } as ClipboardEvent);
      }
      
      return true;
    } catch (error) {
      this.emit('error', {
        code: 'CLIPBOARD_ERROR' as ErrorCode,
        message: 'クリップボードへのコピーに失敗しました',
        details: error
      });
      return false;
    }
  }

  /**
   * リッチテキスト（HTML）をクリップボードにコピー
   */
  async copyRichText(html: string, plainText?: string): Promise<boolean> {
    try {
      const text = plainText || this.stripHtml(html);
      
      if (this.options.preserveFormatting) {
        clipboard.write({
          text,
          html
        });
      } else {
        clipboard.writeText(text);
      }
      
      if (this.options.notifyOnCopy) {
        this.emit('copied', {
          type: 'copy',
          content: html,
          format: 'html',
          timestamp: new Date()
        } as ClipboardEvent);
      }
      
      return true;
    } catch (error) {
      this.emit('error', {
        code: 'CLIPBOARD_ERROR' as ErrorCode,
        message: 'リッチテキストのコピーに失敗しました',
        details: error
      });
      return false;
    }
  }

  /**
   * 添削結果をクリップボードにコピー
   */
  async copyCorrectionResult(result: CorrectionResult): Promise<boolean> {
    try {
      const formattedText = this.formatCorrectionResult(result);
      
      if (this.options.autoFormat && result.changes.length > 0) {
        // 変更箇所をハイライトしたHTMLを生成
        const htmlContent = this.generateHighlightedHtml(result);
        return await this.copyRichText(htmlContent, result.text);
      } else {
        // プレーンテキストとしてコピー
        return await this.copyText(result.text);
      }
    } catch (error) {
      this.emit('error', {
        code: 'CLIPBOARD_ERROR' as ErrorCode,
        message: '添削結果のコピーに失敗しました',
        details: error
      });
      return false;
    }
  }

  /**
   * 履歴アイテムをクリップボードにコピー
   */
  async copyFromHistory(historyItem: CorrectionHistory): Promise<boolean> {
    try {
      return await this.copyText(historyItem.correctedText);
    } catch (error) {
      this.emit('error', {
        code: 'CLIPBOARD_ERROR' as ErrorCode,
        message: '履歴からのコピーに失敗しました',
        details: error
      });
      return false;
    }
  }

  /**
   * クリップボードからテキストを読み取り
   */
  readText(): string {
    try {
      return clipboard.readText();
    } catch (error) {
      this.emit('error', {
        code: 'CLIPBOARD_ERROR' as ErrorCode,
        message: 'クリップボードの読み取りに失敗しました',
        details: error
      });
      return '';
    }
  }

  /**
   * クリップボードからリッチテキストを読み取り
   */
  readRichText(): { text: string; html: string; rtf: string } {
    try {
      return {
        text: clipboard.readText(),
        html: clipboard.readHTML(),
        rtf: clipboard.readRTF()
      };
    } catch (error) {
      this.emit('error', {
        code: 'CLIPBOARD_ERROR' as ErrorCode,
        message: 'リッチテキストの読み取りに失敗しました',
        details: error
      });
      return { text: '', html: '', rtf: '' };
    }
  }

  /**
   * クリップボードをクリア
   */
  clear(): void {
    try {
      clipboard.clear();
      this.emit('cleared');
    } catch (error) {
      this.emit('error', {
        code: 'CLIPBOARD_ERROR' as ErrorCode,
        message: 'クリップボードのクリアに失敗しました',
        details: error
      });
    }
  }

  /**
   * クリップボードの変更を監視開始
   */
  startWatching(interval: number = 500): void {
    if (this.watchInterval) {
      this.stopWatching();
    }

    this.watchInterval = setInterval(() => {
      const currentContent = this.readText();
      
      if (currentContent !== this.lastClipboardContent) {
        this.lastClipboardContent = currentContent;
        this.emit('changed', {
          type: 'changed',
          content: currentContent,
          format: 'text',
          timestamp: new Date()
        } as ClipboardEvent);
      }
    }, interval);

    this.emit('watching-started');
  }

  /**
   * クリップボードの監視を停止
   */
  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
      this.emit('watching-stopped');
    }
  }

  /**
   * 画像をクリップボードにコピー
   */
  async copyImage(imagePath: string): Promise<boolean> {
    try {
      const image = nativeImage.createFromPath(imagePath);
      clipboard.writeImage(image);
      
      this.emit('image-copied', {
        path: imagePath,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      this.emit('error', {
        code: 'CLIPBOARD_ERROR' as ErrorCode,
        message: '画像のコピーに失敗しました',
        details: error
      });
      return false;
    }
  }

  /**
   * クリップボードから画像を読み取り
   */
  readImage(): nativeImage.NativeImage | null {
    try {
      const image = clipboard.readImage();
      return image.isEmpty() ? null : image;
    } catch (error) {
      this.emit('error', {
        code: 'CLIPBOARD_ERROR' as ErrorCode,
        message: '画像の読み取りに失敗しました',
        details: error
      });
      return null;
    }
  }

  /**
   * 添削結果をフォーマット
   */
  private formatCorrectionResult(result: CorrectionResult): string {
    let formatted = result.text;
    
    if (result.explanation) {
      formatted += `\n\n【説明】\n${result.explanation}`;
    }
    
    if (result.changes.length > 0) {
      formatted += '\n\n【変更箇所】\n';
      result.changes.forEach((change, index) => {
        formatted += `${index + 1}. "${change.original}" → "${change.corrected}" (${change.reason})\n`;
      });
    }
    
    return formatted;
  }

  /**
   * 変更箇所をハイライトしたHTMLを生成
   */
  private generateHighlightedHtml(result: CorrectionResult): string {
    let html = `<div style="font-family: sans-serif;">`;
    let lastIndex = 0;
    let workingText = result.text;
    
    // 変更箇所を位置順にソート
    const sortedChanges = [...result.changes].sort((a, b) => a.position.start - b.position.start);
    
    sortedChanges.forEach(change => {
      const beforeText = workingText.substring(lastIndex, change.position.start);
      const highlightedText = `<span style="background-color: #ffeb3b; font-weight: bold;">${change.corrected}</span>`;
      
      html += this.escapeHtml(beforeText) + highlightedText;
      lastIndex = change.position.end;
    });
    
    // 残りのテキスト
    html += this.escapeHtml(workingText.substring(lastIndex));
    
    // 説明を追加
    if (result.explanation) {
      html += `<p style="margin-top: 20px; color: #666;"><strong>説明:</strong> ${this.escapeHtml(result.explanation)}</p>`;
    }
    
    html += `</div>`;
    
    return html;
  }

  /**
   * HTMLタグを除去
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * HTMLエスケープ
   */
  private escapeHtml(text: string): string {
    const escapeMap: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    
    return text.replace(/[&<>"']/g, match => escapeMap[match]);
  }

  /**
   * オプションを更新
   */
  updateOptions(options: Partial<ClipboardOptions>): void {
    this.options = { ...this.options, ...options };
    this.emit('options-updated', this.options);
  }

  /**
   * 現在のオプションを取得
   */
  getOptions(): ClipboardOptions {
    return { ...this.options };
  }

  /**
   * クリーンアップ処理
   */
  destroy(): void {
    this.stopWatching();
    this.removeAllListeners();
  }
}

// シングルトンインスタンスをエクスポート
export const clipboardController = new ClipboardController();