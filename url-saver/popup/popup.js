function extractUrlsFromText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map(u => u.trim().replace(/[),.!?]+$/, "")).filter(Boolean);
}

function shouldIgnoreUrl(url) {
  return url.startsWith("https://pro.fiverr.com/inbox/");
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

function updateCount(el, label, count) {
  if (!el) return;
  el.textContent = `${label}: ${count}`;
}

// Simple wrappers to mimic chrome.storage.local using window.localStorage
function storageGet(keys, callback) {
  const result = {};
  keys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      result[key] = raw ? JSON.parse(raw) : undefined;
    } catch (e) {
      console.error("storageGet parse error for key", key, e);
      result[key] = undefined;
    }
  });
  callback(result);
}

function storageSet(obj, callback) {
  Object.entries(obj).forEach(([key, value]) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("storageSet error for key", key, e);
    }
  });
  if (typeof callback === "function") {
    callback();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("inputText");
  const urlListEl = document.getElementById("urlList");
  const statusEl = document.getElementById("status");
  const processBtn = document.getElementById("processBtn");
  const copyBtn = document.getElementById("copyBtn");
  const copyAllBtn = document.getElementById("copyAllBtn");
  const totalCountEl = document.getElementById("totalCount");
  const todayCountEl = document.getElementById("todayCount");
  const resetTodayBtn = document.getElementById("resetTodayBtn");
  const realCountEl = document.getElementById("realCount");
  const resetRealBtn = document.getElementById("resetRealBtn");
  const realInputEl = document.getElementById("realInput");
  const realAddBtn = document.getElementById("realAddBtn");
  const recentCountEl = document.getElementById("recentCount");

  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Load and display last new/different URLs and counts when popup opens
  storageGet(["lastNewUrls", "savedUrls", "savedCountsByDate", "savedRealCountsByDate"], (result) => {
    const lastNewUrlsRaw = result.lastNewUrls || [];
    const lastNewUrls = lastNewUrlsRaw.filter(u => !shouldIgnoreUrl(u));
    if (lastNewUrls.length > 0) {
      renderUrlList(lastNewUrls);
    }

    const savedRaw = result.savedUrls || [];
    const saved = savedRaw.filter(u => !shouldIgnoreUrl(u));
    const countsByDate = result.savedCountsByDate || {};
    const realCountsByDate = result.savedRealCountsByDate || {};
    const todayCount = countsByDate[todayKey] || 0;
    const todayRealCount = realCountsByDate[todayKey] || 0;

    updateCount(totalCountEl, "All", saved.length);
    updateCount(todayCountEl, "Today", todayCount);
    updateCount(realCountEl, "Real", todayRealCount);
    if (recentCountEl) {
      recentCountEl.textContent = `${lastNewUrls.length} new`;
    }
  });

  // Reset today's count to 0
  if (resetTodayBtn) {
    resetTodayBtn.addEventListener("click", () => {
      storageGet(["savedCountsByDate"], (result) => {
        const countsByDate = result.savedCountsByDate || {};
        countsByDate[todayKey] = 0;
        storageSet({ savedCountsByDate: countsByDate }, () => {
          updateCount(todayCountEl, "Today", 0);
        });
      });
    });
  }

  // Reset today's real URLs count to 0
  if (resetRealBtn) {
    resetRealBtn.addEventListener("click", () => {
      storageGet(["savedRealCountsByDate"], (result) => {
        const realCountsByDate = result.savedRealCountsByDate || {};
        realCountsByDate[todayKey] = 0;
        storageSet({ savedRealCountsByDate: realCountsByDate }, () => {
          updateCount(realCountEl, "Real", 0);
        });
      });
    });
  }

  // Add real URLs based on count of URLs in the small textarea
  if (realAddBtn && realInputEl) {
    realAddBtn.addEventListener("click", () => {
      const text = realInputEl.value || "";
      const realUrls = extractUrlsFromText(text).filter(u => !shouldIgnoreUrl(u));

      if (realUrls.length === 0) {
        statusEl.textContent = "No real URLs found in the small area.";
        return;
      }

      storageGet(["savedRealCountsByDate"], (result) => {
        const realCountsByDate = result.savedRealCountsByDate || {};
        const previousRealCount = realCountsByDate[todayKey] || 0;
        const newRealCount = previousRealCount + realUrls.length;
        realCountsByDate[todayKey] = newRealCount;

        storageSet({ savedRealCountsByDate: realCountsByDate }, () => {
          updateCount(realCountEl, "Real", newRealCount);
          statusEl.textContent = `Added ${realUrls.length} real URLs (total real today: ${newRealCount}).`;
          realInputEl.value = "";
        });
      });
    });
  }

  processBtn.addEventListener("click", () => {
    statusEl.textContent = "";
    renderUrlList([]);

    const text = inputEl.value || "";
    const urls = extractUrlsFromText(text).filter(u => !shouldIgnoreUrl(u));

    if (urls.length === 0) {
      statusEl.textContent = "No URLs found in input.";
      return;
    }

    storageGet(["savedUrls", "savedCountsByDate"], (result) => {
      const savedRaw = result.savedUrls || [];
      const saved = savedRaw.filter(u => !shouldIgnoreUrl(u));
      const savedSet = new Set(saved);
      const countsByDate = result.savedCountsByDate || {};

      const newUrls = urls.filter(u => !savedSet.has(u));

      if (newUrls.length > 0) {
        renderUrlList(newUrls);
        // Store the new URLs so they can be displayed when popup opens next time
        storageSet({ lastNewUrls: newUrls });
        if (recentCountEl) {
          recentCountEl.textContent = `${newUrls.length} new`;
        }
      } else {
        renderUrlList([]);
        statusEl.textContent = "No new URLs. All are already saved.";
      }

      const allUrlsSet = new Set([...saved, ...urls]);
      const allUrls = Array.from(allUrlsSet);

      // Update today's count
      const previousTodayCount = countsByDate[todayKey] || 0;
      const newTodayCount = previousTodayCount + newUrls.length;
      countsByDate[todayKey] = newTodayCount;

      storageSet({ savedUrls: allUrls, savedCountsByDate: countsByDate }, () => {
        if (newUrls.length > 0) {
          statusEl.textContent = `Saved ${allUrls.length} total URLs (${newUrls.length} new).`;
        } else {
          statusEl.textContent = `Saved ${allUrls.length} URLs (no new ones).`;
        }

        updateCount(totalCountEl, "All", allUrls.length);
        updateCount(todayCountEl, "Today", newTodayCount);
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
    storageGet(["savedUrls"], async (result) => {
      const savedRaw = result.savedUrls || [];
      const savedUrls = savedRaw.filter(u => !shouldIgnoreUrl(u));
      
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