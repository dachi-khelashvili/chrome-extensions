// background.js

const tabTimeInfo = {};

// Countries by continent
const COUNTRIES_BY_CONTINENT = {
  "Africa": [
    "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon", 
    "Central African Republic", "Chad", "Comoros", "Congo", "Côte d'Ivoire", "Djibouti", "Egypt", 
    "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", 
    "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", 
    "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", 
    "São Tomé and Príncipe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", 
    "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"
  ],
  "Asia": [
    "Afghanistan", "Armenia", "Azerbaijan", "Bahrain", "Bangladesh", "Bhutan", "Brunei", "Cambodia", 
    "China", "Cyprus", "Georgia", "India", "Indonesia", "Iran", "Iraq", "Israel", "Japan", "Jordan", 
    "Kazakhstan", "Kuwait", "Kyrgyzstan", "Laos", "Lebanon", "Malaysia", "Maldives", "Mongolia", 
    "Myanmar", "Nepal", "North Korea", "Oman", "Pakistan", "Palestine", "Philippines", "Qatar", 
    "Saudi Arabia", "Singapore", "South Korea", "Sri Lanka", "Syria", "Taiwan", "Tajikistan", 
    "Thailand", "Timor-Leste", "Turkey", "Turkmenistan", "United Arab Emirates", "Uzbekistan", 
    "Vietnam", "Yemen"
  ],
  "Europe": [
    "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", 
    "Croatia", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", 
    "Hungary", "Iceland", "Ireland", "Italy", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", 
    "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", 
    "Portugal", "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", 
    "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican City"
  ],
  "North America": [
    "Antigua and Barbuda", "Bahamas", "Barbados", "Belize", "Canada", "Costa Rica", "Cuba", 
    "Dominica", "Dominican Republic", "El Salvador", "Grenada", "Guatemala", "Haiti", "Honduras", 
    "Jamaica", "Mexico", "Nicaragua", "Panama", "Saint Kitts and Nevis", "Saint Lucia", 
    "Saint Vincent and the Grenadines", "Trinidad and Tobago", "United States"
  ],
  "South America": [
    "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", 
    "Suriname", "Uruguay", "Venezuela"
  ],
  "Oceania": [
    "Australia", "Fiji", "Kiribati", "Marshall Islands", "Micronesia", "Nauru", "New Zealand", 
    "Palau", "Papua New Guinea", "Samoa", "Solomon Islands", "Tonga", "Tuvalu", "Vanuatu"
  ]
};

// States/Provinces mapping for large countries by timezone offset
const STATES_BY_TIMEZONE = {
  "-300": { // UTC-5 (Eastern Time)
    "United States": ["Connecticut", "Delaware", "Florida", "Georgia", "Indiana (most)", "Maine", "Maryland", "Massachusetts", "Michigan (most)", "New Hampshire", "New Jersey", "New York", "North Carolina", "Ohio", "Pennsylvania", "Rhode Island", "South Carolina", "Vermont", "Virginia", "West Virginia", "Washington D.C."],
    "Canada": ["Ontario", "Quebec", "Nunavut"]
  },
  "-360": { // UTC-6 (Central Time)
    "United States": ["Alabama", "Arkansas", "Illinois", "Iowa", "Kansas", "Kentucky (western)", "Louisiana", "Minnesota", "Mississippi", "Missouri", "Nebraska (eastern)", "North Dakota (eastern)", "Oklahoma", "South Dakota (eastern)", "Tennessee (most)", "Texas (most)", "Wisconsin"],
    "Canada": ["Manitoba", "Saskatchewan (most)", "Ontario (northwestern)", "Nunavut (central)"]
  },
  "-420": { // UTC-7 (Mountain Time)
    "United States": ["Arizona", "Colorado", "Idaho (southern)", "Montana", "Nebraska (western)", "Nevada (most)", "New Mexico", "North Dakota (western)", "Oregon (eastern)", "South Dakota (western)", "Utah", "Wyoming"],
    "Canada": ["Alberta", "British Columbia (northeastern)", "Northwest Territories (most)", "Nunavut (western)", "Saskatchewan (western)"]
  },
  "-480": { // UTC-8 (Pacific Time)
    "United States": ["California", "Idaho (northern)", "Nevada (western)", "Oregon (western)", "Washington"],
    "Canada": ["British Columbia (most)", "Yukon"]
  },
  "-540": { // UTC-9 (Alaska Time)
    "United States": ["Alaska (most)"]
  },
  "-600": { // UTC-10 (Hawaii Time)
    "United States": ["Hawaii"]
  },
  "480": { // UTC+8 (Western Australia)
    "Australia": ["Western Australia"]
  },
  "570": { // UTC+9:30 (Central Australia)
    "Australia": ["Northern Territory", "South Australia"]
  },
  "600": { // UTC+10 (Eastern Australia)
    "Australia": ["Queensland", "New South Wales", "Victoria", "Tasmania", "Australian Capital Territory"]
  }
};

