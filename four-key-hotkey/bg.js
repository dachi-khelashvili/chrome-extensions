const DEFAULTS = {
  // Each hotkey slot holds an array of messages; a random one is chosen when pressed.
  snippets: [
    ["Hello! 👋", "Hi there!", "Hey!"],
    ["On it—I'll send an update shortly.", "Working on it now.", "I'll circle back soon."],
    ["Thanks for the details. Here's what I found:", "Appreciate the info — summarizing below:"],
    ["Best regards,\nYour Name", "Kind regards,\nYour Name"]
  ],
  mode: "type",        // "type" | "paste"
  delayMs: 30,         // per-character delay when mode === "type"
  useCDP: true         // try DevTools Protocol insert first
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(["snippets","mode","delayMs","useCDP"]);
  const init = {};

  // Migrate/initialize snippets to array-of-arrays format
  if (!Array.isArray(data.snippets)) {
    init.snippets = DEFAULTS.snippets;
  } else {
    // If it's an array of strings, wrap each string in an array.
    if (data.snippets.length && typeof data.snippets[0] === "string") {
      init.snippets = data.snippets.map(s => [s].filter(Boolean));
    }
    // If it's an array but entries aren't arrays, coerce them.
    if (data.snippets.length && Array.isArray(data.snippets[0]) === false) {
      init.snippets = data.snippets.map(s => Array.isArray(s) ? s : [String(s || "")].filter(Boolean));
    }
  }

  if (!data.mode) init.mode = DEFAULTS.mode;
  if (typeof data.delayMs !== "number") init.delayMs = DEFAULTS.delayMs;
  if (typeof data.useCDP !== "boolean") init.useCDP = DEFAULTS.useCDP;
  if (Object.keys(init).length) await chrome.storage.sync.set(init);
});

chrome.commands.onCommand.addListener(async (command) => {
  const idx = ({
    "insert-snippet-1": 0,
    "insert-snippet-2": 1,
    "insert-snippet-3": 2,
    "insert-snippet-4": 3
  })[command];

  if (idx === undefined) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const { snippets = [], mode = "type", delayMs = 30, useCDP = true } = await chrome.storage.sync.get(["snippets","mode","delayMs","useCDP"]);

  // Normalize slot to an array of strings
  let slot = snippets[idx];
  if (!slot) return;
  if (typeof slot === "string") slot = [slot];               // backward-compat
  if (!Array.isArray(slot)) slot = [String(slot || "")];
  slot = slot.map(s => (s ?? "")).filter(s => String(s).trim().length > 0);
  if (!slot.length) return;

  // Pick a random message from this hotkey slot
  const text = slot[Math.floor(Math.random() * slot.length)];

  // Attempt CDP (DevTools Protocol) insert first if enabled
  if (useCDP) {
    try {
      await cdpInsert(tab.id, text);
      return;
    } catch (e) {
      console.warn("CDP insert failed, falling back:", e);
    }
  }

  // Fallback: content script (type/paste modes)
  let pong = null;
  try { pong = await chrome.tabs.sendMessage(tab.id, { ping: true }); } catch {}
  if (!pong) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  }
  await chrome.tabs.sendMessage(tab.id, { type: "INSERT_TEXT", text, mode, delayMs });
});

async function cdpInsert(tabId, text){
  const target = { tabId };
  // Attach to the tab's debugging protocol
  await chrome.debugger.attach(target, "1.3");
  try {
    // Ensure focus stays: a brief delay may help after hotkey
    await sleep(20);
    // Direct text insertion at the renderer caret (respects IME where possible)
    await chrome.debugger.sendCommand(target, "Input.insertText", { text });
  } finally {
    // Always detach to release the tab
    await chrome.debugger.detach(target);
  }
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
