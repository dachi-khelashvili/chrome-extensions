# Auto Email Sender Chrome Extension

A Chrome extension that automates sending emails through Gmail with customizable waiting times and message rotation.

## Features

- Set min/max waiting times between emails (randomized)
- Configure waiting time after opening tab
- Configure waiting time after clicking send button
- Support for multiple emails (one per line)
- Support for multiple subjects (separated by " | ")
- Support for multiple messages (separated by " | ", supports \n for newlines)
- Automatic email rotation and sending

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `auto-email-sender` folder
5. The extension icon should appear in your toolbar

## Usage

1. Click the extension icon to open the popup
2. Configure your settings:
   - **Min/Max Waiting Time**: Random wait time between emails (in seconds)
   - **Wait After Open Tab**: Time to wait after opening Gmail compose page (in seconds)
   - **Wait After Send**: Time to wait after clicking send button (in seconds)
   - **Emails**: Enter one email per line
   - **Subjects**: Enter subjects separated by " | " (e.g., "Subject 1 | Subject 2 | Subject 3")
   - **Messages**: Enter messages separated by " | ". Use \n for newlines (e.g., "Message 1\nLine 2 | Message 2")
3. Click "Start Automation"
4. The extension will:
   - Open Gmail compose for each email
   - Fill in subject and message (rotating through your lists)
   - Send the email
   - Wait and close the tab
   - Process the next email

## Notes

- Make sure you're logged into Gmail before starting
- The extension will cycle through subjects and messages if there are fewer than emails
- You can stop the automation at any time using the "Stop Automation" button
- Settings are automatically saved

## Icons

The extension requires icon files (`icon16.png`, `icon48.png`, `icon128.png`). You can create simple icons or use placeholder images. The extension will work without icons, but Chrome may show a default icon.

## Permissions

- `tabs`: Required to open and close Gmail tabs
- `storage`: Required to save your settings
- `scripting`: Required to inject scripts into Gmail pages
- `https://mail.google.com/*`: Required to access Gmail

