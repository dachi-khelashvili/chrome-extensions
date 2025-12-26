// popup.js

// Most famous/popular countries list
const FAMOUS_COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "Italy", "Spain", "Japan", "China", "India", "Brazil", "Mexico", "Russia",
  "South Korea", "Netherlands", "Sweden", "Norway", "Denmark", "Switzerland",
  "Belgium", "Austria", "Poland", "Portugal", "Ireland", "Greece", "Turkey",
  "Saudi Arabia", "United Arab Emirates", "Singapore", "Malaysia", "Thailand",
  "Philippines", "Indonesia", "Vietnam", "New Zealand", "South Africa", "Egypt",
  "Israel", "Argentina", "Chile", "Colombia", "Nigeria", "Kenya", "Pakistan",
  "Bangladesh", "Iran", "Iraq", "Ukraine"
];

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

let countriesByContinent = {};
let expandedRows = new Set(); // Now stores tab IDs instead of indices
let activeCountriesPopup = null;

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
  // Handle special cases like "United States(Ohio)" -> "United States"
  if (country.includes("(")) {
    const baseCountry = country.split("(")[0].trim();
    return COUNTRY_POPULATION[baseCountry] || 0;
  }
  return COUNTRY_POPULATION[country] || 0;
}

async function showCountriesByContinent(info, button) {
  // Close any existing popup
  if (activeCountriesPopup) {
    activeCountriesPopup.remove();
    activeCountriesPopup = null;
    return;
  }

  // Get countries for this timezone
  const countriesResponse = await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: "GET_COUNTRIES_FOR_TIMEZONE",
      offsetMinutes: info.offsetMinutes
    }, (response) => {
      resolve(response?.countries || []);
    });
  });

  // Get states for US, Canada, Australia
  const statesPromises = ["United States", "Canada", "Australia"]
    .filter(country => countriesResponse.includes(country))
    .map(country => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: "GET_STATES_FOR_COUNTRY",
          country: country,
          offsetMinutes: info.offsetMinutes
        }, (response) => {
          if (!chrome.runtime.lastError && response?.states) {
            resolve({ country, states: response.states });
          } else {
            resolve(null);
          }
        });
      });
    });

  const statesData = await Promise.all(statesPromises);
  const validStatesData = statesData.filter(s => s !== null);

  // Organize by continent (max 5 per continent, sorted by population)
  const continentsList = Object.entries(countriesByContinent)
    .map(([continent, continentCountries]) => {
      const matchingCountries = continentCountries.filter(c =>
        countriesResponse.includes(c)
      );
      // Sort by population and limit to 5 countries per continent
      const sortedCountries = matchingCountries
        .map(country => ({
          name: country,
          population: getCountryPopulation(country)
        }))
        .sort((a, b) => b.population - a.population)
        .slice(0, 5)
        .map(item => item.name);
      return { continent, countries: sortedCountries };
    })
    .filter(({ countries }) => countries.length > 0);

  // Get states for US and Canada (max 2 states)
  const usStates = validStatesData.find(s => s.country === "United States");
  const canadaStates = validStatesData.find(s => s.country === "Canada");

  // Create popup
  const popup = document.createElement("div");
  popup.className = "countries-popup";
  popup.style.position = "absolute";
  popup.style.background = "#fff";
  popup.style.border = "1px solid rgba(21, 34, 56, 0.15)";
  popup.style.borderRadius = "8px";
  popup.style.boxShadow = "0 4px 12px rgba(21, 34, 56, 0.15)";
  popup.style.padding = "12px";
  popup.style.maxWidth = "400px";
  popup.style.maxHeight = "400px";
  popup.style.overflowY = "auto";
  popup.style.zIndex = "10000";
  popup.style.fontSize = "11px";

  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.style.marginBottom = "8px";
  title.style.color = "#152238";
  title.style.borderBottom = "1px solid rgba(21, 34, 56, 0.1)";
  title.style.paddingBottom = "6px";
  title.textContent = `Countries in ${info.timezone}`;
  popup.appendChild(title);

  // Get US timezone name once for all countries
  const usTimezoneNamePromise = new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: "GET_US_TIMEZONE_NAME",
      offsetMinutes: info.offsetMinutes
    }, (response) => {
      resolve(response?.timezoneName || null);
    });
  });

  const usTimezoneName = await usTimezoneNamePromise;

  if (continentsList.length > 0) {
    continentsList.forEach(({ continent, countries }) => {
      const continentDiv = document.createElement("div");
      continentDiv.style.marginBottom = "10px";

      const continentTitle = document.createElement("strong");
      continentTitle.textContent = `${continent}: `;
      continentTitle.style.color = "#0a1c34";
      continentDiv.appendChild(continentTitle);

      const countriesList = document.createElement("span");
      countriesList.style.color = "#555";

      countries.forEach((country, index) => {
        if (index > 0) {
          countriesList.appendChild(document.createTextNode(", "));
        }

        if ((country === "United States" || country === "Canada" || country === "Australia") && usTimezoneName) {
          const countrySpan = document.createElement("span");
          countrySpan.textContent = country;
          countriesList.appendChild(countrySpan);

          const timezoneSpan = document.createElement("span");
          timezoneSpan.textContent = ` (${usTimezoneName})`;
          timezoneSpan.style.opacity = "0.7";
          timezoneSpan.title = `Timezone: ${usTimezoneName}`;
          timezoneSpan.style.cursor = "help";
          countriesList.appendChild(timezoneSpan);
        } else {
          countriesList.appendChild(document.createTextNode(country));
        }
      });

      continentDiv.appendChild(countriesList);
      popup.appendChild(continentDiv);
    });
  } else if (countriesResponse.length > 0) {
    const fallbackDiv = document.createElement("div");
    fallbackDiv.style.color = "#555";
    fallbackDiv.textContent = countriesResponse.slice(0, 10).join(", ");
    if (countriesResponse.length > 10) {
      fallbackDiv.textContent += ` +${countriesResponse.length - 10} more`;
    }
    popup.appendChild(fallbackDiv);
  } else {
    const noDataDiv = document.createElement("div");
    noDataDiv.style.color = "#999";
    noDataDiv.textContent = "No countries data available";
    popup.appendChild(noDataDiv);
  }

  // Add to tabs container for proper positioning
  const container = document.getElementById("tabs-container");
  container.style.position = "relative";
  container.appendChild(popup);

  // Position popup near button
  const buttonRect = button.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // Get popup dimensions after adding to DOM
  const popupRect = popup.getBoundingClientRect();

  // Position relative to button, but within container bounds
  let left = buttonRect.right - containerRect.left + 8;
  let top = buttonRect.top - containerRect.top;

  // Adjust if goes off screen to the right
  if (left + popupRect.width > containerRect.width) {
    left = buttonRect.left - containerRect.left - popupRect.width - 8;
  }

  // Adjust if goes off screen to the bottom
  if (top + popupRect.height > containerRect.height) {
    top = buttonRect.bottom - containerRect.top - popupRect.height;
  }

  // Adjust if goes off screen to the top
  if (top < 0) {
    top = 8;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.style.position = "absolute";

  activeCountriesPopup = popup;

  // Close on outside click
  const closeOnClick = (e) => {
    if (!popup.contains(e.target) && e.target !== button) {
      popup.remove();
      activeCountriesPopup = null;
      document.removeEventListener("click", closeOnClick);
    }
  };
  setTimeout(() => {
    document.addEventListener("click", closeOnClick);
  }, 100);
}

