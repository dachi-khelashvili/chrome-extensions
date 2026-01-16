// Get DOM elements
const textarea1 = document.getElementById('textarea1');
const textarea2 = document.getElementById('textarea2');
const compareBtn = document.getElementById('compareBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const methodSelect = document.getElementById('methodSelect');
const resultContent = document.getElementById('resultContent');
const resultCount = document.getElementById('resultCount');
const githubToken = document.getElementById('githubToken');
const githubUsername = document.getElementById('githubUsername');
const getFollowingBtn = document.getElementById('getFollowingBtn');
const getFollowersBtn = document.getElementById('getFollowersBtn');
const openTabsBtn = document.getElementById('openTabsBtn');
const clickFollowBtn = document.getElementById('clickFollowBtn');
const clickUnfollowBtn = document.getElementById('clickUnfollowBtn');
const closeGitHubTabsBtn = document.getElementById('closeGitHubTabsBtn');
const delayInput = document.getElementById('delayInput');
const statusBar = document.getElementById('statusBar');
const statusMessage = document.getElementById('statusMessage');

// Comparison method titles
const methodTitles = {
  'a-and-b': 'Items in both A and B:',
  'a-or-b': 'Items in A or B:',
  'a-not-b': 'Items in A but not in B:',
  'b-not-a': 'Items in B but not in A:',
  'symmetric-diff': 'Items in A or B but not in both:'
};

// Compare function - finds differences based on selected method
function findDifferences() {
  const list1 = textarea1.value.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const list2 = textarea2.value.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const method = methodSelect.value;
  let result = [];
  
  switch (method) {
    case 'a-and-b':
      // Items in both A and B (intersection)
      result = list1.filter(item => list2.includes(item));
      break;
      
    case 'a-or-b':
      // Items in A or B (union)
      result = [...new Set([...list1, ...list2])];
      break;
      
    case 'a-not-b':
      // Items in A but not in B
      result = list1.filter(item => !list2.includes(item));
      break;
      
    case 'b-not-a':
      // Items in B but not in A
      result = list2.filter(item => !list1.includes(item));
      break;
      
    case 'symmetric-diff':
      // Items in A or B but not in both (symmetric difference)
      const inAOnly = list1.filter(item => !list2.includes(item));
      const inBOnly = list2.filter(item => !list1.includes(item));
      result = [...inAOnly, ...inBOnly];
      break;
      
    default:
      result = [];
  }
  
  // Remove duplicates and maintain order
  const uniqueResult = [...new Set(result)];
  
  displayResults(uniqueResult, method);
}

// Display results
function displayResults(differences, method) {
  
  if (differences.length === 0) {
    resultContent.textContent = 'No items found.';
    resultCount.textContent = '0 items found';
  } else {
    resultContent.textContent = differences.join('\n');
    resultCount.textContent = `${differences.length} item(s) found`;
  }
  
}

// Copy to clipboard
async function copyToClipboard() {
  const differences = resultContent.textContent;
  
  if (!differences || differences === 'No items found.') {
    showStatus('Nothing to copy!', 'error');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(differences);
    
    // Visual feedback
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    copyBtn.style.background = '#218838';
    
    showStatus('Copied to clipboard!', 'success');
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.background = '#28a745';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    showStatus('Failed to copy to clipboard. Please try again.', 'error');
  }
}

// Clear all inputs and results
function clearAll() {
  textarea1.value = '';
  textarea2.value = '';
  resultContent.textContent = '';
  resultCount.textContent = '';
  methodSelect.value = 'symmetric-diff';
  textarea1.focus();
}

// Event listeners
compareBtn.addEventListener('click', findDifferences);
clearBtn.addEventListener('click', clearAll);
copyBtn.addEventListener('click', copyToClipboard);

// Allow Enter key to trigger comparison (Ctrl+Enter or Cmd+Enter)
textarea1.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    findDifferences();
  }
});

textarea2.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    findDifferences();
  }
});