// Simple timezone mapping based on UTC offset in minutes
const TIMEZONES = [
  { offsetMinutes: 0, label: "UTC", countries: ["United Kingdom", "Portugal", "Ireland", "Iceland"] },
  { offsetMinutes: 60, label: "UTC+1", countries: ["Germany", "France", "Spain", "Italy", "Nigeria", "Algeria", "Poland", "Netherlands", "Belgium", "Switzerland", "Austria", "Sweden", "Norway", "Denmark", "Czech Republic", "Hungary", "Croatia", "Serbia", "Slovakia", "Slovenia", "Bosnia and Herzegovina", "North Macedonia", "Albania", "Tunisia", "Morocco", "Angola", "Cameroon", "Central African Republic", "Chad", "Congo", "Equatorial Guinea", "Gabon", "Niger", "Benin", "Togo"] },
  { offsetMinutes: 120, label: "UTC+2", countries: ["Greece", "Israel", "South Africa", "Egypt", "Finland", "Estonia", "Latvia", "Lithuania", "Romania", "Bulgaria", "Cyprus", "Ukraine", "Moldova", "Libya", "Sudan", "Rwanda", "Burundi", "Malawi", "Zambia", "Zimbabwe", "Botswana", "Lesotho", "Eswatini", "Namibia"] },
  { offsetMinutes: 180, label: "UTC+3", countries: ["Turkey", "Saudi Arabia", "Kenya", "Iraq", "Russia (Moscow)", "Belarus", "Ethiopia", "Eritrea", "Djibouti", "Somalia", "Tanzania", "Uganda", "Madagascar", "Comoros", "Mayotte"] },
  { offsetMinutes: 240, label: "UTC+4", countries: ["United Arab Emirates", "Mauritius", "Seychelles", "Armenia", "Azerbaijan", "Georgia", "Oman", "Réunion"] },
  { offsetMinutes: 270, label: "UTC+4:30", countries: ["Afghanistan"] },
  { offsetMinutes: 300, label: "UTC+5", countries: ["Pakistan", "Uzbekistan", "Turkmenistan", "Tajikistan", "Kazakhstan (western)", "Maldives"] },
  { offsetMinutes: 330, label: "UTC+5:30", countries: ["India", "Sri Lanka"] },
  { offsetMinutes: 345, label: "UTC+5:45", countries: ["Nepal"] },
  { offsetMinutes: 360, label: "UTC+6", countries: ["Bangladesh", "Kyrgyzstan", "Bhutan", "Kazakhstan (eastern)"] },
  { offsetMinutes: 390, label: "UTC+6:30", countries: ["Myanmar"] },
  { offsetMinutes: 420, label: "UTC+7", countries: ["Thailand", "Vietnam", "Laos", "Cambodia", "Indonesia (western)", "Mongolia (western)"] },
  { offsetMinutes: 480, label: "UTC+8", countries: ["China", "Singapore", "Malaysia", "Philippines", "Taiwan", "Brunei", "Indonesia (central)", "Mongolia (central)", "Australia"] },
  { offsetMinutes: 540, label: "UTC+9", countries: ["Japan", "South Korea", "Indonesia (eastern)", "Timor-Leste", "Palau", "North Korea"] },
  { offsetMinutes: 570, label: "UTC+9:30", countries: ["Australia"] },
  { offsetMinutes: 600, label: "UTC+10", countries: ["Australia", "Papua New Guinea", "Guam", "Northern Mariana Islands"] },
  { offsetMinutes: 660, label: "UTC+11", countries: ["New Caledonia", "Vanuatu", "Solomon Islands", "Norfolk Island"] },
  { offsetMinutes: 720, label: "UTC+12", countries: ["New Zealand", "Fiji", "Kiribati", "Marshall Islands", "Nauru", "Tuvalu", "Wake Island"] },
  { offsetMinutes: -60, label: "UTC-1", countries: ["Cabo Verde", "Azores"] },
  { offsetMinutes: -120, label: "UTC-2", countries: ["South Georgia", "Mid-Atlantic"] },
  { offsetMinutes: -180, label: "UTC-3", countries: ["Argentina", "Brazil (eastern)", "Uruguay", "Chile", "French Guiana", "Suriname", "Falkland Islands"] },
  { offsetMinutes: -240, label: "UTC-4", countries: ["Venezuela", "Bolivia", "Paraguay", "Brazil (western)", "Guyana", "Barbados", "Trinidad and Tobago", "Dominica", "Grenada", "Saint Lucia", "Saint Vincent and the Grenadines", "Antigua and Barbuda", "Saint Kitts and Nevis", "Anguilla", "Montserrat", "British Virgin Islands", "Puerto Rico", "US Virgin Islands"] },
  { offsetMinutes: -300, label: "UTC-5", countries: ["United States", "Canada", "Colombia", "Ecuador", "Peru", "Panama", "Jamaica", "Haiti", "Cuba", "Bahamas", "Cayman Islands", "Turks and Caicos"] },
  { offsetMinutes: -360, label: "UTC-6", countries: ["United States", "Canada", "Mexico (Central)", "Guatemala", "El Salvador", "Honduras", "Nicaragua", "Costa Rica", "Belize", "Easter Island"] },
  { offsetMinutes: -420, label: "UTC-7", countries: ["United States", "Canada", "Mexico (Sonora)", "Arizona (no DST)"] },
  { offsetMinutes: -480, label: "UTC-8", countries: ["United States", "Canada", "Mexico (Baja California)", "Pitcairn Islands"] },
  { offsetMinutes: -540, label: "UTC-9", countries: ["United States", "French Polynesia (Gambier)"] },
  { offsetMinutes: -600, label: "UTC-10", countries: ["United States", "French Polynesia (most)", "Cook Islands"] },
  { offsetMinutes: -660, label: "UTC-11", countries: ["American Samoa", "Niue", "Midway Island"] },
  { offsetMinutes: -720, label: "UTC-12", countries: ["Baker Island", "Howland Island"] }
];

