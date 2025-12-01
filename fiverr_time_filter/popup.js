// popup.js

function renderTabs(tabs) {
  const container = document.getElementById("tabs-container");
  container.innerHTML = "";

  if (!tabs || tabs.length === 0) {
    container.textContent = "No Fiverr freelancer tabs with local time found.";
    return;
  }

  tabs.forEach((info) => {
    const line = document.createElement("div");
    line.className = "tab-item";

    const countriesText =
      info.countries && info.countries.length
        ? info.countries.join(", ")
        : "Unknown";

    // Format: Tab name - local time zone - possible country name(s)
    line.textContent = `${info.title || "Untitled tab"} – ${info.timezone} – ${countriesText}`;

    container.appendChild(line);
  });
}

function loadTabs() {
  chrome.runtime.sendMessage({ type: "GET_TABS_TIME_INFO" }, (response) => {
    if (chrome.runtime.lastError) {
      document.getElementById("tabs-container").textContent =
        "Error loading tabs.";
      return;
    }
    renderTabs(response?.tabs || []);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadTabs();

  const form = document.getElementById("filter-form");
  const input = document.getElementById("country-input");
  const statusEl = document.getElementById("status");

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