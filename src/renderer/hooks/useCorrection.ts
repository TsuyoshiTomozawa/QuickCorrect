/**
 * QuickCorrect - useCorrection Hook
 * 
 * Hook for managing text correction functionality
 */

import { useState, useCallback } from 'react';
import { useElectronAPI } from './useElectronAPI';
import type { CorrectionResult, CorrectionMode } from '../../types/interfaces';

interface UseCorrectionState {
  isLoading: boolean;
  error: string | null;
  result: CorrectionResult | null;
}

interface UseCorrectionReturn extends UseCorrectionState {
  correctText: (text: string, mode: CorrectionMode) => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
}

/**
 * Hook for text correction functionality
 */
export function useCorrection(): UseCorrectionReturn {
  const api = useElectronAPI();
  const [state, setState] = useState<UseCorrectionState>({
    isLoading: false,
    error: null,
    result: null
  });
  
  const correctText = useCallback(async (text: string, mode: CorrectionMode) => {
    if (!api) {
      setState(prev => ({
        ...prev,
        error: 'Electron API not available'
      }));
      return;
    }
    
    if (!text.trim()) {
      setState(prev => ({
        ...prev,
        error: 'テキストを入力してください'
      }));
      return;
    }
    
    setState({
      isLoading: true,
      error: null,
      result: null
    });
    
    try {
      const result = await api.correctText(text, mode);
      setState({
        isLoading: false,
        error: null,
        result
      });
    } catch (error) {
      setState({
        isLoading: false,
        error: error instanceof Error ? error.message : '添削に失敗しました',
        result: null
      });
    }
  }, [api]);
  
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  
  const clearResult = useCallback(() => {
    setState(prev => ({ ...prev, result: null }));
  }, []);
  
  return {
    isLoading: state.isLoading,
    error: state.error,
    result: state.result,
    correctText,
    clearError,
    clearResult
  };
}