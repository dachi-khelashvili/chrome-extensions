# Difference Finder Chrome Extension

A Chrome extension that compares two lists of URLs or words line by line and finds the differences.

## Features

- Two textareas for inputting lists line by line
- Compare URLs or words to find differences
- Display differences in a clean, readable format
- One-click copy to clipboard functionality
- Modern, user-friendly interface

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the `difference-finder` folder
5. The extension icon will appear in your Chrome toolbar

## Usage

1. Click the extension icon in your Chrome toolbar
2. Enter your first list in "List 1" textarea (one item per line)
3. Enter your second list in "List 2" textarea (one item per line)
4. Click "Find Differences" to compare the lists
5. Differences will be displayed in the results section
6. Click "Copy to Clipboard" to copy the differences

## Keyboard Shortcuts

- `Ctrl+Enter` (or `Cmd+Enter` on Mac) in either textarea to trigger comparison

## Notes

- Empty lines are automatically ignored
- Leading and trailing whitespace is trimmed from each line
- Duplicate differences are automatically removed

## Icon (Optional)

The extension will work without custom icons - Chrome will display a default icon. If you want to add custom icons, create PNG files:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)  
- `icon128.png` (128x128 pixels)

Then add the icon references back to `manifest.json` in the `action.default_icon` and `icons` sections.

