// background.js

const tabTimeInfo = {};

// Get display mode preference (sidebar or popup)
async function getDisplayMode() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["displayMode"], (result) => {
      resolve(result.displayMode || "popup");
    });
  });
}

// Set display mode preference
async function setDisplayMode(mode) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ displayMode: mode }, () => {
      resolve();
    });
  });
}

// Set side panel behavior based on display mode
async function setupSidePanel() {
  const displayMode = await getDisplayMode();
  
  if (displayMode === "sidebar" && chrome.sidePanel) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      console.log("Side panel behavior set successfully");
    } catch (error) {
      console.error("Error setting side panel behavior:", error);
    }
  } else if (displayMode === "popup" && chrome.sidePanel) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
      console.log("Side panel behavior disabled (popup mode)");
    } catch (error) {
      console.error("Error disabling side panel behavior:", error);
    }
  }
}

// Setup side panel immediately
setupSidePanel();

// Countries by continent
const COUNTRIES_BY_CONTINENT = {
  "Africa": [
    "Nigeria", "Egypt", "South Africa", "Kenya", "Morocco", "Tunisia", "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon", 
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

// Country population data (in millions, approximate 2024 data)
const COUNTRY_POPULATION = {
  "China": 1426, "India": 1428, "United States": 339, "Indonesia": 279, "Pakistan": 240,
  "Brazil": 216, "Bangladesh": 173, "Russia": 144, "Mexico": 130, "Japan": 125,
  "Philippines": 118, "Ethiopia": 127, "Egypt": 112, "Vietnam": 99, "Turkey": 86,
  "Iran": 89, "Germany": 84, "Thailand": 72, "United Kingdom": 68, "France": 68,
  "Italy": 59, "South Africa": 62, "South Korea": 52, "Spain": 48, "Colombia": 52,
  "Argentina": 46, "Ukraine": 37, "Poland": 38, "Canada": 39, "Iraq": 46,
  "Algeria": 46, "Afghanistan": 43, "Saudi Arabia": 37, "Peru": 34, "Uzbekistan": 36,
  "Malaysia": 34, "Angola": 37, "Mozambique": 34, "Ghana": 34, "Yemen": 34,
  "Nepal": 31, "Venezuela": 29, "Madagascar": 30, "Cameroon": 29, "Ivory Coast": 29,
  "North Korea": 26, "Australia": 27, "Niger": 27, "Sri Lanka": 22, "Burkina Faso": 23,
  "Mali": 23, "Romania": 19, "Malawi": 21, "Chile": 20, "Kazakhstan": 20,
  "Zambia": 20, "Guatemala": 18, "Ecuador": 18, "Netherlands": 18, "Syria": 23,
  "Cambodia": 17, "Senegal": 18, "Chad": 18, "Somalia": 18, "Zimbabwe": 16,
  "Guinea": 14, "Rwanda": 14, "Benin": 14, "Burundi": 13, "Tunisia": 12,
  "Bolivia": 12, "Belgium": 12, "Haiti": 12, "Jordan": 11, "Cuba": 11,
  "South Sudan": 11, "Dominican Republic": 11, "Czech Republic": 11, "Greece": 11,
  "Portugal": 10, "Azerbaijan": 10, "Sweden": 10, "Hungary": 10, "Belarus": 9,
  "United Arab Emirates": 10, "Honduras": 10, "Tajikistan": 10, "Israel": 10,
  "Switzerland": 9, "Papua New Guinea": 10, "Togo": 9, "Sierra Leone": 9,
  "Laos": 8, "Paraguay": 7, "Libya": 7, "Bulgaria": 7, "Lebanon": 7,
  "Nicaragua": 7, "Kyrgyzstan": 7, "El Salvador": 6, "Turkmenistan": 6,
  "Singapore": 6, "Denmark": 6, "Finland": 6, "Congo": 6, "Slovakia": 5,
  "Norway": 5, "Eritrea": 4, "Palestine": 5, "Oman": 5, "Costa Rica": 5,
  "Liberia": 5, "Ireland": 5, "Central African Republic": 6, "New Zealand": 5,
  "Mauritania": 5, "Panama": 4, "Kuwait": 5, "Croatia": 4, "Moldova": 3,
  "Georgia": 4, "Uruguay": 3, "Bosnia and Herzegovina": 3, "Mongolia": 3,
  "Albania": 3, "Armenia": 3, "Jamaica": 3, "Qatar": 3, "Lithuania": 3,
  "Namibia": 3, "Gambia": 3, "Botswana": 2, "Gabon": 2, "Lesotho": 2,
  "Guinea-Bissau": 2, "North Macedonia": 2, "Slovenia": 2, "Latvia": 2,
  "Equatorial Guinea": 2, "Trinidad and Tobago": 1, "Estonia": 1, "Mauritius": 1,
  "Eswatini": 1, "Djibouti": 1, "Fiji": 1, "Comoros": 1, "Guyana": 1,
  "Bhutan": 1, "Solomon Islands": 1, "Luxembourg": 1, "Suriname": 1,
  "Cabo Verde": 0.6, "Malta": 0.5, "Brunei": 0.5, "Belize": 0.4, "Bahamas": 0.4,
  "Iceland": 0.4, "Vanuatu": 0.3, "Barbados": 0.3, "Sao Tome and Principe": 0.2,
  "Samoa": 0.2, "Saint Lucia": 0.2, "Kiribati": 0.1, "Micronesia": 0.1,
  "Grenada": 0.1, "Tonga": 0.1, "Seychelles": 0.1, "Antigua and Barbuda": 0.1,
  "Andorra": 0.08, "Dominica": 0.07, "Marshall Islands": 0.06, "Saint Kitts and Nevis": 0.06,
  "Liechtenstein": 0.04, "Monaco": 0.04, "San Marino": 0.03, "Palau": 0.02,
  "Tuvalu": 0.01, "Nauru": 0.01, "Vatican City": 0.0008
};

// Helper function to get country population (returns 0 if not found)
function getCountryPopulation(country) {
  // Handle special cases
  if (country.includes("(")) {
    const baseCountry = country.split("(")[0].trim();
    return COUNTRY_POPULATION[baseCountry] || 0;
  }
  return COUNTRY_POPULATION[country] || 0;
}

// Helper function to check if a country matches a preferred location
// Handles cases like "United States(Ohio, ...)" matching "United States"
function matchesPreferredLocation(country, preferredLocation) {
  if (!preferredLocation || !country) return false;
  
  const countryName = country.toLowerCase().trim();
  const prefLoc = preferredLocation.toLowerCase().trim();
  
  if (!countryName || !prefLoc) return false;
  
  // Extract base country name (before parentheses) if present
  const baseCountryName = countryName.includes("(") 
    ? countryName.split("(")[0].trim()
    : countryName;
  
  // Check exact match with base country name (most common case)
  if (baseCountryName === prefLoc) return true;
  
  // Check if base country name starts with preferred location or vice versa
  // This handles cases like "United States" matching "United States of America"
  if (baseCountryName.startsWith(prefLoc) || prefLoc.startsWith(baseCountryName)) return true;
  
  // Check if preferred location is contained in country name (handles partial matches)
  if (baseCountryName.includes(prefLoc) || prefLoc.includes(baseCountryName)) return true;
  
  // Also check the full country string (for cases where preferred location might be more specific)
  if (countryName === prefLoc || countryName.includes(prefLoc) || prefLoc.includes(countryName)) return true;
  
  return false;
}

// States/Provinces mapping for large countries by timezone offset
const STATES_BY_TIMEZONE = {
  "-300": { // UTC-5 (Eastern Time)
    "United States": ["Connecticut", "Delaware", "Florida", "Georgia", "Indiana (most)", "Maine", "Maryland", "Massachusetts", "Michigan (most)", "New Hampshire", "New Jersey", "New York", "North Carolina", "Ohio", "Pennsylvania", "Rhode Island", "South Carolina", "Vermont", "Virginia", "West Virginia", "Washington D.C."],
    "Canada": ["Ontario", "Quebec", "Nunavut"]
  },
  "-360": { // UTC-6 (Central Time)
    "United States": ["Illinois", "Kansas", "Kentucky", "Louisiana", "Minnesota", "Mississippi", "Tennessee", "Texas"],
    "Canada": ["Manitoba", "Saskatchewan", "Ontario"]
  },
  "-420": { // UTC-7 (Mountain Time)
    "United States": ["Arizona", "Colorado", "Montana",  "Nevada", "New Mexico",  "Utah"],
    "Canada": ["Alberta", "British Columbia", "Northwest Territories", "Nunavut", "Saskatchewan"]
  },
  "-480": { // UTC-8 (Pacific Time)
    "United States": ["California", "Nevada", "Washington"],
    "Canada": ["British Columbia (most)", "Yukon"]
  },
  "-540": { // UTC-9 (Alaska Time)
    "United States": ["Alaska"]
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

// US Timezone names mapping
const US_TIMEZONE_NAMES = {
  "-300": "Eastern Standard Timezone",  // UTC-5
  "-360": "Central Standard Timezone",  // UTC-6
  "-420": "Mountain Standard Timezone", // UTC-7
  "-480": "Pacific Standard Timezone",  // UTC-8
  "-540": "Alaska Standard Timezone",   // UTC-9
  "-600": "Hawaii Standard Timezone"    // UTC-10
};

// Helper function to get US timezone name for a given offset
function getUSTimezoneName(offsetMinutes) {
  const norm = normalizeOffset(offsetMinutes);
  const offsetKey = norm.toString();
  return US_TIMEZONE_NAMES[offsetKey] || null;
}

function getTimezoneInfo(offsetMinutes) {
  const norm = normalizeOffset(offsetMinutes);
  const found = TIMEZONES.find((tz) => tz.offsetMinutes === norm);
  
  // Always use UTC format for the main timezone label
  let timezoneLabel = found ? found.label : null;
  
  if (!timezoneLabel) {
    // Fallback to UTC format
    const hours = norm / 60;
    const sign = hours >= 0 ? "+" : "-";
    const abs = Math.abs(hours);
    timezoneLabel = abs === 0 ? "UTC" : `UTC${sign}${Number.isInteger(abs) ? abs : abs.toFixed(1)}`;
  }
  
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
      label: timezoneLabel,
      countries: formattedCountries,
      rawCountries: found.countries // Keep original for filtering
    };
  }

  return {
    offsetMinutes: norm,
    label: timezoneLabel,
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

function getLanguageCountThreshold() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["languageCountThreshold"], (result) => {
      resolve(result.languageCountThreshold !== undefined ? result.languageCountThreshold : 3);
    });
  });
}

