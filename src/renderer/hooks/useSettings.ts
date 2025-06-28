/**
 * QuickCorrect - useSettings Hook
 * 
 * Hook for managing application settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useElectronAPI } from './useElectronAPI';
import type { AppSettings } from '../../types/interfaces';

interface UseSettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface UseSettingsReturn extends UseSettingsState {
  updateSettings: (updates: Partial<AppSettings>) => Promise<boolean>;
  reloadSettings: () => Promise<void>;
}

// Default settings as fallback
const DEFAULT_SETTINGS: AppSettings = {
  apiKeys: {
    openai: '',
    anthropic: '',
    google: ''
  },
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
    primaryProvider: 'openai',
    temperature: 0.7,
    maxTokens: 2000,
    timeout: 30000
  },
  privacy: {
    saveHistory: true,
    analyticsEnabled: false
  },
  appearance: {
    theme: 'system'
  }
};

/**
 * Hook for managing application settings
 */
export function useSettings(): UseSettingsReturn {
  const api = useElectronAPI();
  const [state, setState] = useState<UseSettingsState>({
    settings: null,
    isLoading: true,
    isSaving: false,
    error: null
  });
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = useCallback(async () => {
    if (!api) {
      setState({
        settings: DEFAULT_SETTINGS,
        isLoading: false,
        isSaving: false,
        error: 'Running in non-Electron environment'
      });
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const settings = await api.getSettings();
      setState({
        settings: settings || DEFAULT_SETTINGS,
        isLoading: false,
        isSaving: false,
        error: null
      });
    } catch (error) {
      setState({
        settings: DEFAULT_SETTINGS,
        isLoading: false,
        isSaving: false,
        error: error instanceof Error ? error.message : '設定の読み込みに失敗しました'
      });
    }
  }, [api]);
  
  const updateSettings = useCallback(async (updates: Partial<AppSettings>): Promise<boolean> => {
    if (!api) {
      setState(prev => ({
        ...prev,
        error: 'Electron API not available'
      }));
      return false;
    }
    
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    
    try {
      const success = await api.saveSettings(updates);
      
      if (success) {
        // Update local state optimistically
        setState(prev => ({
          ...prev,
          settings: prev.settings ? { ...prev.settings, ...updates } : null,
          isSaving: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          isSaving: false,
          error: '設定の保存に失敗しました'
        }));
      }
      
      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: error instanceof Error ? error.message : '設定の保存中にエラーが発生しました'
      }));
      return false;
    }
  }, [api]);
  
  const reloadSettings = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);
  
  return {
    settings: state.settings,
    isLoading: state.isLoading,
    isSaving: state.isSaving,
    error: state.error,
    updateSettings,
    reloadSettings
  };
}