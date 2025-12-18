// Content script for page interaction
// This file is loaded on all pages but the main automation logic is in background.js

// Browser compatibility layer
const browserAPI = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : 
                   (typeof browser !== 'undefined' && browser.runtime) ? browser : null;

// Listen for messages from background script
if (browserAPI && browserAPI.runtime) {
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'automate') {
      // Automation logic is handled in background.js via executeScript
      sendResponse({ success: true });
    }
    return true;
  });
}
