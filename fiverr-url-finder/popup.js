// DOM elements
const scanButton = document.getElementById('scanButton');
const manualUrls = document.getElementById('manualUrls');
const saveManualButton = document.getElementById('saveManualButton');
const newUrlsContainer = document.getElementById('newUrlsContainer');
const copyNewButton = document.getElementById('copyNewButton');
const copyAllButton = document.getElementById('copyAllButton');
const totalCount = document.getElementById('totalCount');
const githubToken = document.getElementById('githubToken');
const gistId = document.getElementById('gistId');
const saveConfigButton = document.getElementById('saveConfigButton');
const configStatus = document.getElementById('configStatus');

const GIST_FILENAME_PREFIX = 'fiverr-urls';
const MAX_FILE_SIZE = 800 * 1024; // 800KB to stay under 1MB limit

// Extract username from URL (relative or full)
function extractUsername(href) {
  if (!href) return null;
  
  try {
    // Remove query parameters and hash
    const path = href.split('?')[0].split('#')[0];
    
    // Extract username from path
    // Handle full URL: https://pro.fiverr.com/freelancers/alvaro_mercado_
    // Handle relative URL: /mikevann or /alvaro_mercado_
    let username = path;
    
    // If it's a full URL, extract the username part
    if (username.includes('/freelancers/')) {
      username = username.split('/freelancers/')[1];
    } else {
      // Remove leading/trailing slashes
      username = username.replace(/^\//, '').replace(/\/$/, '');
    }
    
    // Remove any remaining slashes or invalid characters
    username = username.split('/')[0].trim();
    
    // Remove any trailing underscores or invalid characters
    username = username.replace(/[\/\?#\s]+$/, '').trim();
    
    if (!username || username.length === 0) return null;
    
    return username;
  } catch (error) {
    console.error('Error extracting username from:', href, error);
    return null;
  }
}

// Convert username to full URL
function usernameToUrl(username) {
  if (!username) return null;
  return `https://pro.fiverr.com/freelancers/${username}`;
}

// Get GitHub configuration from storage
async function getGitHubConfig() {
  const result = await chrome.storage.local.get(['githubToken', 'gistId']);
  return {
    token: result.githubToken || '',
    gistId: result.gistId || ''
  };
}

// Save GitHub configuration to storage
async function saveGitHubConfig(token, gistId) {
  await chrome.storage.local.set({
    githubToken: token,
    gistId: gistId || ''
  });
}

// Load configuration on popup open
async function loadConfig() {
  const config = await getGitHubConfig();
  if (config.token) {
    githubToken.value = config.token;
  }
  if (config.gistId) {
    gistId.value = config.gistId;
  }
}

// Get usernames from GitHub Gist (handles multiple files)
async function getUsernamesFromGist() {
  const config = await getGitHubConfig();
  
  if (!config.token) {
    throw new Error('GitHub token not configured');
  }
  
  if (!config.gistId) {
    // No Gist ID means no usernames yet
    return [];
  }
  
  try {
    const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        // Gist doesn't exist, return empty array
        return [];
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const gist = await response.json();
    const allUsernames = [];
    
    // Get all files that match our naming pattern
    // Matches: fiverr-urls.txt, fiverr-urls-1.txt, fiverr-urls-2.txt, etc.
    const filePattern = new RegExp(`^${GIST_FILENAME_PREFIX}(-\\d+)?\\.txt$`);
    
    Object.keys(gist.files).forEach(filename => {
      if (filePattern.test(filename)) {
        const file = gist.files[filename];
        if (file && file.content) {
          // Parse usernames from file content (one per line)
          const usernames = file.content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          allUsernames.push(...usernames);
        }
      }
    });
    
    // Remove duplicates
    return [...new Set(allUsernames)];
  } catch (error) {
    console.error('Error fetching Gist:', error);
    throw error;
  }
}

// Split usernames into files based on size limit
function splitUsernamesIntoFiles(usernames) {
  const files = {};
  let currentFileIndex = 1;
  let currentFileContent = '';
  
  usernames.forEach(username => {
    const line = username + '\n';
    
    // Calculate size using TextEncoder for accurate byte count
    const encoder = new TextEncoder();
    const lineSize = encoder.encode(line).length;
    const currentSize = encoder.encode(currentFileContent).length;
    
    // Check if adding this line would exceed the limit
    if (currentSize + lineSize > MAX_FILE_SIZE && currentFileContent.length > 0) {
      // Save current file and start a new one
      const filename = currentFileIndex === 1 
        ? `${GIST_FILENAME_PREFIX}.txt`
        : `${GIST_FILENAME_PREFIX}-${currentFileIndex}.txt`;
      files[filename] = currentFileContent.trim();
      currentFileIndex++;
      currentFileContent = line;
    } else {
      currentFileContent += line;
    }
  });
  
  // Add the last file
  if (currentFileContent.trim().length > 0) {
    const filename = currentFileIndex === 1 
      ? `${GIST_FILENAME_PREFIX}.txt`
      : `${GIST_FILENAME_PREFIX}-${currentFileIndex}.txt`;
    files[filename] = currentFileContent.trim();
  }
  
  return files;
}

// Create a new Gist with usernames
async function createGist(usernames) {
  const config = await getGitHubConfig();
  
  if (!config.token) {
    throw new Error('GitHub token not configured');
  }
  
  const filesObj = splitUsernamesIntoFiles(usernames);
  const files = {};
  
  // Convert to proper Gist file format
  Object.keys(filesObj).forEach(filename => {
    files[filename] = {
      content: filesObj[filename]
    };
  });
  
  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: 'Fiverr Profile Usernames',
      public: false,
      files: files
    })
  });
  
  if (!response.ok) {
    let errorMessage = `Failed to create Gist: ${response.status} ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch (e) {
      // If response is not JSON, use status text
    }
    throw new Error(errorMessage);
  }
  
  const gist = await response.json();
  return gist.id;
}

// Update existing Gist with usernames
async function updateGist(gistId, usernames) {
  const config = await getGitHubConfig();
  
  if (!config.token) {
    throw new Error('GitHub token not configured');
  }
  
  // Get existing files to remove old ones
  const gistResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!gistResponse.ok) {
    throw new Error('Failed to fetch existing Gist');
  }
  
  const existingGist = await gistResponse.json();
  const filesToUpdate = {};
  
  // Split usernames into files
  const newFilesObj = splitUsernamesIntoFiles(usernames);
  const newFileNames = new Set(Object.keys(newFilesObj));
  
  // Mark old files for deletion only if they're not being recreated
  const filePattern = new RegExp(`^${GIST_FILENAME_PREFIX}(-\\d+)?\\.txt$`);
  Object.keys(existingGist.files).forEach(filename => {
    if (filePattern.test(filename) && !newFileNames.has(filename)) {
      // Only delete files that won't be recreated
      filesToUpdate[filename] = null; // null means delete
    }
  });
  
  // Add or update files with proper structure
  Object.keys(newFilesObj).forEach(filename => {
    filesToUpdate[filename] = {
      content: newFilesObj[filename]
    };
  });
  
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: filesToUpdate
    })
  });
  
  if (!response.ok) {
    let errorMessage = `Failed to update Gist: ${response.status} ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
      // Log more details for debugging
      console.error('Gist update error details:', error);
    } catch (e) {
      // If response is not JSON, use status text
    }
    throw new Error(errorMessage);
  }
}

