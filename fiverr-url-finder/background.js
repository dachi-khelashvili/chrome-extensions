// Listen for scan request from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAllTabs') {
    scanAllTabs()
      .then(urls => {
        sendResponse({ urls: urls });
      })
      .catch(error => {
        console.error('Error scanning tabs:', error);
        sendResponse({ urls: [], error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

// Scan all tabs for anchor elements with the specified class
async function scanAllTabs() {
  const allUrls = [];
  
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    // Process each tab
    for (const tab of tabs) {
      // Skip chrome:// and other non-http(s) URLs
      if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
        continue;
      }
      
      try {
        // Inject content script and get URLs
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractUrls
        });
        
        if (results && results[0] && results[0].result) {
          allUrls.push(...results[0].result);
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
  return [...new Set(allUrls)];
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

