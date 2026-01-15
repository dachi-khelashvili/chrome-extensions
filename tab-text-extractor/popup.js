const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");
const tokenEl = document.getElementById("token");
const apiUrlEl = document.getElementById("apiUrl");
const keywordEl = document.getElementById("keyword");
const startTimeEl = document.getElementById("startTime");
const endTimeEl = document.getElementById("endTime");
const searchBtn = document.getElementById("search");
const stopSearchBtn = document.getElementById("stopSearch");
const totalUrlCountEl = document.getElementById("totalUrlCount");
const todoUrlCountEl = document.getElementById("todoUrlCount");
const totalEmailCountEl = document.getElementById("totalEmailCount");
const todoEmailCountEl = document.getElementById("todoEmailCount");
const openUrlCountEl = document.getElementById("openUrlCount");
const copyEmailCountEl = document.getElementById("copyEmailCount");
const scanMailBtn = document.getElementById("scanMail");
const closeGithubTabsBtn = document.getElementById("closeGithubTabs");
const openUrlBtn = document.getElementById("openUrl");
const emailCountIndicatorEl = document.getElementById("emailCountIndicator");

let indicatorInterval = null;

let pageNumber = 1;
let totalCount = 0;
let isLoadingMore = false;

// Local storage keys
const STORAGE_KEY_TOTAL_URLS = "totalUrls";
const STORAGE_KEY_TODO_URLS = "todoUrls";
const STORAGE_KEY_TOTAL_EMAILS = "totalEmails";
const STORAGE_KEY_TODO_EMAILS = "todoEmails";
const STORAGE_KEY_KEYWORD = "keyword";
const STORAGE_KEY_START_TIME = "startTime";
const STORAGE_KEY_END_TIME = "endTime";
const STORAGE_KEY_TOKEN = "githubToken";

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
    // Set up event listeners
    document.getElementById("scanMail").addEventListener("click", scanMailFromGithubUrls);
    document.getElementById("openUrl").addEventListener("click", openUrls);
    document.getElementById("copyEmail").addEventListener("click", copyEmails);
    document.getElementById("search").addEventListener("click", handleSearch);
    document.getElementById("stopSearch").addEventListener("click", stopSearch);
    document.getElementById("reset").addEventListener("click", resetData);
    document.getElementById("addEmails").addEventListener("click", addEmailsManually);
    document.getElementById("closeGithubTabs").addEventListener("click", closeGithubTabs);

    // Load saved values
    loadSavedValues();
    updateCounts();
});

async function handleSearch() {
    if (!isLoadingMore) {
        // First search
        pageNumber = 1;
        const token = tokenEl.value;
        const keyword = keywordEl.value;
        const startTime = startTimeEl.value;
        const endTime = endTimeEl.value;

        // Save to local storage
        localStorage.setItem(STORAGE_KEY_TOKEN, token);
        localStorage.setItem(STORAGE_KEY_KEYWORD, keyword);
        localStorage.setItem(STORAGE_KEY_START_TIME, startTime);
        localStorage.setItem(STORAGE_KEY_END_TIME, endTime);

        await searchGithubUsers(token, keyword, startTime, endTime, pageNumber);
    } else {
        // Next search
        pageNumber++;
        const token = localStorage.getItem(STORAGE_KEY_TOKEN) || "";
        const keyword = localStorage.getItem(STORAGE_KEY_KEYWORD) || "";
        const startTime = localStorage.getItem(STORAGE_KEY_START_TIME) || "";
        const endTime = localStorage.getItem(STORAGE_KEY_END_TIME) || "";

        await searchGithubUsers(token, keyword, startTime, endTime, pageNumber);
    }
}

