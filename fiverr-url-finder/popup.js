// DOM elements
const scanButton = document.getElementById('scanButton');
const manualUrls = document.getElementById('manualUrls');
const saveManualButton = document.getElementById('saveManualButton');
const newUrlsContainer = document.getElementById('newUrlsContainer');
const copyNewButton = document.getElementById('copyNewButton');
const copyAllButton = document.getElementById('copyAllButton');
const totalCount = document.getElementById('totalCount');

// Convert relative URL to full URL
function convertToFullUrl(href) {
  if (!href) return null;
  
  // Remove query parameters
  const path = href.split('?')[0];
  
  // Extract username from path (e.g., /mikevann -> mikevann)
  const username = path.replace(/^\//, '').replace(/\/$/, '');
  
  if (!username) return null;
  
  return `https://pro.fiverr.com/freelancers/${username}`;
}

// Load and display new URLs from storage
async function loadNewUrls() {
  const result = await chrome.storage.local.get(['newUrls', 'allUrls']);
  const newUrls = result.newUrls || [];
  const allUrls = result.allUrls || [];
  
  // Update total count
  totalCount.textContent = `Total URLs in storage: ${allUrls.length}`;
  
  // Display new URLs
  if (newUrls.length === 0) {
    newUrlsContainer.innerHTML = '<p class="no-urls">No new URLs yet</p>';
    copyNewButton.style.display = 'none';
  } else {
    const urlsList = newUrls.map(url => `<div class="url-item">${url}</div>`).join('');
    newUrlsContainer.innerHTML = urlsList;
    copyNewButton.style.display = 'block';
  }
}

// Save URLs to storage (only new ones)
async function saveUrls(urls) {
  const result = await chrome.storage.local.get(['allUrls']);
  const existingUrls = new Set(result.allUrls || []);
  
  const newUrls = [];
  const allUrls = [...existingUrls];
  
  urls.forEach(url => {
    if (url && !existingUrls.has(url)) {
      existingUrls.add(url);
      allUrls.push(url);
      newUrls.push(url);
    }
  });
  
  // Save to storage
  await chrome.storage.local.set({
    allUrls: allUrls,
    newUrls: newUrls
  });
  
  // Update display
  await loadNewUrls();
  
  return newUrls;
}

// Scan button click handler
scanButton.addEventListener('click', async () => {
  scanButton.disabled = true;
  scanButton.textContent = 'Scanning...';
  
  try {
    // Send message to background script to scan all tabs
    const response = await chrome.runtime.sendMessage({ action: 'scanAllTabs' });
    
    if (response && response.urls && response.urls.length > 0) {
      const convertedUrls = response.urls
        .map(convertToFullUrl)
        .filter(url => url !== null);
      
      const newUrls = await saveUrls(convertedUrls);
      
      if (newUrls.length > 0) {
        alert(`Found ${newUrls.length} new URL(s)!`);
      } else {
        alert('No new URLs found.');
      }
    } else {
      alert('No URLs found in any tabs.');
    }
  } catch (error) {
    console.error('Error scanning tabs:', error);
    alert('Error scanning tabs. Please try again.');
  } finally {
    scanButton.disabled = false;
    scanButton.textContent = 'Scan All Tabs';
  }
});

// Save manual URLs button click handler
saveManualButton.addEventListener('click', async () => {
  const inputText = manualUrls.value.trim();
  if (!inputText) {
    alert('Please enter at least one URL.');
    return;
  }
  
  // Split by newlines and filter empty lines
  const inputUrls = inputText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(url => {
      // If it's already a full URL, use it; otherwise convert it
      if (url.startsWith('http')) {
        return url;
      }
      return convertToFullUrl(url);
    })
    .filter(url => url !== null);
  
  if (inputUrls.length === 0) {
    alert('No valid URLs found.');
    return;
  }
  
  const newUrls = await saveUrls(inputUrls);
  
  if (newUrls.length > 0) {
    alert(`Saved ${newUrls.length} new URL(s)!`);
    manualUrls.value = ''; // Clear input
  } else {
    alert('All URLs already exist in storage.');
  }
});

// Copy new URLs button
copyNewButton.addEventListener('click', async () => {
  const result = await chrome.storage.local.get(['newUrls']);
  const newUrls = result.newUrls || [];
  
  if (newUrls.length === 0) {
    alert('No new URLs to copy.');
    return;
  }
  
  const textToCopy = newUrls.join('\n');
  await navigator.clipboard.writeText(textToCopy);
  alert(`Copied ${newUrls.length} URL(s) to clipboard!`);
});

// Copy all URLs button
copyAllButton.addEventListener('click', async () => {
  const result = await chrome.storage.local.get(['allUrls']);
  const allUrls = result.allUrls || [];
  
  if (allUrls.length === 0) {
    alert('No URLs in storage.');
    return;
  }
  
  const textToCopy = allUrls.join('\n');
  await navigator.clipboard.writeText(textToCopy);
  alert(`Copied ${allUrls.length} URL(s) to clipboard!`);
});

// Load new URLs on popup open
loadNewUrls();

// Listen for storage changes to update display
chrome.storage.onChanged.addListener(() => {
  loadNewUrls();
});

