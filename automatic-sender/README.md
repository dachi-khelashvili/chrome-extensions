# Automatic Sender Chrome Extension

A Chrome extension that automates sending messages to multiple URLs.

## Features

- Save multiple messages (one per line)
- Save multiple URLs (one per line)
- Automatically process each URL:
  - Opens URL in new tab
  - Waits 10 seconds
  - Clicks "Contact me" button
  - Waits 5 seconds
  - Clicks button starting with "👋 Hey"
  - Enters a random message from your saved messages
  - Clicks "Send message" button
  - Waits 10 seconds
  - Closes the tab
  - Moves to next URL

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `automatic-sender` folder
5. The extension icon should appear in your toolbar

## Usage

1. Click the extension icon to open the popup
2. Enter your messages in the "Messages" textarea (one message per line)
3. Click "Save Messages"
4. Enter your URLs in the "URLs" textarea (one URL per line)
5. Click "Save URLs"
6. Click "Start" to begin the automation process
7. Use "Stop" to halt the process at any time

## Notes

- The extension will process URLs one at a time
- Each URL is removed from the list after processing
- Messages are selected randomly for each URL
- The extension requires appropriate permissions to interact with web pages

## Icon Files

You'll need to create icon files (icon16.png, icon48.png, icon128.png) or the extension will show a default icon. You can use any image editor to create simple icons for the extension.