function getCountriesByContinent() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_COUNTRIES_BY_CONTINENT" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({});
        return;
      }
      countriesByContinent = response?.countriesByContinent || {};
      resolve(countriesByContinent);
    });
  });
}

function getAllCountriesSorted() {
  const allCountries = new Set();
  Object.values(countriesByContinent).forEach(continentCountries => {
    continentCountries.forEach(country => allCountries.add(country));
  });
  return Array.from(allCountries).sort();
}

function populateCountrySelect(selectElement, selectedCountry = "") {
  // Clear existing options except the first one
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }

  // Get all countries sorted
  const allCountries = getAllCountriesSorted();

  // Add countries grouped by continent
  const continentOrder = ["North America", "South America", "Europe", "Asia", "Africa", "Oceania"];

  continentOrder.forEach(continent => {
    if (countriesByContinent[continent] && countriesByContinent[continent].length > 0) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = continent;

      const continentCountries = countriesByContinent[continent]
        .filter(c => allCountries.includes(c))
        .sort();

      continentCountries.forEach(country => {
        const option = document.createElement("option");
        option.value = country;
        option.textContent = country;
        if (country === selectedCountry) {
          option.selected = true;
        }
        optgroup.appendChild(option);
      });

      selectElement.appendChild(optgroup);
    }
  });

  // Add any remaining countries not in the continent list (if any)
  const addedCountries = new Set();
  Array.from(selectElement.querySelectorAll("option")).forEach(opt => {
    if (opt.value) addedCountries.add(opt.value);
  });

  const remainingCountries = allCountries.filter(c => !addedCountries.has(c));
  if (remainingCountries.length > 0) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = "Other";
    remainingCountries.forEach(country => {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      if (country === selectedCountry) {
        option.selected = true;
      }
      optgroup.appendChild(option);
    });
    selectElement.appendChild(optgroup);
  }
}

async function copyAllLinksToClipboard(tabs) {
  if (!tabs || tabs.length === 0) {
    return;
  }

  const links = tabs.map(tab => tab.url || "").filter(url => url).join("\n");

  if (links) {
    try {
      await navigator.clipboard.writeText(links);
      // Show brief feedback (you could enhance this with a toast notification)
      console.log(`Copied ${tabs.length} link(s) to clipboard`);
    } catch (err) {
      console.error("Failed to copy links:", err);
    }
  }
}