// GitHub API functions
async function fetchGitHubUsers(endpoint, token) {
  const allUsers = [];
  let page = 1;
  const perPage = 100;
  
  // Prepare headers - token is optional but recommended for higher rate limits
  const headers = {
    'Accept': 'application/vnd.github.v3+json'
  };
  
  if (token && token.trim()) {
    headers['Authorization'] = `token ${token.trim()}`;
  }
  
  while (true) {
    try {
      const response = await fetch(`${endpoint}?page=${page}&per_page=${perPage}`, {
        headers: headers
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid GitHub token. Please check your token and try again.');
        } else if (response.status === 403) {
          throw new Error('GitHub API rate limit exceeded or token lacks required permissions.');
        } else if (response.status === 404) {
          throw new Error('User not found. Please check the username and try again.');
        } else {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
      }
      
      const users = await response.json();
      
      if (users.length === 0) {
        break;
      }
      
      allUsers.push(...users);
      
      // If we got fewer than perPage results, we've reached the last page
      if (users.length < perPage) {
        break;
      }
      
      page++;
    } catch (error) {
      throw error;
    }
  }
  
  return allUsers.map(user => user.html_url);
}

// Get following users and populate List 1
async function getFollowing() {
  const username = githubUsername.value.trim();
  const token = githubToken.value.trim();
  
  // If username is provided, use it; otherwise use authenticated user endpoint
  // For authenticated user endpoint, token is required
  if (!username && !token) {
    showStatus('Please enter a GitHub username, or enter your GitHub token to fetch your own following.', 'error');
    if (!username) {
      githubUsername.focus();
    } else {
      githubToken.focus();
    }
    return;
  }
  
  try {
    getFollowingBtn.disabled = true;
    getFollowingBtn.textContent = 'Loading...';
    showStatus('Fetching following users...', 'info');
    
    // Use username-based endpoint if username is provided, otherwise use authenticated endpoint
    const endpoint = username 
      ? `https://api.github.com/users/${encodeURIComponent(username)}/following`
      : 'https://api.github.com/user/following';
    
    const urls = await fetchGitHubUsers(endpoint, token);
    
    if (urls.length === 0) {
      textarea1.value = '';
      showStatus('No following users found.', 'info');
    } else {
      textarea1.value = urls.join('\n');
      const userText = username ? ` for ${username}` : '';
      showStatus(`Successfully fetched ${urls.length} following user(s)${userText}.`, 'success');
    }
  } catch (error) {
    console.error('Error fetching following:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    getFollowingBtn.disabled = false;
    getFollowingBtn.textContent = 'Get Following';
  }
}

// Get followers and populate List 2
async function getFollowers() {
  const username = githubUsername.value.trim();
  const token = githubToken.value.trim();
  
  // If username is provided, use it; otherwise use authenticated user endpoint
  // For authenticated user endpoint, token is required
  if (!username && !token) {
    showStatus('Please enter a GitHub username, or enter your GitHub token to fetch your own followers.', 'error');
    if (!username) {
      githubUsername.focus();
    } else {
      githubToken.focus();
    }
    return;
  }
  
  try {
    getFollowersBtn.disabled = true;
    getFollowersBtn.textContent = 'Loading...';
    showStatus('Fetching followers...', 'info');
    
    // Use username-based endpoint if username is provided, otherwise use authenticated endpoint
    const endpoint = username 
      ? `https://api.github.com/users/${encodeURIComponent(username)}/followers`
      : 'https://api.github.com/user/followers';
    
    const urls = await fetchGitHubUsers(endpoint, token);
    
    if (urls.length === 0) {
      textarea2.value = '';
      showStatus('No followers found.', 'info');
    } else {
      textarea2.value = urls.join('\n');
      const userText = username ? ` for ${username}` : '';
      showStatus(`Successfully fetched ${urls.length} follower(s)${userText}.`, 'success');
    }
  } catch (error) {
    console.error('Error fetching followers:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    getFollowersBtn.disabled = false;
    getFollowersBtn.textContent = 'Get Followers';
  }
}

// Status message functions
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusBar.className = 'status-bar ' + type;
  statusBar.style.display = 'block';
}

function hideStatus() {
  statusBar.style.display = 'none';
}

// Load GitHub token from localStorage when popup opens
function loadGitHubToken() {
  try {
    const savedToken = localStorage.getItem('githubToken');
    if (savedToken) {
      githubToken.value = savedToken;
    }
  } catch (error) {
    console.error('Error loading GitHub token from localStorage:', error);
  }
}

// Save GitHub token to localStorage
function saveGitHubToken() {
  try {
    const token = githubToken.value.trim();
    if (token) {
      localStorage.setItem('githubToken', token);
    } else {
      // Remove token from localStorage if input is empty
      localStorage.removeItem('githubToken');
    }
  } catch (error) {
    console.error('Error saving GitHub token to localStorage:', error);
  }
}

// Load delay from localStorage
function loadDelay() {
  try {
    const savedDelay = localStorage.getItem('clickDelay');
    if (savedDelay) {
      delayInput.value = savedDelay;
    } else {
      // Default delay: 500ms
      delayInput.value = '500';
      localStorage.setItem('clickDelay', '500');
    }
  } catch (error) {
    console.error('Error loading delay from localStorage:', error);
    delayInput.value = '500';
  }
}

// Save delay to localStorage
function saveDelay() {
  try {
    const delay = delayInput.value.trim();
    if (delay && !isNaN(delay) && parseInt(delay) >= 0) {
      localStorage.setItem('clickDelay', delay);
    }
  } catch (error) {
    console.error('Error saving delay to localStorage:', error);
  }
}

// Get delay value (in milliseconds)
function getDelay() {
  const delay = parseInt(delayInput.value.trim()) || 500;
  return Math.max(0, delay); // Ensure non-negative
}

// Event listeners for GitHub buttons
getFollowingBtn.addEventListener('click', getFollowing);
getFollowersBtn.addEventListener('click', getFollowers);

// Save token to localStorage when it changes
githubToken.addEventListener('input', saveGitHubToken);
githubToken.addEventListener('blur', saveGitHubToken);

// Allow Enter key in GitHub inputs to trigger Get Following
githubUsername.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    getFollowing();
  }
});

