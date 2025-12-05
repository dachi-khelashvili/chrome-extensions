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

let countriesByContinent = {};
let expandedRows = new Set();

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

function renderTabs(tabs) {
  const container = document.getElementById("tabs-container");
  container.innerHTML = "";

  if (!tabs || tabs.length === 0) {
    container.textContent = "No Fiverr tabs found.";
    return;
  }

  // Create table
  const table = document.createElement("table");
  table.className = "tabs-table";

  tabs.forEach((info, index) => {
    const row = document.createElement("tr");
    row.className = "tab-row";
    row.dataset.tabIndex = index;
    
    if (expandedRows.has(index)) {
      row.classList.add("expanded");
    }

    const number = (index + 1).toString().padStart(2, "0");
    
    let localTimeText = "No local time";
    let preferredStatus = "";
    
    if (info.hasLocalTime) {
      const timeStr = formatTime(info.hours24, info.minutes);
      localTimeText = timeStr || "No local time";
      
      if (info.isPreferredLocation) {
        preferredStatus = "✓ Preferred";
      } else {
        preferredStatus = "✗ Not preferred";
      }
    } else {
      preferredStatus = "No local time";
    }

    // Create cells: Number | Local Time | Preferred Status
    const cell1 = document.createElement("td");
    cell1.textContent = number;
    cell1.className = "col-number";

    const cell2 = document.createElement("td");
    cell2.textContent = localTimeText;
    cell2.className = "col-time";

    const cell3 = document.createElement("td");
    cell3.textContent = preferredStatus;
    cell3.className = "col-status";
    if (info.isPreferredLocation) {
      cell3.classList.add("preferred");
    } else if (!info.hasLocalTime) {
      cell3.classList.add("no-local-time");
    } else {
      cell3.classList.add("not-preferred");
    }

    row.appendChild(cell1);
    row.appendChild(cell2);
    row.appendChild(cell3);

    table.appendChild(row);

    // Add expandable content row
    if (expandedRows.has(index) && info.hasLocalTime && info.countries && info.countries.length > 0) {
      const expandRow = document.createElement("tr");
      expandRow.className = "expand-row";
      const expandCell = document.createElement("td");
      expandCell.colSpan = 3;
      expandCell.className = "expand-content";

      const countriesList = info.rawCountries || info.countries;
      // Extract base country names from formatted strings (remove state info)
      const baseCountries = countriesList.map(c => {
        // Remove state info like "United States(Ohio)" -> "United States"
        const match = c.match(/^([^(]+)/);
        return match ? match[1].trim() : c;
      });
      
      // Show states for US, Canada, Australia
      const statesPromises = baseCountries
        .filter(country => ["United States", "Canada", "Australia"].includes(country))
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
      
      // Get preferred location and show countries in this timezone organized by continent
      chrome.runtime.sendMessage({ type: "GET_PREFERRED_LOCATION" }, (prefResponse) => {
        const preferredLocation = prefResponse?.preferredLocation || "";
        
        // Get all countries in this timezone
        chrome.runtime.sendMessage({
          type: "GET_COUNTRIES_FOR_TIMEZONE",
          offsetMinutes: info.offsetMinutes
        }, (tzResponse) => {
          const allCountriesInTimezone = tzResponse?.countries || [];
          
          Promise.all(statesPromises).then(statesData => {
            const validStatesData = statesData.filter(s => s !== null);
            
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
            
            // Organize countries by continent
            const continentsList = Object.entries(countriesByContinent)
              .map(([continent, continentCountries]) => {
                // Filter to only countries that are in this timezone
                const matchingCountries = continentCountries.filter(c => 
                  allCountriesInTimezone.includes(c)
                );
                return { continent, countries: matchingCountries };
              })
              .filter(({ countries }) => countries.length > 0); // Only show continents with matching countries
            
            // Show countries organized by continent
            if (continentsList.length > 0) {
              const continentsDiv = document.createElement("div");
              continentsDiv.className = "continents-list";
              
              continentsList.forEach(({ continent, countries }) => {
                const continentDiv = document.createElement("div");
                continentDiv.className = "continent-group";
                continentDiv.style.marginBottom = "10px";
                
                // Format countries with states inline
                const continentTitle = document.createElement("strong");
                continentTitle.textContent = `${continent}: `;
                continentDiv.appendChild(continentTitle);
                
                const countriesContainer = document.createElement("span");
                countriesContainer.style.fontSize = "11px";
                countriesContainer.style.color = "#555";
                
                countries.forEach((country, index) => {
                  if (index > 0) {
                    countriesContainer.appendChild(document.createTextNode(", "));
                  }
                  
                  if (["United States", "Canada", "Australia"].includes(country)) {
                    const statesInfo = validStatesData.find(s => s.country === country);
                    if (statesInfo && statesInfo.states.length > 0) {
                      // Format as "United States(Ohio, California, Miami)"
                      const countrySpan = document.createElement("span");
                      countrySpan.textContent = country;
                      countriesContainer.appendChild(countrySpan);
                      
                      const statesSpan = document.createElement("span");
                      statesSpan.textContent = `(${statesInfo.states.join(", ")})`;
                      statesSpan.style.opacity = "0.6"; // Make states transparent
                      countriesContainer.appendChild(statesSpan);
                    } else {
                      countriesContainer.appendChild(document.createTextNode(country));
                    }
                  } else {
                    countriesContainer.appendChild(document.createTextNode(country));
                  }
                });
                
                continentDiv.appendChild(countriesContainer);
                
                continentsDiv.appendChild(continentDiv);
              });
              
              expandCell.appendChild(continentsDiv);
            } else if (allCountriesInTimezone.length > 0) {
              // Fallback: show countries without continent grouping if continent data not available
              const countriesDiv = document.createElement("div");
              countriesDiv.style.fontSize = "11px";
              countriesDiv.style.color = "#555";
              countriesDiv.textContent = allCountriesInTimezone.join(", ");
              expandCell.appendChild(countriesDiv);
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

    // Make row clickable
    row.addEventListener("click", () => {
      if (!info.hasLocalTime) {
        // Navigate to tab if no local time
        chrome.tabs.update(info.tabId, { active: true }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error navigating to tab:", chrome.runtime.lastError);
          }
        });
        return;
      }
      
      // Toggle expand/collapse for tabs with local time
      if (expandedRows.has(index)) {
        expandedRows.delete(index);
      } else {
        expandedRows.add(index);
      }
      renderTabs(tabs);
    });
  });

  container.appendChild(table);
}

function loadTabs() {
  return new Promise(async (resolve) => {
    await getCountriesByContinent();
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

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("filter-form");
  const input = document.getElementById("country-input");
  const statusEl = document.getElementById("status");
  const recheckButton = document.getElementById("recheck-button");
  const container = document.getElementById("tabs-container");

  // Load preferred location
  chrome.runtime.sendMessage({ type: "GET_PREFERRED_LOCATION" }, (response) => {
    if (!chrome.runtime.lastError && response?.preferredLocation) {
      input.value = response.preferredLocation;
    }
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
  await getCountriesByContinent();
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

    // Save preferred location
    chrome.runtime.sendMessage(
      {
        type: "SET_PREFERRED_LOCATION",
        country
      },
      () => {
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