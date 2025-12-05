// popup.js

function formatTime(hours24, minutes) {
  if (hours24 === undefined || minutes === undefined) return "";
  
  let hours = hours24;
  const ampm = hours >= 12 ? "PM" : "AM";
  
  if (hours === 0) {
    hours = 12;
  } else if (hours > 12) {
    hours = hours - 12;
  }
  
  const hoursStr = hours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");
  return `${hoursStr}:${minutesStr} ${ampm}`;
}

function extractUsername(url) {
  if (!url) return "";
  const match = url.match(/https:\/\/pro\.fiverr\.com\/freelancers\/([^\/\?]+)/);
  return match ? match[1] : "";
}

function renderTabs(tabs) {
  const container = document.getElementById("tabs-container");
  container.innerHTML = "";

  if (!tabs || tabs.length === 0) {
    container.textContent = "No Fiverr freelancer tabs with local time found.";
    return;
  }

  // Create table
  const table = document.createElement("table");
  table.className = "tabs-table";

  tabs.forEach((info, index) => {
    const row = document.createElement("tr");
    row.className = "tab-row";

    const countriesText =
      info.countries && info.countries.length
        ? info.countries.join(", ")
        : "Unknown";

    const number = (index + 1).toString().padStart(2, "0");
    const username = extractUsername(info.url);
    const timeStr = formatTime(info.hours24, info.minutes);
    const timeAndTimezone = `${timeStr}, ${info.timezone}`;

    // Create cells: Number | @username | Time, Timezone | Countries
    const cell1 = document.createElement("td");
    cell1.textContent = number;
    cell1.className = "col-number";

    const cell2 = document.createElement("td");
    cell2.textContent = `@${username}`;
    cell2.className = "col-username";

    const cell3 = document.createElement("td");
    cell3.textContent = timeAndTimezone;
    cell3.className = "col-time";

    const cell4 = document.createElement("td");
    cell4.textContent = countriesText;
    cell4.className = "col-countries";

    row.appendChild(cell1);
    row.appendChild(cell2);
    row.appendChild(cell3);
    row.appendChild(cell4);

    table.appendChild(row);
  });

  container.appendChild(table);
}

function loadTabs() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TABS_TIME_INFO" }, (response) => {
      if (chrome.runtime.lastError) {
        document.getElementById("tabs-container").textContent =
          "Error loading tabs.";
        resolve([]);
        return;
      }
      const tabs = response?.tabs || [];
      renderTabs(tabs);
      resolve(tabs);
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestRecheck() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "RECHECK_TABS" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error("Unable to contact the extension background service."));
        return;
      }
      resolve(response?.tabCount || 0);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("filter-form");
  const input = document.getElementById("country-input");
  const statusEl = document.getElementById("status");
  const recheckButton = document.getElementById("recheck-button");
  const container = document.getElementById("tabs-container");

  async function syncTabs() {
    if (recheckButton.disabled) return;

    recheckButton.disabled = true;
    container.textContent = "Syncing tabs...";
    statusEl.textContent = "Refreshing Fiverr tabs...";

    try {
      const tabCount = await requestRecheck();
      statusEl.textContent = tabCount
        ? `Collecting local times from ${tabCount} tab(s)...`
        : "No Fiverr freelancer tabs detected.";

      const waitTime = tabCount ? Math.min(400 + tabCount * 60, 1500) : 250;
      await wait(waitTime);
      await loadTabs();
      statusEl.textContent = "";
    } catch (error) {
      container.textContent = "Unable to refresh Fiverr tabs.";
      statusEl.textContent = error?.message || "Failed to refresh tabs.";
    } finally {
      recheckButton.disabled = false;
    }
  }

  // Show cached data immediately if available, then refresh in background
  loadTabs();
  syncTabs();

  recheckButton.addEventListener("click", () => {
    syncTabs();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const country = (input.value || "").trim();

    if (!country) {
      statusEl.textContent = "Please type a country name first.";
      return;
    }

    statusEl.textContent = "Closing tabs not in this country timezone...";

    chrome.runtime.sendMessage(
      {
        type: "CLOSE_TABS_NOT_IN_COUNTRY",
        country
      },
      (response) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error closing tabs.";
          return;
        }

        const closed = response?.closed || 0;
        statusEl.textContent = `Closed ${closed} tab(s).`;

        // Refresh list after closing
        loadTabs();
      }
    );
  });
});