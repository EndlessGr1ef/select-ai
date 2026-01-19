# Select AI 🎯

<div align="center">

**AI-powered Selection Search | Select to Explain | Context-aware**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)]()

</div>
<div align="center">

![Demo](demo_en.gif)

</div>

## ✨ Core Features

| Feature | Description | Use Case |
|---------|-------------|----------|
| 🎯 **Smart Selection** | Floating button appears on text selection, click to query | Get instant explanations |
| 🧠 **Context Awareness** | Auto-extract 500-3000 characters context for accurate AI understanding | Technical terms, complex sentences |
| 🚀 **Streaming Output** | Stream responses in real time as they are generated | Get answers faster |
| 🌐 **Multi-language** | Supports Chinese, English, Japanese, Korean output | Foreign language reading & learning |
| 🔌 **Multi-API Support** | MiniMax / OpenAI / Anthropic / DeepSeek / Zhipu AI / Custom API | Flexible deployment, self-hosted services |
| 💬 **Markdown Rendering** | AI responses displayed in beautiful Markdown format | Clear, readable output |
| 🔒 **Privacy First** | API keys stored locally, no user data collection | Secure usage |
| 📄 **Full Page Translation** | Auto-detect content, batch translate entire page | Foreign language websites |
| ✂️ **Selected Text** | Translate only selected text or paragraphs | Precise translation needs |
| 🔄 **Smart Cache** | Toggle display without re-requesting | Repeated viewing |
| ⚡ **Concurrent Translation** | Multi-paragraph parallel translation | Batch translation |

## 📖 Why Select AI?

| Traditional Dictionaries | Select AI |
|--------------------------|-----------|
| Words/phrases only | Full translation & explanation |
| Limited vocabulary, slow updates | AI real-time understanding, broader coverage |
| No context support | Auto context extraction, handles technical terms |
| Single function | Multi-language, multi-model, customizable |
| Paid subscriptions | Completely free, no hidden costs |
| Data uploaded to cloud | Local processing, safe and secure |

## 🚀 Quick Start

### Method 1: Direct Install (Recommended)

1. Download [chrome_extension.zip](chrome_extension.zip)
2. Extract to any directory
3. Open Chrome and visit `chrome://extensions/`
4. Enable **"Developer mode"** in the top right corner
5. Click **"Load unpacked"**
6. Select the extracted folder

### Method 2: Build from Source

```bash
cd select-ai
pnpm install
pnpm build
```

Then load the `select-ai/dist` directory in Chrome.

### 3. Configure API

1. Click the extension icon
2. Go to **"Settings"** to configure your API Key
3. Optionally customize API endpoint and model

## 🔧 Development

```bash
# Development mode (hot reload)
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## 💻 Usage

1. Select any text on a webpage
2. Click the pink-purple floating button
3. Wait for AI analysis and view the explanation

## 🔌 Supported APIs

This extension is compatible with any Anthropic-format API:

| Provider | Default Model | Description |
|----------|---------------|-------------|
| **MiniMax** | MiniMax-M2.1 | Ready to use out of the box |
| **OpenAI** | GPT-4o | Compatible with GPT series |
| **Anthropic** | Claude 3.5 | Compatible with Claude series |
| **DeepSeek** | DeepSeek Chat | Compatible with DeepSeek series |
| **Zhipu AI** | GLM-4.7 | Zhipu AI series models |
| **Custom** | - | Any Anthropic-format API |

## 🛠️ Tech Stack

<div align="center">

✨ **React 19** + TypeScript
⚡ **Vite 7** + HMR
🔒 **Manifest V3**
📦 **@crxjs/vite-plugin**
🎨 **Tailwind CSS 4**
📱 **Chrome Extension**

</div>

## 📁 Project Structure

```
select-ai/
├── src/
│   ├── main.tsx                    # Popup entry point
│   ├── App.tsx                     # Popup UI
│   ├── background/
│   │   └── index.ts                # Service Worker (API requests, streaming)
│   ├── content/
│   │   ├── index.tsx               # Content script entry
│   │   ├── ContentApp.tsx          # Main controller (selection detection & translation coordination)
│   │   ├── content.css             # Content script styles
│   │   ├── InlineTranslator.tsx    # Full-page/selection translator
│   │   ├── context/
│   │   │   └── TranslationContext.tsx  # Translation state management
│   │   ├── components/
│   │   │   ├── FloatingButton/     # Floating button (drag, click)
│   │   │   │   ├── index.ts
│   │   │   │   ├── FloatingButton.tsx
│   │   │   │   ├── useDraggable.ts
│   │   │   │   └── types.ts
│   │   │   ├── TranslationPanel/   # Translation result panel
│   │   │   │   ├── index.ts
│   │   │   │   ├── TranslationPanel.tsx
│   │   │   │   ├── BlockPanel.tsx
│   │   │   │   └── InlinePanel.tsx
│   │   │   └── TranslationContent/ # Translation content rendering
│   │   │       ├── index.ts
│   │   │       └── TranslationContent.tsx
│   │   ├── hooks/
│   │   │   ├── useTranslationStream.ts   # Streaming translation hook
│   │   │   └── useAbortController.ts     # Request abort control
│   │   └── utils/
│   │       ├── elementDetection.ts  # Main content element detection
│   │       ├── markdown.ts          # Markdown rendering
│   │       └── placeholder.ts       # Placeholder management
│   ├── options/
│   │   ├── index.tsx               # Options entry
│   │   └── OptionsApp.tsx          # Settings page UI
│   ├── utils/
│   │   ├── ContextExtractor.ts     # Context extraction (500-3000 chars)
│   │   ├── language.ts             # Language detection
│   │   ├── i18n.ts                 # Multi-language strings
│   │   ├── SiteBlacklist.ts        # Site blacklist
│   │   └── ContentPriority.ts      # Content priority algorithm
│   ├── assets/
│   │   └── react.svg
│   ├── App.css
│   └── index.css
├── public/
│   ├── icon.svg
│   ├── icon-16.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── icon.png
├── scripts/
│   └── convert-icon.cjs            # Icon conversion script
├── index.html                      # Popup HTML
├── options.html                    # Options HTML
├── manifest.json                   # Extension configuration
├── vite.config.ts                  # Vite build configuration
├── postcss.config.js               # PostCSS configuration
├── eslint.config.js                # ESLint configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json                    # Dependencies
└── README.md                       # This document
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

- 🐛 Found a bug? Please [open an issue](https://github.com/yourusername/select-ai/issues)
- 💡 Have an idea? Please [submit a Feature Request](https://github.com/yourusername/select-ai/issues)
- 🔧 Want to contribute? Fork and submit a PR

## 📝 FAQ

**Q: Why doesn't the extension respond?**
A: Make sure you have configured a valid API Key in settings.

**Q: Why doesn't the floating button appear?**
A: Check if the page has Content Script restrictions. Some sites (like `chrome://` pages) cannot inject content scripts.

**Q: What APIs are supported?**
A: Supports MiniMax, OpenAI, Anthropic, DeepSeek, Zhipu AI, and any custom API with Anthropic-compatible format.

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

<div align="center">

**If you find this project helpful, please give it a Star ⭐**

</div>