async function searchGithubUsers(token, keyword, startTime, endTime, page) {
    statusEl.textContent = "Searching...";

    let query = "";
    if (keyword) {
        query += keyword + "+";
    }
    if (startTime && endTime) {
        query += `created:${startTime}..${endTime}+`;
    } else if (startTime) {
        query += `created:>=${startTime}+`;
    } else if (endTime) {
        query += `created:<=${endTime}+`;
    }

    // Remove trailing +
    query = query.replace(/\+$/, "");

    if (!query) {
        statusEl.textContent = "Please enter at least keyword or date range.";
        return;
    }

    const url = `https://api.github.com/search/users?q=${query}&sort:joined&per_page=100&page=${page}`;

    statusEl.textContent = `Searching...`;
    apiUrlEl.textContent = query + " " + url;

    try {
        // Prepare headers with token if provided
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };

        if (token && token.trim()) {
            headers['Authorization'] = `token ${token.trim()}`;
        }

        const response = await fetch(url, {
            headers: headers
        });

        if (!response.ok) {
            const data = await response.json();
            statusEl.textContent = `API Error: ${response.status} - ${data.message || "Unknown error"}`;
            return;
        }

        const data = await response.json();
        totalCount = data.total_count;

        const newUrls = data.items
            .filter(user => user.type === "User")
            .map(user => `https://github.com/${user.login}`);

        // Get total URLs and todo URLs from storage
        const totalUrls = getTotalUrlsFromStorage();
        const todoUrls = getTodoUrlsFromStorage();

        // Create a set of total URLs to check for duplicates
        const totalUrlSet = new Set();
        totalUrls.forEach(url => totalUrlSet.add(url.toLowerCase()));

        // Add only non-duplicated URLs (not in total)
        const uniqueNewUrls = newUrls.filter(url => !totalUrlSet.has(url.toLowerCase()));

        // Add new URLs to both total and todo
        const updatedTotalUrls = [...totalUrls, ...uniqueNewUrls];
        const updatedTodoUrls = [...todoUrls, ...uniqueNewUrls];

        // Save to local storage
        localStorage.setItem(STORAGE_KEY_TOTAL_URLS, JSON.stringify(updatedTotalUrls));
        localStorage.setItem(STORAGE_KEY_TODO_URLS, JSON.stringify(updatedTodoUrls));

        // Update UI
        countEl.textContent = `(${page*100 > totalCount ? totalCount : page*100})`;
        statusEl.textContent = `Found ${uniqueNewUrls.length} new URLs. Total: ${page*100 > totalCount ? totalCount : page*100}/${totalCount}, Todo: ${updatedTodoUrls.length}`;

        // Check if we've reached total count
        if (page*100 >= totalCount) {
            // Re-enable inputs
            resetSearchState();
        } else {
            // Disable inputs and change button
            setNextSearchState();
        }

        updateCounts();
    } catch (err) {
        statusEl.textContent = "Error: " + err.message;
    }
}

function getTotalUrlsFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY_TOTAL_URLS);
    return stored ? JSON.parse(stored) : [];
}

function getTodoUrlsFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY_TODO_URLS);
    return stored ? JSON.parse(stored) : [];
}

function getTotalEmailsFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY_TOTAL_EMAILS);
    return stored ? JSON.parse(stored) : [];
}

function getTodoEmailsFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY_TODO_EMAILS);
    return stored ? JSON.parse(stored) : [];
}

function updateCounts() {
    const totalUrls = getTotalUrlsFromStorage();
    const todoUrls = getTodoUrlsFromStorage();
    const totalEmails = getTotalEmailsFromStorage();
    const todoEmails = getTodoEmailsFromStorage();
    totalUrlCountEl.textContent = `${totalUrls.length} URLs`
    todoUrlCountEl.textContent = `/ ${todoUrls.length}`;
    totalEmailCountEl.textContent = `${totalEmails.length} Emails`;
    todoEmailCountEl.textContent = `/ ${todoEmails.length}`;
}

