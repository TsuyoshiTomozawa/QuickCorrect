/**
 * QuickCorrect - Main Process Entry Point (統合版)
 * 
 * Controller統合とイベント処理を実装した改良版
 * Model層との統合を含む
 */

import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, globalShortcut } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { eventBus, EventType } from '../services/EventBus';
import { HotkeyController } from '../controllers/HotkeyController';
import { CorrectionController, AIProvider } from '../controllers/CorrectionController';
import { ClipboardController } from '../controllers/ClipboardController';
import { WorkflowOrchestrator } from '../services/WorkflowOrchestrator';
import { CorrectionMode, CorrectionResult } from '../types/interfaces';
import { initializeIPCHandlers, cleanupIPCHandlers } from './ipc/handlers';
import { SettingsManager } from './settings/SettingsManager';

// Load environment variables from .env file
dotenv.config();

// グローバル変数
let mainWindow: BrowserWindow | null = null;
let hotkeyController: HotkeyController;
let correctionController: CorrectionController;
let clipboardController: ClipboardController;
let workflowOrchestrator: WorkflowOrchestrator;
let settingsManager: SettingsManager;
let tray: Tray | null = null;

// 開発モードかチェック
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * メインウィンドウを作成
 */
async function createWindow(): Promise<void> {
  // 設定マネージャーの初期化
  settingsManager = new SettingsManager(app.getPath('userData'));
  const settings = await settingsManager.getSettings();

  mainWindow = new BrowserWindow({
    width: settings.windowSettings.size.width,
    height: settings.windowSettings.size.height,
    minWidth: 700,
    minHeight: 450,
    show: false,
    alwaysOnTop: false, // 常に最前面に表示しない
    opacity: settings.windowSettings.opacity,
    frame: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: !isDevelopment
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // ウィンドウ位置の復元
  if (settings.windowSettings.position.x !== -1 && settings.windowSettings.position.y !== -1) {
    mainWindow.setPosition(
      settings.windowSettings.position.x,
      settings.windowSettings.position.y
    );
  }

  // CSPヘッダーの設定
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "font-src 'self' data:; " +
          "connect-src 'self' http://localhost:* ws://localhost:* https://api.openai.com; " +
          "media-src 'self'; " +
          "object-src 'none'; " +
          "frame-src 'none';"
        ]
      }
    });
  });

  // 開発環境設定
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:9000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // ウィンドウ準備完了時
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      setupWindowEventHandlers();
      
      // macOSでフォーカス
      if (process.platform === 'darwin') {
        mainWindow.focus();
      }
    }
  });

  // ウィンドウクローズ時
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * ウィンドウイベントハンドラーを設定
 */
function setupWindowEventHandlers(): void {
  if (!mainWindow) return;

  // ウィンドウフォーカス
  mainWindow.on('focus', () => {
    eventBus.emit(EventType.WINDOW_FOCUS, { timestamp: new Date() });
  });

  // ウィンドウブラー
  mainWindow.on('blur', () => {
    eventBus.emit(EventType.WINDOW_BLUR, { timestamp: new Date() });
  });

  // ウィンドウ移動時に位置を保存
  mainWindow.on('moved', async () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      const [width, height] = mainWindow.getSize();
      const currentSettings = await settingsManager.getSetting('windowSettings');
      settingsManager.setSetting('windowSettings', {
        ...currentSettings,
        position: { x, y },
        size: { width, height }
      });
    }
  });

  // ウィンドウリサイズ時にサイズを保存
  mainWindow.on('resized', async () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      const [x, y] = mainWindow.getPosition();
      const currentSettings = await settingsManager.getSetting('windowSettings');
      settingsManager.setSetting('windowSettings', {
        ...currentSettings,
        position: { x, y },
        size: { width, height }
      });
    }
  });

  // 最小化時は非表示にする
  mainWindow.on('minimize', (event: Electron.Event) => {
    event.preventDefault();
    mainWindow?.hide();
    eventBus.emit(EventType.WINDOW_HIDE, { 
      reason: 'minimize',
      timestamp: new Date() 
    });
  });
}

/**
 * システムトレイを作成
 */
