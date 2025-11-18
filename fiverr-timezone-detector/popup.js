document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("countrySelect");
  const saveBtn = document.getElementById("saveBtn");
  const scanBtn = document.getElementById("scanBtn");

  chrome.storage.sync.get({ country: "US" }, data => {
    select.value = data.country;
  });

  saveBtn.addEventListener("click", () => {
    const country = select.value;
    chrome.storage.sync.set({ country }, () => {
      // Rescan current tab after saving
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs[0];
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: "RUN_SCAN" });
        }
      });
    });
  });

  scanBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "RUN_SCAN" });
      }
    });
  });
});
