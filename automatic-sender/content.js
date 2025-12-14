// Content script for page interaction
// This file is loaded on all pages but the main automation logic is in background.js

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'automate') {
    // Automation logic is handled in background.js via executeScript
    sendResponse({ success: true });
  }
  return true;
});

