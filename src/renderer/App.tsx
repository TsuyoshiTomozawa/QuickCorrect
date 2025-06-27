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

// Styled components
const AppContainer = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;
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
      {/* Placeholder Header */}
      <div
        style={{
          height: "60px",
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid #e1e5e9",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "20px", color: "#333" }}>
          QuickCorrect
        </h1>
        <div>
          <button onClick={handleSettingsToggle} style={{ marginRight: "8px" }}>
            ⚙️
          </button>
          <button onClick={handleHistoryToggle} style={{ marginRight: "8px" }}>
            📋
          </button>
          <button onClick={hideWindow} style={{ marginRight: "8px" }}>
            ➖
          </button>
          <button onClick={closeWindow}>✕</button>
        </div>
      </div>

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

        {/* Status Bar */}
        <div
          style={{
            height: "30px",
            background: "#f8f9fa",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            fontSize: "12px",
            color: "#666",
            borderTop: "1px solid #e1e5e9",
          }}
        >
          文字数: {inputText.length} | モード: {correctionMode} | 状態:{" "}
          {isLoading ? "処理中" : "スタンバイ"}
        </div>
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
            <div style={{ padding: "20px", height: "100%", overflowY: "auto" }}>
              <h3>設定</h3>

              {/* API Provider Selection */}
              <div style={{ marginTop: "20px" }}>
                <label
                  htmlFor="aiProviderSelect"
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  AIプロバイダー
                </label>
                <select
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
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                  }}
                >
                  <option value="openai">OpenAI GPT-3.5</option>
                  <option value="google">Google Gemini Pro</option>
                </select>
              </div>

              {/* API Keys */}
              <div style={{ marginTop: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  APIキー
                </label>

                {/* OpenAI API Key */}
                {(settings?.aiSettings?.primaryProvider === "openai" ||
                  !settings?.aiSettings?.primaryProvider) && (
                  <div style={{ marginBottom: "10px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "3px",
                        fontSize: "14px",
                      }}
                    >
                      OpenAI
                    </label>
                    <input
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
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                )}

                {/* Gemini API Key */}
                {settings?.aiSettings?.primaryProvider === "google" && (
                  <>
                    <div style={{ marginBottom: "10px" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "3px",
                          fontSize: "14px",
                        }}
                      >
                        Google Gemini
                      </label>
                      <input
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
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ddd",
                        }}
                      />
                    </div>
                    {/* Gemini Model Selection */}
                    <div style={{ marginBottom: "10px" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "3px",
                          fontSize: "14px",
                        }}
                      >
                        Geminiモデル
                      </label>
                      <select
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
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid #ddd",
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
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Hotkey */}
              <div style={{ marginTop: "20px" }}>
                <HotkeyInput
                  value={settings?.hotkey || "CommandOrControl+T"}
                  onChange={(hotkey) => {
                    updateSettings({ hotkey });
                  }}
                  label="ホットキー"
                />

                <div style={{ marginTop: "20px" }}>
                  <label style={{ display: "block", marginBottom: "10px" }}>
                    <input
                      type="checkbox"
                      checked={settings?.autoCorrect || false}
                      onChange={(e) =>
                        updateSettings({ autoCorrect: e.target.checked })
                      }
                    />{" "}
                    自動添削
                  </label>
                  <label style={{ display: "block", marginBottom: "10px" }}>
                    <input
                      type="checkbox"
                      checked={settings?.autoCopy || false}
                      onChange={(e) =>
                        updateSettings({ autoCopy: e.target.checked })
                      }
                    />{" "}
                    自動コピー
                  </label>
                  <label style={{ display: "block", marginBottom: "10px" }}>
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
                    />{" "}
                    履歴を保存
                  </label>
                </div>

                {/* AI Settings */}
                <div style={{ marginTop: "20px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                    }}
                  >
                    AI設定
                  </label>
                  <div style={{ marginBottom: "10px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "3px",
                        fontSize: "14px",
                      }}
                    >
                      Temperature (0-2)
                    </label>
                    <input
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
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "3px",
                        fontSize: "14px",
                      }}
                    >
                      最大トークン数
                    </label>
                    <input
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
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  marginTop: "20px",
                  padding: "8px 16px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                閉じる
              </button>
            </div>
          </SidePanel>
        )}

        {showHistory && (
          <SidePanel
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div style={{ padding: "20px" }}>
              <h3>履歴</h3>
              {history.length > 0 ? (
                <div
                  style={{
                    marginTop: "20px",
                    maxHeight: "400px",
                    overflow: "auto",
                  }}
                >
                  {history.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #eee",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ fontWeight: "bold" }}>{item.mode}</div>
                      <div style={{ color: "#666", marginTop: "4px" }}>
                        {item.originalText.substring(0, 50)}...
                      </div>
                      <div style={{ color: "#28a745", marginTop: "4px" }}>
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
