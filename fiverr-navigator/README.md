# Fiverr Navigator

A Chrome extension that allows you to navigate through Fiverr's contact list and send messages using keyboard shortcuts.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select this directory (`fiverr-navigator`)

## Usage

### Navigation Shortcuts

- **Page Down**: Navigate to the next contact in the list
- **Page Up**: Navigate to the previous contact in the list
- **Home**: Jump to the first contact

The extension automatically finds and clicks contacts in the Fiverr messaging interface, scrolling them into view as needed.

### Message Shortcuts

- **Space** (1st press): Click 👋 Hey button
- **Space** (2nd press): Add random message to textarea
- **Space** (3rd press): Click Send message button

The sequence resets after sending a message.

### Managing Messages

1. Click the extension icon to open the popup
2. Enter messages separated by ` | ` (pipe with spaces), e.g., `Hello! | Hi there! | Greetings!`
3. Click "Save Messages" to store them
4. The extension will randomly select one of your saved messages when you press Space (2nd press)

## Notes

- The extension only works on `pro.fiverr.com/inbox` pages
- Navigation shortcuts won't interfere with typing in input fields
- Message shortcuts work when you're in a conversation view
- Icon files are optional but recommended for Chrome Web Store submission

