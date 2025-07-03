/**
 * QuickCorrect - useSettings Hook
 * 
 * Hook for managing application settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useElectronAPI } from './useElectronAPI';
import type { AppSettings } from '../../types/interfaces';

// Deep merge helper function
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  Object.keys(source).forEach(key => {
    const sourceValue = source[key as keyof T];
    const targetValue = target[key as keyof T];
    
    if (sourceValue !== undefined) {
      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        (result as any)[key] = deepMerge(targetValue as any, sourceValue as any);
      } else {
        (result as any)[key] = sourceValue;
      }
    }
  });
  
  return result;
}

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
      // In non-Electron environment (like browser tests), update local state only
      setState(prev => ({
        ...prev,
        settings: prev.settings ? deepMerge(prev.settings, updates) : null,
        error: null
      }));
      return true;
    }
    
    console.log('useSettings: updateSettings called with:', updates);
    setState(prev => ({ ...prev, isSaving: true, error: null }));
    
    try {
      const success = await api.saveSettings(updates);
      console.log('useSettings: saveSettings result:', success);
      
      if (success) {
        // Update local state optimistically with deep merge
        setState(prev => {
          const newSettings = prev.settings ? deepMerge(prev.settings, updates) : null;
          console.log('useSettings: merged settings:', newSettings);
          return {
            ...prev,
            settings: newSettings,
            isSaving: false
          };
        });
      } else {
        setState(prev => ({
          ...prev,
          isSaving: false,
          error: '設定の保存に失敗しました'
        }));
      }
      
      return success;
    } catch (error) {
      console.error('useSettings: error saving settings:', error);
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