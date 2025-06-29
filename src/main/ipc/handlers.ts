/**
 * IPC Handlers - Main process handlers for IPC communication
 *
 * This module sets up all IPC handlers that bridge the renderer
 * process with the Model layer and other backend services.
 */

import { ipcMain, clipboard, app, systemPreferences } from "electron";
import * as os from "os";
import * as dotenv from "dotenv";
import {
  CorrectionMode,
  CorrectionHistory,
  AppSettings,
  HistorySearchOptions,
  Permissions,
} from "../../types/interfaces";
import { ProviderFactory, HistoryManager } from "../../models";
import { SettingsManager } from "../settings/SettingsManager";
import {
  validateCorrectionRequest,
  validateSettings,
} from "../validation/validators";
import * as path from "path";

// Load environment variables
dotenv.config();

// Initialize managers
let historyManager: HistoryManager;
let settingsManager: SettingsManager;
let aiProvider: any;

/**
 * Initialize IPC handlers and backend services
 */
export async function initializeIPCHandlers(): Promise<void> {
  const userDataPath = app.getPath("userData");

  // Initialize managers
  historyManager = new HistoryManager(userDataPath);
  settingsManager = new SettingsManager(userDataPath);

  // Initialize history database
  await historyManager.initialize();

  // Load settings and initialize AI provider
  const settings = await settingsManager.getSettings();
  const primaryProvider = settings.aiSettings?.primaryProvider || "openai";

  // First try to get API key from environment variable (for OpenAI only)
  const apiKeyFromEnv =
    primaryProvider === "openai" ? process.env.OPENAI_API_KEY : undefined;
  const apiKey = apiKeyFromEnv || settings.apiKeys?.[primaryProvider];

  if (apiKey) {
    configureAIProvider(primaryProvider, apiKey, settings.aiSettings);
  }

  // Register all IPC handlers
  registerCorrectionHandlers();
  registerSettingsHandlers();
  registerHistoryHandlers();
  registerClipboardHandlers();
  registerSystemHandlers();
}

/**
 * Configure AI provider with the given settings
 */
function configureAIProvider(
  primaryProvider: "openai" | "anthropic" | "google",
  apiKey: string,
  aiSettings?: Partial<AppSettings["aiSettings"]>
): void {
  aiProvider = ProviderFactory.createProvider(primaryProvider, {
    apiKey,
    temperature: aiSettings?.temperature,
    maxTokens: aiSettings?.maxTokens,
    geminiModel: aiSettings?.geminiModel,
  });
}

/**
 * Register text correction related handlers
 */
function registerCorrectionHandlers(): void {
  ipcMain.handle("correct-text", async (_event, text: string, mode: string) => {
    try {
      // Validate input
      const validation = validateCorrectionRequest({ text, mode });
      if (!validation.valid) {
        throw new Error(`Validation error: ${validation.errors.join(", ")}`);
      }

      // Check if AI provider is initialized
      if (!aiProvider) {
        const settings = await settingsManager.getSettings();
        const primaryProvider =
          settings.aiSettings?.primaryProvider || "openai";
        const providerName =
          primaryProvider === "openai"
            ? "OpenAI"
            : primaryProvider === "google"
              ? "Google Gemini"
              : "Anthropic";
        throw new Error(
          `APIキーが設定されていません。設定画面で${providerName} APIキーを入力してください。`,
        );
      }

      // Perform text correction
      const result = await aiProvider.correctText(text, mode as CorrectionMode);

      // Save to history if enabled
      const settings = await settingsManager.getSettings();
      if (settings.privacy?.saveHistory !== false) {
        await historyManager.addEntry({
          originalText: text,
          correctedText: result.text,
          mode: mode as CorrectionMode,
          model: result.model,
          favorite: false,
        });
      }

      return result;
    } catch (error: any) {
      console.error("Text correction error:", error);
      // Return a proper error object that can be serialized
      throw new Error(error.message || "Failed to correct text");
    }
  });
}

/**
 * Register settings related handlers
 */
function registerSettingsHandlers(): void {
  ipcMain.handle("get-settings", async () => {
    try {
      return await settingsManager.getSettings();
    } catch (error: any) {
      console.error("Get settings error:", error);
      throw {
        code: "SETTINGS_ERROR",
        message: "Failed to retrieve settings",
        details: error,
      };
    }
  });

  ipcMain.handle(
    "save-settings",
    async (_event, settings: Partial<AppSettings>) => {
      try {
        // Validate settings
        const validation = validateSettings(settings);
        if (!validation.valid) {
          throw new Error(`Validation error: ${validation.errors.join(", ")}`);
        }

        // Save settings
        await settingsManager.updateSettings(settings);

        // Re-initialize AI provider if API key changed
        if (settings.apiKeys) {
          const primaryProvider =
            settings.aiSettings?.primaryProvider || "openai";
          const apiKeyFromEnv =
            primaryProvider === "openai"
              ? process.env.OPENAI_API_KEY
              : undefined;
          const apiKey = apiKeyFromEnv || settings.apiKeys[primaryProvider];

          if (apiKey) {
            const fullSettings = await settingsManager.getSettings();
            configureAIProvider(primaryProvider, apiKey, {
              temperature:
                settings.aiSettings?.temperature ||
                fullSettings.aiSettings?.temperature,
              maxTokens:
                settings.aiSettings?.maxTokens ||
                fullSettings.aiSettings?.maxTokens,
              geminiModel:
                settings.aiSettings?.geminiModel ||
                fullSettings.aiSettings?.geminiModel,
            });
          }
        }

        return true;
      } catch (error: any) {
        console.error("Save settings error:", error);
        throw {
          code: "SETTINGS_ERROR",
          message: "Failed to save settings",
          details: error,
        };
      }
    },
  );
}