async function pasteTabsFromClipboard() {
  let clipboardText = "";

  try {
    // Try modern clipboard API first
    clipboardText = await navigator.clipboard.readText();
  } catch (err) {
    console.log("Clipboard API failed, trying fallback:", err);
    // Fallback: use a textarea to paste
    try {
      const textArea = document.createElement("textarea");
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      const success = document.execCommand("paste");

      if (success && textArea.value) {
        clipboardText = textArea.value;
      }

      document.body.removeChild(textArea);

      if (!success || !clipboardText) {
        console.log("Fallback paste failed or clipboard is empty");
        return;
      }
    } catch (fallbackErr) {
      console.error("Fallback paste also failed:", fallbackErr);
      return;
    }
  }

  if (!clipboardText || clipboardText.trim().length === 0) {
    console.log("Clipboard is empty");
    return;
  }

  // Split by newlines or tabs (handle both)
  const lines = clipboardText
    .split(/\r?\n|\t/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Filter to only Fiverr URLs
  const fiverrUrls = lines.filter(line => {
    try {
      // Try to parse as URL
      const urlObj = new URL(line);
      return urlObj.hostname.includes('fiverr.com') &&
        (urlObj.pathname.includes('/freelancers/') || urlObj.pathname.startsWith('/'));
    } catch (e) {
      // If not a valid URL, check if it looks like a Fiverr URL
      return line.includes('fiverr.com') && line.includes('/freelancers/');
    }
  });

  if (fiverrUrls.length === 0) {
    console.log("No valid Fiverr URLs found in clipboard");
    console.log("Clipboard content:", clipboardText.substring(0, 100));
    return;
  }

  // Open each URL as a new tab (limit to prevent too many tabs at once)
  const maxTabs = 50;
  const urlsToOpen = fiverrUrls.slice(0, maxTabs);

  let openedCount = 0;
  for (const url of urlsToOpen) {
    try {
      chrome.tabs.create({ url: url, active: false }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error("Error opening tab:", chrome.runtime.lastError);
        } else {
          openedCount++;
        }
      });
    } catch (err) {
      console.error("Error creating tab for URL:", url, err);
    }
  }

  // Wait a bit then refresh the tab list (keep popup open)
  setTimeout(() => {
    loadTabs();
    // Ensure popup stays open
    window.focus();
  }, 1500);

  console.log(`Opening ${urlsToOpen.length} tab(s) from clipboard`);
}

async function copyAllLinksWithTabsToClipboard(tabs) {
  if (!tabs || tabs.length === 0) {
    console.log("No tabs to copy");
    return;
  }

  const links = tabs.map(tab => tab.url || "").filter(url => url);

  if (links.length === 0) {
    console.log("No valid URLs found");
    return;
  }

  const linksWithTabs = links.join("\t");

  try {
    await navigator.clipboard.writeText(linksWithTabs);
    console.log(`Copied ${links.length} link(s) with tabs to clipboard`);
  } catch (err) {
    console.error("Failed to copy links with tabs:", err);
    // Fallback for older browsers or permission issues
    try {
      const textArea = document.createElement("textarea");
      textArea.value = linksWithTabs;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      console.log(`Copied ${links.length} link(s) with tabs using fallback method`);
    } catch (fallbackErr) {
      console.error("Fallback copy also failed:", fallbackErr);
    }
  }
}

async function closeAllTabs(tabs) {
  if (!tabs || tabs.length === 0) {
    return;
  }

  const tabIds = tabs.map(tab => tab.tabId).filter(id => id !== undefined);

  if (tabIds.length > 0) {
    try {
      chrome.tabs.remove(tabIds, () => {
        if (chrome.runtime.lastError) {
          console.error("Error closing tabs:", chrome.runtime.lastError);
        } else {
          // Reload the tab list after closing
          setTimeout(() => {
            loadTabs();
          }, 300);
        }
      });
    } catch (err) {
      console.error("Failed to close tabs:", err);
    }
  }
}

function createPasteButton() {
  const pasteButton = document.createElement("button");
  pasteButton.className = "icon-button paste-tabs-button";
  pasteButton.type = "button";
  pasteButton.title = "Paste URLs from clipboard and open as tabs";
  pasteButton.textContent = "Paste Tabs";
  pasteButton.style.padding = "4px 8px";
  pasteButton.style.marginLeft = "0";

  pasteButton.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();
    console.log("Paste button clicked");

    // Keep popup open by focusing back on it
    window.focus();

    await pasteTabsFromClipboard();

    // Return false to prevent any default behavior
    return false;
  });

  // Prevent popup from closing on mousedown
  pasteButton.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // Also prevent on mouseup
  pasteButton.addEventListener("mouseup", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  return pasteButton;
}

