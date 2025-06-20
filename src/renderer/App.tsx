/**
 * QuickCorrect - Main React Application Component
 * 
 * This is the root component of the React application that runs in the renderer process.
 * It manages the overall application state and renders the main UI components.
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useTextSelection, 
  useWindowControls, 
  useCorrection, 
  useSettings, 
  useHistory,
  useClipboard 
} from './hooks';
import { CorrectionMode } from '../types/interfaces';

// Styled components
const AppContainer = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const TextPanelContainer = styled.div`
  flex: 1;
  display: flex;
  gap: 1px;
  background: #e1e5e9;
`;

const SidePanel = styled(motion.div)`
  position: absolute;
  top: 0;
  right: 0;
  width: 300px;
  height: 100%;
  background: white;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
`;

const PlaceholderPanel = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 8px;
  margin: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-size: 18px;
  color: #666;
`;

const App: React.FC = () => {
  // Local state
  const [inputText, setInputText] = useState('');
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>('business');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Use custom hooks
  const { hideWindow, minimizeWindow, closeWindow } = useWindowControls();
  const { correctText, isLoading, error, result, clearError } = useCorrection();
  const { settings, updateSettings } = useSettings();
  const { history, addToHistory } = useHistory(50);
  const { copyToClipboard } = useClipboard();

  // Handle text selection from main process
  useTextSelection((text: string) => {
    setInputText(text);
    clearError();
    
    // Auto-start correction if enabled in settings
    if (text.trim() && settings?.autoCorrect) {
      handleCorrectText(text);
    }
  });

  // Update correction mode from settings
  useEffect(() => {
    if (settings?.defaultMode) {
      setCorrectionMode(settings.defaultMode);
    }
  }, [settings]);

  // Auto-copy result to clipboard
  useEffect(() => {
    if (result && settings?.autoCopy) {
      copyToClipboard(result.text);
      
      // Save to history if enabled
      if (settings?.privacy.saveHistory) {
        addToHistory(inputText, result.text, correctionMode, result.model);
      }
    }
  }, [result]);

  // Handle text correction
  const handleCorrectText = async (text?: string) => {
    const textToCorrect = text || inputText;
    
    if (!textToCorrect.trim()) {
      return;
    }

    await correctText(textToCorrect, correctionMode);
  };

  // Handle input text change
  const handleInputChange = (text: string) => {
    setInputText(text);
    clearError();
  };

  // Handle correction mode change
  const handleModeChange = (mode: CorrectionMode) => {
    setCorrectionMode(mode);
  };

  // Handle settings toggle
  const handleSettingsToggle = () => {
    setShowSettings(!showSettings);
    setShowHistory(false);
  };

  // Handle history toggle
  const handleHistoryToggle = () => {
    setShowHistory(!showHistory);
    setShowSettings(false);
  };

  return (
    <AppContainer>
      {/* Placeholder Header */}
      <div style={{ 
        height: '60px', 
        background: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid #e1e5e9'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', color: '#333' }}>QuickCorrect</h1>
        <div>
          <button onClick={handleSettingsToggle} style={{ marginRight: '8px' }}>⚙️</button>
          <button onClick={handleHistoryToggle} style={{ marginRight: '8px' }}>📋</button>
          <button onClick={hideWindow} style={{ marginRight: '8px' }}>➖</button>
          <button onClick={closeWindow}>✕</button>
        </div>
      </div>
      
      <MainContent>
        <TextPanelContainer>
          {/* Input Panel */}
          <PlaceholderPanel>
            <div style={{ textAlign: 'center' }}>
              <h3>入力テキスト</h3>
              <p>{settings?.hotkey || 'Ctrl+T'} で選択したテキストがここに表示されます</p>
              <textarea 
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="または直接テキストを入力してください..."
                style={{
                  width: '90%',
                  height: '200px',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
              <br />
              <button 
                onClick={() => handleCorrectText()}
                disabled={isLoading || !inputText.trim()}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isLoading ? '添削中...' : '添削実行'}
              </button>
            </div>
          </PlaceholderPanel>
          
          {/* Output Panel */}
          <PlaceholderPanel>
            <div style={{ textAlign: 'center' }}>
              <h3>添削結果</h3>
              {isLoading ? (
                <p>AIが添削中です...</p>
              ) : result ? (
                <div>
                  <textarea 
                    value={result.text}
                    readOnly
                    style={{
                      width: '90%',
                      height: '200px',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                      backgroundColor: '#f8f9fa'
                    }}
                  />
                  <br />
                  {settings?.autoCopy && (
                    <p style={{ color: '#28a745', marginTop: '12px' }}>✅ クリップボードにコピー済み</p>
                  )}
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                    Model: {result.model} | 処理時間: {(result.processingTime / 1000).toFixed(1)}秒
                  </div>
                </div>
              ) : (
                <p>添削結果がここに表示されます</p>
              )}
              
              {error && (
                <p style={{ color: '#dc3545', marginTop: '12px' }}>❌ {error}</p>
              )}
            </div>
          </PlaceholderPanel>
        </TextPanelContainer>
        
        {/* Status Bar */}
        <div style={{
          height: '30px',
          background: '#f8f9fa',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: '12px',
          color: '#666',
          borderTop: '1px solid #e1e5e9'
        }}>
          文字数: {inputText.length} | モード: {correctionMode} | 状態: {isLoading ? '処理中' : 'スタンバイ'}
        </div>
      </MainContent>

      {/* Side Panels - Placeholder */}
      <AnimatePresence>
        {showSettings && (
          <SidePanel
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div style={{ padding: '20px' }}>
              <h3>設定</h3>
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <input 
                    type="checkbox" 
                    checked={settings?.autoCorrect || false}
                    onChange={(e) => updateSettings({ autoCorrect: e.target.checked })}
                  />
                  {' '}自動添削
                </label>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <input 
                    type="checkbox" 
                    checked={settings?.autoCopy || false}
                    onChange={(e) => updateSettings({ autoCopy: e.target.checked })}
                  />
                  {' '}自動コピー
                </label>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <input 
                    type="checkbox" 
                    checked={settings?.privacy.saveHistory || false}
                    onChange={(e) => updateSettings({ 
                      privacy: { ...settings?.privacy, saveHistory: e.target.checked } 
                    })}
                  />
                  {' '}履歴を保存
                </label>
              </div>
              <button onClick={() => setShowSettings(false)}>閉じる</button>
            </div>
          </SidePanel>
        )}
        
        {showHistory && (
          <SidePanel
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div style={{ padding: '20px' }}>
              <h3>履歴</h3>
              {history.length > 0 ? (
                <div style={{ marginTop: '20px', maxHeight: '400px', overflow: 'auto' }}>
                  {history.map((item, index) => (
                    <div key={item.id} style={{ 
                      padding: '10px', 
                      borderBottom: '1px solid #eee',
                      fontSize: '12px' 
                    }}>
                      <div style={{ fontWeight: 'bold' }}>{item.mode}</div>
                      <div style={{ color: '#666', marginTop: '4px' }}>
                        {item.originalText.substring(0, 50)}...
                      </div>
                      <div style={{ color: '#28a745', marginTop: '4px' }}>
                        → {item.correctedText.substring(0, 50)}...
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>履歴がありません</p>
              )}
              <button onClick={() => setShowHistory(false)}>閉じる</button>
            </div>
          </SidePanel>
        )}
      </AnimatePresence>
    </AppContainer>
  );
};

export default App;