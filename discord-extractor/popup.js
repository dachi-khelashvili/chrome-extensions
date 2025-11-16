const emailsBox = document.getElementById("emails");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");
const locationEl = document.getElementById("location");
const dateEl = document.getElementById("date");
const pageEl = document.getElementById("page");
const openEl = document.getElementById("open");

let lastEmails = [];
let githubUrls = [];
let pageNumber = 1;
let totalCount = 0;
let prevTime = new Date();

document.getElementById("scan").addEventListener("click", scanAllTabs);
document.getElementById("copy").addEventListener("click", copyAll);

async function scanAllTabs() {
    statusEl.textContent = "Scanning…";
    emailsBox.textContent = "";
    countEl.textContent = "0";
    lastEmails = [];

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
                        document.querySelectorAll('a[class^="button button-join is-discord"]').forEach(a => {
                            const href = a.getAttribute("href") || "";
                            found.add("https://disboard.org"+href);
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

        lastEmails = deduped;
        emailsBox.textContent = deduped.length ? deduped.join("\n") : "No emails found.";
        countEl.textContent = `(${String(deduped.length)})`;

        // Note about blocked pages
        const blockedCount = tabs.length - candidates.length;
        statusEl.textContent = blockedCount > 0
            ? `Done. Skipped ${blockedCount} disallowed tab(s) (e.g., chrome://, Web Store, PDFs).`
            : "Done.";
    } catch (err) {
        emailsBox.textContent = "Error: " + err.message;
        statusEl.textContent = "Failed.";
    }
}

async function copyAll() {
    if (!lastEmails.length) {
        statusEl.textContent = "Nothing to copy.";
        return;
    }
    try {
        await navigator.clipboard.writeText(lastEmails.join("\n"));
        statusEl.textContent = "Copied!";
        setTimeout(() => (statusEl.textContent = ""), 1200);
    } catch (e) {
        statusEl.textContent = "Clipboard blocked. Try again.";
    }
}