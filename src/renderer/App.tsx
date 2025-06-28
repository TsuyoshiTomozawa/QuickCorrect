/**
 * QuickCorrect - Main React Application Component
 *
 * This is the root component of the React application that runs in the renderer process.
 * It manages the overall application state and renders the main UI components.
 */

import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { TextInput, TextOutput, HotkeyInput } from "./components";
import {
  useTextSelection,
  useWindowControls,
  useCorrection,
  useSettings,
  useHistory,
  useClipboard,
} from "./hooks";
import {
  CorrectionMode,
  GEMINI_MODELS,
  GeminiModel,
} from "../types/interfaces";
import { ThemeProvider, useTheme, ThemeMode, getFocusShadow } from "./contexts/ThemeContext";

// Styled components
const AppContainer = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;
  transition: background 0.3s ease, color 0.3s ease;
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
  background: ${({ theme }) => theme.colors.border};
`;

const SidePanel = styled(motion.div)`
  position: absolute;
  top: 0;
  right: 0;
  width: 300px;
  height: 100%;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: -2px 0 10px ${({ theme }) => theme.colors.shadow};
  z-index: 1000;
  color: ${({ theme }) => theme.colors.text};
`;

const Header = styled.div`
  height: 60px;
  background: ${({ theme }) => theme.colors.surface};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h1`
  margin: 0;
  font-size: 20px;
  color: ${({ theme }) => theme.colors.text};
`;

const HeaderButton = styled.button`
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background 0.2s ease;
  
  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }

  &:focus {
    outline: none;
    box-shadow: ${({ theme }) => getFocusShadow(theme)};
  }

  &:focus:not(:focus-visible) {
    box-shadow: none;
  }
`;

const StatusBar = styled.div`
  height: 30px;
  background: ${({ theme }) => theme.colors.surface};
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSubtle};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const SettingsSection = styled.div`
  margin-top: 20px;
`;

const SettingsLabel = styled.label`
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: ${({ theme }) => theme.colors.text};
`;

const SettingsSelect = styled.select`
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const SettingsInput = styled.input`
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const CloseButton = styled.button`
  margin-top: 20px;
  padding: 8px 16px;
  background-color: ${({ theme }) => theme.colors.textSubtle};
  color: ${({ theme }) => theme.colors.textInverse};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.text};
  }
`;

const PanelContent = styled.div`
  padding: 20px;
  height: 100%;
  overflow-y: auto;
`;

const PanelTitle = styled.h3`
  margin: 0 0 20px 0;
  color: ${({ theme }) => theme.colors.text};
`;

const InputGroup = styled.div`
  margin-bottom: 10px;
`;

const SubLabel = styled.label`
  display: block;
  margin-bottom: 3px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
`;

const CheckboxLabel = styled.label`
  display: block;
  margin-bottom: 10px;
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  
  input {
    margin-right: 8px;
  }
`;

const NumberInput = styled.input`
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: ${({ theme }) => getFocusShadow(theme)};
  }
`;

const HistoryList = styled.div`
  margin-top: 20px;
  max-height: 400px;
  overflow: auto;
`;

const HistoryItem = styled.div`
  padding: 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 12px;
`;

const HistoryMode = styled.div`
  font-weight: bold;
  color: ${({ theme }) => theme.colors.text};
`;

const HistoryOriginal = styled.div`
  color: ${({ theme }) => theme.colors.textSubtle};
  margin-top: 4px;
`;

const HistoryCorrected = styled.div`
  color: ${({ theme }) => theme.colors.success};
  margin-top: 4px;
`;

const EmptyMessage = styled.p`
  color: ${({ theme }) => theme.colors.textSubtle};
