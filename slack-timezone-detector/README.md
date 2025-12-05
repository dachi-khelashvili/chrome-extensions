# Slack Timezone Detector Chrome Extension

A Chrome extension that automatically detects local time from Slack messages and displays possible countries/timezones that match that time.

## Features

- 🔍 Automatically scans for time elements with class `p-local_time__text`
- 🌍 Shows possible countries and cities that are currently at that time
- ⚡ Works on all websites (not just Slack)
- 🔄 Automatically updates when new elements are added to the page

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the `slack-timezone-detector` folder
6. The extension is now installed and active!

## How It Works

The extension:
1. Scans the page for `<span class="p-local_time__text">` elements
2. Parses the time from text like "7:51 PM local time"
3. Compares it with the current UTC time to determine the timezone offset
4. Displays matching countries/cities next to the time element

## Example

When you see:
```
<span class="p-local_time__text">7:51 PM local time</span>
```

The extension will add:
```
🌍 New York, Toronto, Lima, Bogota (+X more)
```

## Icon Files

Note: You'll need to create icon files (`icon16.png`, `icon48.png`, `icon128.png`) for the extension. You can:
- Create simple icons using any image editor
- Use placeholder icons from online resources
- The extension will work without icons, but Chrome may show a warning

## Development

The extension consists of:
- `manifest.json` - Extension configuration
- `content.js` - Main script that runs on web pages

## Limitations

- Uses static timezone offset data (doesn't account for DST changes)
- Shows approximate matches (within 15 minutes)
- May show multiple timezones that are close but not exact

## License

MIT