githubToken.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    getFollowing();
  }
});

// Open URLs from clipboard in new tabs
async function openUrlsFromClipboard() {
  try {
    openTabsBtn.disabled = true;
    openTabsBtn.textContent = 'Reading clipboard...';
    showStatus('Reading clipboard...', 'info');
    
    // Read from clipboard
    const clipboardText = await navigator.clipboard.readText();
    
    if (!clipboardText || !clipboardText.trim()) {
      showStatus('Clipboard is empty. Please copy URLs first (one per line).', 'error');
      openTabsBtn.disabled = false;
      openTabsBtn.textContent = 'Open URLs from Clipboard in Tabs';
      return;
    }
    
    // Parse URLs from clipboard (one per line)
    const urls = clipboardText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));
    
    if (urls.length === 0) {
      showStatus('No valid URLs found in clipboard. URLs must start with http:// or https://', 'error');
      openTabsBtn.disabled = false;
      openTabsBtn.textContent = 'Open URLs from Clipboard in Tabs';
      return;
    }
    
    showStatus(`Opening ${urls.length} tab(s)...`, 'info');
    
    // Open all tabs with small delay between each
    let openedCount = 0;
    for (let i = 0; i < urls.length; i++) {
      // Small delay between opens to avoid overwhelming the browser
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      try {
        await chrome.tabs.create({ url: urls[i], active: false });
        openedCount++;
        showStatus(`Opening tabs... (${openedCount}/${urls.length})`, 'info');
      } catch (error) {
        console.error(`Error opening tab ${urls[i]}:`, error);
      }
    }
    
    showStatus(`Successfully opened ${openedCount} out of ${urls.length} tab(s).`, 'success');
  } catch (error) {
    console.error('Error reading clipboard:', error);
    showStatus(`Error: ${error.message}. Make sure clipboard contains URLs.`, 'error');
  } finally {
    openTabsBtn.disabled = false;
    openTabsBtn.textContent = 'Open URLs from Clipboard in Tabs';
  }
}

