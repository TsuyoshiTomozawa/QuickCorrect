/**
 * QuickCorrect - Type Definitions
 *
 * This file contains all TypeScript interfaces and types used throughout the application.
 */

// Correction-related types
export interface CorrectionResult {
  text: string;
  explanation?: string;
  changes: CorrectionChange[];
  confidence: number;
  processingTime: number;
  model: string;
}

export interface CorrectionChange {
  original: string;
  corrected: string;
  reason: string;
  position: {
    start: number;
    end: number;
  };
}

export type CorrectionMode =
  | "business"
  | "academic"
  | "casual"
  | "presentation";

// Gemini model constants
export const GEMINI_MODELS = {
  FLASH_2_0_EXP: "gemini-2.0-flash-exp",
  FLASH_1_5: "gemini-1.5-flash",
  FLASH_1_5_8B: "gemini-1.5-flash-8b",
} as const;

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

// History-related types
export interface CorrectionHistory {
  id: string;
  originalText: string;
  correctedText: string;
  mode: CorrectionMode;
  timestamp: Date;
  model: string;
  favorite: boolean;
}

// Settings-related types
export interface AppSettings {
  apiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
  };
  defaultMode: CorrectionMode;
  hotkey: string;
  autoCorrect: boolean;
  autoCopy: boolean;
  windowSettings: {
    alwaysOnTop: boolean;
    opacity: number;
    position: {
      x: number;
      y: number;
    };
    size: {
      width: number;
      height: number;
    };
  };
  aiSettings: {
    primaryProvider: "openai" | "anthropic" | "google";
    temperature: number;
    maxTokens: number;
    timeout: number;
    geminiModel?: GeminiModel;
  };
  privacy: {
    saveHistory: boolean;
    analyticsEnabled: boolean;
  };
  appearance: {
    theme: "light" | "dark" | "system";
  };
}

// API-related types
export interface APIProvider {
  name: string;
  displayName: string;
  isAvailable: boolean;
  costPerToken: number;
  maxTokens: number;
}

export interface APIUsage {
  provider: string;
  tokensUsed: number;
  requestCount: number;
  cost: number;
  date: Date;
}

// UI-related types
export interface WindowState {
  isVisible: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      small: string;
      medium: string;
      large: string;
    };
  };
  spacing: {
    small: string;
    medium: string;
    large: string;
  };
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export type ErrorCode =
  | "API_ERROR"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "PERMISSION_ERROR"
  | "HOTKEY_ERROR"
  | "STORAGE_ERROR"
  | "UNKNOWN_ERROR";

// IPC types for Electron communication
export interface ElectronAPI {
  // Text correction
  correctText: (
    text: string,
    mode: CorrectionMode,
  ) => Promise<CorrectionResult>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<boolean>;

  // History
  getHistory: (limit?: number) => Promise<CorrectionHistory[]>;
  saveToHistory: (
    history: Omit<CorrectionHistory, "id" | "timestamp">,
  ) => Promise<boolean>;
  deleteHistory: (id: string) => Promise<boolean>;
  clearHistory: () => Promise<boolean>;

  // Window controls
  hideWindow: () => void;
  minimizeWindow: () => void;
  closeWindow: () => void;

  // Events
  onTextSelected: (callback: (text: string) => void) => void;
  removeAllListeners: (channel: string) => void;

  // Clipboard
  copyToClipboard: (text: string) => Promise<boolean>;
  getClipboardText: () => Promise<string>;

  // System
  getSystemInfo: () => Promise<SystemInfo>;
  checkPermissions: () => Promise<PermissionStatus>;
  platform: NodeJS.Platform;

  // Statistics
  getStatistics: () => Promise<Statistics>;

  // Debug
  getDebugInfo?: () => Promise<DebugInfo>;

  // Event listeners
  on?: (channel: string, callback: Function) => void;
  once?: (channel: string, callback: Function) => void;
}

export interface SystemInfo {
  platform: "win32" | "darwin" | "linux";
  version: string;
  arch: string;
  memory: {
    total: number;
    used: number;
  };
}

export interface PermissionStatus {
  accessibility: boolean;
  microphone: boolean;
  camera: boolean;
  notifications: boolean;
}

export interface DebugInfo {
  version: string;
  environment: "development" | "production" | "test";
  settings: AppSettings;
  systemInfo: SystemInfo;
  permissions: PermissionStatus;
  aiProvider: {
    name: string;
    isConfigured: boolean;
  };
  errors: Array<{
    timestamp: Date;
    message: string;
    stack?: string;
  }>;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Component prop types
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

// History search options
export interface HistorySearchOptions {
  query?: string;
  mode?: CorrectionMode;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  onlyFavorites?: boolean;
}

// Statistics interface
export interface Statistics {
  totalCorrections: number;
  correctionsByMode: Record<CorrectionMode, number>;
  averageProcessingTime: number;
  totalTokensUsed: number;
  mostUsedProvider: string;
  dailyUsage: Array<{
    date: string;
    count: number;
  }>;
}

// Permissions interface
export interface Permissions {
  accessibility: boolean;
  microphone: boolean;
  camera: boolean;
  notifications: boolean;
}

// Global declarations for window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