function createCopyWithTabsButton(tabs) {
  const copyTabsButton = document.createElement("button");
  copyTabsButton.className = "icon-button copy-tabs-button";
  copyTabsButton.type = "button";
  copyTabsButton.title = "Copy all links with tabs to clipboard";
  copyTabsButton.style.width = "24px";
  copyTabsButton.style.height = "24px";
  copyTabsButton.style.marginLeft = "0";
  copyTabsButton.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 1.5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1h1v-1Z" fill="currentColor"/>
      <path d="M10.5 1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Z" fill="currentColor"/>
      <path d="M3 6h10M3 9h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
  `;

  copyTabsButton.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();
    console.log("Copy with tabs button clicked, tabs:", tabs);
    await copyAllLinksWithTabsToClipboard(tabs);
  });

  return copyTabsButton;
}

function createCopyButton(tabs) {
  const copyButton = document.createElement("button");
  copyButton.className = "icon-button copy-links-button";
  copyButton.type = "button";
  copyButton.title = "Copy all links to clipboard";
  copyButton.textContent = "Copy Tabs";
  copyButton.style.padding = "4px 8px";
  copyButton.style.marginLeft = "0";

  copyButton.addEventListener("click", async (e) => {
    e.stopPropagation();
    await copyAllLinksToClipboard(tabs);
  });

  return copyButton;
}

function createCloseButton(tabs) {
  const closeButton = document.createElement("button");
  closeButton.className = "icon-button close-tabs-button";
  closeButton.type = "button";
  closeButton.title = "Close all tabs";
  closeButton.textContent = "Close Tabs";
  closeButton.style.padding = "4px 8px";
  closeButton.style.marginLeft = "0";

  closeButton.addEventListener("click", async (e) => {
    e.stopPropagation();
    await closeAllTabs(tabs);
  });

  return closeButton;
}

async function renderTabs(tabs) {
  const container = document.getElementById("tabs-container");
  const statusText = document.getElementById("tabs-status-text");
  const buttonGroup = document.getElementById("tabs-action-buttons");

  // Clear container
  container.innerHTML = "";

  // Clear and update buttons
  buttonGroup.innerHTML = "";
  buttonGroup.appendChild(createPasteButton());
  buttonGroup.appendChild(createCopyButton(tabs));
  buttonGroup.appendChild(createCloseButton(tabs));

  // Update status text
  if (!tabs || tabs.length === 0) {
    statusText.textContent = "No Fiverr tabs found.";
  } else {
    statusText.textContent = `${tabs.length} tab(s)`;
  }

  if (!tabs || tabs.length === 0) {
    return;
  }

  // Get language threshold once for all rows
  const threshold = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_LANGUAGE_COUNT_THRESHOLD" }, (response) => {
      resolve((!chrome.runtime.lastError && response?.threshold !== undefined) ? response.threshold : 3);
    });
  });

  // Get image size once for all rows
  const imageSize = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_IMAGE_SIZE" }, (response) => {
      resolve((!chrome.runtime.lastError && response?.size !== undefined) ? response.size : 40);
    });
  });

  // Create table
  const table = document.createElement("table");
  table.className = "tabs-table";

  // Create table header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.className = "table-header-row";

  const headers = ["#", "", "image", "Name", "Time", "Status", "Languages"];
  headers.forEach((headerText, idx) => {
    const th = document.createElement("th");
    th.textContent = headerText;
    th.className = `col-header-${idx === 0 ? 'number' : idx === 1 ? 'image' : idx === 2 ? 'name' : idx === 3 ? 'time' : idx === 4 ? 'status' : idx === 5 ? 'languages' : 'actions'}`;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  tabs.forEach((info, index) => {
    const row = document.createElement("tr");
    row.className = "tab-row";
    row.dataset.tabIndex = index;

    if (expandedRows.has(info.tabId)) {
      row.classList.add("expanded");
    }

    const number = (index + 1).toString().padStart(2, "0");

    let localTimeText = "XX:XX XM";
    let preferredStatus = "";

    if (info.hasLocalTime) {
      const timeStr = formatTime(info.hours24, info.minutes);
      localTimeText = timeStr || "XX:XX XM";

      if (info.isPreferredLocation) {
        preferredStatus = "✓ Preferred";
      } else {
        preferredStatus = "✗ Not preferred";
      }
    } else {
      preferredStatus = "No local time";
    }

    // Create cells: Number | Image | Name | Local Time | Preferred Status | Languages | Actions
    const cell1 = document.createElement("td");
    cell1.textContent = number;
    cell1.className = "col-number";

    const cellImage = document.createElement("td");
    cellImage.className = "col-image";

    if (info.imageUrl) {
      const img = document.createElement("img");
      img.src = info.imageUrl;
      img.alt = info.freelancerName || "Freelancer";
      img.className = "freelancer-image";
      img.style.width = `${imageSize}px`;
      img.style.height = `${imageSize}px`;
      img.onerror = function () {
        this.style.display = "none";
      };
      cellImage.appendChild(img);
    } else {
      const noImageDiv = document.createElement("div");
      noImageDiv.className = "no-image";
      noImageDiv.textContent = "—";
      noImageDiv.style.width = `${imageSize}px`;
      noImageDiv.style.height = `${imageSize}px`;
      cellImage.appendChild(noImageDiv);
    }

    const cellName = document.createElement("td");
    cellName.className = "col-name";
    cellName.textContent = info.freelancerName || "Unknown";
    cellName.title = info.freelancerName || "";

    const cell2 = document.createElement("td");
    cell2.textContent = localTimeText;
    cell2.className = "col-time";

    const cell3 = document.createElement("td");
    cell3.className = "col-status";

    if (!info.hasLocalTime) {
      // For "No local time", add text and refresh button
      cell3.classList.add("no-local-time");
      const wrapper = document.createElement("span");
      wrapper.className = "no-local-time-wrapper";

      const statusText = document.createElement("span");
      statusText.className = "status-container";
      statusText.textContent = preferredStatus;
      wrapper.appendChild(statusText);

      const refreshButton = document.createElement("button");
      refreshButton.className = "tiny-refresh-button";
      refreshButton.type = "button";
      refreshButton.style.width = `${imageSize / 2}px`;
      refreshButton.style.height = `${imageSize / 2}px`;
      refreshButton.title = "Refresh this tab";
      refreshButton.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.65 2.35C12.2 0.9 10.2 0 8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C11.73 16 14.84 13.45 15.73 10H13.65C12.83 12.33 10.61 14 8 14C4.69 14 2 11.31 2 8C2 4.69 4.69 2 8 2C9.66 2 11.14 2.69 12.22 3.78L9 7H16V0L13.65 2.35Z" fill="currentColor"/>
        </svg>
      `;

      refreshButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent row click
        refreshButton.disabled = true;
        refreshButton.style.opacity = "0.5";

        chrome.runtime.sendMessage({
          type: "REFRESH_SINGLE_TAB",
          tabId: info.tabId
        }, (response) => {
          refreshButton.disabled = false;
          refreshButton.style.opacity = "1";

          // Wait a bit then reload tabs to see updated data
          setTimeout(() => {
            loadTabs();
          }, 1000);
        });
      });

      wrapper.appendChild(refreshButton);
      cell3.appendChild(wrapper);
    } else {
      // For tabs with local time, just show text
      cell3.textContent = preferredStatus;
      if (info.isPreferredLocation) {
        cell3.classList.add("preferred");
      } else {
        cell3.classList.add("not-preferred");
      }
    }

    // Create languages cell
    const cellLanguages = document.createElement("td");
    cellLanguages.className = "col-languages";

    const languageCount = info.languageCount || 0;
    const languagesText = info.languagesText || info.languages?.join(", ") || "";

    if (languagesText) {
      cellLanguages.textContent = languagesText;
      cellLanguages.title = `${languageCount} language(s)`;

      // If language count exceeds threshold, show in red
      if (languageCount > threshold) {
        cellLanguages.style.color = "#dc3545";
        cellLanguages.style.fontWeight = "600";
      } else {
        cellLanguages.style.color = "#152238";
        cellLanguages.style.fontWeight = "normal";
      }
    } else {
      cellLanguages.textContent = "—";
      cellLanguages.style.color = "#999";
    }

    // Create actions cell with close button only
    const cellActions = document.createElement("td");
    cellActions.className = "col-actions";

    const actionsWrapper = document.createElement("div");
    actionsWrapper.className = "row-actions";

    // Close button
    const closeRowButton = document.createElement("button");
    closeRowButton.className = "row-action-button close-row-button";
    closeRowButton.type = "button";
    closeRowButton.title = "Close this tab";
    closeRowButton.style.width = `${imageSize / 2}px`;
    closeRowButton.style.height = `${imageSize / 2}px`;
    closeRowButton.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 2l12 12M14 2l-12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    closeRowButton.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.tabs.remove(info.tabId, () => {
        if (chrome.runtime.lastError) {
          console.error("Error closing tab:", chrome.runtime.lastError);
        } else {
          // Reload tab list after closing
          setTimeout(() => {
            loadTabs();
          }, 300);
        }
      });
    });

    actionsWrapper.appendChild(closeRowButton);
    cellActions.appendChild(actionsWrapper);

    row.appendChild(cell1);
    row.appendChild(cellActions);
    row.appendChild(cellImage);
    row.appendChild(cellName);
    row.appendChild(cell2);
    row.appendChild(cell3);
    row.appendChild(cellLanguages);

    table.appendChild(row);

    // Add expandable content row
    if (expandedRows.has(info.tabId) && info.hasLocalTime && info.countries && info.countries.length > 0) {
      const expandRow = document.createElement("tr");
      expandRow.className = "expand-row";
      const expandCell = document.createElement("td");
      expandCell.colSpan = 7;
      expandCell.className = "expand-content";

      // Get preferred location and show countries in this timezone organized by continent
      chrome.runtime.sendMessage({ type: "GET_PREFERRED_LOCATION" }, (prefResponse) => {
        const preferredLocation = prefResponse?.preferredLocation || "";

        // Get all countries in this timezone
        chrome.runtime.sendMessage({
          type: "GET_COUNTRIES_FOR_TIMEZONE",
          offsetMinutes: info.offsetMinutes
        }, (tzResponse) => {
          const allCountriesInTimezone = tzResponse?.countries || [];

          // Show timezone header
          const timezoneHeader = document.createElement("div");
          timezoneHeader.style.marginBottom = "12px";
          timezoneHeader.style.paddingBottom = "8px";
          timezoneHeader.style.borderBottom = "2px solid #0d6efd";

          const timezoneTitle = document.createElement("strong");
          timezoneTitle.textContent = `Countries in ${info.timezone}`;
          timezoneTitle.style.color = "#0d6efd";
          timezoneTitle.style.fontSize = "13px";
          timezoneHeader.appendChild(timezoneTitle);

          // Highlight preferred location if it matches
          if (preferredLocation && allCountriesInTimezone.length > 0) {
            const prefMatch = allCountriesInTimezone.some(c => {
              const countryName = c.toLowerCase();
              const prefLoc = preferredLocation.toLowerCase();
              return countryName === prefLoc || countryName.includes(prefLoc) || prefLoc.includes(countryName);
            });

            if (prefMatch) {
              const prefNote = document.createElement("div");
              prefNote.style.marginTop = "4px";
              prefNote.style.fontSize = "11px";
              prefNote.style.color = "#28a745";
              prefNote.style.fontWeight = "600";
              prefNote.textContent = `✓ Matches preferred location: ${preferredLocation}`;
              timezoneHeader.appendChild(prefNote);
            }
          }

          expandCell.appendChild(timezoneHeader);

          // Organize countries by continent (max 5 per continent, sorted by population)
          const continentsList = Object.entries(countriesByContinent)
            .map(([continent, continentCountries]) => {
              // Filter to only countries that are in this timezone
              const matchingCountries = continentCountries.filter(c =>
                allCountriesInTimezone.includes(c)
              );
              // Sort by population and limit to 5 countries per continent
              const sortedCountries = matchingCountries
                .map(country => ({
                  name: country,
                  population: getCountryPopulation(country)
                }))
                .sort((a, b) => b.population - a.population)
                .slice(0, 5)
                .map(item => item.name);
              return { continent, countries: sortedCountries };
            })
            .filter(({ countries }) => countries.length > 0);

          // Get US timezone name once for all countries
          chrome.runtime.sendMessage({
            type: "GET_US_TIMEZONE_NAME",
            offsetMinutes: info.offsetMinutes
          }, (tzResponse) => {
            const usTimezoneName = tzResponse?.timezoneName || null;

            // Show countries organized by continent
            if (continentsList.length > 0) {
              const continentsDiv = document.createElement("div");
              continentsDiv.className = "continents-list";

              continentsList.forEach(({ continent, countries }) => {
                const continentDiv = document.createElement("div");
                continentDiv.className = "continent-group";
                continentDiv.style.marginBottom = "10px";

                const continentTitle = document.createElement("strong");
                continentTitle.textContent = `${continent}: `;
                continentTitle.style.color = "#0a1c34";
                continentDiv.appendChild(continentTitle);

                const countriesContainer = document.createElement("span");
                countriesContainer.style.fontSize = "11px";
                countriesContainer.style.color = "#555";

                countries.forEach((country, index) => {
                  if (index > 0) {
                    countriesContainer.appendChild(document.createTextNode(", "));
                  }

                  if ((country === "United States" || country === "Canada" || country === "Australia") && usTimezoneName) {
                    const countrySpan = document.createElement("span");
                    countrySpan.textContent = country;
                    countriesContainer.appendChild(countrySpan);

                    const timezoneSpan = document.createElement("span");
                    timezoneSpan.textContent = ` (${usTimezoneName})`;
                    timezoneSpan.style.opacity = "0.7";
                    timezoneSpan.title = `Timezone: ${usTimezoneName}`;
                    timezoneSpan.style.cursor = "help";
                    countriesContainer.appendChild(timezoneSpan);
                  } else {
                    countriesContainer.appendChild(document.createTextNode(country));
                  }
                });

                continentDiv.appendChild(countriesContainer);
                continentsDiv.appendChild(continentDiv);
              });

              expandCell.appendChild(continentsDiv);
            } else if (allCountriesInTimezone.length > 0) {
              // Fallback: show first 5 countries if no continent data
              const fallbackDiv = document.createElement("div");
              fallbackDiv.style.fontSize = "11px";
              fallbackDiv.style.color = "#555";
              const limitedCountries = allCountriesInTimezone.slice(0, 5);
              fallbackDiv.textContent = limitedCountries.join(", ");
              expandCell.appendChild(fallbackDiv);
            }

            if (expandCell.children.length === 0) {
              expandCell.textContent = "No location data available";
            }
          });
        });
      });

      expandRow.appendChild(expandCell);
      table.appendChild(expandRow);
    }

    // Track click timing to prevent navigation on double-click
    let clickTimeout = null;
    let isDoubleClick = false;

    // Make row clickable - navigate to tab
    row.addEventListener("click", (e) => {
      // Don't navigate if clicking on action buttons
      if (e.target.closest('.row-actions') || e.target.closest('.row-action-button')) {
        return;
      }

      // Clear any existing timeout
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }

      // If this is part of a double-click, don't navigate
      if (isDoubleClick) {
        isDoubleClick = false;
        return;
      }

      // Delay navigation to allow double-click detection
      clickTimeout = setTimeout(() => {
        if (!isDoubleClick) {
          // Navigate to tab
          chrome.tabs.update(info.tabId, { active: true }, () => {
            if (chrome.runtime.lastError) {
              console.error("Error navigating to tab:", chrome.runtime.lastError);
            }
          });
        }
        clickTimeout = null;
      }, 300);
    });

    // Double click to expand/collapse for tabs with local time
    if (info.hasLocalTime) {
      row.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        e.preventDefault();
        isDoubleClick = true;

        // Clear the click timeout to prevent navigation
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }

        if (expandedRows.has(info.tabId)) {
          expandedRows.delete(info.tabId);
        } else {
          expandedRows.add(info.tabId);
        }
        renderTabs(tabs).catch(err => console.error("Error rendering tabs:", err));
      });
    }
  });

  container.appendChild(table);
}

