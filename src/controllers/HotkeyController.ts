/**
 * HotkeyController - グローバルホットキー管理
 * 
 * Issue #3: グローバルホットキーの登録・解除機能を実装
 * - Ctrl+T (Windows/Linux) / Cmd+T (macOS) のグローバル監視
 * - 選択テキストの取得とイベント発火
 * - 権限チェック機能（特にmacOSのアクセシビリティ）
 */

import { globalShortcut, clipboard, BrowserWindow, app, systemPreferences } from 'electron';
import { EventEmitter } from 'events';
import { CorrectionMode, AppSettings, ErrorCode } from '../types/interfaces';

export interface HotkeyEvent {
  selectedText: string;
  timestamp: Date;
  source: 'clipboard' | 'selection';
}

export class HotkeyController extends EventEmitter {
  private currentHotkey: string;
  private isRegistered: boolean = false;
  private readonly defaultHotkey: string;
  private registeredHotkeys: Map<string, () => void> = new Map();
  
  constructor() {
    super();
    // プラットフォームに応じたデフォルトホットキー
    this.defaultHotkey = process.platform === 'darwin' ? 'Cmd+T' : 'Ctrl+T';
    this.currentHotkey = this.defaultHotkey;
  }

  /**
   * Register a global hotkey (簡易版API互換メソッド)
   */
  registerHotkey(accelerator: string, callback: () => void): boolean {
    try {
      // Unregister if already exists
      if (this.registeredHotkeys.has(accelerator)) {
        this.unregisterHotkey(accelerator);
      }
      
      const success = globalShortcut.register(accelerator, callback);
      
      if (success) {
        this.registeredHotkeys.set(accelerator, callback);
        console.log(`Hotkey registered: ${accelerator}`);
      } else {
        console.error(`Failed to register hotkey: ${accelerator}`);
      }
      
      return success;
    } catch (error) {
      console.error('Error registering hotkey:', error);
      return false;
    }
  }

  /**
   * Unregister a specific hotkey (簡易版API互換メソッド)
   */
  unregisterHotkey(accelerator: string): void {
    try {
      globalShortcut.unregister(accelerator);
      this.registeredHotkeys.delete(accelerator);
      console.log(`Hotkey unregistered: ${accelerator}`);
    } catch (error) {
      console.error('Error unregistering hotkey:', error);
    }
  }

