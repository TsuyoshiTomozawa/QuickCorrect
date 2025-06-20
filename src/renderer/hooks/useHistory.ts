/**
 * QuickCorrect - useHistory Hook
 * 
 * Hook for managing correction history
 */

import { useState, useEffect, useCallback } from 'react';
import { useElectronAPI } from './useElectronAPI';
import type { CorrectionHistory, CorrectionMode } from '../../types/interfaces';

interface UseHistoryState {
  history: CorrectionHistory[];
  isLoading: boolean;
  error: string | null;
}

interface UseHistoryReturn extends UseHistoryState {
  addToHistory: (originalText: string, correctedText: string, mode: CorrectionMode, model: string) => Promise<boolean>;
  deleteHistoryItem: (id: string) => Promise<boolean>;
  clearAllHistory: () => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
  refreshHistory: () => Promise<void>;
}

/**
 * Hook for managing correction history
 */
export function useHistory(limit?: number): UseHistoryReturn {
  const api = useElectronAPI();
  const [state, setState] = useState<UseHistoryState>({
    history: [],
    isLoading: true,
    error: null
  });
  
  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [limit]);
  
  const loadHistory = useCallback(async () => {
    if (!api) {
      setState({
        history: [],
        isLoading: false,
        error: 'Electron API not available'
      });
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const history = await api.getHistory(limit);
      setState({
        history: history || [],
        isLoading: false,
        error: null
      });
    } catch (error) {
      setState({
        history: [],
        isLoading: false,
        error: error instanceof Error ? error.message : '履歴の読み込みに失敗しました'
      });
    }
  }, [api, limit]);
  
  const addToHistory = useCallback(async (
    originalText: string,
    correctedText: string,
    mode: CorrectionMode,
    model: string
  ): Promise<boolean> => {
    if (!api) return false;
    
    try {
      const success = await api.saveToHistory({
        originalText,
        correctedText,
        mode,
        model,
        favorite: false
      });
      
      if (success) {
        // Refresh history to get the new item with ID
        await loadHistory();
      }
      
      return success;
    } catch (error) {
      console.error('Failed to add to history:', error);
      return false;
    }
  }, [api, loadHistory]);
  
  const deleteHistoryItem = useCallback(async (id: string): Promise<boolean> => {
    if (!api) return false;
    
    try {
      const success = await api.deleteHistory(id);
      
      if (success) {
        // Update local state optimistically
        setState(prev => ({
          ...prev,
          history: prev.history.filter(item => item.id !== id)
        }));
      }
      
      return success;
    } catch (error) {
      console.error('Failed to delete history item:', error);
      setState(prev => ({
        ...prev,
        error: '履歴の削除に失敗しました'
      }));
      return false;
    }
  }, [api]);
  
  const clearAllHistory = useCallback(async (): Promise<boolean> => {
    if (!api) return false;
    
    try {
      const success = await api.clearHistory();
      
      if (success) {
        setState(prev => ({
          ...prev,
          history: []
        }));
      }
      
      return success;
    } catch (error) {
      console.error('Failed to clear history:', error);
      setState(prev => ({
        ...prev,
        error: '履歴のクリアに失敗しました'
      }));
      return false;
    }
  }, [api]);
  
  const toggleFavorite = useCallback(async (id: string): Promise<boolean> => {
    // This would require updating the history item
    // For now, we'll implement this client-side only
    setState(prev => ({
      ...prev,
      history: prev.history.map(item =>
        item.id === id ? { ...item, favorite: !item.favorite } : item
      )
    }));
    
    // TODO: Implement server-side favorite toggle
    return true;
  }, []);
  
  const refreshHistory = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);
  
  return {
    history: state.history,
    isLoading: state.isLoading,
    error: state.error,
    addToHistory,
    deleteHistoryItem,
    clearAllHistory,
    toggleFavorite,
    refreshHistory
  };
}