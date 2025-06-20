/**
 * QuickCorrect - Main Process Entry Point
 * 
 * This file serves as the main entry point for the Electron application.
 * It handles:
 * - Application lifecycle management
 * - Window creation and management
 * - Global hotkey registration
 * - IPC communication setup
 */

import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import * as path from 'path';
import { HotkeyController } from '../controllers/HotkeyController';
import { CorrectionController } from '../controllers/CorrectionController';
import { ClipboardController } from '../controllers/ClipboardController';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let hotkeyController: HotkeyController;
let correctionController: CorrectionController;
let clipboardController: ClipboardController;

/**
 * Create the main application window
 */
function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    minWidth: 600,
    minHeight: 400,
    show: false, // Don't show until ready
    alwaysOnTop: true,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: true
    },
    icon: path.join(__dirname, '../../assets/icon.png') // Add app icon
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      
      // Focus the window if it was triggered by hotkey
      if (process.platform === 'darwin') {
        mainWindow.focus();
      }
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window minimize (hide instead of minimize for better UX)
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow?.hide();
  });
}

/**
 * Initialize application controllers
 */
function initializeControllers(): void {
  // Initialize controllers
  hotkeyController = new HotkeyController();
  correctionController = new CorrectionController();
  clipboardController = new ClipboardController();

  // Register global hotkey
  hotkeyController.registerHotkey('CommandOrControl+T', () => {
    showWindowWithSelectedText();
  });
}

/**
 * Show window and process selected text
 */
async function showWindowWithSelectedText(): Promise<void> {
  try {
    // Get selected text from clipboard
    const selectedText = await clipboardController.getSelectedText();
    
    if (selectedText) {
      // Show window if hidden
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        
        // Send selected text to renderer
        mainWindow.webContents.send('text-selected', selectedText);
      }
    }
  } catch (error) {
    console.error('Error processing selected text:', error);
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC(): void {
  // Handle text correction request
  ipcMain.handle('correct-text', async (event, text: string, mode: string) => {
    try {
      const correctedText = await correctionController.correctText(text, mode as any);
      
      // Auto-copy to clipboard
      await clipboardController.copyToClipboard(correctedText.text);
      
      return correctedText;
    } catch (error) {
      console.error('Text correction error:', error);
      throw error;
    }
  });

  // Handle settings requests
  ipcMain.handle('get-settings', async () => {
    // TODO: Implement settings retrieval from storage
    return {
      apiKeys: {},
      defaultMode: 'business',
      hotkey: 'CommandOrControl+T',
      autoCorrect: false,
      autoCopy: true,
      windowSettings: {
        alwaysOnTop: true,
        opacity: 1,
        position: { x: 0, y: 0 },
        size: { width: 800, height: 500 }
      },
      aiSettings: {
        primaryProvider: 'openai' as const,
        temperature: 0.7,
        maxTokens: 2000,
        timeout: 30000
      },
      privacy: {
        saveHistory: true,
        analyticsEnabled: false
      }
    };
  });

  ipcMain.handle('save-settings', async (event, settings) => {
    // TODO: Implement settings saving to storage
    return true;
  });

  // Handle history requests
  ipcMain.handle('get-history', async (event, limit?: number) => {
    // TODO: Implement history retrieval from database
    return [];
  });

  ipcMain.handle('save-to-history', async (event, history) => {
    // TODO: Implement history saving to database
    return true;
  });

  ipcMain.handle('delete-history', async (event, id: string) => {
    // TODO: Implement history deletion
    return true;
  });

  ipcMain.handle('clear-history', async () => {
    // TODO: Implement history clearing
    return true;
  });

  // Handle window control
  ipcMain.handle('hide-window', () => {
    mainWindow?.hide();
  });

  ipcMain.handle('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('close-window', () => {
    mainWindow?.close();
  });

  // Handle clipboard operations
  ipcMain.handle('copy-to-clipboard', async (event, text: string) => {
    return await clipboardController.copyToClipboard(text);
  });

  ipcMain.handle('get-clipboard-text', async () => {
    return await clipboardController.getClipboardText();
  });

  // Handle system info
  ipcMain.handle('get-system-info', async () => {
    return {
      platform: process.platform as any,
      version: process.version,
      arch: process.arch,
      memory: {
        total: process.memoryUsage().heapTotal,
        used: process.memoryUsage().heapUsed
      }
    };
  });

  ipcMain.handle('check-permissions', async () => {
    // TODO: Implement actual permission checking
    return {
      accessibility: true,
      microphone: false,
      camera: false,
      notifications: true
    };
  });
}

/**
 * App event handlers
 */

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  initializeControllers();
  setupIPC();

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up before quitting
app.on('before-quit', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

// Handle app activation (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    console.log('Prevented new window:', navigationUrl);
  });
});

export { mainWindow };