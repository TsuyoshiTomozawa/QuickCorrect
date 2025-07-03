/**
 * QuickCorrect - Preload Script
 * 
 * This script runs in a separate context before the renderer process loads.
 * It securely exposes specific Electron APIs to the renderer process using contextBridge.
 * All communication between main and renderer processes goes through this bridge.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, CorrectionMode, CorrectionResult, AppSettings, CorrectionHistory, SystemInfo, PermissionStatus } from '../types/interfaces';

// Type-safe IPC channel names
const IPC_CHANNELS = {
  // Text correction
  CORRECT_TEXT: 'correct-text',
  TEXT_SELECTED: 'text-selected',
  
  // Settings
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  
  // History
  GET_HISTORY: 'get-history',
  SAVE_TO_HISTORY: 'save-to-history',
  DELETE_HISTORY: 'delete-history',
  CLEAR_HISTORY: 'clear-history',
  
  // Window controls
  HIDE_WINDOW: 'hide-window',
  MINIMIZE_WINDOW: 'minimize-window',
  CLOSE_WINDOW: 'close-window',
  
  // Clipboard
  COPY_TO_CLIPBOARD: 'copy-to-clipboard',
  GET_CLIPBOARD_TEXT: 'get-clipboard-text',
  
  // System
  GET_SYSTEM_INFO: 'get-system-info',
  CHECK_PERMISSIONS: 'check-permissions',
  
  // Statistics and debug
  GET_STATISTICS: 'get-statistics',
  DEBUG_INFO: 'debug-info',
  
  // Navigation
  NAVIGATE: 'navigate',
  THEME_CHANGED: 'theme-changed',
  
  // Workflow events
  WORKFLOW_TEXT_SELECTED: 'workflow:text-selected',
  WORKFLOW_CORRECTION_COMPLETED: 'workflow:correction-completed',
  WORKFLOW_ERROR: 'workflow:error'
} as const;

// Validate allowed channels for security
const ALLOWED_CHANNELS = Object.values(IPC_CHANNELS);

// Create the API object to expose to the renderer
const electronAPI: ElectronAPI = {
  // Text correction
  correctText: async (text: string, mode: CorrectionMode): Promise<CorrectionResult> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.CORRECT_TEXT, text, mode);
    } catch (error) {
      console.error('Error correcting text:', error);
      throw error;
    }
  },
  
  // Settings
  getSettings: async (): Promise<AppSettings> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS);
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  },
  
  saveSettings: async (settings: Partial<AppSettings>): Promise<boolean> => {
    try {
      console.log('Preload: saveSettings called with:', settings);
      const result = await ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings);
      console.log('Preload: saveSettings result:', result);
      return result?.success || result === true;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  },
  
  // History
  getHistory: async (limit?: number): Promise<CorrectionHistory[]> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY, limit);
    } catch (error) {
      console.error('Error getting history:', error);
      throw error;
    }
  },
  
  saveToHistory: async (history: Omit<CorrectionHistory, 'id' | 'timestamp'>): Promise<boolean> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.SAVE_TO_HISTORY, history);
    } catch (error) {
      console.error('Error saving to history:', error);
      throw error;
    }
  },
  
  deleteHistory: async (id: string): Promise<boolean> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.DELETE_HISTORY, id);
    } catch (error) {
      console.error('Error deleting history:', error);
      throw error;
    }
  },
  
  clearHistory: async (): Promise<boolean> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.CLEAR_HISTORY);
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  },
  
  // Window controls
  hideWindow: (): void => {
    ipcRenderer.invoke(IPC_CHANNELS.HIDE_WINDOW);
  },
  
  minimizeWindow: (): void => {
    ipcRenderer.invoke(IPC_CHANNELS.MINIMIZE_WINDOW);
  },
  
  closeWindow: (): void => {
    ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW);
  },
  
  // Events
  onTextSelected: (callback: (text: string) => void): void => {
    // Remove any existing listeners first
    ipcRenderer.removeAllListeners(IPC_CHANNELS.TEXT_SELECTED);
    
    // Add the new listener
    ipcRenderer.on(IPC_CHANNELS.TEXT_SELECTED, (_event, text: string) => {
      callback(text);
    });
  },
  
  removeAllListeners: (channel: string): void => {
    if (ALLOWED_CHANNELS.includes(channel as any)) {
      ipcRenderer.removeAllListeners(channel);
    } else {
      console.warn(`Attempted to remove listeners for unauthorized channel: ${channel}`);
    }
  },
  
  // Clipboard
  copyToClipboard: async (text: string): Promise<boolean> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.COPY_TO_CLIPBOARD, text);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      throw error;
    }
  },
  
  getClipboardText: async (): Promise<string> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.GET_CLIPBOARD_TEXT);
    } catch (error) {
      console.error('Error getting clipboard text:', error);
      throw error;
    }
  },
  
  // System
  getSystemInfo: async (): Promise<SystemInfo> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_INFO);
    } catch (error) {
      console.error('Error getting system info:', error);
      throw error;
    }
  },
  
  // Platform info for renderer process
  platform: process.platform,
  
  checkPermissions: async (): Promise<PermissionStatus> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.CHECK_PERMISSIONS);
    } catch (error) {
      console.error('Error checking permissions:', error);
      throw error;
    }
  },
  
  // Statistics (PR #19 additions)
  getStatistics: async (): Promise<any> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.GET_STATISTICS);
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  },
  
  // Debug
  getDebugInfo: async (): Promise<any> => {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.DEBUG_INFO);
    } catch (error) {
      console.error('Error getting debug info:', error);
      throw error;
    }
  },
  
  // Event listeners (PR #19 additions)
  on: (channel: string, callback: Function): void => {
    const validChannels = [
      IPC_CHANNELS.WORKFLOW_TEXT_SELECTED,
      IPC_CHANNELS.WORKFLOW_CORRECTION_COMPLETED,
      IPC_CHANNELS.WORKFLOW_ERROR,
      IPC_CHANNELS.NAVIGATE,
      IPC_CHANNELS.THEME_CHANGED,
      IPC_CHANNELS.TEXT_SELECTED
    ];
    
    if (validChannels.includes(channel as any)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    } else {
      console.warn(`Attempted to listen to unauthorized channel: ${channel}`);
    }
  },
  
  // One-time event listener
  once: (channel: string, callback: Function): void => {
    const validChannels = [
      IPC_CHANNELS.WORKFLOW_TEXT_SELECTED,
      IPC_CHANNELS.WORKFLOW_CORRECTION_COMPLETED,
      IPC_CHANNELS.WORKFLOW_ERROR
    ];
    
    if (validChannels.includes(channel as any)) {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    } else {
      console.warn(`Attempted to listen once to unauthorized channel: ${channel}`);
    }
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript用の型定義
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Log successful preload
if (process.env.NODE_ENV === 'development') {
  console.log('Preload script loaded successfully');
  console.log('Available API methods:', Object.keys(electronAPI));
}

// Export for TypeScript support
export { IPC_CHANNELS };