async function scanMailFromGithubUrls() {
    statusEl.textContent = "Scanning emails from GitHub URLs...";
    scanMailBtn.disabled = true;
    closeGithubTabsBtn.disabled = false;
    openUrlBtn.disabled = true;

    try {
        // Get all tabs
        const tabs = await chrome.tabs.query({});

        // Filter only GitHub username URLs (https://github.com/*)
        const githubTabs = tabs.filter(tab =>
            tab.url && tab.url.startsWith("https://github.com/")
        );

        if (githubTabs.length === 0) {
            statusEl.textContent = "No open GitHub tabs found. Open some GitHub URLs first.";
            return;
        }

        // Extract emails from these tabs
        const emailSet = new Set();
        const totalEmails = getTotalEmailsFromStorage();

        // Add total emails to set to check for duplicates
        totalEmails.forEach(email => emailSet.add(email.toLowerCase()));

        for (const tab of githubTabs) {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: () => {
                        const found = new Set();
                        const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

                        // Text on page
                        const text = (document.body && document.body.innerText) || "";
                        const textMatches = text.match(emailRegex);
                        if (textMatches) textMatches.forEach(e => found.add(e.toLowerCase()));

                        // mailto: links
                        document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
                            const href = a.getAttribute("href") || "";
                            const raw = href.replace(/^mailto:/i, "").split("?")[0];
                            raw.split(/[;,]/).forEach(part => {
                                const m = part.match(emailRegex);
                                if (m) m.forEach(e => found.add(e.toLowerCase()));
                            });
                        });

                        return Array.from(found);
                    }
                });

                for (const result of results) {
                    if (result.result && Array.isArray(result.result)) {
                        result.result.forEach(email => {
                            const lowerEmail = email.toLowerCase().trim();
                            if (lowerEmail && !emailSet.has(lowerEmail)) {
                                emailSet.add(lowerEmail);
                            }
                        });
                    }
                }
            } catch (err) {
                // Some tabs may not be accessible (chrome://, etc.)
                console.error(`Error scanning tab ${tab.url}:`, err);
            }
        }

        // Get new emails (not in total)
        const allFoundEmails = Array.from(emailSet);
        const newEmails = allFoundEmails.filter(email => {
            return !totalEmails.some(e => e.toLowerCase() === email.toLowerCase());
        });

        // Add new emails to both total and todo
        const updatedTotalEmails = [...totalEmails, ...newEmails];
        const todoEmails = getTodoEmailsFromStorage();
        const updatedTodoEmails = [...todoEmails, ...newEmails];

        // Save to local storage
        localStorage.setItem(STORAGE_KEY_TOTAL_EMAILS, JSON.stringify(updatedTotalEmails));
        localStorage.setItem(STORAGE_KEY_TODO_EMAILS, JSON.stringify(updatedTodoEmails));

        statusEl.textContent = `Found ${newEmails.length} new emails. Total: ${updatedTotalEmails.length}, Todo: ${updatedTodoEmails.length}`;
        updateCounts();

    } catch (err) {
        statusEl.textContent = "Error: " + err.message;
    }
}

