# QuickCorrect Model Layer

This directory contains the Model layer implementation for QuickCorrect, handling AI provider integrations and history management.

## Structure

```
models/
├── providers/           # AI provider implementations
│   ├── AIProvider.ts   # Base abstract class for all providers
│   └── OpenAIProvider.ts # OpenAI GPT-4 implementation
├── history/            # History management
│   └── HistoryManager.ts # SQLite-based history storage
└── index.ts           # Central exports and factory
```

## Components

### AIProvider (Base Class)

Abstract base class that defines the interface for all AI providers:

- **Core Methods**:
  - `correctText()`: Main correction method
  - `checkAvailability()`: Verify provider is accessible
  - `getUsageStats()`: Track API usage and costs

- **Features**:
  - Retry logic with exponential backoff
  - Consistent error handling
  - Input validation
  - Prompt generation for different correction modes

### OpenAIProvider

Implementation for OpenAI's GPT-4 model:

- Supports all correction modes (business, academic, casual, presentation)
- JSON-formatted responses for structured output
- Token usage tracking and cost calculation
- Automatic change detection and confidence scoring

### HistoryManager

SQLite-based storage for correction history:

- **Features**:
  - Store up to 100 correction pairs (configurable)
  - Search by text, mode, date range
  - Favorite marking
  - Export/import functionality (JSON/CSV)
  - Usage statistics

- **Database Schema**:
  - Unique constraint on (original_text, corrected_text, mode)
  - Indexed for fast timestamp and text searches
  - Metadata storage for additional context

## Usage Examples

### Creating a Provider

```typescript
import { ProviderFactory } from './models';

const provider = ProviderFactory.createProvider('openai', {
  apiKey: 'your-api-key',
  temperature: 0.7,
  maxTokens: 2000
});

const result = await provider.correctText(
  '今日わ会議があります',
  'business'
);
```

### Managing History

```typescript
import { HistoryManager } from './models';

const history = new HistoryManager('/path/to/userdata');
await history.initialize();

// Add entry
const id = await history.addEntry({
  originalText: '今日わ会議があります',
  correctedText: '今日は会議があります',
  mode: 'business',
  model: 'OpenAI GPT-4',
  favorite: false
});

// Search history
const results = await history.searchHistory({
  query: '会議',
  mode: 'business',
  limit: 10
});
```

## Implementation Status

- ✅ AI Provider base class (Issue #1)
- ✅ OpenAI provider implementation (Issue #2)
- ✅ History management (Issue #5)
- ⏳ Anthropic provider (Future)
- ⏳ Google provider (Future)

## Testing

Unit tests should cover:
- Provider initialization and configuration
- API error handling and retries
- History CRUD operations
- Search functionality
- Export/import features

## Security Considerations

- API keys are never logged or exposed
- SQLite database is stored in user data directory
- Input validation prevents injection attacks
- Rate limiting prevents API abuse