`;

const App: React.FC = () => {
  // Local state
  const [inputText, setInputText] = useState("");
  const [correctionMode, setCorrectionMode] =
    useState<CorrectionMode>("business");
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Use custom hooks
  const { hideWindow, closeWindow } = useWindowControls();
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

    if (
      !textToCorrect ||
      typeof textToCorrect !== "string" ||
      !textToCorrect.trim()
    ) {
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
      <Header>
        <Title>QuickCorrect</Title>
        <div>
          <HeaderButton onClick={handleSettingsToggle} aria-label="設定を開く">
            ⚙️
          </HeaderButton>
          <HeaderButton onClick={handleHistoryToggle} aria-label="履歴を開く">
            📋
          </HeaderButton>
          <HeaderButton onClick={hideWindow} aria-label="ウィンドウを最小化">
            ➖
          </HeaderButton>
          <HeaderButton onClick={closeWindow} aria-label="ウィンドウを閉じる">✕</HeaderButton>
        </div>
      </Header>

      <MainContent>
        <TextPanelContainer>
          <TextInput
            value={inputText}
            onChange={handleInputChange}
            onCorrect={handleCorrectText}
            isLoading={isLoading}
            correctionMode={correctionMode}
            onModeChange={handleModeChange}
          />

          <TextOutput
            correctionResult={result}
            isLoading={isLoading}
            error={error}
            onApplyToInput={() => handleInputChange(result?.text || "")}
          />
        </TextPanelContainer>

        <StatusBar>
          文字数: {inputText.length} | モード: {correctionMode} | 状態:{" "}
          {isLoading ? "処理中" : "スタンバイ"}
        </StatusBar>
      </MainContent>

      {/* Side Panels - Placeholder */}
      <AnimatePresence>
        {showSettings && (
          <SidePanel
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <PanelContent>
              <PanelTitle>設定</PanelTitle>
              
              {/* Theme Selection */}
              <SettingsSection>
                <SettingsLabel htmlFor="themeSelect">
                  テーマ
                </SettingsLabel>
                <SettingsSelect
                  id="themeSelect"
                  value={settings?.appearance?.theme || "system"}
                  onChange={(e) => {
                    updateSettings({
                      appearance: {
                        theme: e.target.value as "light" | "dark" | "system",
                      },
                    });
                  }}
                >
                  <option value="system">システム設定に従う</option>
                  <option value="light">ライトモード</option>
                  <option value="dark">ダークモード</option>
                </SettingsSelect>
              </SettingsSection>

              {/* API Provider Selection */}
              <SettingsSection>
                <SettingsLabel htmlFor="aiProviderSelect">
                  AIプロバイダー
                </SettingsLabel>
                <SettingsSelect
                  id="aiProviderSelect"
                  value={settings?.aiSettings?.primaryProvider || "openai"}
                  onChange={(e) => {
                    updateSettings({
                      aiSettings: {
                        primaryProvider: e.target.value as
                          | "openai"
                          | "anthropic"
                          | "google",
                        temperature: settings?.aiSettings?.temperature ?? 0.7,
                        maxTokens: settings?.aiSettings?.maxTokens ?? 2000,
                        timeout: settings?.aiSettings?.timeout ?? 30000,
                      },
                    });
                  }}
                >
                  <option value="openai">OpenAI GPT-3.5</option>
                  <option value="google">Google Gemini Pro</option>
                </SettingsSelect>
              </SettingsSection>

              {/* API Keys */}
              <SettingsSection>
                <SettingsLabel>
                  APIキー
                </SettingsLabel>

                {/* OpenAI API Key */}
                {(settings?.aiSettings?.primaryProvider === "openai" ||
                  !settings?.aiSettings?.primaryProvider) && (
                  <InputGroup>
                    <SubLabel>
                      OpenAI
                    </SubLabel>
                    <SettingsInput
                      type="password"
                      value={settings?.apiKeys?.openai || ""}
                      onChange={(e) => {
                        updateSettings({
                          apiKeys: {
                            ...settings?.apiKeys,
                            openai: e.target.value,
                          },
                        });
                      }}
                      placeholder="sk-..."
                    />
                  </InputGroup>
                )}

                {/* Gemini API Key */}
                {settings?.aiSettings?.primaryProvider === "google" && (
                  <>
                    <InputGroup>
                      <SubLabel>
                        Google Gemini
                      </SubLabel>
                      <SettingsInput
                        type="password"
                        value={settings?.apiKeys?.google || ""}
                        onChange={(e) => {
                          updateSettings({
                            apiKeys: {
                              ...settings?.apiKeys,
                              google: e.target.value,
                            },
                          });
                        }}
                        placeholder="AIza..."
                      />
                    </InputGroup>
                    {/* Gemini Model Selection */}
                    <InputGroup>
                      <SubLabel>
                        Geminiモデル
                      </SubLabel>
                      <SettingsSelect
                        value={
                          settings?.aiSettings?.geminiModel ||
                          GEMINI_MODELS.FLASH_1_5
                        }
                        onChange={(e) => {
                          updateSettings({
                            aiSettings: {
                              ...settings?.aiSettings,
                              geminiModel: e.target.value as GeminiModel,
                            },
                          });
                        }}
                      >
                        <option value={GEMINI_MODELS.FLASH_2_0_EXP}>
                          Gemini 2.0 Flash (実験版)
                        </option>
                        <option value={GEMINI_MODELS.FLASH_1_5}>
                          Gemini 1.5 Flash
                        </option>
                        <option value={GEMINI_MODELS.FLASH_1_5_8B}>
                          Gemini 1.5 Flash 8B (最安価)
                        </option>
                      </SettingsSelect>
                    </InputGroup>
                  </>
                )}
              </SettingsSection>

              {/* Hotkey */}
              <SettingsSection>
                <HotkeyInput
                  value={settings?.hotkey || "CommandOrControl+T"}
                  onChange={(hotkey) => {
                    updateSettings({ hotkey });
                  }}
                  label="ホットキー"
                />

                <SettingsSection>
                  <CheckboxLabel>
                    <input
                      type="checkbox"
                      checked={settings?.autoCorrect || false}
                      onChange={(e) =>
                        updateSettings({ autoCorrect: e.target.checked })
                      }
                    />
                    自動添削
                  </CheckboxLabel>
                  <CheckboxLabel>
                    <input
                      type="checkbox"
                      checked={settings?.autoCopy || false}
                      onChange={(e) =>
                        updateSettings({ autoCopy: e.target.checked })
                      }
                    />
                    自動コピー
                  </CheckboxLabel>
                  <CheckboxLabel>
                    <input
                      type="checkbox"
                      checked={settings?.privacy.saveHistory || false}
                      onChange={(e) =>
                        updateSettings({
                          privacy: {
                            saveHistory: e.target.checked,
                            analyticsEnabled:
                              settings?.privacy?.analyticsEnabled ?? false,
                          },
                        })
                      }
                    />
                    履歴を保存
                  </CheckboxLabel>
                </SettingsSection>

                {/* AI Settings */}
                <SettingsSection>
                  <SettingsLabel>
                    AI設定
                  </SettingsLabel>
                  <InputGroup>
                    <SubLabel>
                      Temperature (0-2)
                    </SubLabel>
                    <NumberInput
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings?.aiSettings?.temperature ?? 0.7}
                      onChange={(e) => {
                        updateSettings({
                          aiSettings: {
                            primaryProvider:
                              settings?.aiSettings?.primaryProvider ?? "openai",
                            temperature: parseFloat(e.target.value),
                            maxTokens: settings?.aiSettings?.maxTokens ?? 2000,
                            timeout: settings?.aiSettings?.timeout ?? 30000,
                          },
                        });
                      }}
                    />
                  </InputGroup>
                  <InputGroup>
                    <SubLabel>
                      最大トークン数
                    </SubLabel>
                    <NumberInput
                      type="number"
                      min="100"
                      max="4000"
                      step="100"
                      value={settings?.aiSettings?.maxTokens ?? 2000}
                      onChange={(e) => {
                        updateSettings({
                          aiSettings: {
                            primaryProvider:
                              settings?.aiSettings?.primaryProvider ?? "openai",
                            temperature:
                              settings?.aiSettings?.temperature ?? 0.7,
                            maxTokens: parseInt(e.target.value),
                            timeout: settings?.aiSettings?.timeout ?? 30000,
                          },
                        });
                      }}
                    />
                  </InputGroup>
                </SettingsSection>
              </SettingsSection>
              <CloseButton onClick={() => setShowSettings(false)}>
                閉じる
              </CloseButton>
            </PanelContent>
          </SidePanel>
        )}

        {showHistory && (
          <SidePanel
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <PanelContent>
              <PanelTitle>履歴</PanelTitle>
              {history.length > 0 ? (
                <HistoryList>
                  {history.map((item) => (
                    <HistoryItem key={item.id}>
                      <HistoryMode>{item.mode}</HistoryMode>
                      <HistoryOriginal>
                        {item.originalText.substring(0, 50)}...
                      </HistoryOriginal>
                      <HistoryCorrected>
                        → {item.correctedText.substring(0, 50)}...
                      </HistoryCorrected>
                    </HistoryItem>
                  ))}
                </HistoryList>
              ) : (
                <EmptyMessage>履歴がありません</EmptyMessage>
              )}
              <CloseButton onClick={() => setShowHistory(false)}>閉じる</CloseButton>
            </PanelContent>
          </SidePanel>
        )}
      </AnimatePresence>
    </AppContainer>
  );
};

export default App;