// Save usernames to Gist (only new ones)
async function saveUsernames(usernames) {
  const config = await getGitHubConfig();
  
  if (!config.token) {
    throw new Error('Please configure GitHub token first');
  }
  
  // Get existing usernames from Gist
  let existingUsernames = [];
  let currentGistId = config.gistId;
  
  try {
    if (currentGistId) {
      existingUsernames = await getUsernamesFromGist();
    }
  } catch (error) {
    // If Gist doesn't exist or error, start fresh
    console.log('Could not fetch existing Gist, starting fresh:', error);
    existingUsernames = [];
    currentGistId = '';
  }
  
  const existingSet = new Set(existingUsernames);
  const newUsernames = [];
  const allUsernames = [...existingUsernames];
  
  // Find new usernames
  usernames.forEach(username => {
    if (username && !existingSet.has(username)) {
      existingSet.add(username);
      allUsernames.push(username);
      newUsernames.push(username);
    }
  });
  
  // Update or create Gist
  if (allUsernames.length > 0) {
    if (currentGistId) {
      await updateGist(currentGistId, allUsernames);
    } else {
      const newGistId = await createGist(allUsernames);
      await saveGitHubConfig(config.token, newGistId);
      // Update the input field
      gistId.value = newGistId;
    }
  }
  
  // Store new usernames temporarily in local storage for display
  await chrome.storage.local.set({
    newUrls: newUsernames,
    allUrls: allUsernames
  });
  
  // Update display
  await loadNewUrls();
  
  return newUsernames;
}

