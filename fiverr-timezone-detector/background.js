chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ country: "US" });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SET_BADGE" && sender.tab) {
    if (msg.hasMatch) {
      const rawLabel = (msg.label || "").toString();
      const label = rawLabel.slice(0, 4); // toolbar badge is short
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: label });
      chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#00DD00" });
    } else {
      chrome.action.setBadgeText({ tabId: sender.tab.id, text: "" });
    }
  }
});
