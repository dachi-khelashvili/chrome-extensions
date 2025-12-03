# Fiverr Assistant Chrome Extension

A Chrome extension that automates button clicks on Fiverr freelancer pages using the space key.

## Features

- Press **Space** key to cycle through clicking buttons:
  1. First press: Clicks button with title "Message ..."
  2. Second press: Clicks button with title "👋 Hey"
  3. Third press: Clicks button with title "Send message"
  4. Then cycles back to the first button

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this folder (`fiverr-assistant`)
5. The extension is now installed and active

## Usage

1. Navigate to any Fiverr freelancer page: `https://pro.fiverr.com/freelancers/...`
2. Press the **Space** key to trigger button clicks in sequence
3. The extension will automatically find and click the appropriate buttons

## Notes

- The extension only works on `pro.fiverr.com/freelancers/*` pages
- Space key is ignored when typing in input fields
- The extension resets to the first button when navigating to a new page

## Development

- `manifest.json` - Extension configuration
- `content.js` - Main script that handles key presses and button clicking

