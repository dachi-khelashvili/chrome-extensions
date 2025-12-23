// Cache for minimum online count and alpha value
let cachedMinOnlineCount = 500;
let cachedAlphaValue = 0.1;

// Get minimum online count from storage
async function getMinOnlineCount() {
  const result = await chrome.storage.sync.get(['minOnlineCount']);
  const count = result.minOnlineCount || 500;
  cachedMinOnlineCount = count;
  return count;
}

// Get alpha value from storage
async function getAlphaValue() {
  const result = await chrome.storage.sync.get(['alphaValue']);
  const alpha = result.alphaValue !== undefined ? result.alphaValue : 0.1;
  cachedAlphaValue = alpha;
  return alpha;
}

// Apply dimming to servers on the page
function dimServers() {
  const minOnlineCount = cachedMinOnlineCount;
  const alphaValue = cachedAlphaValue;
  const transitionGroups = document.querySelectorAll('div._4cb8ad5be329b603-container');
  
  transitionGroups.forEach(group => {
    // Find elements
    let titleElement = group.querySelector('h2._4cb8ad5be329b603-guildName');
    if (!titleElement) {
      const h2Elements = group.querySelectorAll('h2');
      for (const h2 of h2Elements) {
        if (h2.className.includes('guildName')) {
          titleElement = h2;
          break;
        }
      }
    }
    
    let descElement = group.querySelector('div._4cb8ad5be329b603-description');
    if (!descElement) {
      const divs = group.querySelectorAll('div');
      for (const div of divs) {
        if (div.className.includes('description')) {
          descElement = div;
          break;
        }
      }
    }
    
    let onlineCountElement = group.querySelector('div._4cb8ad5be329b603-memberDetailsText');
    if (!onlineCountElement) {
      const divs = group.querySelectorAll('div');
      for (const div of divs) {
        if (div.className.includes('memberDetailsText')) {
          onlineCountElement = div;
          break;
        }
      }
    }
    
    if (!titleElement || !descElement || !onlineCountElement) return;
    
    const title = titleElement.textContent.trim();
    const description = descElement.textContent.trim();
    const onlineCountText = onlineCountElement.textContent.trim();
    
    // Check conditions
    const hasLGBTQ = window.DiscordServerUtils.detectLGBTQContent(title, description).isLGBTQ;
    const language = window.DiscordServerUtils.detectServerLanguage(title, description).language;
    const isNotEnglish = language !== 'English';
    
    // Parse online count
    const onlineCountMatch = onlineCountText.match(/[\d,]+/);
    const onlineCountNum = onlineCountMatch ? parseInt(onlineCountMatch[0].replace(/,/g, ''), 10) : 0;
    const isLowCount = onlineCountNum < minOnlineCount;
    
    // Apply opacity if any condition is met
    if (hasLGBTQ || isNotEnglish || isLowCount) {
      group.style.opacity = alphaValue.toString();
    } else {
      group.style.opacity = '1';
    }
  });
}

// Extract Discord server data from the page
function extractServerData() {
  const servers = [];
  
  // Find all transition group divs
  const transitionGroups = document.querySelectorAll('div._4cb8ad5be329b603-guildDetails');
  transitionGroups.forEach(group => {
    // Find title (h2) - try multiple selector approaches
    let titleElement = group.querySelector('h2._4cb8ad5be329b603-guildName');
    if (!titleElement) {
      // Fallback: look for h2 with class containing guildName
      const h2Elements = group.querySelectorAll('h2');
      for (const h2 of h2Elements) {
        if (h2.className.includes('guildName')) {
          titleElement = h2;
          break;
        }
      }
    }
    
    // Find description div - try selector with escaped slash
    let descElement = group.querySelector('div._4cb8ad5be329b603-description');
    if (!descElement) {
      // Fallback: look for div with class containing description
      const divs = group.querySelectorAll('div');
      for (const div of divs) {
        if (div.className.includes('description')) {
          descElement = div;
          break;
        }
      }
    }
    
    // Find online count div with specific class
    let onlineCountElement = group.querySelector('div._4cb8ad5be329b603-memberDetailsText');
    if (!onlineCountElement) {
      // Fallback: look for div with class containing memberDetailsText
      const divs = group.querySelectorAll('div');
      for (const div of divs) {
        if (div.className.includes('memberDetailsText')) {
          onlineCountElement = div;
          break;
        }
      }
    }
    
    // Only add if we have all three elements
    if (titleElement && descElement && onlineCountElement) {
      servers.push({
        title: titleElement.textContent.trim(),
        description: descElement.textContent.trim(),
        onlineCount: onlineCountElement.textContent.trim()
      });
    }
  });
  
  return servers;
}

function refreshServers() {
  const servers = extractServerData();
  sendResponse({ servers: servers });
}      

// Initialize and apply dimming when page loads
Promise.all([getMinOnlineCount(), getAlphaValue()]).then(() => {
  dimServers();
});

// Watch for DOM changes (Discord uses dynamic content loading)
const observer = new MutationObserver(() => {
  dimServers();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getServers') {
    const servers = extractServerData();
    sendResponse({ servers: servers });
  } else if (request.action === 'updateDimming') {
    // Update dimming when settings change
    if (request.minOnlineCount !== undefined) {
      cachedMinOnlineCount = request.minOnlineCount;
    }
    if (request.alphaValue !== undefined) {
      cachedAlphaValue = request.alphaValue;
    }
    dimServers();
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});