async function openUrls() {
    openUrlBtn.disabled = true;
    scanMailBtn.disabled = false;
    closeGithubTabsBtn.disabled = true;

    const count = parseInt(openUrlCountEl.value) || 10;
    const todoUrls = getTodoUrlsFromStorage();

    if (todoUrls.length === 0) {
        statusEl.textContent = "No URLs in todo list.";
        return;
    }

    // Change indicator with smooth color transition
    if (emailCountIndicatorEl) {
        // Clear any existing interval
        if (indicatorInterval) {
            clearInterval(indicatorInterval);
        }
        
        // RGB color values
        const redColor = { r: 244, g: 67, b: 54 };    // #f44336
        const yellowColor = { r: 255, g: 193, b: 7 }; // #FFC107
        const greenColor = { r: 76, g: 175, b: 80 };  // #4CAF50
        
        const startTime = Date.now();
        const duration = 20000; // 20 seconds
        
        // Function to interpolate between two colors
        const interpolateColor = (color1, color2, factor) => {
            return {
                r: Math.round(color1.r + (color2.r - color1.r) * factor),
                g: Math.round(color1.g + (color2.g - color1.g) * factor),
                b: Math.round(color1.b + (color2.b - color1.b) * factor)
            };
        };
        
        // Update color every second
        indicatorInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            let currentColor;
            if (progress <= 0.5) {
                // First half: red to yellow
                const factor = progress * 2; // 0 to 1 over first 10 seconds
                currentColor = interpolateColor(redColor, yellowColor, factor);
            } else {
                // Second half: yellow to green
                const factor = (progress - 0.5) * 2; // 0 to 1 over next 10 seconds
                currentColor = interpolateColor(yellowColor, greenColor, factor);
            }
            
            if (emailCountIndicatorEl) {
                emailCountIndicatorEl.style.backgroundColor = 
                    `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
            }
            
            // Clear interval after 20 seconds
            if (progress >= 1) {
                clearInterval(indicatorInterval);
                indicatorInterval = null;
                // Ensure it ends at green
                if (emailCountIndicatorEl) {
                    emailCountIndicatorEl.style.backgroundColor = 
                        `rgb(${greenColor.r}, ${greenColor.g}, ${greenColor.b})`;
                }
            }
        }, 1000); // Update every second
    }

    const urlsToOpen = todoUrls.slice(0, count);

    // Open URLs in new tabs
    for (const url of urlsToOpen) {
        await chrome.tabs.create({ url, active: false });
    }

    // Remove opened URLs from todo list only (keep in total)
    const remainingTodoUrls = todoUrls.slice(count);
    localStorage.setItem(STORAGE_KEY_TODO_URLS, JSON.stringify(remainingTodoUrls));

    const totalUrls = getTotalUrlsFromStorage();
    statusEl.textContent = `Opened ${urlsToOpen.length} URLs. Total: ${totalUrls.length}, Todo: ${remainingTodoUrls.length}`;
    updateCounts();
}

async function copyEmails() {
    const count = parseInt(copyEmailCountEl.value) || 10;
    const todoEmails = getTodoEmailsFromStorage();

    if (todoEmails.length === 0) {
        statusEl.textContent = "No emails in todo list.";
        return;
    }

    const emailsToCopy = todoEmails.slice(0, count);

    try {
        await navigator.clipboard.writeText(emailsToCopy.join("\n"));

        // Remove copied emails from todo list only (keep in total)
        const remainingTodoEmails = todoEmails.slice(count);
        localStorage.setItem(STORAGE_KEY_TODO_EMAILS, JSON.stringify(remainingTodoEmails));

        const totalEmails = getTotalEmailsFromStorage();
        statusEl.textContent = `Copied ${emailsToCopy.length} emails. Total: ${totalEmails.length}, Todo: ${remainingTodoEmails.length}`;
        updateCounts();
    } catch (err) {
        statusEl.textContent = "Clipboard blocked. Try again.";
    }
}

function addEmailsManually() {
    const emailTextarea = document.getElementById("manualEmails");
    const text = emailTextarea.value.trim();

    if (!text) {
        statusEl.textContent = "Please enter emails in the text area.";
        return;
    }

    // Extract emails from text (one per line, or comma-separated)
    const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const foundEmails = text.match(emailRegex) || [];

    if (foundEmails.length === 0) {
        statusEl.textContent = "No valid emails found in the text.";
        return;
    }

    // Get total emails to check for duplicates
    const totalEmails = getTotalEmailsFromStorage();
    const totalEmailSet = new Set();
    totalEmails.forEach(email => totalEmailSet.add(email.toLowerCase()));

    // Add only new, non-duplicated emails
    const newEmails = [];
    foundEmails.forEach(email => {
        const lowerEmail = email.toLowerCase().trim();
        if (lowerEmail && !totalEmailSet.has(lowerEmail)) {
            totalEmailSet.add(lowerEmail);
            newEmails.push(lowerEmail);
        }
    });

    // Add new emails to both total and todo
    const updatedTotalEmails = [...totalEmails, ...newEmails];
    const todoEmails = getTodoEmailsFromStorage();
    const updatedTodoEmails = [...todoEmails, ...newEmails];

    // Save to storage
    localStorage.setItem(STORAGE_KEY_TOTAL_EMAILS, JSON.stringify(updatedTotalEmails));
    localStorage.setItem(STORAGE_KEY_TODO_EMAILS, JSON.stringify(updatedTodoEmails));

    // Clear textarea
    emailTextarea.value = "";

    statusEl.textContent = `Added ${newEmails.length} new emails. Total: ${updatedTotalEmails.length}, Todo: ${updatedTodoEmails.length}`;
    updateCounts();
}

async function resetData() {
    if (confirm("Reset all data? This will clear all stored URLs and emails.")) {
        localStorage.removeItem(STORAGE_KEY_TOTAL_URLS);
        localStorage.removeItem(STORAGE_KEY_TODO_URLS);
        localStorage.removeItem(STORAGE_KEY_TOTAL_EMAILS);
        localStorage.removeItem(STORAGE_KEY_TODO_EMAILS);
        localStorage.removeItem(STORAGE_KEY_KEYWORD);
        localStorage.removeItem(STORAGE_KEY_START_TIME);
        localStorage.removeItem(STORAGE_KEY_END_TIME);

        keywordEl.value = "";
        startTimeEl.value = "";
        endTimeEl.value = "";

        const emailTextarea = document.getElementById("manualEmails");
        if (emailTextarea) {
            emailTextarea.value = "";
        }

        keywordEl.disabled = false;
        startTimeEl.disabled = false;
        endTimeEl.disabled = false;
        searchBtn.textContent = "Search";

        isLoadingMore = false;
        pageNumber = 1;
        totalCount = 0;

        countEl.textContent = "(0)";
        statusEl.textContent = "Data reset.";
        updateCounts();
    }
}

function loadSavedValues() {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN) || "";
    const keyword = localStorage.getItem(STORAGE_KEY_KEYWORD) || "";
    const startTime = localStorage.getItem(STORAGE_KEY_START_TIME) || "";
    const endTime = localStorage.getItem(STORAGE_KEY_END_TIME) || "";

    tokenEl.value = token;
    keywordEl.value = keyword;
    startTimeEl.value = startTime;
    endTimeEl.value = endTime;
}

function setNextSearchState() {
    // Disable inputs and change button
    keywordEl.disabled = true;
    startTimeEl.disabled = true;
    endTimeEl.disabled = true;
    searchBtn.textContent = "Next Search";
    isLoadingMore = true;
    stopSearchBtn.style.display = "inline-block";
}

function resetSearchState() {
    // Re-enable inputs
    keywordEl.disabled = false;
    startTimeEl.disabled = false;
    endTimeEl.disabled = false;
    searchBtn.textContent = "Search";
    isLoadingMore = false;
    stopSearchBtn.style.display = "none";
}

function stopSearch() {
    resetSearchState();
    statusEl.textContent = "Search stopped. You can now modify search criteria.";
}

async function closeGithubTabs() {
    closeGithubTabsBtn.disabled = true;
    openUrlBtn.disabled = false;
    scanMailBtn.disabled = true;

    try {
        const tabs = await chrome.tabs.query({});
        const githubTabs = tabs.filter(tab =>
            tab.url && tab.url.startsWith("https://github.com/")
        );

        if (githubTabs.length === 0) {
            statusEl.textContent = "No GitHub tabs found.";
            return;
        }

        const tabIds = githubTabs.map(tab => tab.id);
        await chrome.tabs.remove(tabIds);

        statusEl.textContent = `Closed ${githubTabs.length} GitHub tab(s).`;
    } catch (err) {
        statusEl.textContent = "Error closing tabs: " + err.message;
    }
}

