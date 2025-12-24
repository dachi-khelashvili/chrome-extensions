// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAllTabs') {
    scanAllTabs()
      .then(result => {
        sendResponse({ urls: result.urls, tabIds: result.tabIds });
      })
      .catch(error => {
        console.error('Error scanning tabs:', error);
        sendResponse({ urls: [], tabIds: [], error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
  
  if (request.action === 'closeTabs') {
    closeTabs(request.tabIds)
      .then(closed => {
        sendResponse({ closed: closed });
      })
      .catch(error => {
        console.error('Error closing tabs:', error);
        sendResponse({ closed: 0, error: error.message });
      });
    
    return true;
  }
  
  if (request.action === 'openTabs') {
    openTabs(request.urls)
      .then(opened => {
        sendResponse({ opened: opened });
      })
      .catch(error => {
        console.error('Error opening tabs:', error);
        sendResponse({ opened: 0, error: error.message });
      });
    
    return true;
  }
});

// Open multiple tabs
async function openTabs(urls) {
  if (!urls || urls.length === 0) return 0;
  
  let opened = 0;
  for (let i = 0; i < urls.length; i++) {
    try {
      await chrome.tabs.create({
        url: urls[i],
        active: i === 0 // Only first tab is active
      });
      opened++;
      // Small delay to avoid overwhelming the browser
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } catch (error) {
      console.error(`Error opening tab ${i + 1}/${urls.length}:`, error);
    }
  }
  
  return opened;
}

// Close multiple tabs
async function closeTabs(tabIds) {
  if (!tabIds || tabIds.length === 0) return 0;
  
  let closed = 0;
  for (const tabId of tabIds) {
    try {
      await chrome.tabs.remove(tabId);
      closed++;
    } catch (error) {
      console.error(`Error closing tab ${tabId}:`, error);
    }
  }
  
  return closed;
}

// Scan all tabs for anchor elements with the specified class
async function scanAllTabs() {
  const allUrls = [];
  const scannedTabIds = [];
  
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    // Process each tab
    for (const tab of tabs) {
      // Skip chrome:// and other non-http(s) URLs
      if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
        continue;
      }
      
      // Check if tab URL itself is a freelancer URL
      if (tab.url.includes('pro.fiverr.com/freelancers/')) {
        const cleanUrl = tab.url.split('?')[0].split('#')[0];
        if (cleanUrl.includes('/freelancers/')) {
          allUrls.push(cleanUrl);
          scannedTabIds.push(tab.id);
        }
      }
      
      try {
        // Inject content script and get URLs
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractUrls
        });
        
        if (results && results[0] && results[0].result) {
          allUrls.push(...results[0].result);
          scannedTabIds.push(tab.id);
        }
      } catch (error) {
        // Some tabs may not be accessible (e.g., chrome:// pages)
        console.log(`Could not access tab ${tab.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error getting tabs:', error);
  }
  
  // Remove duplicates
  return {
    urls: [...new Set(allUrls)],
    tabIds: [...new Set(scannedTabIds)]
  };
}

// Function to extract URLs from the page (runs in page context)
function extractUrls() {
  const urls = [];
  
  // Find all anchor elements with the specified class
  const anchors = document.querySelectorAll('a.text-bold._1lc1p3l2');
  
  anchors.forEach(anchor => {
    const href = anchor.getAttribute('href');
    if (href) {
      urls.push(href);
    }
  });
  
  return urls;
}

