const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Text correction
  correctText: (text, mode) => ipcRenderer.invoke('correct-text', text, mode),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // History
  getHistory: (limit) => ipcRenderer.invoke('get-history', limit),
  saveToHistory: (history) => ipcRenderer.invoke('save-to-history', history),
  deleteHistory: (id) => ipcRenderer.invoke('delete-history', id),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  
  // Window controls
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Events
  onTextSelected: (callback) => {
    ipcRenderer.on('text-selected', (event, text) => callback(text));
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  
  // System
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  checkPermissions: () => ipcRenderer.invoke('check-permissions')
});