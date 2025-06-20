# QuickCorrect IPC Integration

This directory contains the IPC (Inter-Process Communication) backend implementation that bridges the renderer process with the Model layer.

## Structure

```
main/
├── ipc/
│   └── handlers.ts      # All IPC handlers for renderer-main communication
├── preload/
│   └── preload.ts       # Secure context bridge for renderer
├── settings/
│   └── SettingsManager.ts # Application settings persistence
├── validation/
│   └── validators.ts    # Input validation for IPC security
└── main.ts              # Main process entry point
```

## Components

### IPC Handlers (`ipc/handlers.ts`)

Centralizes all IPC communication handlers:

- **Text Correction**: Integrates with AI providers from Model layer
- **Settings Management**: Load/save application settings
- **History Management**: CRUD operations for correction history
- **Clipboard Operations**: Secure clipboard access
- **System Information**: OS and permission checks

### Preload Script (`preload/preload.ts`)

Provides secure API exposure to renderer:

- Whitelisted channels only
- Input validation before IPC calls
- Type-safe API through ElectronAPI interface

### Settings Manager (`settings/SettingsManager.ts`)

Manages persistent application settings:

- Encrypted API key storage
- Settings validation and migration
- Default values management
- Import/export functionality

### Validators (`validation/validators.ts`)

Ensures data integrity and security:

- Input validation for all IPC calls
- Type checking and sanitization
- Path validation for file operations
- API key format validation

## Security Features

1. **Context Isolation**: Renderer has no direct access to Node.js
2. **Channel Whitelisting**: Only approved IPC channels allowed
3. **Input Validation**: All inputs validated before processing
4. **API Key Encryption**: Sensitive data encrypted at rest
5. **Path Validation**: File operations restricted to safe paths

## Integration with Model Layer

The IPC handlers integrate with the Model layer components:

```typescript
// In handlers.ts
import { ProviderFactory, HistoryManager } from '../../models';

// Initialize AI provider based on settings
const provider = ProviderFactory.createProvider('openai', {
  apiKey: settings.apiKeys.openai,
  temperature: settings.aiSettings.temperature
});

// Use provider for text correction
const result = await provider.correctText(text, mode);
```

## Usage Example

### Renderer Process

```typescript
// Using the exposed ElectronAPI
const result = await window.electronAPI.correctText(
  '今日わ会議があります',
  'business'
);

console.log(result.text); // '今日は会議があります'
```

### Main Process

The IPC handlers automatically:
1. Validate the input
2. Call the appropriate Model layer component
3. Save to history if enabled
4. Return the result to renderer

## Testing

Unit tests should cover:
- IPC handler functionality
- Input validation edge cases
- Settings persistence
- Error handling
- Security validation

## Implementation Status

- ✅ IPC handlers for Model integration (Issue #12)
- ✅ Data validation system
- ✅ Settings management
- ✅ Preload script with security
- ⏳ Full Model layer integration (pending merge)

## Notes

- The Model layer stubs are temporary and will be replaced when the actual Model implementation is merged
- All IPC communication is asynchronous
- Error handling returns structured error objects with codes