/**
 * Preload Script - レンダラープロセスとメインプロセスの橋渡し
 * 
 * contextBridgeを使用してセキュアなAPI通信を実現
 */

import { contextBridge, ipcRenderer } from 'electron';
import { CorrectionMode, AppSettings } from '../types/interfaces';

// ElectronAPIの定義
const electronAPI = {
  // テキスト添削
  correctText: (text: string, mode?: CorrectionMode) => 
    ipcRenderer.invoke('correct-text', text, mode),
  
  // 設定管理
  getSettings: () => 
    ipcRenderer.invoke('get-settings'),
  
  saveSettings: (settings: Partial<AppSettings>) => 
    ipcRenderer.invoke('save-settings', settings),
  
  // ウィンドウ制御
  hideWindow: () => 
    ipcRenderer.invoke('hide-window'),
  
  minimizeWindow: () => 
    ipcRenderer.invoke('minimize-window'),
  
  closeWindow: () => 
    ipcRenderer.invoke('close-window'),
  
  // 統計情報
  getStatistics: () => 
    ipcRenderer.invoke('get-statistics'),
  
  // デバッグ
  getDebugInfo: () => 
    ipcRenderer.invoke('debug-info'),
  
  // イベントリスナー
  on: (channel: string, callback: Function) => {
    const validChannels = [
      'workflow:text-selected',
      'workflow:correction-completed',
      'workflow:error',
      'navigate',
      'theme-changed'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  // イベントリスナー削除
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // 一度だけのイベントリスナー
  once: (channel: string, callback: Function) => {
    const validChannels = [
      'workflow:text-selected',
      'workflow:correction-completed',
      'workflow:error'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.once(channel, (event, ...args) => callback(...args));
    }
  }
};

// contextBridgeでAPIを公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript用の型定義
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}

// 開発環境でのコンソール出力
if (process.env.NODE_ENV === 'development') {
  console.log('Preload script loaded');
  console.log('Available API methods:', Object.keys(electronAPI));
}