function loadTabs() {
  return new Promise(async (resolve) => {
    await getCountriesByContinent();
    chrome.runtime.sendMessage({ type: "GET_TABS_TIME_INFO" }, async (response) => {
      if (chrome.runtime.lastError) {
        await renderTabs([]);
        const container = document.getElementById("tabs-container");
        container.textContent = "Error loading tabs.";
        resolve([]);
        return;
      }
      const tabs = response?.tabs || [];
      await renderTabs(tabs);
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

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("filter-form");
  const countrySelect = document.getElementById("country-select");
  const statusEl = document.getElementById("status");
  const recheckButton = document.getElementById("recheck-button");
  const container = document.getElementById("tabs-container");

  // Load countries and populate select
  await getCountriesByContinent();

  // Load preferred location and populate select
  chrome.runtime.sendMessage({ type: "GET_PREFERRED_LOCATION" }, (response) => {
    const preferredLocation = (!chrome.runtime.lastError && response?.preferredLocation) ? response.preferredLocation : "";
    populateCountrySelect(countrySelect, preferredLocation);
  });

  // Load language threshold and populate input
  const languageThresholdInput = document.getElementById("language-threshold-input");
  chrome.runtime.sendMessage({ type: "GET_LANGUAGE_COUNT_THRESHOLD" }, (response) => {
    const threshold = (!chrome.runtime.lastError && response?.threshold !== undefined) ? response.threshold : 3;
    languageThresholdInput.value = threshold;
  });


  async function syncTabs() {
    if (recheckButton.disabled) return;

    recheckButton.disabled = true;
    container.textContent = "Syncing tabs...";
    statusEl.textContent = "Refreshing Fiverr tabs...";

    try {
      const tabCount = await requestRecheck();
      statusEl.textContent = tabCount
        ? `Collecting local times from ${tabCount} tab(s)...`
        : "No Fiverr tabs detected.";

      await loadTabs();
      statusEl.textContent = "";
    } catch (error) {
      container.textContent = "Unable to refresh Fiverr tabs.";
      statusEl.textContent = error?.message || "Failed to refresh tabs.";
    } finally {
      recheckButton.disabled = false;
    }
  }

  // Initialize buttons immediately (even with no tabs)
  await renderTabs([]);

  // Show cached data immediately if available, then refresh in background
  await getCountriesByContinent();
  loadTabs();
  syncTabs();

  recheckButton.addEventListener("click", () => {
    syncTabs();
  });

  // Display mode toggle button
  const displayModeButton = document.getElementById("display-mode-button");
  const displayModeIcon = document.getElementById("display-mode-icon");

  // Load current display mode and update icon
  chrome.runtime.sendMessage({ type: "GET_DISPLAY_MODE" }, (response) => {
    const displayMode = (!chrome.runtime.lastError && response?.displayMode) ? response.displayMode : "sidebar";
    updateDisplayModeIcon(displayMode);
  });

  function updateDisplayModeIcon(mode) {
    if (mode === "popup") {
      // Icon for popup mode (window icon) - shows we're in popup, click to switch to sidebar
      displayModeIcon.innerHTML = `
        <path d="M2 2h12v12H2V2zm1 1v10h10V3H3z" fill="currentColor"/>
        <path d="M4 4h8v1H4V4zm0 2h8v1H4V6zm0 2h8v1H4V8zm0 2h5v1H4v-1z" fill="currentColor"/>
      `;
      displayModeButton.title = "Switch to sidebar mode";
    } else {
      // Icon for sidebar mode (sidebar icon with two panels) - shows we're in sidebar, click to switch to popup
      displayModeIcon.innerHTML = `
        <path d="M1 1h6v14H1V1zm1 1v12h4V2H2z" fill="currentColor"/>
        <path d="M9 1h6v14H9V1zm1 1v12h4V2h-4z" fill="currentColor"/>
        <path d="M3 3h2v1H3V3zm0 2h2v1H3V5zm0 2h2v1H3V7zm0 2h2v1H3V9z" fill="currentColor"/>
      `;
      displayModeButton.title = "Switch to popup mode";
    }
  }

  displayModeButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_DISPLAY_MODE" }, (response) => {
      const currentMode = (!chrome.runtime.lastError && response?.displayMode) ? response.displayMode : "sidebar";
      const newMode = currentMode === "sidebar" ? "popup" : "sidebar";

      chrome.runtime.sendMessage({ type: "SET_DISPLAY_MODE", mode: newMode }, (response) => {
        if (!chrome.runtime.lastError) {
          updateDisplayModeIcon(newMode);
          statusEl.textContent = `Switched to ${newMode} mode. Click extension icon to see the change.`;
          setTimeout(() => {
            statusEl.textContent = "";
          }, 3000);
        }
      });
    });
  });

  // Set preferred location button
  const setLocationButton = document.getElementById("set-location-button");
  setLocationButton.addEventListener("click", () => {
    const country = (countrySelect.value || "").trim();

    if (!country) {
      statusEl.textContent = "Please type a country name first.";
      return;
    }

    statusEl.textContent = "Setting preferred location...";

    // Save preferred location
    chrome.runtime.sendMessage(
      {
        type: "SET_PREFERRED_LOCATION",
        country
      },
      (response) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error setting preferred location.";
          return;
        }

        statusEl.textContent = `Preferred location set to: ${country}`;

        // Update select to show selected country
        countrySelect.value = country;

        // Refresh tab list to show updated preferred status
        loadTabs();

        // Clear status message after 2 seconds
        setTimeout(() => {
          if (statusEl.textContent === `Preferred location set to: ${country}`) {
            statusEl.textContent = "";
          }
        }, 2000);
      }
    );
  });

  // Set language threshold button
  const setLanguageThresholdButton = document.getElementById("set-language-threshold-button");
  setLanguageThresholdButton.addEventListener("click", () => {
    const threshold = parseInt(languageThresholdInput.value, 10);

    if (isNaN(threshold) || threshold < 0) {
      statusEl.textContent = "Please enter a valid number (0 or greater).";
      return;
    }

    statusEl.textContent = "Setting language threshold...";

    // Save language threshold
    chrome.runtime.sendMessage(
      {
        type: "SET_LANGUAGE_COUNT_THRESHOLD",
        threshold
      },
      (response) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error setting language threshold.";
          return;
        }

        statusEl.textContent = `Language threshold set to: ${threshold}`;

        // Refresh tab list to show updated language colors
        loadTabs().catch(err => console.error("Error loading tabs:", err));

        // Clear status message after 2 seconds
        setTimeout(() => {
          if (statusEl.textContent === `Language threshold set to: ${threshold}`) {
            statusEl.textContent = "";
          }
        }, 2000);
      }
    );
  });

  // Predefined image sizes
  const imageSizes = [30, 60, 120, 240];

  // Zoom out image button
  const zoomOutImageButton = document.getElementById("zoom-out-image-button");
  zoomOutImageButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_IMAGE_SIZE" }, (response) => {
      const currentSize = (!chrome.runtime.lastError && response?.size !== undefined) ? response.size : 40;
      const currentIndex = imageSizes.indexOf(currentSize);

      // If current size is not in the list, find the closest one
      const index = currentIndex >= 0 ? currentIndex :
        imageSizes.reduce((prev, curr, idx) =>
          Math.abs(curr - currentSize) < Math.abs(imageSizes[prev] - currentSize) ? idx : prev, 0);

      // Get previous size (if at first, stay at first)
      const newIndex = Math.max(0, index - 1);
      const newSize = imageSizes[newIndex];

      if (newIndex === 0) {
        zoomOutImageButton.disabled = true;
      }

      if (newIndex === imageSizes.length - 2) {
        zoomInImageButton.disabled = false;
      }

      chrome.runtime.sendMessage(
        {
          type: "SET_IMAGE_SIZE",
          size: newSize
        },
        (response) => {
          if (!chrome.runtime.lastError) {
            // Refresh tab list to show updated image sizes
            loadTabs().catch(err => console.error("Error loading tabs:", err));
          }
        }
      );
    });
  });

  // Zoom in image button
  const zoomInImageButton = document.getElementById("zoom-in-image-button");
  zoomInImageButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_IMAGE_SIZE" }, (response) => {
      const currentSize = (!chrome.runtime.lastError && response?.size !== undefined) ? response.size : 40;
      const currentIndex = imageSizes.indexOf(currentSize);

      // If current size is not in the list, find the closest one
      const index = currentIndex >= 0 ? currentIndex :
        imageSizes.reduce((prev, curr, idx) =>
          Math.abs(curr - currentSize) < Math.abs(imageSizes[prev] - currentSize) ? idx : prev, 0);

      // Get next size (if at last, stay at last)
      const newIndex = Math.min(imageSizes.length - 1, index + 1);
      const newSize = imageSizes[newIndex];

      if (newIndex === imageSizes.length - 1) {
        zoomInImageButton.disabled = true;
      }

      if (newIndex === 1) {
        zoomOutImageButton.disabled = false;
      }

      chrome.runtime.sendMessage(
        {
          type: "SET_IMAGE_SIZE",
          size: newSize
        },
        (response) => {
          if (!chrome.runtime.lastError) {
            // Refresh tab list to show updated image sizes
            loadTabs().catch(err => console.error("Error loading tabs:", err));
          }
        }
      );
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const country = (countrySelect.value || "").trim();

    if (!country) {
      statusEl.textContent = "Please type a country name first.";
      return;
    }

    // Save preferred location
    chrome.runtime.sendMessage(
      {
        type: "SET_PREFERRED_LOCATION",
        country
      },
      () => {
        // Update select to show selected country
        countrySelect.value = country;
        // Refresh tab list to show updated preferred status
        loadTabs();
        // Continue with closing tabs
      }
    );

    statusEl.textContent = "Closing tabs not in preferred location...";

    chrome.runtime.sendMessage(
      {
        type: "CLOSE_TABS_NOT_IN_PREFERRED_LOCATION"
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