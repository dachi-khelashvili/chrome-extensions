# Auto Control — Type by Hotkey (Chrome Extension) — v0.3.0

Type snippets with hotkeys. This version adds **DevTools Protocol** typing via `chrome.debugger`, which many sites accept even when they block synthetic DOM events.

## Features
- 4 hotkey-triggered snippets (configurable text).
- **CDP typing (recommended):** Uses `Input.insertText` via DevTools Protocol for more "real" input.
- Fallback to **Type** (per-character, delay) or **Paste** modes.
- Adjustable per-character delay.

## Install (Developer Mode)
1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open `chrome://extensions/shortcuts` to set your hotkeys.
4. In **Options**, keep “Use DevTools Protocol typing” enabled (default), set fallback and delay.

## Usage
- Click into a text field or editor so it has the caret.
- Press your hotkey (e.g., Ctrl/Cmd+Shift+1…4).
- The extension tries CDP insert first. If Chrome prompts for debugging permission for that tab, click **Allow**.
- If CDP fails, it falls back to your selected mode.

## Notes
- `chrome.debugger` will briefly attach/detach to the active tab only when you trigger a hotkey.
- Some enterprise-managed Chromes may restrict the debugger permission.
- This extension does not send keystrokes outside Chrome.