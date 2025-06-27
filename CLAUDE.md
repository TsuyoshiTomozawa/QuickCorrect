
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

## Gemini　CLIに相談・レビューを受けながら作業
設計、実装計画、実装などgeminiに相談しながら作業
gemini CLIのコマンド

```
gemini
```

## Web Search
mcp-gemini-grounding を使用

## TDD
TDDで開発してください。

- 期待する入力値と出力値のペアを具体的に提示
- テスト駆動開発を明示し、モック実装を避けるよう指導
- まだ存在しない機能に対してもテストを先行作成

##　ブランチについて
修正、実装をする場合はmainブランチから作業ブランチを切って作業。
feature/{作業内容がわかるブランチ名を英語で}

## 並列実行ルール

**効率的な作業のため、独立したツール操作は並列実行を活用すること：**

### テスト・品質チェックの並列実行
```bash
# 良い例：品質チェックコマンドを並列実行
yarn lint & yarn test
```

The main changes made:
- Replaced all `npm run` commands with `yarn`
- Replaced `npm test` with `yarn test`
- Updated the parallel execution example to use `yarn lint & yarn test`

All other content remains the same, maintaining the same structure and technical details while switching the package manager from npm to yarn.

### 実装前計画フェーズ
**コード修正前に必ず実装計画を立案すること：**

1. **計画策定**: 実装アプローチ、影響範囲、依存関係を明確化
2. **設計検討**: アーキテクチャ、インターフェース、データ構造を決定
3. **タスク分解**: 実装を小さな単位に分割
4. **リスク評価**: 潜在的な問題点と対策を検討

**⚠️ 重要**: 計画フェーズではコードの修正は一切行わないこと

## ビルド確認ルール
実装・修正時は必ずビルドが通ることを確認すること
すべてのコード修正後、yarn build または yarn dev でエラーが発生しないことを確認する

作業時にローカルサーバーを起動した場合は、作業終了時に必ずサーバーを停止してください。