/**
 * Register history related handlers
 */
function registerHistoryHandlers(): void {
  ipcMain.handle("get-history", async (_event, limit?: number) => {
    try {
      return await historyManager.getHistory(limit);
    } catch (error: any) {
      console.error("Get history error:", error);
      throw {
        code: "HISTORY_ERROR",
        message: "Failed to retrieve history",
        details: error,
      };
    }
  });

  ipcMain.handle(
    "save-to-history",
    async (_event, history: Omit<CorrectionHistory, "id" | "timestamp">) => {
      try {
        const id = await historyManager.addEntry(history);
        return { success: true, id };
      } catch (error: any) {
        console.error("Save history error:", error);
        throw {
          code: "HISTORY_ERROR",
          message: "Failed to save to history",
          details: error,
        };
      }
    },
  );

  ipcMain.handle("delete-history", async (_event, id: string) => {
    try {
      return await historyManager.deleteEntry(id);
    } catch (error: any) {
      console.error("Delete history error:", error);
      throw {
        code: "HISTORY_ERROR",
        message: "Failed to delete history entry",
        details: error,
      };
    }
  });

  ipcMain.handle("clear-history", async () => {
    try {
      await historyManager.clearHistory();
      return true;
    } catch (error: any) {
      console.error("Clear history error:", error);
      throw {
        code: "HISTORY_ERROR",
        message: "Failed to clear history",
        details: error,
      };
    }
  });

  ipcMain.handle(
    "search-history",
    async (_event, options: HistorySearchOptions) => {
      try {
        return await historyManager.searchHistory(options);
      } catch (error: any) {
        console.error("Search history error:", error);
        throw {
          code: "HISTORY_ERROR",
          message: "Failed to search history",
          details: error,
        };
      }
    },
  );

  ipcMain.handle("get-history-stats", async () => {
    try {
      return await historyManager.getStats();
    } catch (error: any) {
      console.error("Get history stats error:", error);
      throw {
        code: "HISTORY_ERROR",
        message: "Failed to get history statistics",
        details: error,
      };
    }
  });

  ipcMain.handle("export-history", async (_event, format: "json" | "csv") => {
    try {
      const exportPath = path.join(
        app.getPath("downloads"),
        `quickcorrect-history-${Date.now()}.${format}`,
      );
      await historyManager.exportHistory(exportPath, format);
      return { success: true, path: exportPath };
    } catch (error: any) {
      console.error("Export history error:", error);
      throw {
        code: "HISTORY_ERROR",
        message: "Failed to export history",
        details: error,
      };
    }
  });
}

/**
 * Register clipboard related handlers
 */
function registerClipboardHandlers(): void {
  ipcMain.handle("copy-to-clipboard", async (_event, text: string) => {
    try {
      clipboard.writeText(text);
      return true;
    } catch (error: any) {
      console.error("Copy to clipboard error:", error);
      throw {
        code: "CLIPBOARD_ERROR",
        message: "Failed to copy to clipboard",
        details: error,
      };
    }
  });

  ipcMain.handle("get-clipboard-text", async () => {
    try {
      return clipboard.readText();
    } catch (error: any) {
      console.error("Get clipboard text error:", error);
      throw {
        code: "CLIPBOARD_ERROR",
        message: "Failed to read clipboard",
        details: error,
      };
    }
  });
}

/**
 * Register system related handlers
 */
function registerSystemHandlers(): void {
  ipcMain.handle("get-system-info", async () => {
    try {
      const totalMemory = os.totalmem();
      const usedMemory = totalMemory - os.freemem();

      return {
        platform: process.platform,
        version: os.release(),
        arch: os.arch(),
        memory: {
          total: totalMemory,
          used: usedMemory,
        },
      };
    } catch (error: any) {
      console.error("Get system info error:", error);
      throw {
        code: "SYSTEM_ERROR",
        message: "Failed to get system information",
        details: error,
      };
    }
  });

  ipcMain.handle("check-permissions", async () => {
    try {
      const permissions: Permissions = {
        accessibility: true,
        microphone: false,
        camera: false,
        notifications: true,
      };

      // macOS specific permission checks
      if (process.platform === "darwin") {
        permissions.accessibility =
          systemPreferences.isTrustedAccessibilityClient(false);

        // Check other permissions if available
        if (systemPreferences.getMediaAccessStatus) {
          permissions.microphone =
            systemPreferences.getMediaAccessStatus("microphone") === "granted";
          permissions.camera =
            systemPreferences.getMediaAccessStatus("camera") === "granted";
        }
      }

      return permissions;
    } catch (error: any) {
      console.error("Check permissions error:", error);
      throw {
        code: "SYSTEM_ERROR",
        message: "Failed to check permissions",
        details: error,
      };
    }
  });
}

/**
 * Clean up IPC handlers and close connections
 */
export async function cleanupIPCHandlers(): Promise<void> {
  try {
    if (historyManager) {
      await historyManager.close();
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}
