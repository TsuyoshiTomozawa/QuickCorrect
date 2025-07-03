
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Development
yarn dev             # Start app in development mode (renderer + main process)
yarn dev:renderer    # Start only renderer process
yarn dev:main        # Start only main process

# Testing & Quality
yarn test            # Run all Jest tests
yarn test:watch      # Run tests in watch mode
yarn lint            # Run ESLint
yarn format          # Run Prettier formatting

# Building
yarn build           # Build for production
yarn dist            # Create installer packages
```

## Architecture Overview

QuickCorrect is an Electron application following MVC architecture for Japanese text correction:

### Model Layer (`src/models/`)
- **AIProvider.ts**: Abstract base class defining the AI provider interface
- **OpenAIProvider.ts**: OpenAI GPT-4 implementation for text correction
- **HistoryManager.ts**: SQLite-based history storage and retrieval

### View Layer (`src/renderer/`)
- React components with TypeScript and styled-components
- **App.tsx**: Main component managing state and routing
- **TextInput.tsx**: Input field for text to be corrected
- **TextOutput.tsx**: Display area for corrected text

### Controller Layer (`src/controllers/`)
- **HotkeyController.ts**: Global hotkey registration and handling
- **CorrectionController.ts**: Orchestrates correction flow between model and view
- **ClipboardController.ts**: Manages clipboard operations

### Main Process (`src/main/`)
- **main.ts**: Electron main process handling window management and IPC

## Key Technical Details

- **IPC Channels**: Use consistent naming like `correction:request`, `clipboard:copy`
- **TypeScript**: All files must be TypeScript with proper type definitions
- **Error Handling**: Wrap API calls in try-catch with user-friendly error messages
- **Testing**: Write tests for all new controllers and models
- **State Management**: React state in App.tsx, no external state library needed

## Hotkey Configuration

The app supports customizable hotkeys through the settings panel:
- **Default Hotkey**: Cmd+T (macOS) / Ctrl+T (Windows/Linux)
- **HotkeyInput Component**: Custom component for capturing key combinations
- **Validation**: Prevents conflicts with common OS shortcuts
- **Dynamic Registration**: Hotkeys are re-registered automatically when changed
- **EventBus Integration**: Settings changes trigger hotkey updates via SETTINGS_CHANGED event

## Correction Modes

The app supports 4 correction modes, each with specific prompt engineering:
- Business: Formal, professional tone
- Academic: Technical accuracy, scholarly style
- Casual: Natural, conversational tone
- Presentation: Clear, impactful statements

When modifying AI prompts, ensure Japanese language correction remains the primary focus.

## Web Search
mcp-gemini-grounding を使用

## 開発方法について
TDDで開発してください。

- 期待する入力値と出力値のペアを具体的に提示
- テスト駆動開発を明示し、モック実装を避けるよう指導
- まだ存在しない機能に対してもテストを先行作成

## E2Eテスト (Playwright)

PlaywrightによるE2Eテストを実施して動作確認を行います：

```bash
# E2Eテストの実行
yarn test:e2e

# UI モードでの実行（デバッグ用）
yarn test:e2e:ui
```

### E2Eテスト作成時の注意点

- **テストファイル**: `tests/e2e/` ディレクトリに `*.spec.ts` として作成
- **セレクター**: `data-testid` 属性を優先的に使用
- **待機処理**: `waitForSelector` や `waitForTimeout` を適切に使用
- **テーマ切り替え**: 無限再レンダリングが発生しないことを確認
- **永続性テスト**: リロード後も設定が保持されることを確認

### 主要なE2Eテストケース

1. **テーマ適用**: ライト/ダーク/システムテーマが正しく適用される
2. **テーマ切り替え**: テーマ変更時に無限ループが発生しない
3. **設定の永続化**: リロード後もテーマ設定が維持される
4. **システム連携**: OSのテーマ設定に追従する（システムテーマ選択時）

## Gemini CLIについて
開発はGemini CLIに相談して
gemini CLIの起動コマンド

```
gemini
```