function normalizeOffset(minutes) {
  return Math.round(minutes / 30) * 30;
}

function formatCountryWithStates(country, offsetMinutes) {
  const offsetKey = offsetMinutes.toString();
  const statesData = STATES_BY_TIMEZONE[offsetKey];
  
  if (!statesData || !statesData[country]) {
    return country;
  }
  
  const states = statesData[country];
  if (states && states.length > 0) {
    // Show all states: "United States(Ohio, Michigan, New York, ...)"
    // Limit to first 5 states to keep it readable, or show all if 5 or fewer
    if (states.length <= 5) {
      return `${country}(${states.join(", ")})`;
    } else {
      return `${country}(${states.slice(0, 5).join(", ")}, ...)`;
    }
  }
  
  return country;
}

function getTimezoneInfo(offsetMinutes) {
  const norm = normalizeOffset(offsetMinutes);
  const found = TIMEZONES.find((tz) => tz.offsetMinutes === norm);
  
  if (found) {
    // Format countries with states for US, Canada, Australia
    const formattedCountries = found.countries.map(country => {
      if (country === "United States" || country === "Canada" || country === "Australia") {
        return formatCountryWithStates(country, norm);
      }
      return country;
    });
    
    return {
      offsetMinutes: found.offsetMinutes,
      label: found.label,
      countries: formattedCountries,
      rawCountries: found.countries // Keep original for filtering
    };
  }

  const hours = norm / 60;
  const sign = hours >= 0 ? "+" : "-";
  const abs = Math.abs(hours);
  const label =
    abs === 0 ? "UTC" : `UTC${sign}${Number.isInteger(abs) ? abs : abs.toFixed(1)}`;

  return {
    offsetMinutes: norm,
    label,
    countries: [],
    rawCountries: []
  };
}