function createTray(): void {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../assets/tray-icon.png'));
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'QuickCorrectを表示',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    {
      label: '設定',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', '/settings');
      }
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('QuickCorrect - AI添削アシスタント');
  tray.setContextMenu(contextMenu);
  
  // トレイアイコンクリックでウィンドウ表示
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

/**
 * コントローラーを初期化
 */
async function initializeControllers(): Promise<void> {
  console.log('Initializing controllers...');
  
  // コントローラーのインスタンス化
  hotkeyController = new HotkeyController();
  clipboardController = new ClipboardController();
  correctionController = new CorrectionController();
  
  // AIプロバイダーの登録（モック実装）
  correctionController.registerProvider(createMockAIProvider());
  
  // ワークフローオーケストレーターの初期化
  workflowOrchestrator = new WorkflowOrchestrator(
    hotkeyController,
    clipboardController,
    correctionController
  );
  
  if (mainWindow) {
    workflowOrchestrator.setMainWindow(mainWindow);
  }
  
  // ホットキーの登録
  const settings = await settingsManager.getSettings();
  await hotkeyController.register(settings.hotkey);
  
  // システム準備完了イベント
  eventBus.emit(EventType.SYSTEM_READY, { timestamp: new Date() });
  
  console.log('Controllers initialized successfully');
}

/**
 * モックAIプロバイダーを作成（開発用）
 */
function createMockAIProvider(): AIProvider {
  return {
    name: 'mock',
    async correctText(text: string, mode: CorrectionMode): Promise<CorrectionResult> {
      // 簡単な添削シミュレーション
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const correctedText = text
        .replace(/です。/g, 'でございます。')
        .replace(/ます。/g, 'ます。')
        .replace(/だ。/g, 'です。');
      
      return {
        text: correctedText,
        explanation: `${mode}モードで添削しました`,
        changes: [{
          original: 'です',
          corrected: 'でございます',
          reason: '敬語レベルの向上',
          position: { start: 0, end: 2 }
        }],
        confidence: 0.95,
        processingTime: 1000,
        model: 'mock-model-v1'
      };
    },
    isAvailable(): boolean {
      return true;
    }
  };
}

/**
 * IPCハンドラーを設定
 */
async function setupIPC(): Promise<void> {
  // Model層のIPCハンドラーを初期化
  await initializeIPCHandlers();

  // ウィンドウ制御
  ipcMain.handle('hide-window', () => {
    mainWindow?.hide();
    eventBus.emit(EventType.WINDOW_HIDE, { 
      reason: 'user-action',
      timestamp: new Date() 
    });
  });

  ipcMain.handle('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('close-window', () => {
    mainWindow?.close();
  });

  // クリップボード操作（コントローラー経由）
  ipcMain.handle('copy-to-clipboard', async (_event, text: string) => {
    return await clipboardController.copyToClipboard(text);
  });

  ipcMain.handle('get-clipboard-text', async () => {
    return await clipboardController.getClipboardText();
  });

  // イベント統計取得
  ipcMain.handle('get-statistics', () => {
    return {
      workflow: workflowOrchestrator?.getWorkflowStatistics() || {},
      events: Object.fromEntries(eventBus.getEventStatistics()),
      health: correctionController ? Object.fromEntries(correctionController.checkProvidersHealth()) : {}
    };
  });

  // デバッグ情報取得
  ipcMain.handle('debug-info', () => {
    eventBus.debug();
    return {
      workflowState: workflowOrchestrator?.getWorkflowState() || 'not-initialized',
      hotkeyRegistered: hotkeyController?.getRegistrationStatus() || false,
      activeRequests: correctionController?.getActiveRequestCount() || 0
    };
  });

  // 選択テキスト処理のイベントリスナー
  ipcMain.on('text-selected', (_event, text: string) => {
    if (text && text.trim()) {
      eventBus.emit(EventType.TEXT_SELECTED, {
        text: text.trim(),
        source: 'manual',
        timestamp: new Date()
      });
    }
  });
}

/**
 * 選択されたテキストでウィンドウを表示
 * 現在未使用だが、将来的に使用する可能性があるため保持
 */
if (false) {
  // この関数は将来的に使用される可能性があるため保持
  // @ts-ignore - 未使用の関数だが将来のために保持
  async function showWindowWithSelectedText(): Promise<void> {
    try {
      // 選択されたテキストを取得
      const selectedText = await clipboardController.getSelectedText();
      
      if (selectedText && selectedText.trim()) {
        // ウィンドウが存在しない場合は作成
        if (!mainWindow) {
          await createWindow();
        }
        
        // ウィンドウを表示
        if (mainWindow) {
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
          
          // 選択されたテキストをレンダラーに送信
          mainWindow.webContents.send('text-selected', selectedText);
        }
      }
    } catch (error) {
      console.error('Error processing selected text:', error);
    }
  }
}

/**
 * グローバルエラーハンドラーを設定
 */
function setupErrorHandlers(): void {
  // 未処理のPromiseエラー
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    eventBus.emit(EventType.SYSTEM_ERROR, {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Unhandled promise rejection',
        details: reason,
        timestamp: new Date()
      }
    });
  });

  // 未処理の例外
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    eventBus.emit(EventType.SYSTEM_ERROR, {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Uncaught exception',
        details: error,
        timestamp: new Date()
      }
    });
  });
}

/**
 * アプリケーション起動
 */
app.whenReady().then(async () => {
  await createWindow();
  createTray();
  await initializeControllers();
  await setupIPC();
  setupErrorHandlers();

  // macOS: Dockアイコンクリック時の処理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

/**
 * 全ウィンドウが閉じられた時
 */
app.on('window-all-closed', () => {
  // macOSではアプリを終了しない
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * アプリ終了前のクリーンアップ
 */
app.on('before-quit', async () => {
  console.log('Cleaning up before quit...');
  
  // シャットダウンイベント
  eventBus.emit(EventType.SYSTEM_SHUTDOWN, { timestamp: new Date() });
  
  // グローバルショートカットの解除
  globalShortcut.unregisterAll();
  
  // コントローラーのクリーンアップ
  hotkeyController?.destroy();
  clipboardController?.destroy();
  correctionController?.destroy();
  workflowOrchestrator?.destroy();
  
  // Model層のクリーンアップ
  await cleanupIPCHandlers();
  
  // トレイの削除
  tray?.destroy();
});

/**
 * セキュリティ: 新規ウィンドウ作成を防止
 */
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    console.log('Prevented new window:', url);
    return { action: 'deny' };
  });
  
  // ナビゲーション制限
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:3000') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });
});

// エクスポート
export { mainWindow, eventBus };