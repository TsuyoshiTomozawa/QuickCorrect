/**
 * HotkeyController - 統合版ホットキー管理
 * 
 * EventBusと連携してグローバルホットキーを管理
 */

import { globalShortcut, clipboard, BrowserWindow, systemPreferences } from 'electron';
import { eventBus, EventType } from '../services/EventBus';
import { ErrorCode } from '../types/interfaces';

export class HotkeyController {
  private currentHotkey: string;
  private isRegistered: boolean = false;
  private readonly defaultHotkey: string;
  private previousClipboard: string = '';
  
  constructor() {
    this.defaultHotkey = process.platform === 'darwin' ? 'Cmd+T' : 'Ctrl+T';
    this.currentHotkey = this.defaultHotkey;
    this.setupEventListeners();
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    // 設定変更イベントを監視
    eventBus.on(EventType.SETTINGS_CHANGED, (payload) => {
      if (payload.hotkey && payload.hotkey !== this.currentHotkey) {
        this.register(payload.hotkey);
      }
    });
  }

  /**
   * ホットキーを登録
   */
  async register(hotkey?: string): Promise<boolean> {
    try {
      // 既存のホットキーを解除
      if (this.isRegistered) {
        await this.unregister();
      }

      // macOSの権限チェック
      if (process.platform === 'darwin') {
        const hasPermission = await this.checkAccessibilityPermission();
        if (!hasPermission) {
          eventBus.emit(EventType.SYSTEM_ERROR, {
            error: {
              code: 'PERMISSION_ERROR' as ErrorCode,
              message: 'アクセシビリティ権限が必要です',
              details: { platform: 'darwin' },
              timestamp: new Date()
            }
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
        
        eventBus.emit(EventType.HOTKEY_REGISTERED, {
          hotkey: keyToRegister,
          timestamp: new Date()
        });
        
        return true;
      } else {
        eventBus.emit(EventType.HOTKEY_ERROR, {
          error: {
            code: 'HOTKEY_ERROR' as ErrorCode,
            message: `ホットキー ${keyToRegister} の登録に失敗しました`,
            details: { hotkey: keyToRegister },
            timestamp: new Date()
          }
        });
        return false;
      }
    } catch (error) {
      eventBus.emit(EventType.SYSTEM_ERROR, {
        error: {
          code: 'HOTKEY_ERROR' as ErrorCode,
          message: 'ホットキー登録中にエラーが発生しました',
          details: error,
          timestamp: new Date()
        }
      });
      return false;
    }
  }

  /**
   * ホットキーが押された時の処理
   */
  private async handleHotkeyPress(): Promise<void> {
    try {
      // ホットキー押下イベントを発行
      eventBus.emit(EventType.HOTKEY_PRESSED, {
        hotkey: this.currentHotkey,
        timestamp: new Date()
      });

      // 選択されたテキストを取得
      const selectedText = await this.getSelectedText();
      
      if (selectedText && selectedText.trim()) {
        // テキスト選択成功イベントを発行
        eventBus.emit(EventType.TEXT_SELECTED, {
          text: selectedText.trim(),
          source: 'hotkey',
          timestamp: new Date()
        });
      } else {
        // テキスト選択失敗イベントを発行
        eventBus.emit(EventType.TEXT_SELECTION_FAILED, {
          reason: 'no-text-selected',
          timestamp: new Date()
        });
      }
    } catch (error) {
      eventBus.emit(EventType.SYSTEM_ERROR, {
        error: {
          code: 'HOTKEY_ERROR' as ErrorCode,
          message: 'テキスト取得中にエラーが発生しました',
          details: error,
          timestamp: new Date()
        }
      });
    }
  }

  /**
   * 選択されたテキストを取得（改良版）
   */
  private async getSelectedText(): Promise<string> {
    try {
      // 現在のクリップボードの内容を保存
      this.previousClipboard = clipboard.readText();
      
      // アクティブなウィンドウを取得
      const focusedWindow = BrowserWindow.getFocusedWindow();
      
      if (focusedWindow && focusedWindow.webContents) {
        // Electronウィンドウ内の場合
        return await this.getTextFromElectronWindow(focusedWindow);
      } else {
        // 外部アプリケーションの場合
        return await this.getTextFromExternalApp();
      }
    } catch (error) {
      console.error('選択テキスト取得エラー:', error);
      return '';
    } finally {
      // クリップボードを復元
      if (this.previousClipboard) {
        setTimeout(() => {
          clipboard.writeText(this.previousClipboard);
        }, 100);
      }
    }
  }

  /**
   * Electronウィンドウからテキストを取得
   */
  private async getTextFromElectronWindow(window: BrowserWindow): Promise<string> {
    try {
      const selectedText = await window.webContents.executeJavaScript(`
        window.getSelection().toString()
      `);
      return selectedText || '';
    } catch {
      return '';
    }
  }

  /**
   * 外部アプリケーションからテキストを取得
   */
  private async getTextFromExternalApp(): Promise<string> {
    // プラットフォーム別の実装
    if (process.platform === 'darwin') {
      // macOS: AppleScriptを使用
      return await this.getTextMacOS();
    } else if (process.platform === 'win32') {
      // Windows: PowerShellまたはAutoHotkeyを使用
      return await this.getTextWindows();
    } else {
      // Linux: xclipを使用
      return await this.getTextLinux();
    }
  }

  /**
   * macOSでテキストを取得
   */
  private async getTextMacOS(): Promise<string> {
    const { execSync } = require('child_process');
    try {
      // Cmd+Cをシミュレート
      execSync(`osascript -e 'tell application "System Events" to keystroke "c" using command down'`);
      
      // クリップボードの更新を待つ
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return clipboard.readText();
    } catch {
      return clipboard.readText();
    }
  }

  /**
   * Windowsでテキストを取得
   */
  private async getTextWindows(): Promise<string> {
    const { execSync } = require('child_process');
    try {
      // Ctrl+Cをシミュレート
      execSync('powershell -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys(\'^c\')"');
      
      // クリップボードの更新を待つ
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return clipboard.readText();
    } catch {
      return clipboard.readText();
    }
  }

  /**
   * Linuxでテキストを取得
   */
  private async getTextLinux(): Promise<string> {
    const { execSync } = require('child_process');
    try {
      // xdotoolを使用してCtrl+Cをシミュレート
      execSync('xdotool key ctrl+c');
      
      // クリップボードの更新を待つ
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return clipboard.readText();
    } catch {
      // xselを試す
      try {
        const selection = execSync('xsel -o').toString();
        return selection;
      } catch {
        return clipboard.readText();
      }
    }
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
      return isTrusted;
    } catch (error) {
      console.error('アクセシビリティ権限チェックエラー:', error);
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
        
        eventBus.emit(EventType.HOTKEY_UNREGISTERED, {
          hotkey: this.currentHotkey,
          timestamp: new Date()
        });
        
        return true;
      }
      return false;
    } catch (error) {
      eventBus.emit(EventType.SYSTEM_ERROR, {
        error: {
          code: 'HOTKEY_ERROR' as ErrorCode,
          message: 'ホットキー解除中にエラーが発生しました',
          details: error,
          timestamp: new Date()
        }
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
   * クリーンアップ処理
   */
  destroy(): void {
    this.unregisterAll();
  }
}