function getCountriesByContinent() {
  return COUNTRIES_BY_CONTINENT;
}

function getStatesForCountry(country, offsetMinutes) {
  const offsetKey = offsetMinutes.toString();
  const statesData = STATES_BY_TIMEZONE[offsetKey];
  if (!statesData || !statesData[country]) {
    return [];
  }
  return statesData[country];
}

function getCountriesForTimezone(offsetMinutes) {
  const tz = getTimezoneInfo(offsetMinutes);
  return tz.rawCountries || tz.countries || [];
}

function getPreferredLocation() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["preferredLocation"], (result) => {
      resolve(result.preferredLocation || "");
    });
  });
}

function setPreferredLocation(country) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ preferredLocation: country }, () => {
      resolve();
    });
  });
}

function injectContentScript(tabId) {
  // First clear the processed flag, then inject content script
  chrome.scripting.executeScript(
    {
      target: { tabId },
      func: () => {
        if (window.__fiverrLocalTimeProcessed) {
          delete window.__fiverrLocalTimeProcessed;
        }
      }
    },
    () => {
      if (chrome.runtime.lastError) {
        return;
      }
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ["contentScript.js"]
        },
        () => {
          // Ignore errors (tab might not be accessible)
        }
      );
    }
  );
}

function triggerRecheck(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "RECHECK" }, () => {
    if (chrome.runtime.lastError) {
      injectContentScript(tabId);
    }
  });
}

// Inject content script into all existing Fiverr tabs on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ url: "https://pro.fiverr.com/freelancers/*" }, (tabs) => {
    tabs.forEach((tab) => {
      triggerRecheck(tab.id);
    });
  });
});

