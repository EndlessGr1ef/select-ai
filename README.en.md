# Select AI

An AI-powered selection search Chrome extension with context awareness. Select text on any webpage to get instant AI explanations.

[中文文档](./README.md)

## Features

- 🎯 **Instant Search** - Select text and click the floating button to get AI explanations
- 🧠 **Context Awareness** - Automatically extracts surrounding context for better understanding
- 🌍 **Multi-language Support** - Supports Chinese, English, Japanese, and Korean output
- ⚙️ **Customizable API** - Configure your own API endpoint and model
- 💬 **Markdown Rendering** - Beautiful markdown-formatted responses

## Installation

### Developer Mode (Recommended)

1. **Build the extension**
   ```bash
   cd select-ai
   pnpm install
   pnpm build
   ```

2. **Load in Chrome**
   - Open Chrome and visit `chrome://extensions/`
   - Enable **"Developer mode"** in the top right
   - Click **"Load unpacked"**
   - Select the `select-ai/dist` directory

3. **Configure API**
   - Click the extension icon
   - Go to "Settings" to configure your API Key
   - Optionally customize API endpoint and model

### Development Mode

```bash
cd select-ai
pnpm install
pnpm dev
```

Load the `dist` directory in Chrome. Changes will auto-reload.

## Usage

1. Select any text on a webpage
2. Click the floating button that appears
3. Wait for AI analysis and view the explanation

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Chrome Extension Manifest V3
- Tailwind CSS 4
- Lucide React (icons)

## Project Structure

```
select-ai/
├── src/
│   ├── main.tsx             # Popup entry point
│   ├── App.tsx              # Popup UI
│   ├── background/          # Service Worker
│   ├── content/             # Content scripts (selection feature)
│   ├── options/             # Settings page
│   └── utils/               # Utility functions
├── public/                  # Static assets
├── dist/                    # Build output
├── manifest.json            # Extension manifest
└── vite.config.ts           # Vite configuration
```

## API Configuration

This extension supports multiple AI APIs with independent configuration:

- **MiniMax** (default) - Uses MiniMax-M2.1 model
- **OpenAI** - Compatible with GPT-4o and other models
- **Anthropic Claude** - Compatible with Claude series models

Each provider can independently configure API Key, endpoint, and model.

## FAQ

### Q: Why doesn't the extension respond?
Ensure you have configured a valid API Key in settings.

### Q: Why doesn't the floating button appear?
Check if the page has Content Script restrictions. Some sites (like chrome:// pages) cannot inject content scripts.

### Q: What APIs are supported?
Any API with Anthropic-compatible format is supported.

## License

MIT
