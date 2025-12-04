# Discord Server Badge Filter

A lightweight Chrome extension that automatically filters Discord servers based on English-only content and member count criteria.

## Features

- 🚀 **Ultra-lightweight** - Optimized for minimal performance impact
- 🎯 **Smart Filtering** - Automatically dims servers that don't meet criteria
- 📊 **Real-time Stats** - View eligible servers in a modern popup interface
- ⚡ **Fast Processing** - Uses advanced caching and batch processing

## How It Works

The extension automatically:
- Scans Discord server cards on the discovery page
- Checks if server title and overview are English-only
- Verifies member count is above 500
- Dims servers that don't meet these criteria
- Shows eligible servers in the popup

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select this directory
5. Navigate to Discord's server discovery page to see it in action

## Project Structure

```
discord-badge-filter-v2/
├── src/
│   ├── content/          # Content script (runs on Discord pages)
│   │   └── content.js
│   ├── popup/            # Popup interface
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── styles/           # Content styles
│       └── content.css
├── assets/               # Extension icons (optional)
├── manifest.json         # Extension manifest
└── README.md
```

## Performance Optimizations

- **WeakMap Caching** - Avoids re-processing already evaluated cards
- **Incremental Processing** - Only processes new cards as they appear
- **Lazy Storage** - Only writes to storage when popup is opened
- **RequestIdleCallback** - Uses browser idle time for processing
- **Targeted MutationObserver** - Only watches for new cards, not entire DOM
- **Batch Operations** - Groups DOM operations for efficiency

## Development

The extension follows Chrome Extension Manifest V3 best practices:
- Minimal permissions (only `storage`)
- Content script runs at `document_idle` for better performance
- Modern ES6+ JavaScript with strict mode
- Clean separation of concerns

## License

MIT