function setLanguageCountThreshold(threshold) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ languageCountThreshold: threshold }, () => {
      resolve();
    });
  });
}

function getImageSize() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["imageSize"], (result) => {
      // Default to 40px if not set
      const defaultSize = 40;
      const validSizes = [20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 240];
      const savedSize = result.imageSize !== undefined ? result.imageSize : defaultSize;
      // If saved size is not in the list, find the closest valid size
      const size = validSizes.includes(savedSize) ? savedSize : 
        validSizes.reduce((prev, curr) => Math.abs(curr - savedSize) < Math.abs(prev - savedSize) ? curr : prev);
      resolve(size);
    });
  });
}

function setImageSize(size) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ imageSize: size }, () => {
      resolve();
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
          files: ["scripts/contentScript.js"]
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

// Ensure side panel behavior is set on install/startup
chrome.runtime.onInstalled.addListener(() => {
  setupSidePanel();
  
  // Inject content script into all existing Fiverr tabs
  chrome.tabs.query({ url: "https://pro.fiverr.com/freelancers/*" }, (tabs) => {
    tabs.forEach((tab) => {
      triggerRecheck(tab.id);
    });
  });
});

// Inject content script into all existing Fiverr tabs on startup
chrome.runtime.onStartup.addListener(() => {
  setupSidePanel();
  
  chrome.tabs.query({ url: "https://pro.fiverr.com/freelancers/*" }, (tabs) => {
    tabs.forEach((tab) => {
      triggerRecheck(tab.id);
    });
  });
});

// Handle action click based on display mode
chrome.action.onClicked.addListener(async (tab) => {
  const displayMode = await getDisplayMode();
  
  if (displayMode === "popup") {
    // Open as popup window
    try {
      const url = chrome.runtime.getURL("popup/index.html");
      await chrome.windows.create({
        url: url,
        type: "popup",
        width: 520,
        height: 600,
        focused: true
      });
    } catch (error) {
      console.error("Error opening popup window:", error);
    }
  } else {
    // Open side panel (fallback if setPanelBehavior didn't work)
    if (chrome.sidePanel) {
      try {
        await chrome.sidePanel.open({ tabId: tab.id });
      } catch (error) {
        console.error("Error opening side panel:", error);
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOCAL_TIME_INFO" && sender.tab) {
    const tabId = sender.tab.id;
    const { localTimeText, offsetMinutes, hours24, minutes, imageUrl, freelancerName, location, locationText, languages, languagesText } = message;
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
        isPreferredLocation: preferredLocation ? ((tz.rawCountries && tz.rawCountries.length > 0 ? tz.rawCountries : tz.countries) || []).some(c => matchesPreferredLocation(c, preferredLocation)) : false,
        imageUrl: imageUrl || "",
        freelancerName: freelancerName || "",
        location: location || "",
        locationText: locationText || "",
        languages: languages || [],
        languagesText: languagesText || "",
        languageCount: (languages || []).length
      };
      sendResponse({ status: "ok" });
    });
    return true;
  }

  if (message.type === "NO_LOCAL_TIME" && sender.tab) {
    const tabId = sender.tab.id;
    const { imageUrl, freelancerName, location, locationText, languages, languagesText } = message;

    tabTimeInfo[tabId] = {
      tabId,
      url: sender.tab.url,
      title: sender.tab.title,
      hasLocalTime: false,
      isPreferredLocation: false,
      imageUrl: imageUrl || "",
      freelancerName: freelancerName || "",
      location: location || "",
      locationText: locationText || "",
      languages: languages || [],
      languagesText: languagesText || "",
      languageCount: (languages || []).length
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
              isPreferredLocation: false,
              imageUrl: "",
              freelancerName: "",
              location: "",
              locationText: "",
              languages: [],
              languagesText: "",
              languageCount: 0
            };
          }
        });
        
        // Update preferred location status for all tabs
        const list = Object.values(tabTimeInfo)
          .filter(info => tabs.some(tab => tab.id === info.tabId)) // Only include tabs that still exist
          .map(info => {
            if (info.hasLocalTime && preferredLocation) {
              const countriesToCheck = (info.rawCountries && info.rawCountries.length > 0 ? info.rawCountries : info.countries) || [];
              info.isPreferredLocation = countriesToCheck.length > 0 && countriesToCheck.some(c => matchesPreferredLocation(c, preferredLocation));
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
    // Sort by population (descending) and limit to top 10
    const sortedCountries = countries
      .map(country => ({
        name: country,
        population: getCountryPopulation(country)
      }))
      .sort((a, b) => b.population - a.population)
      .slice(0, 10)
      .map(item => item.name);
    sendResponse({ countries: sortedCountries });
    return true;
  }

  if (message.type === "GET_US_TIMEZONE_NAME") {
    const timezoneName = getUSTimezoneName(message.offsetMinutes);
    sendResponse({ timezoneName });
    return true;
  }

  if (message.type === "SET_PREFERRED_LOCATION") {
    const newPreferredLocation = (message.country || "").trim();
    setPreferredLocation(newPreferredLocation).then(() => {
      // Update isPreferredLocation for all existing tabs
      for (const [tabIdStr, info] of Object.entries(tabTimeInfo)) {
        if (info.hasLocalTime && newPreferredLocation) {
          const countriesToCheck = (info.rawCountries && info.rawCountries.length > 0 ? info.rawCountries : info.countries) || [];
          info.isPreferredLocation = countriesToCheck.length > 0 && countriesToCheck.some(c => matchesPreferredLocation(c, newPreferredLocation));
        } else {
          info.isPreferredLocation = false;
        }
      }
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

  if (message.type === "GET_DISPLAY_MODE") {
    getDisplayMode().then(displayMode => {
      sendResponse({ displayMode });
    });
    return true;
  }

  if (message.type === "SET_DISPLAY_MODE") {
    setDisplayMode(message.mode || "sidebar").then(() => {
      setupSidePanel(); // Update side panel behavior
      sendResponse({ status: "ok" });
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
      const matches = countriesToCheck.some(c => matchesPreferredLocation(c, message.country));

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
    Promise.all([getPreferredLocation(), getLanguageCountThreshold()]).then(([preferredLocation, languageThreshold]) => {
      if (!preferredLocation) {
        sendResponse({ closed: 0 });
        return;
      }

      const toClose = [];

      for (const [tabIdStr, info] of Object.entries(tabTimeInfo)) {
        // Close tabs that are NOT in preferred location
        // This includes tabs with no local time and tabs not matching preferred location
        // Also close tabs with language count > threshold
        const shouldClose = !info.isPreferredLocation || 
                           (info.languageCount !== undefined && info.languageCount > languageThreshold);
        
        if (shouldClose) {
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

  if (message.type === "GET_LANGUAGE_COUNT_THRESHOLD") {
    getLanguageCountThreshold().then(threshold => {
      sendResponse({ threshold });
    });
    return true;
  }

  if (message.type === "SET_LANGUAGE_COUNT_THRESHOLD") {
    const threshold = parseInt(message.threshold, 10);
    if (!isNaN(threshold) && threshold >= 0) {
      setLanguageCountThreshold(threshold).then(() => {
        sendResponse({ status: "ok" });
      });
    } else {
      sendResponse({ status: "error", message: "Invalid threshold value" });
    }
    return true;
  }

  if (message.type === "GET_IMAGE_SIZE") {
    getImageSize().then(size => {
      sendResponse({ size });
    });
    return true;
  }

  if (message.type === "SET_IMAGE_SIZE") {
    const size = parseInt(message.size, 10);
    const validSizes = [20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 240];
    if (!isNaN(size) && validSizes.includes(size)) {
      setImageSize(size).then(() => {
        sendResponse({ status: "ok" });
      });
    } else {
      sendResponse({ status: "error", message: "Invalid image size value (must be one of: 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 240)" });
    }
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

  if (message.type === "REFRESH_SINGLE_TAB") {
    const tabId = message.tabId;
    if (tabId) {
      // Reload the tab first, then trigger recheck after a delay
      chrome.tabs.reload(tabId, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ status: "error", message: chrome.runtime.lastError.message });
          return;
        }
        // Wait for page to load, then trigger recheck
        setTimeout(() => {
          triggerRecheck(tabId);
          sendResponse({ status: "ok" });
        }, 1500);
      });
    } else {
      sendResponse({ status: "error", message: "No tab ID provided" });
    }
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
