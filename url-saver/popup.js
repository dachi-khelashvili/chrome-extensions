function extractUrlsFromText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map(u => u.trim().replace(/[),.!?]+$/, "")).filter(Boolean);
}

document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("inputText");
  const outputEl = document.getElementById("outputText");
  const statusEl = document.getElementById("status");
  const processBtn = document.getElementById("processBtn");
  const copyBtn = document.getElementById("copyBtn");

  processBtn.addEventListener("click", () => {
    statusEl.textContent = "";
    outputEl.value = "";

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
        outputEl.value = newUrls.join("\n");
      } else {
        outputEl.value = "";
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
    const text = outputEl.value.trim();
    if (!text) {
      statusEl.textContent = "Nothing to copy.";
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      statusEl.textContent = "New URLs copied to clipboard.";
    } catch (err) {
      console.error("Clipboard error:", err);
      statusEl.textContent = "Failed to copy. You can select and copy manually.";
      outputEl.focus();
      outputEl.select();
    }
  });
});