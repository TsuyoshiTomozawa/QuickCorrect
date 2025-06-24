/**
 * Preload Script - Secure bridge between main and renderer processes
 * 
 * This script runs in an isolated context and exposes a limited API
 * to the renderer process through the contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI } from '../../types/interfaces';

// Define allowed channels for security
const ALLOWED_CHANNELS = {
  invoke: [
    'correct-text',
    'get-settings',
    'save-settings',
    'get-history',
    'save-to-history',
    'delete-history',
    'clear-history',
    'hide-window',
    'minimize-window',
    'close-window',
    'copy-to-clipboard',
    'get-clipboard-text',
    'get-system-info',
    'check-permissions',
    'get-statistics'
  ],
  on: [
    'text-selected'
  ]
};

// Validate channel is allowed
function isAllowedChannel(channel: string, type: 'invoke' | 'on'): boolean {
  return ALLOWED_CHANNELS[type].includes(channel);
}

// Create the API object to expose to renderer
const electronAPI: ElectronAPI = {
  // Text correction
  correctText: async (text: string, mode: any) => {
    if (!isAllowedChannel('correct-text', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('correct-text', text, mode);
  },

  // Settings
  getSettings: async () => {
    if (!isAllowedChannel('get-settings', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('get-settings');
  },

  saveSettings: async (settings: any) => {
    if (!isAllowedChannel('save-settings', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('save-settings', settings);
  },

  // History
  getHistory: async (limit?: number) => {
    if (!isAllowedChannel('get-history', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('get-history', limit);
  },

  saveToHistory: async (history: any) => {
    if (!isAllowedChannel('save-to-history', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('save-to-history', history);
  },

  deleteHistory: async (id: string) => {
    if (!isAllowedChannel('delete-history', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('delete-history', id);
  },

  clearHistory: async () => {
    if (!isAllowedChannel('clear-history', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('clear-history');
  },

  // Window controls
  hideWindow: () => {
    if (!isAllowedChannel('hide-window', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    ipcRenderer.invoke('hide-window');
  },

  minimizeWindow: () => {
    if (!isAllowedChannel('minimize-window', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    ipcRenderer.invoke('minimize-window');
  },

  closeWindow: () => {
    if (!isAllowedChannel('close-window', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    ipcRenderer.invoke('close-window');
  },

  // Events
  onTextSelected: (callback: (text: string) => void) => {
    if (!isAllowedChannel('text-selected', 'on')) {
      throw new Error('Channel not allowed');
    }
    
    // Remove any existing listeners
    ipcRenderer.removeAllListeners('text-selected');
    
    // Add the new listener
    ipcRenderer.on('text-selected', (_event, text) => {
      callback(text);
    });
  },

  removeAllListeners: (channel: string) => {
    if (!isAllowedChannel(channel, 'on')) {
      throw new Error('Channel not allowed');
    }
    ipcRenderer.removeAllListeners(channel);
  },

  // Clipboard
  copyToClipboard: async (text: string) => {
    if (!isAllowedChannel('copy-to-clipboard', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('copy-to-clipboard', text);
  },

  getClipboardText: async () => {
    if (!isAllowedChannel('get-clipboard-text', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('get-clipboard-text');
  },

  // System
  getSystemInfo: async () => {
    if (!isAllowedChannel('get-system-info', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('get-system-info');
  },

  checkPermissions: async () => {
    if (!isAllowedChannel('check-permissions', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('check-permissions');
  },

  // Statistics
  getStatistics: async () => {
    if (!isAllowedChannel('get-statistics', 'invoke')) {
      throw new Error('Channel not allowed');
    }
    return ipcRenderer.invoke('get-statistics');
  },

  // Platform info for renderer process
  platform: process.platform as NodeJS.Platform
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Log successful preload
console.log('Preload script loaded successfully');