// Click follow buttons on all GitHub tabs
async function clickFollowOnAllTabs() {
  try {
    clickFollowBtn.disabled = true;
    clickFollowBtn.textContent = 'Processing...';
    const delay = getDelay();
    
    // Get all tabs
    const tabs = await chrome.tabs.query({ url: 'https://github.com/*' });
    
    if (tabs.length === 0) {
      showStatus('No GitHub tabs found. Please open some GitHub profile pages first.', 'error');
      clickFollowBtn.disabled = false;
      clickFollowBtn.textContent = 'Click Follow on All GitHub Tabs';
      return;
    }
    
    let clickedCount = 0;
    let errorCount = 0;
    
    showStatus(`Processing ${tabs.length} GitHub tab(s)...`, 'info');
    
    // Send message to each GitHub tab to click follow button with delay
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      
      // Add delay between clicks (except for the first one)
      if (i > 0 && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        showStatus(`Clicking Follow... (${i + 1}/${tabs.length})`, 'info');
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'clickFollow' });
        if (response && response.success) {
          clickedCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing tab ${tab.id}:`, error);
        errorCount++;
      }
    }
    
    const message = `Processed ${tabs.length} tab(s). Clicked follow on ${clickedCount} tab(s).`;
    const statusMessage = errorCount > 0 
      ? `${message} Errors: ${errorCount}`
      : message;
    
    showStatus(statusMessage, clickedCount > 0 ? 'success' : 'error');
  } catch (error) {
    console.error('Error clicking follow on tabs:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    clickFollowBtn.disabled = false;
    clickFollowBtn.textContent = 'Click Follow on All GitHub Tabs';
  }
}

// Click unfollow buttons on all GitHub tabs
async function clickUnfollowOnAllTabs() {
  try {
    clickUnfollowBtn.disabled = true;
    clickUnfollowBtn.textContent = 'Processing...';
    const delay = getDelay();
    
    // Get all tabs
    const tabs = await chrome.tabs.query({ url: 'https://github.com/*' });
    
    if (tabs.length === 0) {
      showStatus('No GitHub tabs found. Please open some GitHub profile pages first.', 'error');
      clickUnfollowBtn.disabled = false;
      clickUnfollowBtn.textContent = 'Click Unfollow on All GitHub Tabs';
      return;
    }
    
    let clickedCount = 0;
    let errorCount = 0;
    
    showStatus(`Processing ${tabs.length} GitHub tab(s)...`, 'info');
    
    // Send message to each GitHub tab to click unfollow button with delay
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      
      // Add delay between clicks (except for the first one)
      if (i > 0 && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        showStatus(`Clicking Unfollow... (${i + 1}/${tabs.length})`, 'info');
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'clickUnfollow' });
        if (response && response.success) {
          clickedCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing tab ${tab.id}:`, error);
        errorCount++;
      }
    }
    
    const message = `Processed ${tabs.length} tab(s). Clicked unfollow on ${clickedCount} tab(s).`;
    const statusMessage = errorCount > 0 
      ? `${message} Errors: ${errorCount}`
      : message;
    
    showStatus(statusMessage, clickedCount > 0 ? 'success' : 'error');
  } catch (error) {
    console.error('Error clicking unfollow on tabs:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    clickUnfollowBtn.disabled = false;
    clickUnfollowBtn.textContent = 'Click Unfollow on All GitHub Tabs';
  }
}

// Close all GitHub user tabs
async function closeAllGitHubTabs() {
  try {
    closeGitHubTabsBtn.disabled = true;
    closeGitHubTabsBtn.textContent = 'Closing tabs...';
    
    // Get all GitHub tabs
    const tabs = await chrome.tabs.query({ url: 'https://github.com/*' });
    
    if (tabs.length === 0) {
      showStatus('No GitHub tabs found.', 'info');
      closeGitHubTabsBtn.disabled = false;
      closeGitHubTabsBtn.textContent = 'Close All GitHub User Tabs';
      return;
    }
    
    showStatus(`Closing ${tabs.length} GitHub tab(s)...`, 'info');
    
    // Close all GitHub tabs
    const tabIds = tabs.map(tab => tab.id);
    await chrome.tabs.remove(tabIds);
    
    showStatus(`Successfully closed ${tabs.length} GitHub tab(s).`, 'success');
  } catch (error) {
    console.error('Error closing GitHub tabs:', error);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    closeGitHubTabsBtn.disabled = false;
    closeGitHubTabsBtn.textContent = 'Close All GitHub User Tabs';
  }
}

// Event listeners for action buttons
openTabsBtn.addEventListener('click', openUrlsFromClipboard);
clickFollowBtn.addEventListener('click', clickFollowOnAllTabs);
clickUnfollowBtn.addEventListener('click', clickUnfollowOnAllTabs);
closeGitHubTabsBtn.addEventListener('click', closeAllGitHubTabs);

// Save delay to localStorage when it changes
delayInput.addEventListener('input', saveDelay);
delayInput.addEventListener('blur', saveDelay);

// Load saved values when popup opens
loadGitHubToken();
loadDelay();

// Focus on first textarea when popup opens
textarea1.focus();