  /**
   * Check if a hotkey is registered (簡易版API互換メソッド)
   */
  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }

  /**
   * Get all registered hotkeys (簡易版API互換メソッド)
   */
  getRegisteredHotkeys(): string[] {
    return Array.from(this.registeredHotkeys.keys());
  }

  /**
   * ホットキーを登録
   */
  async register(hotkey?: string): Promise<boolean> {
    try {
      // 既存のホットキーが登録されていれば解除
      if (this.isRegistered) {
        await this.unregister();
      }

      // 権限チェック（macOS）
      if (process.platform === 'darwin') {
        const hasPermission = await this.checkAccessibilityPermission();
        if (!hasPermission) {
          this.emit('permission-error', {
            code: 'PERMISSION_ERROR' as ErrorCode,
            message: 'アクセシビリティ権限が必要です',
            platform: 'darwin'
          });
          return false;
        }
      }

      const keyToRegister = hotkey || this.currentHotkey;
      
      // ホットキーの登録
      const registered = globalShortcut.register(keyToRegister, async () => {
        await this.handleHotkeyPress();
      });

      if (registered) {
        this.currentHotkey = keyToRegister;
        this.isRegistered = true;
        this.emit('registered', { hotkey: keyToRegister });
        return true;
      } else {
        this.emit('registration-failed', {
          code: 'HOTKEY_ERROR' as ErrorCode,
          message: `ホットキー ${keyToRegister} の登録に失敗しました`,
          hotkey: keyToRegister
        });
        return false;
      }
    } catch (error) {
      this.emit('error', {
        code: 'HOTKEY_ERROR' as ErrorCode,
        message: 'ホットキー登録中にエラーが発生しました',
        details: error
      });
      return false;
    }
  }

  /**
   * ホットキーを解除
   */
  async unregister(): Promise<boolean> {
    try {
      if (this.isRegistered && this.currentHotkey) {
        globalShortcut.unregister(this.currentHotkey);
        this.isRegistered = false;
        this.emit('unregistered', { hotkey: this.currentHotkey });
        return true;
      }
      return false;
    } catch (error) {
      this.emit('error', {
        code: 'HOTKEY_ERROR' as ErrorCode,
        message: 'ホットキー解除中にエラーが発生しました',
        details: error
      });
      return false;
    }
  }

  /**
   * 全てのホットキーを解除
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.isRegistered = false;
    this.registeredHotkeys.clear();
    this.emit('all-unregistered');
  }

  /**
   * ホットキーが押された時の処理
   */
  private async handleHotkeyPress(): Promise<void> {
    try {
      // 選択されたテキストを取得
      const selectedText = await this.getSelectedText();
      
      if (selectedText && selectedText.trim()) {
        const event: HotkeyEvent = {
          selectedText: selectedText.trim(),
          timestamp: new Date(),
          source: 'clipboard'
        };
        
        this.emit('hotkey-pressed', event);
      } else {
        this.emit('no-text-selected');
      }
    } catch (error) {
      this.emit('error', {
        code: 'HOTKEY_ERROR' as ErrorCode,
        message: 'テキスト取得中にエラーが発生しました',
        details: error
      });
    }
  }

  /**
   * 選択されたテキストを取得
   * クリップボード経由で選択テキストを取得（クロスプラットフォーム対応）
   */
  private async getSelectedText(): Promise<string> {
    try {
      // 現在のクリップボードの内容を保存
      const previousClipboard = clipboard.readText();
      
      // Ctrl+C / Cmd+C をシミュレート
      const currentWindow = BrowserWindow.getFocusedWindow();
      if (currentWindow) {
        // 選択されたテキストをコピー
        if (process.platform === 'darwin') {
          // macOS
          currentWindow.webContents.selectAll();
          currentWindow.webContents.copy();
        } else {
          // Windows/Linux
          currentWindow.webContents.copy();
        }
      } else {
        // アクティブウィンドウがない場合、システムレベルでコピーを試行
        // プラットフォーム固有の実装が必要
        return this.getSelectedTextFallback();
      }
      
      // 少し待つ（クリップボードへの反映待ち）
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // クリップボードから選択されたテキストを取得
      const selectedText = clipboard.readText();
      
      // 元のクリップボードの内容を復元
      if (previousClipboard) {
        clipboard.writeText(previousClipboard);
      }
      
      return selectedText;
    } catch (error) {
      throw new Error(`選択テキスト取得エラー: ${error}`);
    }
  }

  /**
   * フォールバック: 別の方法で選択テキストを取得
   */
  private async getSelectedTextFallback(): Promise<string> {
    // プラットフォーム固有の実装
    // 例: Windows - PowerShell/AutoHotkey
    // 例: macOS - AppleScript
    // 例: Linux - xclip/xsel
    
    // 現時点では単純にクリップボードの内容を返す
    return clipboard.readText();
  }

  /**
   * アクセシビリティ権限をチェック（macOS）
   */
  private async checkAccessibilityPermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true;
    }

    try {
      const isTrusted = systemPreferences.isTrustedAccessibilityClient(true);
      if (!isTrusted) {
        // 権限要求ダイアログを表示
        this.emit('permission-required', {
          type: 'accessibility',
          platform: 'darwin',
          message: 'QuickCorrectがテキスト選択を監視するにはアクセシビリティ権限が必要です'
        });
      }
      return isTrusted;
    } catch (error) {
      console.error('アクセシビリティ権限チェックエラー:', error);
      return false;
    }
  }

  /**
   * 現在のホットキー設定を取得
   */
  getCurrentHotkey(): string {
    return this.currentHotkey;
  }

  /**
   * 登録状態を取得
   */
  isHotkeyRegistered(): boolean {
    return this.isRegistered;
  }

  /**
   * ホットキーが利用可能かチェック
   */
  isAcceleratorValid(accelerator: string): boolean {
    try {
      return globalShortcut.isRegistered(accelerator) === false;
    } catch {
      return false;
    }
  }

  /**
   * ホットキーのコンフリクトをチェック
   */
  checkHotkeyConflict(hotkey: string): boolean {
    return globalShortcut.isRegistered(hotkey);
  }

  /**
   * クリーンアップ処理
   */
  destroy(): void {
    this.unregisterAll();
    this.removeAllListeners();
  }
}

// シングルトンインスタンスをエクスポート
export const hotkeyController = new HotkeyController();

// アプリケーション終了時のクリーンアップ
app.on('will-quit', () => {
  hotkeyController.destroy();
});