// Also inject when extension is installed/reloaded
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: "https://pro.fiverr.com/freelancers/*" }, (tabs) => {
    tabs.forEach((tab) => {
      triggerRecheck(tab.id);
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOCAL_TIME_INFO" && sender.tab) {
    const tabId = sender.tab.id;
    const { localTimeText, offsetMinutes, hours24, minutes } = message;
    const tz = getTimezoneInfo(offsetMinutes);
    
    getPreferredLocation().then(preferredLocation => {
      tabTimeInfo[tabId] = {
        tabId,
        url: sender.tab.url,
        title: sender.tab.title,
        localTimeText,
        hours24,
        minutes,
        offsetMinutes,
        timezone: tz.label,
        countries: tz.countries,
        rawCountries: tz.rawCountries || tz.countries,
        hasLocalTime: true,
        isPreferredLocation: preferredLocation ? (tz.rawCountries || tz.countries).some(c => c.toLowerCase() === preferredLocation.toLowerCase()) : false
      };
      sendResponse({ status: "ok" });
    });
    return true;
  }

  if (message.type === "NO_LOCAL_TIME" && sender.tab) {
    const tabId = sender.tab.id;

    tabTimeInfo[tabId] = {
      tabId,
      url: sender.tab.url,
      title: sender.tab.title,
      hasLocalTime: false,
      isPreferredLocation: false
    };

    sendResponse({ status: "ok" });
    return true;
  }

  if (message.type === "GET_TABS_TIME_INFO") {
    getPreferredLocation().then(preferredLocation => {
      // Get all pro.fiverr.com tabs and ensure they're in the list
      chrome.tabs.query({ url: "https://pro.fiverr.com/freelancers/*" }, (tabs) => {
        tabs.forEach((tab) => {
          if (!tabTimeInfo[tab.id]) {
            // Tab exists but hasn't sent time info yet
            tabTimeInfo[tab.id] = {
              tabId: tab.id,
              url: tab.url,
              title: tab.title,
              hasLocalTime: false,
              isPreferredLocation: false
            };
          }
        });
        
        // Update preferred location status for all tabs
        const list = Object.values(tabTimeInfo)
          .filter(info => tabs.some(tab => tab.id === info.tabId)) // Only include tabs that still exist
          .map(info => {
            if (info.hasLocalTime && preferredLocation) {
              const countriesToCheck = info.rawCountries || info.countries;
              info.isPreferredLocation = countriesToCheck.some(c => {
                const countryName = c.toLowerCase();
                const prefLocation = preferredLocation.toLowerCase();
                return countryName === prefLocation || countryName.includes(prefLocation) || prefLocation.includes(countryName);
              });
            }
            return info;
          });
        
        sendResponse({ tabs: list });
      });
    });
    return true;
  }

  if (message.type === "GET_COUNTRIES_BY_CONTINENT") {
    sendResponse({ countriesByContinent: getCountriesByContinent() });
    return true;
  }

  if (message.type === "GET_STATES_FOR_COUNTRY") {
    const states = getStatesForCountry(message.country, message.offsetMinutes);
    sendResponse({ states });
    return true;
  }

  if (message.type === "GET_COUNTRIES_FOR_TIMEZONE") {
    const countries = getCountriesForTimezone(message.offsetMinutes);
    sendResponse({ countries });
    return true;
  }

  if (message.type === "SET_PREFERRED_LOCATION") {
    setPreferredLocation(message.country || "").then(() => {
      sendResponse({ status: "ok" });
    });
    return true;
  }

  if (message.type === "GET_PREFERRED_LOCATION") {
    getPreferredLocation().then(preferredLocation => {
      sendResponse({ preferredLocation });
    });
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
      const countriesToCheck = info.rawCountries || info.countries;
      const matches = countriesToCheck.some(
        (c) => {
          const countryName = c.toLowerCase();
          return countryName === rawCountry || countryName.includes(rawCountry) || rawCountry.includes(countryName);
        }
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
        sendResponse({ closed: toClose.length });
      });
    } else {
      sendResponse({ closed: 0 });
    }
    return true;
  }

  if (message.type === "CLOSE_TABS_NOT_IN_PREFERRED_LOCATION") {
    getPreferredLocation().then(preferredLocation => {
      if (!preferredLocation) {
        sendResponse({ closed: 0 });
        return;
      }

      const toClose = [];

      for (const [tabIdStr, info] of Object.entries(tabTimeInfo)) {
        // Close tabs that are NOT in preferred location
        // This includes tabs with no local time and tabs not matching preferred location
        if (!info.isPreferredLocation) {
          toClose.push(Number(tabIdStr));
        }
      }

      if (toClose.length) {
        chrome.tabs.remove(toClose, () => {
          toClose.forEach((id) => {
            delete tabTimeInfo[id];
          });
          sendResponse({ closed: toClose.length });
        });
      } else {
        sendResponse({ closed: 0 });
      }
    });
    return true;
  }

  if (message.type === "RECHECK_TABS") {
    // Find all Fiverr tabs and trigger content script re-extraction
    chrome.tabs.query({ url: "https://pro.fiverr.com/freelancers/*" }, (tabs) => {
      tabs.forEach((tab) => {
        triggerRecheck(tab.id);
      });
      sendResponse({ status: "ok", tabCount: tabs.length });
    });
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
  
  // When tab finishes loading and matches Fiverr pattern, inject content script
  if (changeInfo.status === "complete" && tab.url && tab.url.match(/https:\/\/pro\.fiverr\.com\/freelancers\//)) {
    // Small delay to ensure page is fully ready
    setTimeout(() => {
      triggerRecheck(tabId);
    }, 500);
  }
});
