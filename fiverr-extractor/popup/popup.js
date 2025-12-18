const emailsBox = document.getElementById("emails");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");

let fiverrUrls = [];

document.getElementById("scan").addEventListener("click", scanAllTabs);
document.getElementById("copy").addEventListener("click", copyAll);
document.getElementById("close").addEventListener("click", closeAll);

async function scanAllTabs() {
    statusEl.className = "";
    statusEl.textContent = "Scanning all tabs…";
    emailsBox.textContent = "";
    countEl.textContent = "0";

    try {
        const tabs = await chrome.tabs.query({});
        // Only inject into http/https tabs (Chrome blocks chrome://, Web Store, PDFs, etc.)
        const candidates = tabs.filter(t => t.url && /^https?:\/\//i.test(t.url));

        const injections = await Promise.allSettled(
            candidates.map(tab =>
                chrome.scripting.executeScript({
                    target: { tabId: tab.id, allFrames: true },
                    func: () => {
                        // Runs IN THE TAB
                        const found = new Set();

                        // mailto: links (can contain multiple emails separated by , or ;)
                        document.querySelectorAll('a[class^="text-bold _1lc1p3l2"]').forEach(a => {
                            const href = a.getAttribute("href") || "";
                            const text = a.textContent;
                            const raw = href.split("?")[0];
                            
                                found.add(`https://pro.fiverr.com/freelancers${raw}`);
                        });

                        return Array.from(found);
                    }
                })
            )
        );

        // Collect results from all frames of all tabs
        const aggregate = [];
        for (const res of injections) {
            if (res.status === "fulfilled" && Array.isArray(res.value)) {
                for (const frame of res.value) {
                    if (frame && Array.isArray(frame.result)) {
                        aggregate.push(...frame.result);
                    }
                }
            }
        }

        // De-duplicate (case-insensitive), trim
        const seen = new Set();
        const deduped = [];
        for (const e of aggregate) {
            const clean = e.trim();
            const key = clean.toLowerCase();
            if (clean && !seen.has(key)) {
                seen.add(key);
                deduped.push(clean);
            }
        }

        fiverrUrls = deduped;
        emailsBox.textContent = deduped.length ? deduped.join("\n") : "No URLs found.";
        countEl.textContent = String(deduped.length);

        // Note about blocked pages
        const blockedCount = tabs.length - candidates.length;
        statusEl.className = "";
        statusEl.textContent = blockedCount > 0
            ? `Scan complete. Skipped ${blockedCount} disallowed tab(s).`
            : "Scan complete.";
    } catch (err) {
        emailsBox.textContent = "Error: " + err.message;
        statusEl.className = "error";
        statusEl.textContent = "Scan failed. Please try again.";
    }
}

async function copyAll() {
    if (!fiverrUrls.length) {
        statusEl.className = "";
        statusEl.textContent = "No results to copy. Please scan first.";
        return;
    }
    try {
        await navigator.clipboard.writeText(fiverrUrls.join("\n"));
        statusEl.className = "";
        statusEl.textContent = `Copied ${fiverrUrls.length} URL${fiverrUrls.length === 1 ? '' : 's'} to clipboard!`;
        setTimeout(() => (statusEl.textContent = ""), 2000);
    } catch (e) {
        statusEl.className = "error";
        statusEl.textContent = "Clipboard access denied. Please try again.";
    }
}

async function closeAll() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (tab.url && tab.url.includes("pro.fiverr.com/categories") && !tab.url.includes("page=1&")) {
                chrome.tabs.remove(tab.id);
            }
        });
    });
}