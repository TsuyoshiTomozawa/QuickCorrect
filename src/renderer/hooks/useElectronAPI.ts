/**
 * QuickCorrect - useElectronAPI Hook
 * 
 * Main hook for accessing Electron API functions in React components
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ElectronAPI } from '../../types/interfaces';

/**
 * Custom hook to safely access the Electron API
 * @returns The Electron API object or null if not available
 */
export function useElectronAPI(): ElectronAPI | null {
  // Check if we're in an Electron environment
  if (typeof window === 'undefined' || !window.electronAPI) {
    console.warn('Electron API not available. Running in a non-Electron environment?');
    return null;
  }
  
  return window.electronAPI;
}

/**
 * Hook for managing text selection events
 */
export function useTextSelection(onTextSelected?: (text: string) => void) {
  const api = useElectronAPI();
  const callbackRef = useRef(onTextSelected);
  
  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = onTextSelected;
  }, [onTextSelected]);
  
  useEffect(() => {
    if (!api || !callbackRef.current) return;
    
    // Set up the listener
    api.onTextSelected(callbackRef.current);
    
    // Cleanup
    return () => {
      api.removeAllListeners('text-selected');
    };
  }, [api]);
}

/**
 * Hook for window control functions
 */
export function useWindowControls() {
  const api = useElectronAPI();
  
  const hideWindow = useCallback(() => {
    if (api) {
      api.hideWindow();
    }
  }, [api]);
  
  const minimizeWindow = useCallback(() => {
    if (api) {
      api.minimizeWindow();
    }
  }, [api]);
  
  const closeWindow = useCallback(() => {
    if (api) {
      api.closeWindow();
    }
  }, [api]);
  
  return {
    hideWindow,
    minimizeWindow,
    closeWindow,
    isAvailable: !!api
  };
}

/**
 * Hook for clipboard operations
 */
export function useClipboard() {
  const api = useElectronAPI();
  
  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    if (!api) {
      console.warn('Electron API not available');
      return false;
    }
    
    try {
      return await api.copyToClipboard(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, [api]);
  
  const getClipboardText = useCallback(async (): Promise<string> => {
    if (!api) {
      console.warn('Electron API not available');
      return '';
    }
    
    try {
      return await api.getClipboardText();
    } catch (error) {
      console.error('Failed to get clipboard text:', error);
      return '';
    }
  }, [api]);
  
  return {
    copyToClipboard,
    getClipboardText,
    isAvailable: !!api
  };
}