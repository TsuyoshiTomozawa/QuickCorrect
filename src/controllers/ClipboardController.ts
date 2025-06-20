/**
 * ClipboardController - 統合版クリップボード管理
 * 
 * EventBusと連携してクリップボード操作を管理
 */

import { clipboard, nativeImage } from 'electron';
import { eventBus, EventType } from '../services/EventBus';
import { CorrectionResult, ErrorCode } from '../types/interfaces';

export class ClipboardController {
  private watchInterval: NodeJS.Timeout | null = null;
  private lastClipboardContent: string = '';
  private options = {
    autoFormat: true,
    preserveFormatting: true,
    notifyOnCopy: true
  };
  
  constructor() {
    this.setupEventListeners();
    this.lastClipboardContent = this.readText();
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    // 添削完了イベントを監視して自動コピー
    eventBus.on(EventType.CORRECTION_COMPLETED, async (payload) => {
      if (this.options.notifyOnCopy) {
        await this.copyCorrectionResult(payload.result);
      }
    });

    // 設定変更イベントを監視
    eventBus.on(EventType.SETTINGS_CHANGED, (payload) => {
      if (payload.clipboard) {
        this.updateOptions(payload.clipboard);
      }
    });
  }

  /**
   * テキストをクリップボードにコピー
   */
  async copyText(text: string): Promise<boolean> {
    try {
      clipboard.writeText(text);
      
      eventBus.emit(EventType.CLIPBOARD_COPIED, {
        text,
        format: 'plain',
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      eventBus.emit(EventType.CLIPBOARD_COPY_FAILED, {
        error: {
          code: 'CLIPBOARD_ERROR' as ErrorCode,
          message: 'クリップボードへのコピーに失敗しました',
          details: error,
          timestamp: new Date()
        }
      });
      return false;
    }
  }

  /**
   * リッチテキストをクリップボードにコピー
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
      
      eventBus.emit(EventType.CLIPBOARD_COPIED, {
        text: html,
        format: 'rich',
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      eventBus.emit(EventType.CLIPBOARD_COPY_FAILED, {
        error: {
          code: 'CLIPBOARD_ERROR' as ErrorCode,
          message: 'リッチテキストのコピーに失敗しました',
          details: error,
          timestamp: new Date()
        }
      });
      return false;
    }
  }

  /**
   * 添削結果をクリップボードにコピー
   */
  async copyCorrectionResult(result: CorrectionResult): Promise<boolean> {
    try {
      if (this.options.autoFormat && result.changes && result.changes.length > 0) {
        const htmlContent = this.generateHighlightedHtml(result);
        return await this.copyRichText(htmlContent, result.text);
      } else {
        return await this.copyText(result.text);
      }
    } catch (error) {
      eventBus.emit(EventType.SYSTEM_ERROR, {
        error: {
          code: 'CLIPBOARD_ERROR' as ErrorCode,
          message: '添削結果のコピーに失敗しました',
          details: error,
          timestamp: new Date()
        }
      });
      return false;
    }
  }

  /**
   * 選択されたテキストを取得（ホットキー処理用）
   */
  async getSelectedText(): Promise<string> {
    try {
      // 現在のクリップボードの内容を保存
      const previousContent = clipboard.readText();
      
      // プラットフォーム別のコピーコマンドを実行
      await this.triggerCopy();
      
      // 少し待つ
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 新しいクリップボードの内容を取得
      const selectedText = clipboard.readText();
      
      // 元のクリップボードの内容を復元
      if (previousContent !== selectedText) {
        setTimeout(() => {
          clipboard.writeText(previousContent);
        }, 100);
      }
      
      return selectedText;
    } catch (error) {
      console.error('選択テキスト取得エラー:', error);
      return '';
    }
  }

  /**
   * プラットフォーム別のコピーコマンドを実行
   */
  private async triggerCopy(): Promise<void> {
    const { execSync } = require('child_process');
    
    try {
      if (process.platform === 'darwin') {
        // macOS: Cmd+C
        execSync(`osascript -e 'tell application "System Events" to keystroke "c" using command down'`);
      } else if (process.platform === 'win32') {
        // Windows: Ctrl+C
        execSync('powershell -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys(\'^c\')"');
      } else {
        // Linux: Ctrl+C
        execSync('xdotool key ctrl+c');
      }
    } catch (error) {
      console.error('コピーコマンド実行エラー:', error);
    }
  }

  /**
   * クリップボードからテキストを読み取り
   */
  readText(): string {
    try {
      return clipboard.readText();
    } catch (error) {
      eventBus.emit(EventType.SYSTEM_ERROR, {
        error: {
          code: 'CLIPBOARD_ERROR' as ErrorCode,
          message: 'クリップボードの読み取りに失敗しました',
          details: error,
          timestamp: new Date()
        }
      });
      return '';
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
        
        eventBus.emit(EventType.CLIPBOARD_CHANGED, {
          content: currentContent,
          timestamp: new Date()
        });
      }
    }, interval);
  }

  /**
   * クリップボードの監視を停止
   */
  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  /**
   * 変更箇所をハイライトしたHTMLを生成
   */
  private generateHighlightedHtml(result: CorrectionResult): string {
    let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">`;
    let workingText = result.text;
    
    if (result.changes && result.changes.length > 0) {
      let lastIndex = 0;
      const sortedChanges = [...result.changes].sort((a, b) => a.position.start - b.position.start);
      
      sortedChanges.forEach(change => {
        const beforeText = workingText.substring(lastIndex, change.position.start);
        const highlightedText = `<span style="background-color: #ffeb3b; font-weight: bold; padding: 2px 4px; border-radius: 3px;">${this.escapeHtml(change.corrected)}</span>`;
        
        html += this.escapeHtml(beforeText) + highlightedText;
        lastIndex = change.position.end;
      });
      
      html += this.escapeHtml(workingText.substring(lastIndex));
    } else {
      html += this.escapeHtml(workingText);
    }
    
    if (result.explanation) {
      html += `<div style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">`;
      html += `<strong style="color: #666;">説明:</strong> ${this.escapeHtml(result.explanation)}`;
      html += `</div>`;
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
  updateOptions(options: Partial<typeof this.options>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * クリーンアップ処理
   */
  destroy(): void {
    this.stopWatching();
  }
}