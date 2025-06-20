# QuickCorrect

> AI-powered Japanese text correction desktop app with one-click workflow

## 🚀 Features

- **One-Click Correction**: Select text → Ctrl+T → Instantly get corrected text
- **Auto-Copy**: Corrected text is automatically copied to clipboard
- **Multiple AI Models**: Support for GPT-4, Claude, and more
- **Correction Modes**: Business, Academic, Casual, Presentation styles
- **History Management**: Track and reuse previous corrections
- **Cross-Platform**: Windows, macOS, Linux support

## 📋 Quick Start

1. Select any Japanese text in any application
2. Press `Ctrl+T` (or `Cmd+T` on Mac)
3. QuickCorrect window appears with corrected text
4. Corrected text is automatically copied to clipboard
5. Paste anywhere with `Ctrl+V`

## 🛠️ Tech Stack

- **Frontend**: Electron + React
- **Backend**: Node.js
- **Database**: SQLite
- **AI APIs**: OpenAI GPT-4, Anthropic Claude

## 📁 Project Structure

```
QuickCorrect/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React frontend
│   ├── models/         # Data models and AI integration
│   └── controllers/    # Business logic
├── docs/               # Documentation
├── tests/              # Test files
└── build/              # Build configuration
```

## 🔧 Development

```bash
# Clone repository
git clone https://github.com/TsuyoshiTomozawa/QuickCorrect.git
cd QuickCorrect

# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build
```

## 📖 Documentation

- [Requirements Specification](docs/requirements.md)
- [API Cost Analysis](docs/api-costs.md)
- [Development Guide](docs/development.md)
- [Deployment Guide](docs/deployment.md)

## 🎯 Roadmap

### Phase 1: MVP (1-2 months)
- [x] Project setup
- [ ] Basic UI implementation
- [ ] Hotkey functionality
- [ ] OpenAI API integration
- [ ] Local data storage

### Phase 2: Feature Expansion (1 month)
- [ ] Multiple correction modes
- [ ] History functionality
- [ ] Settings panel
- [ ] Error handling

### Phase 3: Commercialization (1 month)
- [ ] User authentication
- [ ] Payment system
- [ ] Installer creation
- [ ] Documentation

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📧 Contact

- GitHub: [@TsuyoshiTomozawa](https://github.com/TsuyoshiTomozawa)
- Project Link: [https://github.com/TsuyoshiTomozawa/QuickCorrect](https://github.com/TsuyoshiTomozawa/QuickCorrect)

---

**QuickCorrect** - Making Japanese text correction effortless 🎯