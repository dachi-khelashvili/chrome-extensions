// background.js

const tabTimeInfo = {};

// Simple timezone mapping based on UTC offset in minutes
const TIMEZONES = [
  { offsetMinutes: 0, label: "UTC", countries: ["United Kingdom", "Portugal"] },
  { offsetMinutes: 60, label: "UTC+1", countries: ["Germany", "France", "Spain", "Italy", "Nigeria"] },
  { offsetMinutes: 120, label: "UTC+2", countries: ["Greece", "Israel", "South Africa"] },
  { offsetMinutes: 180, label: "UTC+3", countries: ["Turkey", "Saudi Arabia", "Kenya"] },
  { offsetMinutes: 330, label: "UTC+5:30", countries: ["India"] },
  { offsetMinutes: 480, label: "UTC+8", countries: ["China", "Singapore", "Malaysia"] },
  { offsetMinutes: 540, label: "UTC+9", countries: ["Japan", "South Korea"] },
  { offsetMinutes: -300, label: "UTC-5", countries: ["United States", "Canada"] },
  { offsetMinutes: -360, label: "UTC-6", countries: ["United States", "Mexico"] },
  { offsetMinutes: -420, label: "UTC-7", countries: ["United States", "Canada"] },
  { offsetMinutes: -480, label: "UTC-8", countries: ["United States", "Canada"] }
];

function normalizeOffset(minutes) {
  return Math.round(minutes / 30) * 30;
}

function getTimezoneInfo(offsetMinutes) {
  const norm = normalizeOffset(offsetMinutes);
  const found = TIMEZONES.find((tz) => tz.offsetMinutes === norm);
  if (found) return found;

  const hours = norm / 60;
  const sign = hours >= 0 ? "+" : "-";
  const abs = Math.abs(hours);
  const label =
    abs === 0 ? "UTC" : `UTC${sign}${Number.isInteger(abs) ? abs : abs.toFixed(1)}`;

  return {
    offsetMinutes: norm,
    label,
    countries: []
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOCAL_TIME_INFO" && sender.tab) {
    const tabId = sender.tab.id;
    const { localTimeText, offsetMinutes } = message;
    const tz = getTimezoneInfo(offsetMinutes);

    tabTimeInfo[tabId] = {
      tabId,
      url: sender.tab.url,
      title: sender.tab.title,
      localTimeText,
      offsetMinutes,
      timezone: tz.label,
      countries: tz.countries
    };

    sendResponse({ status: "ok" });
    return true;
  }

  if (message.type === "GET_TABS_TIME_INFO") {
    const list = Object.values(tabTimeInfo);
    sendResponse({ tabs: list });
    return true;
  }

  if (message.type === "CLOSE_TABS_NOT_IN_COUNTRY") {
    const rawCountry = (message.country || "").trim().toLowerCase();
    if (!rawCountry) {
      sendResponse({ closed: 0 });
      return true;
    }

    const toClose = [];

    for (const [tabIdStr, info] of Object.entries(tabTimeInfo)) {
      const matches = info.countries.some(
        (c) => c.toLowerCase() === rawCountry
      );

      if (!matches) {
        toClose.push(Number(tabIdStr));
      }
    }

    if (toClose.length) {
      chrome.tabs.remove(toClose, () => {
        toClose.forEach((id) => {
          delete tabTimeInfo[id];
        });
      });
    }

    sendResponse({ closed: toClose.length });
    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabTimeInfo[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    delete tabTimeInfo[tabId];
  }
});
