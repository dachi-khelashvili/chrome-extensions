function extractUrlsFromText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map(u => u.trim().replace(/[),.!?]+$/, "")).filter(Boolean);
}

function renderUrlList(urls) {
  const urlListEl = document.getElementById("urlList");
  urlListEl.innerHTML = "";
  
  if (urls.length === 0) {
    return;
  }

  urls.forEach(url => {
    const item = document.createElement("div");
    item.className = "url-item";
    item.textContent = url;
    urlListEl.appendChild(item);
  });
}

function getUrlsFromList() {
  const urlListEl = document.getElementById("urlList");
  const items = urlListEl.querySelectorAll(".url-item");
  return Array.from(items).map(item => item.textContent.trim()).filter(Boolean);
}

document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("inputText");
  const urlListEl = document.getElementById("urlList");
  const statusEl = document.getElementById("status");
  const processBtn = document.getElementById("processBtn");
  const copyBtn = document.getElementById("copyBtn");
  const copyAllBtn = document.getElementById("copyAllBtn");

  // Load and display last new/different URLs when popup opens
  chrome.storage.local.get(["lastNewUrls"], (result) => {
    const lastNewUrls = result.lastNewUrls || [];
    if (lastNewUrls.length > 0) {
      renderUrlList(lastNewUrls);
    }
  });

  processBtn.addEventListener("click", () => {
    statusEl.textContent = "";
    renderUrlList([]);

    const text = inputEl.value || "";
    const urls = extractUrlsFromText(text);

    if (urls.length === 0) {
      statusEl.textContent = "No URLs found in input.";
      return;
    }

    chrome.storage.local.get(["savedUrls"], (result) => {
      const saved = result.savedUrls || [];
      const savedSet = new Set(saved);

      const newUrls = urls.filter(u => !savedSet.has(u));

      if (newUrls.length > 0) {
        renderUrlList(newUrls);
        // Store the new URLs so they can be displayed when popup opens next time
        chrome.storage.local.set({ lastNewUrls: newUrls });
      } else {
        renderUrlList([]);
        statusEl.textContent = "No new URLs. All are already saved.";
      }

      const allUrlsSet = new Set([...saved, ...urls]);
      const allUrls = Array.from(allUrlsSet);

      chrome.storage.local.set({ savedUrls: allUrls }, () => {
        if (newUrls.length > 0) {
          statusEl.textContent = `Saved ${allUrls.length} total URLs (${newUrls.length} new).`;
        } else {
          statusEl.textContent = `Saved ${allUrls.length} URLs (no new ones).`;
        }
      });
    });
  });

  copyBtn.addEventListener("click", async () => {
    const urls = getUrlsFromList();
    if (urls.length === 0) {
      statusEl.textContent = "Nothing to copy.";
      return;
    }

    const text = urls.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      statusEl.textContent = "New URLs copied to clipboard.";
    } catch (err) {
      console.error("Clipboard error:", err);
      statusEl.textContent = "Failed to copy. Please try again.";
    }
  });

  copyAllBtn.addEventListener("click", async () => {
    chrome.storage.local.get(["savedUrls"], async (result) => {
      const savedUrls = result.savedUrls || [];
      
      if (savedUrls.length === 0) {
        statusEl.textContent = "No saved URLs to copy.";
        return;
      }

      const text = savedUrls.join("\n");

      try {
        await navigator.clipboard.writeText(text);
        statusEl.textContent = `Copied ${savedUrls.length} saved URLs to clipboard.`;
      } catch (err) {
        console.error("Clipboard error:", err);
        statusEl.textContent = "Failed to copy. Please try again.";
      }
    });
  });
});