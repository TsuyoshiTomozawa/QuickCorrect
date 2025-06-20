/**
 * QuickCorrect - Main Process Entry Point (統合版)
 * 
 * Controller統合とイベント処理を実装した改良版
 */

import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';
import { eventBus, EventType } from '../services/EventBus';
import { HotkeyController } from '../controllers/HotkeyController';
import { CorrectionController, AIProvider } from '../controllers/CorrectionController';
import { ClipboardController } from '../controllers/ClipboardController';
import { WorkflowOrchestrator } from '../services/WorkflowOrchestrator';
import { CorrectionMode, CorrectionResult, AppSettings } from '../types/interfaces';

// グローバル変数
let mainWindow: BrowserWindow | null = null;
let hotkeyController: HotkeyController;
let correctionController: CorrectionController;
let clipboardController: ClipboardController;
let workflowOrchestrator: WorkflowOrchestrator;
let tray: Tray | null = null;

// 開発モードかチェック
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * メインウィンドウを作成
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 700,
    minHeight: 450,
    show: false,
    alwaysOnTop: true,
    frame: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: !isDevelopment
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // 開発環境設定
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // ウィンドウ準備完了時
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      setupWindowEventHandlers();
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

  // 最小化時は非表示にする
  mainWindow.on('minimize', (event) => {
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
  await hotkeyController.register();
  
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
function setupIPC(): void {
  // 手動テキスト添削
  ipcMain.handle('correct-text', async (event, text: string, mode?: CorrectionMode) => {
    try {
      await workflowOrchestrator.processManualText(text, mode);
      return { success: true };
    } catch (error) {
      console.error('Correction error:', error);
      return { success: false, error: error.message };
    }
  });

  // 設定取得
  ipcMain.handle('get-settings', async () => {
    // TODO: 実際の設定管理を実装
    return {
      hotkey: hotkeyController.getCurrentHotkey(),
      defaultMode: correctionController.getMode(),
      autoCorrect: true,
      autoCopy: true
    } as Partial<AppSettings>;
  });

  // 設定保存
  ipcMain.handle('save-settings', async (event, settings: Partial<AppSettings>) => {
    try {
      eventBus.emit(EventType.SETTINGS_CHANGED, settings);
      eventBus.emit(EventType.SETTINGS_SAVED, { 
        settings,
        timestamp: new Date() 
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

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

  // イベント統計取得
  ipcMain.handle('get-statistics', () => {
    return {
      workflow: workflowOrchestrator.getWorkflowStatistics(),
      events: Object.fromEntries(eventBus.getEventStatistics()),
      health: Object.fromEntries(correctionController.checkProvidersHealth())
    };
  });

  // デバッグ情報取得
  ipcMain.handle('debug-info', () => {
    eventBus.debug();
    return {
      workflowState: workflowOrchestrator.getWorkflowState(),
      hotkeyRegistered: hotkeyController.isHotkeyRegistered(),
      activeRequests: correctionController.getActiveRequestCount()
    };
  });
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
  createWindow();
  createTray();
  await initializeControllers();
  setupIPC();
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * アプリ終了前のクリーンアップ
 */
app.on('before-quit', () => {
  console.log('Cleaning up before quit...');
  
  // シャットダウンイベント
  eventBus.emit(EventType.SYSTEM_SHUTDOWN, { timestamp: new Date() });
  
  // コントローラーのクリーンアップ
  hotkeyController?.destroy();
  clipboardController?.destroy();
  correctionController?.destroy();
  workflowOrchestrator?.destroy();
  
  // トレイの削除
  tray?.destroy();
});

/**
 * セキュリティ: 新規ウィンドウ作成を防止
 */
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event) => {
    event.preventDefault();
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