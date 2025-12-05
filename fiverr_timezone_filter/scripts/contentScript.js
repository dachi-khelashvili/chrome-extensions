// contentScript.js

(function () {
  if (window.__fiverrLocalTimeProcessed) return;
  window.__fiverrLocalTimeProcessed = true;

  function parseLocalTime(text) {
    // Examples: "03:06 AM local time", "3:06 pm local time"
    const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*local time/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();

    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    return { hours24: hours, minutes, raw: match[0] };
  }

  function findLocalTimeElement() {
    const nodes = document.querySelectorAll("div, span, p");
    for (const el of nodes) {
      const text = el.textContent.trim();
      if (/local time/i.test(text)) {
        const parsed = parseLocalTime(text);
        if (parsed) {
          return { el, parsed, fullText: text };
        }
      }
    }
    return null;
  }

  function computeOffsetMinutes(localHours, localMinutes) {
    const now = new Date();
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    let localTotal = localHours * 60 + localMinutes;

    // Difference in minutes
    let diff = localTotal - utcMinutes;

    // Normalize to range -720..+720 (approx -12h..+12h)
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;

    return diff;
  }

  function sendLocalTimeToBackground() {
    const result = findLocalTimeElement();
    if (!result) {
      // Send message that there's no local time
      chrome.runtime.sendMessage(
        {
          type: "NO_LOCAL_TIME"
        },
        () => {
          // ignore response
        }
      );
      return;
    }

    const { parsed, fullText } = result;
    const offsetMinutes = computeOffsetMinutes(parsed.hours24, parsed.minutes);

    chrome.runtime.sendMessage(
      {
        type: "LOCAL_TIME_INFO",
        localTimeText: fullText,
        hours24: parsed.hours24,
        minutes: parsed.minutes,
        offsetMinutes
      },
      () => {
        // ignore response
      }
    );
  }

  function runExtraction() {
    sendLocalTimeToBackground();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    runExtraction();
  } else {
    document.addEventListener("DOMContentLoaded", runExtraction);
  }

  // Listen for recheck messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "RECHECK") {
      // Clear the processed flag to allow re-extraction
      delete window.__fiverrLocalTimeProcessed;
      runExtraction();
      sendResponse({ status: "ok" });
    }
  });
})();