// Load and display new URLs
async function loadNewUrls() {
  const config = await getGitHubConfig();
  
  if (!config.token) {
    totalCount.textContent = 'Please configure GitHub token first';
    newUrlsContainer.innerHTML = '<p class="no-urls">Configure GitHub token to start</p>';
    copyNewButton.style.display = 'none';
    return;
  }
  
  try {
    const allUsernames = await getUsernamesFromGist();
    const result = await chrome.storage.local.get(['newUrls']);
    const newUsernames = result.newUrls || [];
    
    // Update total count
    totalCount.textContent = `Total usernames in Gist: ${allUsernames.length}`;
    
    // Display new usernames as full URLs
    if (newUsernames.length === 0) {
      newUrlsContainer.innerHTML = '<p class="no-urls">No new usernames yet</p>';
      copyNewButton.style.display = 'none';
    } else {
      const urlsList = newUsernames
        .map(username => usernameToUrl(username))
        .filter(url => url !== null)
        .map(url => `<div class="url-item">${url}</div>`)
        .join('');
      newUrlsContainer.innerHTML = urlsList;
      copyNewButton.style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading usernames:', error);
    totalCount.textContent = `Error: ${error.message}`;
    newUrlsContainer.innerHTML = '<p class="no-urls">Error loading usernames from Gist</p>';
    copyNewButton.style.display = 'none';
  }
}

// Save configuration button
saveConfigButton.addEventListener('click', async () => {
  const token = githubToken.value.trim();
  const gistIdValue = gistId.value.trim();
  
  if (!token) {
    configStatus.textContent = 'Please enter a GitHub token';
    configStatus.className = 'status-text error';
    return;
  }
  
  saveConfigButton.disabled = true;
  saveConfigButton.textContent = 'Saving...';
  configStatus.textContent = '';
  
  try {
    // Test the token by trying to get user info
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Invalid GitHub token');
    }
    
    // If Gist ID is provided, verify it exists
    if (gistIdValue) {
      const gistResponse = await fetch(`https://api.github.com/gists/${gistIdValue}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!gistResponse.ok) {
        throw new Error('Gist not found or not accessible');
      }
    }
    
    await saveGitHubConfig(token, gistIdValue);
    configStatus.textContent = 'Configuration saved successfully!';
    configStatus.className = 'status-text success';
    
    // Reload URLs
    await loadNewUrls();
  } catch (error) {
    configStatus.textContent = `Error: ${error.message}`;
    configStatus.className = 'status-text error';
  } finally {
    saveConfigButton.disabled = false;
    saveConfigButton.textContent = 'Save Configuration';
  }
});

// Scan button click handler
scanButton.addEventListener('click', async () => {
  scanButton.disabled = true;
  scanButton.textContent = 'Scanning...';
  
  try {
    // Send message to background script to scan all tabs
    const response = await chrome.runtime.sendMessage({ action: 'scanAllTabs' });
    
    if (!response) {
      alert('No response from background script. Please try again.');
      return;
    }
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    if (response.urls && response.urls.length > 0) {
      const usernames = response.urls
        .map(extractUsername)
        .filter(username => username !== null);
      
      if (usernames.length === 0) {
        alert('Found URLs but could not extract usernames. Please check the URL format.');
        return;
      }
      
      const newUsernames = await saveUsernames(usernames);
      
      if (newUsernames.length > 0) {
        alert(`Found ${newUsernames.length} new username(s)!`);
      } else {
        alert('No new usernames found.');
      }
    } else {
      alert('No URLs found in any tabs. Make sure you have Fiverr pages open.');
    }
  } catch (error) {
    console.error('Error scanning tabs:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    alert(`Error: ${errorMessage}`);
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
  
  // Split by newlines and filter empty lines, extract usernames
  const usernames = inputText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(input => {
      // Extract username from URL or use as-is if it's already a username
      return extractUsername(input) || input;
    })
    .filter(username => username !== null && username.length > 0);
  
  if (usernames.length === 0) {
    alert('No valid usernames found.');
    return;
  }
  
  try {
    saveManualButton.disabled = true;
    saveManualButton.textContent = 'Saving...';
    const newUsernames = await saveUsernames(usernames);
    
    if (newUsernames.length > 0) {
      alert(`Saved ${newUsernames.length} new username(s)!`);
      manualUrls.value = ''; // Clear input
    } else {
      alert('All usernames already exist in Gist.');
    }
  } catch (error) {
    console.error('Error saving usernames:', error);
    alert(`Error: ${error.message}`);
  } finally {
    saveManualButton.disabled = false;
    saveManualButton.textContent = 'Save Usernames';
  }
});

// Copy new usernames button
copyNewButton.addEventListener('click', async () => {
  const result = await chrome.storage.local.get(['newUrls']);
  const newUsernames = result.newUrls || [];
  
  if (newUsernames.length === 0) {
    alert('No new usernames to copy.');
    return;
  }
  
  // Convert usernames to full URLs for copying
  const urls = newUsernames
    .map(username => usernameToUrl(username))
    .filter(url => url !== null);
  
  const textToCopy = urls.join('\n');
  await navigator.clipboard.writeText(textToCopy);
  alert(`Copied ${urls.length} URL(s) to clipboard!`);
});

// Copy all usernames button
copyAllButton.addEventListener('click', async () => {
  try {
    const allUsernames = await getUsernamesFromGist();
    
    if (allUsernames.length === 0) {
      alert('No usernames in Gist.');
      return;
    }
    
    // Convert usernames to full URLs for copying
    const urls = allUsernames
      .map(username => usernameToUrl(username))
      .filter(url => url !== null);
    
    const textToCopy = urls.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    alert(`Copied ${urls.length} URL(s) to clipboard!`);
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
});

// Load configuration and URLs on popup open
loadConfig();
loadNewUrls();

// Listen for storage changes to update display
chrome.storage.onChanged.addListener(() => {
  loadNewUrls();
});
