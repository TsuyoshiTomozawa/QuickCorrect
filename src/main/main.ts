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

import { app, BrowserWindow, globalShortcut, clipboard } from 'electron';
import * as path from 'path';
import { initializeIPCHandlers, cleanupIPCHandlers } from './ipc/handlers';
import { SettingsManager } from './settings/SettingsManager';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let settingsManager: SettingsManager;

/**
 * Create the main application window
 */
async function createWindow(): Promise<void> {
  // Load settings
  settingsManager = new SettingsManager(app.getPath('userData'));
  const settings = await settingsManager.getSettings();

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: settings.windowSettings.size.width,
    height: settings.windowSettings.size.height,
    minWidth: 600,
    minHeight: 400,
    show: false, // Don't show until ready
    alwaysOnTop: settings.windowSettings.alwaysOnTop,
    opacity: settings.windowSettings.opacity,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload/preload.js'),
      webSecurity: true
    },
    icon: path.join(__dirname, '../../assets/icon.png') // Add app icon
  });

  // Restore window position if saved
  if (settings.windowSettings.position.x !== -1 && settings.windowSettings.position.y !== -1) {
    mainWindow.setPosition(
      settings.windowSettings.position.x,
      settings.windowSettings.position.y
    );
  }

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

  // Save window position on move
  mainWindow.on('moved', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      settingsManager.setSetting('windowSettings', {
        ...settings.windowSettings,
        position: { x, y }
      });
    }
  });

  // Save window size on resize
  mainWindow.on('resized', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      settingsManager.setSetting('windowSettings', {
        ...settings.windowSettings,
        size: { width, height }
      });
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
 * Initialize application
 */
async function initializeApp(): Promise<void> {
  // Initialize IPC handlers (includes Model layer integration)
  await initializeIPCHandlers();

  // Register global hotkey
  const settings = await settingsManager.getSettings();
  registerGlobalHotkey(settings.hotkey);
}

/**
 * Register global hotkey
 */
function registerGlobalHotkey(hotkey: string): void {
  // Unregister any existing hotkey
  globalShortcut.unregisterAll();

  // Register new hotkey
  const registered = globalShortcut.register(hotkey, () => {
    showWindowWithSelectedText();
  });

  if (!registered) {
    console.error('Failed to register hotkey:', hotkey);
  } else {
    console.log('Hotkey registered:', hotkey);
  }
}

/**
 * Show window and process selected text
 */
async function showWindowWithSelectedText(): Promise<void> {
  try {
    // Get selected text from clipboard
    const selectedText = clipboard.readText();
    
    if (selectedText && selectedText.trim()) {
      // Show window if hidden
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        
        // Send selected text to renderer
        mainWindow.webContents.send('text-selected', selectedText);
      } else {
        // Create window if it doesn't exist
        await createWindow();
        mainWindow?.webContents.once('did-finish-load', () => {
          mainWindow?.webContents.send('text-selected', selectedText);
        });
      }
    }
  } catch (error) {
    console.error('Error processing selected text:', error);
  }
}

/**
 * App event handlers
 */

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  await createWindow();
  await initializeApp();

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
app.on('before-quit', async () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
  
  // Cleanup IPC handlers
  await cleanupIPCHandlers();
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

// Handle window control IPC
export { mainWindow };