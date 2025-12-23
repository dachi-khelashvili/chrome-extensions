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

  function extractFreelancerInfo() {
    // Extract image - try multiple selectors
    let imageUrl = "";
    
    // Try selector with class _482b46
    const imgWithClass = document.querySelector('img._482b46[src*="profile/photo"]');
    if (imgWithClass && imgWithClass.src) {
      imageUrl = imgWithClass.src;
    }
    
    // Try cloudinary profile photo
    if (!imageUrl) {
      const profileImg = document.querySelector('img[src*="fiverr-res.cloudinary.com"][src*="profile/photo"]');
      if (profileImg && profileImg.src) {
        imageUrl = profileImg.src;
      }
    }
    
    // Try any img with profile/photo in src
    if (!imageUrl) {
      const anyProfileImg = document.querySelector('img[src*="profile/photo"]');
      if (anyProfileImg && anyProfileImg.src) {
        imageUrl = anyProfileImg.src;
      }
    }
    
    // Extract name - try multiple selectors
    let freelancerName = "";
    
    // Try h1 with aria-label="Public Name"
    const nameElement = document.querySelector('h1[aria-label="Public Name"]');
    if (nameElement) {
      freelancerName = nameElement.textContent.trim() || "";
    }
    
    // Try h1 with classes
    if (!freelancerName) {
      const nameEl = document.querySelector('h1.tbody-2.text-bold.co-text-darkest, h1.text-bold.co-text-darkest');
      if (nameEl) {
        freelancerName = nameEl.textContent.trim() || "";
      }
    }
    
    // Try any h1 in the profile area
    if (!freelancerName) {
      const anyH1 = document.querySelector('h1');
      if (anyH1) {
        freelancerName = anyH1.textContent.trim() || "";
      }
    }
    
    // Extract location and languages
    // Both use the same selector structure: span.xvxemck.y89fkm1gt.y89fkm1eb.y89fkm7.y89fkm2[data-track-tag="text"]
    // First one is location, second one is languages
    let location = "";
    let locationText = "";
    let languages = [];
    let languagesText = "";
    
    // Find all matching elements
    const allMatchingElements = document.querySelectorAll('span.xvxemck.y89fkm1gt.y89fkm1eb.y89fkm7.y89fkm2[data-track-tag="text"]');
    
    if (allMatchingElements.length >= 1) {
      // First element is location
      locationText = allMatchingElements[0].textContent.trim() || "";
      location = locationText;
    }
    
    if (allMatchingElements.length >= 2) {
      // Second element is languages
      languagesText = allMatchingElements[1].textContent.trim() || "";
      if (languagesText) {
        // Split by comma and trim each language
        languages = languagesText.split(',').map(lang => lang.trim()).filter(lang => lang.length > 0);
      }
    }
    
    // Fallback: if we didn't find using specific selector, try generic selector
    if (locationText === "" && languages.length === 0) {
      const allTrackTags = document.querySelectorAll('span[data-track-tag="text"]');
      const texts = Array.from(allTrackTags).map(el => el.textContent.trim()).filter(text => text.length > 0);
      
      if (texts.length >= 1) {
        // First one could be location
        locationText = texts[0];
        location = locationText;
      }
      
      if (texts.length >= 2) {
        // Second one could be languages
        const secondText = texts[1];
        // Check if it looks like a language list (contains comma-separated capitalized words)
        if (secondText.includes(',')) {
          languagesText = secondText;
          languages = secondText.split(',').map(lang => lang.trim()).filter(lang => lang.length > 0);
        }
      }
    }
    
    return { imageUrl, freelancerName, location, locationText, languages, languagesText };
  }

  function sendLocalTimeToBackground() {
    const result = findLocalTimeElement();
    const freelancerInfo = extractFreelancerInfo();
    
    if (!result) {
      // Send message that there's no local time
      chrome.runtime.sendMessage(
        {
          type: "NO_LOCAL_TIME",
          imageUrl: freelancerInfo.imageUrl,
          freelancerName: freelancerInfo.freelancerName,
          location: freelancerInfo.location || "",
          locationText: freelancerInfo.locationText || "",
          languages: freelancerInfo.languages || [],
          languagesText: freelancerInfo.languagesText || ""
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
        offsetMinutes,
        imageUrl: freelancerInfo.imageUrl,
        freelancerName: freelancerInfo.freelancerName,
        location: freelancerInfo.location || "",
        locationText: freelancerInfo.locationText || "",
        languages: freelancerInfo.languages || [],
        languagesText: freelancerInfo.languagesText || ""
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
