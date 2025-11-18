// Country configuration
// For US, label is full state name
// For others, label is full city name
const COUNTRY_ZONES = {
  US: [
    { timeZone: "America/New_York", label: "New York" },
    { timeZone: "America/Chicago", label: "Illinois" },
    { timeZone: "America/Denver", label: "Colorado" },
    { timeZone: "America/Los_Angeles", label: "California" },
    { timeZone: "America/Anchorage", label: "Alaska" },
    { timeZone: "Pacific/Honolulu", label: "Hawaii" }
  ],
  UK: [
    { timeZone: "Europe/London", label: "London" }
  ],
  CA: [
    { timeZone: "America/Toronto", label: "Toronto" },
    { timeZone: "America/Vancouver", label: "Vancouver" },
    { timeZone: "America/Edmonton", label: "Edmonton" },
    { timeZone: "America/Halifax", label: "Halifax" }
  ],
  AU: [
    { timeZone: "Australia/Sydney", label: "Sydney" },
    { timeZone: "Australia/Melbourne", label: "Melbourne" },
    { timeZone: "Australia/Perth", label: "Perth" },
    { timeZone: "Australia/Brisbane", label: "Brisbane" }
  ],
  JP: [
    { timeZone: "Asia/Tokyo", label: "Tokyo" }
  ],
  DE: [
    { timeZone: "Europe/Berlin", label: "Berlin" }
  ]
};

const MAX_DIFF_MINUTES = 10; // allowed difference

function getSelectedCountry() {
  return new Promise(resolve => {
    chrome.storage.sync.get({ country: "US" }, data => {
      resolve(data.country);
    });
  });
}

// Get current time in minutes from midnight for each zone in selected country
function getCurrentZoneTimes(countryCode) {
  const configs = COUNTRY_ZONES[countryCode] || [];
  const now = new Date();
  const result = [];

  for (const cfg of configs) {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: cfg.timeZone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });

      const parts = formatter.formatToParts(now);
      let hour = null;
      let minute = null;
      let dayPeriod = null;

      for (const p of parts) {
        if (p.type === "hour") hour = parseInt(p.value, 10);
        if (p.type === "minute") minute = parseInt(p.value, 10);
        if (p.type === "dayPeriod") dayPeriod = p.value;
      }

      if (hour == null || minute == null || !dayPeriod) continue;

      // Convert to 24h for difference math
      let h24 = hour % 12;
      if (dayPeriod.toLowerCase() === "pm") {
        h24 += 12;
      }
      const totalMinutes = h24 * 60 + minute;

      result.push({
        label: cfg.label,
        minutes: totalMinutes
      });
    } catch (e) {
      // ignore errors
    }
  }

  return result;
}

function timeStringToMinutes(timeStr, ampmStr) {
  const parts = timeStr.split(":");
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;

  let h24 = h % 12;
  const ampm = ampmStr.toLowerCase();
  if (ampm === "pm") {
    h24 += 12;
  }
  return h24 * 60 + m;
}

async function scanPage() {
  const country = await getSelectedCountry();
  const zoneTimes = getCurrentZoneTimes(country);

  if (zoneTimes.length === 0) {
    chrome.runtime.sendMessage({ type: "SET_BADGE", hasMatch: false });
    return;
  }

  // We still scan many elements to find the text,
  // but the badge will be added only to the closest <div> that contains it.
  const elements = document.querySelectorAll(
    "div, span, p, td, li, time, strong, b, i, h1, h2, h3, h4, h5, h6"
  );

  const regex = /(\d{1,2}:\d{2})\s?(AM|PM)\s+local time/i;
  let anyMatch = false;
  let bestLabel = null;
  let bestDiff = Infinity;

  let badgeFlag = 0;

  elements.forEach(el => {
    const text = el.textContent;
    if (!text) return;

    const match = text.match(regex);
    if (!match) return;

    const timePart = match[1];    // "02:35"
    const ampmRaw = match[2];     // "AM" or "PM"

    const minutes = timeStringToMinutes(timePart, ampmRaw);
    if (minutes == null) return;

    // Find the nearest div that contains this element
    const containerDiv = el.closest("div");
    if (!containerDiv) return;

 
    // Compare with each zone
    for (const zone of zoneTimes) {
      const diff = Math.abs(zone.minutes - minutes);
      if (diff <= MAX_DIFF_MINUTES) {
        anyMatch = true;

        // Highlight the div that has local time
        containerDiv.style.color = "#008800";

        // Add inline badge with full name - only once per div
        if (!containerDiv._timeBadgeAdded) {
          const badge = document.createElement("span");
          badge.textContent = ` ${zone.label}`;
          badge.style.backgroundColor = "green";
          badge.style.color = "white";
          badge.style.boxSizing = "border-box";
          badge.style.textWrap = "no-wrap";
          badge.style.borderRadius = "999px";
          badge.style.padding = "2px 4px";
          badge.style.marginLeft = "6px";
          badge.style.fontSize = "12px";
          badge.style.display = "inline-block";
          if (badgeFlag == 12 || badgeFlag == 20)
            containerDiv.appendChild(badge);
          badgeFlag++
          containerDiv._timeBadgeAdded = true;
        }

        // Track closest zone for toolbar badge
        if (diff < bestDiff) {
          bestDiff = diff;
          bestLabel = zone.label;
        }
      }
    }
  });

  chrome.runtime.sendMessage({
    type: "SET_BADGE",
    hasMatch: anyMatch,
    label: bestLabel
  });
}

function setupVisibilityListener() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      scanPage();
    }
  });
}

// Allow manual rescan from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RUN_SCAN") {
    scanPage();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    scanPage();
    setupVisibilityListener();
  });
} else {
  scanPage();
  setupVisibilityListener();
}
