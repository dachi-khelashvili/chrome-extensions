// DOM elements
const scanButton = document.getElementById('scanButton');
const manualUrls = document.getElementById('manualUrls');
const saveManualButton = document.getElementById('saveManualButton');
const newUrlsContainer = document.getElementById('newUrlsContainer');
const newUsernamesTitle = document.getElementById('newUsernamesTitle');
const copyNewButton = document.getElementById('copyNewButton');
const copyAllButton = document.getElementById('copyAllButton');
const copyAllButtonText = document.getElementById('copyAllButtonText');
const totalCount = document.getElementById('totalCount');
const githubToken = document.getElementById('githubToken');
const saveConfigButton = document.getElementById('saveConfigButton');
const manualTodoUrls = document.getElementById('manualTodoUrls');
const saveTodoButton = document.getElementById('saveTodoButton');
const copyAllTodoButton = document.getElementById('copyAllTodoButton');
const processTodoButton = document.getElementById('processTodoButton');
const todoCount = document.getElementById('todoCount');
const manualFinalUrls = document.getElementById('manualFinalUrls');
const saveFinalButton = document.getElementById('saveFinalButton');
const copyAllFinalButton = document.getElementById('copyAllFinalButton');
const scanFinalButton = document.getElementById('scanFinalButton');
const finalCount = document.getElementById('finalCount');
const finalNumber = document.getElementById('finalNumber');
const copyFinalButton = document.getElementById('copyFinalButton');
const openFinalButton = document.getElementById('openFinalButton');

const GIST_FILENAME_PREFIX = 'fiverr-urls';
const TODO_GIST_FILENAME_PREFIX = 'fiverr-todo';
const FINAL_GIST_FILENAME_PREFIX = 'fiverr-final';
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
  const result = await chrome.storage.local.get(['githubToken', 'gistId', 'todoGistId', 'finalGistId']);
  return {
    token: result.githubToken || '',
    gistId: result.gistId || '',
    todoGistId: result.todoGistId || '',
    finalGistId: result.finalGistId || ''
  };
}

// Save GitHub configuration to storage
async function saveGitHubConfig(token, gistId, todoGistId, finalGistId) {
  const updates = {
    githubToken: token,
    gistId: gistId || ''
  };
  if (todoGistId !== undefined) updates.todoGistId = todoGistId || '';
  if (finalGistId !== undefined) updates.finalGistId = finalGistId || '';
  await chrome.storage.local.set(updates);
}

// Load configuration on popup open
async function loadConfig() {
  const config = await getGitHubConfig();
  if (config.token) {
    githubToken.value = config.token;
  }
}

// Find existing Gist by description
async function findGistByDescription(token, description) {
  try {
    let page = 1;
    let foundGist = null;

    // Search through pages of Gists (GitHub API paginates results)
    while (page <= 10) { // Limit to 10 pages to avoid infinite loops
      const response = await fetch(`https://api.github.com/gists?page=${page}&per_page=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        break;
      }

      const gists = await response.json();

      if (gists.length === 0) {
        break; // No more Gists
      }

      // Find Gist with matching description
      foundGist = gists.find(gist => gist.description === description);
      if (foundGist) {
        return foundGist.id;
      }

      // If we got less than 100 results, we've reached the end
      if (gists.length < 100) {
        break;
      }

      page++;
    }

    return null;
  } catch (error) {
    console.error('Error finding Gist:', error);
    return null;
  }
}

// Find or create Gist
async function findOrCreateGist(token, description, filename, initialContent = '') {
  try {
    // First try to find existing Gist
    const existingGistId = await findGistByDescription(token, description);

    if (existingGistId) {
      console.log(`Found existing Gist: ${existingGistId} for ${description}`);
      return existingGistId;
    }

    // Create new Gist if not found
    console.log(`Creating new Gist: ${description} with file ${filename}`);

    // GitHub requires at least one character in file content
    // Use a placeholder if content is empty
    const fileContent = initialContent && initialContent.trim().length > 0
      ? initialContent
      : '# Fiverr URLs\n';

    const files = {};
    files[filename] = {
      content: fileContent
    };

    const requestBody = {
      description: description,
      public: false,
      files: files
    };

    console.log('Creating Gist with body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMessage = `Failed to create Gist: ${response.status} ${response.statusText}`;
      let errorDetails = null;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
        errorDetails = error.errors || error;
        console.error('Gist creation error:', JSON.stringify(error, null, 2));
        if (errorDetails) {
          console.error('Error details:', JSON.stringify(errorDetails, null, 2));
        }
      } catch (e) {
        // If response is not JSON, use status text
        const errorText = await response.text();
        console.error('Gist creation error text:', errorText);
        errorMessage = errorText || errorMessage;
      }

      // Provide more detailed error message
      if (errorDetails) {
        if (Array.isArray(errorDetails)) {
          const detailMessages = errorDetails.map(e => {
            if (typeof e === 'string') return e;
            return e.message || JSON.stringify(e);
          }).join(', ');
          errorMessage = `${errorMessage}: ${detailMessages}`;
        } else if (typeof errorDetails === 'object') {
          const detailStr = JSON.stringify(errorDetails);
          errorMessage = `${errorMessage}: ${detailStr}`;
        }
      }

      throw new Error(errorMessage);
    }

    const gist = await response.json();
    console.log(`Successfully created Gist: ${gist.id} for ${description}`);
    return gist.id;
  } catch (error) {
    console.error(`Error in findOrCreateGist for ${description}:`, error);
    throw error;
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

  // Get or create Gist ID
  let currentGistId = config.gistId;
  if (!currentGistId) {
    currentGistId = await findOrCreateGist(
      config.token,
      'Fiverr Profile Usernames',
      `${GIST_FILENAME_PREFIX}.txt`,
      ''
    );
    await saveGitHubConfig(config.token, currentGistId, config.todoGistId, config.finalGistId);
  }

  // Get existing usernames from Gist
  let existingUsernames = [];
  try {
    existingUsernames = await getUsernamesFromGist();
  } catch (error) {
    // If Gist doesn't exist or error, start fresh
    console.log('Could not fetch existing Gist, starting fresh:', error);
    existingUsernames = [];
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

  // Update Gist
  if (allUsernames.length > 0) {
    await updateGist(currentGistId, allUsernames);
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

// ========== TODO LIST FUNCTIONS ==========

// Get URLs from Todo Gist
async function getTodoUrlsFromGist() {
  const config = await getGitHubConfig();

  if (!config.token) {
    throw new Error('GitHub token not configured');
  }

  if (!config.todoGistId) {
    return [];
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${config.todoGistId}`, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const gist = await response.json();
    const allUrls = [];

    const filePattern = new RegExp(`^${TODO_GIST_FILENAME_PREFIX}(-\\d+)?\\.txt$`);

    Object.keys(gist.files).forEach(filename => {
      if (filePattern.test(filename)) {
        const file = gist.files[filename];
        if (file && file.content) {
          const urls = file.content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(url => url.trim()); // Normalize URLs
          allUrls.push(...urls);
        }
      }
    });

    // Remove duplicates and return normalized URLs
    return [...new Set(allUrls.map(url => url.trim()))];
  } catch (error) {
    console.error('Error fetching Todo Gist:', error);
    throw error;
  }
}

// Save URLs to Todo Gist
async function saveUrlsToTodo(urls) {
  const config = await getGitHubConfig();

  if (!config.token) {
    throw new Error('Please configure GitHub token first');
  }

  // Get or create Todo Gist ID
  let currentTodoGistId = config.todoGistId;
  if (!currentTodoGistId) {
    currentTodoGistId = await findOrCreateGist(
      config.token,
      'Fiverr Todo URLs',
      `${TODO_GIST_FILENAME_PREFIX}.txt`,
      ''
    );
    await saveGitHubConfig(config.token, config.gistId, currentTodoGistId, config.finalGistId);
  }

  // Get existing URLs from Todo Gist
  let existingUrls = [];
  try {
    existingUrls = await getTodoUrlsFromGist();
  } catch (error) {
    console.log('Could not fetch existing Todo Gist, starting fresh:', error);
    existingUrls = [];
  }

  const existingSet = new Set(existingUrls);
  const newUrls = [];
  const allUrls = [...existingUrls];

  // Find new URLs (store as full URLs in todo)
  urls.forEach(url => {
    const fullUrl = url.startsWith('http') ? url : usernameToUrl(url);
    if (fullUrl && !existingSet.has(fullUrl)) {
      existingSet.add(fullUrl);
      allUrls.push(fullUrl);
      newUrls.push(fullUrl);
    }
  });

  // Update Todo Gist
  if (allUrls.length > 0) {
    await updateTodoGist(currentTodoGistId, allUrls);
  }

  return newUrls;
}

// Create Todo Gist
async function createTodoGist(urls) {
  const config = await getGitHubConfig();

  if (!config.token) {
    throw new Error('GitHub token not configured');
  }

  const filesObj = splitUrlsIntoFiles(urls, TODO_GIST_FILENAME_PREFIX);
  const files = {};

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
      description: 'Fiverr Todo URLs',
      public: false,
      files: files
    })
  });

  if (!response.ok) {
    let errorMessage = `Failed to create Todo Gist: ${response.status} ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch (e) { }
    throw new Error(errorMessage);
  }

  const gist = await response.json();
  return gist.id;
}

// Update Todo Gist
async function updateTodoGist(gistId, urls) {
  const config = await getGitHubConfig();

  if (!config.token) {
    throw new Error('GitHub token not configured');
  }

  const gistResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!gistResponse.ok) {
    throw new Error('Failed to fetch existing Todo Gist');
  }

  const existingGist = await gistResponse.json();
  const filesToUpdate = {};

  const newFilesObj = splitUrlsIntoFiles(urls, TODO_GIST_FILENAME_PREFIX);
  const newFileNames = new Set(Object.keys(newFilesObj));

  const filePattern = new RegExp(`^${TODO_GIST_FILENAME_PREFIX}(-\\d+)?\\.txt$`);
  Object.keys(existingGist.files).forEach(filename => {
    if (filePattern.test(filename) && !newFileNames.has(filename)) {
      filesToUpdate[filename] = null;
    }
  });

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
    let errorMessage = `Failed to update Todo Gist: ${response.status} ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch (e) { }
    throw new Error(errorMessage);
  }
}

// Split URLs into files (for todo/final lists that store full URLs)
function splitUrlsIntoFiles(urls, prefix) {
  const files = {};
  let currentFileIndex = 1;
  let currentFileContent = '';

  urls.forEach(url => {
    const line = url + '\n';
    const encoder = new TextEncoder();
    const lineSize = encoder.encode(line).length;
    const currentSize = encoder.encode(currentFileContent).length;

    if (currentSize + lineSize > MAX_FILE_SIZE && currentFileContent.length > 0) {
      const filename = currentFileIndex === 1
        ? `${prefix}.txt`
        : `${prefix}-${currentFileIndex}.txt`;
      files[filename] = currentFileContent.trim();
      currentFileIndex++;
      currentFileContent = line;
    } else {
      currentFileContent += line;
    }
  });

  if (currentFileContent.trim().length > 0) {
    const filename = currentFileIndex === 1
      ? `${prefix}.txt`
      : `${prefix}-${currentFileIndex}.txt`;
    files[filename] = currentFileContent.trim();
  }

  return files;
}

// ========== FINAL LIST FUNCTIONS ==========

// Get URLs from Final Gist
async function getFinalUrlsFromGist() {
  const config = await getGitHubConfig();

  if (!config.token) {
    throw new Error('GitHub token not configured');
  }

  if (!config.finalGistId) {
    return [];
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${config.finalGistId}`, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const gist = await response.json();
    const allUrls = [];

    const filePattern = new RegExp(`^${FINAL_GIST_FILENAME_PREFIX}(-\\d+)?\\.txt$`);

    Object.keys(gist.files).forEach(filename => {
      if (filePattern.test(filename)) {
        const file = gist.files[filename];
        if (file && file.content) {
          const urls = file.content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          allUrls.push(...urls);
        }
      }
    });

    return [...new Set(allUrls)];
  } catch (error) {
    console.error('Error fetching Final Gist:', error);
    throw error;
  }
}

// Add URLs to Final Gist (only freelancer URLs)
async function addUrlsToFinal(urls) {
  const config = await getGitHubConfig();

  if (!config.token) {
    throw new Error('Please configure GitHub token first');
  }

  // Filter only freelancer URLs
  const freelancerUrls = urls
    .map(url => {
      if (url.startsWith('http')) {
        return url.includes('/freelancers/') ? url : null;
      }
      const fullUrl = usernameToUrl(url);
      return fullUrl;
    })
    .filter(url => url !== null);

  if (freelancerUrls.length === 0) {
    return [];
  }

  // Get or create Final Gist ID
  let currentFinalGistId = config.finalGistId;
  if (!currentFinalGistId) {
    currentFinalGistId = await findOrCreateGist(
      config.token,
      'Fiverr Final URLs',
      `${FINAL_GIST_FILENAME_PREFIX}.txt`,
      ''
    );
    await saveGitHubConfig(config.token, config.gistId, config.todoGistId, currentFinalGistId);
  }

  // Get existing URLs from Final Gist
  let existingUrls = [];
  try {
    existingUrls = await getFinalUrlsFromGist();
  } catch (error) {
    console.log('Could not fetch existing Final Gist, starting fresh:', error);
    existingUrls = [];
  }

  const existingSet = new Set(existingUrls);
  const newUrls = [];
  const allUrls = [...existingUrls];

  freelancerUrls.forEach(url => {
    if (!existingSet.has(url)) {
      existingSet.add(url);
      allUrls.push(url);
      newUrls.push(url);
    }
  });

  // Update Final Gist
  if (allUrls.length > 0) {
    await updateFinalGist(currentFinalGistId, allUrls);
  }

  return newUrls;
}

// Create Final Gist
async function createFinalGist(urls) {
  const config = await getGitHubConfig();

  if (!config.token) {
    throw new Error('GitHub token not configured');
  }

  const filesObj = splitUrlsIntoFiles(urls, FINAL_GIST_FILENAME_PREFIX);
  const files = {};

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
      description: 'Fiverr Final URLs',
      public: false,
      files: files
    })
  });

  if (!response.ok) {
    let errorMessage = `Failed to create Final Gist: ${response.status} ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch (e) { }
    throw new Error(errorMessage);
  }

  const gist = await response.json();
  return gist.id;
}

// Update Final Gist
async function updateFinalGist(gistId, urls) {
  const config = await getGitHubConfig();

  if (!config.token) {
    throw new Error('GitHub token not configured');
  }

  const gistResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!gistResponse.ok) {
    throw new Error('Failed to fetch existing Final Gist');
  }

  const existingGist = await gistResponse.json();
  const filesToUpdate = {};

  const newFilesObj = splitUrlsIntoFiles(urls, FINAL_GIST_FILENAME_PREFIX);
  const newFileNames = new Set(Object.keys(newFilesObj));

  const filePattern = new RegExp(`^${FINAL_GIST_FILENAME_PREFIX}(-\\d+)?\\.txt$`);
  Object.keys(existingGist.files).forEach(filename => {
    if (filePattern.test(filename) && !newFileNames.has(filename)) {
      filesToUpdate[filename] = null;
    }
  });

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
    let errorMessage = `Failed to update Final Gist: ${response.status} ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch (e) { }
    throw new Error(errorMessage);
  }
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
      newUsernamesTitle.textContent = `${newUsernames.length} new username${newUsernames.length > 1 ? 's' : ''} found`;
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

  if (!token) {
    saveConfigButton.textContent = 'Please enter a GitHub token';
    await setTimeout(() => {
      saveConfigButton.textContent = 'Save Configuration';
    }, 500);
    return;
  }

  saveConfigButton.disabled = true;
  saveConfigButton.textContent = 'Saving...';

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

    // Find or create all Gists automatically
    const mainGistId = await findOrCreateGist(
      token,
      'Fiverr Profile Usernames',
      `${GIST_FILENAME_PREFIX}.txt`,
      ''
    );

    const todoGistId = await findOrCreateGist(
      token,
      'Fiverr Todo URLs',
      `${TODO_GIST_FILENAME_PREFIX}.txt`,
      ''
    );

    const finalGistId = await findOrCreateGist(
      token,
      'Fiverr Final URLs',
      `${FINAL_GIST_FILENAME_PREFIX}.txt`,
      ''
    );

    await saveGitHubConfig(token, mainGistId, todoGistId, finalGistId);

    saveConfigButton.textContent = 'Configuration saved successfully! Gists created/found automatically.';

    // Reload URLs
    await loadNewUrls();
    await loadTodoCount();
    await loadFinalCount();
  } catch (error) {
    console.error('Error saving configuration:', error);
    saveConfigButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      saveConfigButton.disabled = false;
      saveConfigButton.textContent = 'Save Configuration';
    }, 500);
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
      scanButton.textContent = 'No response from background script. Please try again.';
      return;
    }

    if (response.error) {
      throw new Error(response.error);
    }

    if (response.urls && response.urls.length > 0) {

      scanButton.textContent = `${response.urls.length} URLs found`;

      const usernames = response.urls
        .map(extractUsername)
        .filter(username => username !== null);

      if (usernames.length === 0) {
        scanButton.textContent = "Found URLs but could not extract usernames. Please check the URL format.";
        await setTimeout(() => {
          scanButton.textContent = 'Scan All Tabs';
        }, 500);
        return;
      }

      const newUsernames = await saveUsernames(usernames);

      scanButton.textContent = `${newUsernames.length} new usernames found`;

      // Automatically add new URLs to todo list
      if (newUsernames.length > 0) {
        const newUrls = newUsernames.map(username => usernameToUrl(username)).filter(url => url !== null);
        try {
          await saveUrlsToTodo(newUrls);
        } catch (error) {
          console.error('Error adding to todo:', error);
        }
        scanButton.textContent = `${newUsernames.length} new username(s)! Added to todo list.`;
      } else {
        scanButton.textContent = 'No new usernames found.';
      }
    } else {
      scanButton.textContent = "No URLs found in any tabs. Make sure you have Fiverr pages open.";
    }
  } catch (error) {
    console.error('Error scanning tabs:', error);
    scanButton.textContent = `Error: ${error.message || 'Unknown error occurred'}`;
  } finally {
    await setTimeout(() => {
      scanButton.textContent = 'Scan All Tabs';
      scanButton.disabled = false;
    }, 500);
  }
});

// Save manual URLs button click handler
saveManualButton.addEventListener('click', async () => {
  const inputText = manualUrls.value.trim();
  if (!inputText) {
    saveManualButton.textContent = 'Please enter at least one URL.';
    await setTimeout(() => {
      saveManualButton.textContent = 'Save URLs manually to the <b>All URL List</b>';
    }, 500);
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
    saveManualButton.textContent = 'No valid usernames found.';
    return;
  }

  try {
    saveManualButton.disabled = true;
    saveManualButton.textContent = 'Saving...';
    const newUsernames = await saveUsernames(usernames);

    if (newUsernames.length > 0) {
      saveManualButton.textContent = `${newUsernames.length} new username(s)! Saved!`;
      manualUrls.value = ''; // Clear input
    } else {
      saveManualButton.textContent = 'All usernames already exist in Gist.';
    }
  } catch (error) {
    console.error('Error saving usernames:', error);
    saveManualButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      saveManualButton.disabled = false;
      saveManualButton.textContent = 'Save Usernames';
    }, 500);
  }
});

// Copy new usernames button
copyNewButton.addEventListener('click', async () => {
  const result = await chrome.storage.local.get(['newUrls']);
  const newUsernames = result.newUrls || [];

  if (newUsernames.length === 0) {
    copyNewButton.textContent = "No new usernames to copy.";
    return;
  }

  // Convert usernames to full URLs for copying
  const urls = newUsernames
    .map(username => usernameToUrl(username))
    .filter(url => url !== null);

  const textToCopy = urls.join('\n');
  await navigator.clipboard.writeText(textToCopy);
  copyNewButton.textContent = `${urls.length} URL(s) copied to clipboard!`;
  await setTimeout(() => {
    copyNewButton.textContent = 'Copy New Usernames';
  }, 500);
});

// Copy all usernames button
copyAllButton.addEventListener('click', async () => {
  try {
    copyAllButton.disabled = true;
    copyAllButtonText.style.display = 'block';
    copyAllButtonText.textContent = 'Copying...';
    const allUsernames = await getUsernamesFromGist();

    if (allUsernames.length === 0) {
      copyAllButtonText.textContent = 'No usernames in Gist.';
      return;
    }

    // Convert usernames to full URLs for copying
    const urls = allUsernames
      .map(username => usernameToUrl(username))
      .filter(url => url !== null);

    const textToCopy = urls.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    copyAllButtonText.textContent = `${urls.length} URL(s) copied to clipboard!`;
  } catch (error) {
    copyAllButtonText.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      copyAllButtonText.style.display = 'none';
      copyAllButton.disabled = false;
    }, 500);
  }
});

// Load todo count
async function loadTodoCount() {
  const config = await getGitHubConfig();

  if (!config.token) {
    if (todoCount) todoCount.textContent = 'Please configure GitHub token first';
    return;
  }

  try {
    const urls = await getTodoUrlsFromGist();
    if (todoCount) todoCount.textContent = `Total URLs in Todo: ${urls.length}`;
  } catch (error) {
    if (todoCount) todoCount.textContent = `Error: ${error.message}`;
  }
}

// Load final count
async function loadFinalCount() {
  const config = await getGitHubConfig();

  if (!config.token) {
    if (finalCount) finalCount.textContent = 'Please configure GitHub token first';
    return;
  }

  try {
    const urls = await getFinalUrlsFromGist();
    if (finalCount) finalCount.textContent = `Total URLs in Final: ${urls.length}`;
  } catch (error) {
    if (finalCount) finalCount.textContent = `Error: ${error.message}`;
  }
}

// Open URLs in browser
async function openUrlsInBrowser(urls) {
  if (!urls || urls.length === 0) return [];

  // Use background script to open tabs to avoid popup limitations
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'openTabs',
      urls: urls
    });

    if (response && response.opened) {
      console.log(`Opened ${response.opened} out of ${urls.length} URLs`);
      return response.opened;
    }
  } catch (error) {
    console.error('Error opening tabs via background:', error);
  }

  // Fallback: try opening directly (may be limited by Chrome)
  const openedUrls = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      await chrome.tabs.create({
        url: urls[i],
        active: i === 0
      });
      openedUrls.push(urls[i]);
      // Delay to avoid overwhelming browser
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Error opening ${urls[i]}:`, error);
    }
  }

  console.log(`Opened ${openedUrls.length} out of ${urls.length} URLs`);
  return openedUrls;
}

// Remove URLs from Todo Gist
async function removeUrlsFromTodo(urlsToRemove) {
  const config = await getGitHubConfig();

  if (!config.token || !config.todoGistId) {
    throw new Error('Todo Gist not configured');
  }

  console.log('Starting removal. URLs to remove:', urlsToRemove.length);

  const allUrls = await getTodoUrlsFromGist();
  console.log('Total URLs in todo before removal:', allUrls.length);

  // Normalize URLs for comparison (trim and ensure consistent format)
  const normalizedRemoveSet = new Set(
    urlsToRemove.map(url => url.trim().toLowerCase())
  );

  const remainingUrls = allUrls
    .map(url => url.trim())
    .filter(url => {
      const normalized = url.trim().toLowerCase();
      const shouldRemove = normalizedRemoveSet.has(normalized);
      if (shouldRemove) {
        console.log('Removing:', url);
      }
      return !shouldRemove;
    });

  console.log(`Removing ${urlsToRemove.length} URLs from todo. Remaining: ${remainingUrls.length}`);
  console.log('Remaining URLs:', remainingUrls);

  if (remainingUrls.length === 0) {
    // Delete the Gist if empty
    console.log('Todo list is empty, deleting Gist');
    const deleteResponse = await fetch(`https://api.github.com/gists/${config.todoGistId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (deleteResponse.ok || deleteResponse.status === 404) {
      await saveGitHubConfig(config.token, config.gistId, '', config.finalGistId);
      console.log('Deleted empty todo Gist');
    } else {
      const errorText = await deleteResponse.text();
      console.error('Failed to delete Gist:', errorText);
      throw new Error('Failed to delete empty todo Gist');
    }
  } else {
    console.log('Updating todo Gist with remaining URLs');
    await updateTodoGist(config.todoGistId, remainingUrls);
    console.log('Todo Gist updated successfully');
  }
}

// Copy all todo URLs button
copyAllTodoButton.addEventListener('click', async () => {
  try {
    copyAllTodoButton.disabled = true;
    copyAllTodoButton.textContent = 'Copying...';

    const allUrls = await getTodoUrlsFromGist();

    if (allUrls.length === 0) {
      copyAllTodoButton.textContent = 'No URLs in todo list.';
      return;
    }

    const textToCopy = allUrls.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    copyAllTodoButton.textContent = `${allUrls.length} URL(s) copied to clipboard!`;
    await setTimeout(() => {
      copyAllTodoButton.textContent = 'Copy All Todo URLs';
    }, 500);
  } catch (error) {
    console.error('Error copying all todo URLs:', error);
    copyAllTodoButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      copyAllTodoButton.textContent = 'Copy All Todo URLs';
      copyAllTodoButton.disabled = false;
    }, 500);
  }
});

// Copy all todo URLs button
copyAllTodoButton.addEventListener('click', async () => {
  try {
    copyAllTodoButton.disabled = true;
    copyAllTodoButton.textContent = 'Copying...';

    const allUrls = await getTodoUrlsFromGist();

    if (allUrls.length === 0) {
      copyAllTodoButton.textContent = 'No URLs in todo list.';
      return;
    }

    const textToCopy = allUrls.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    copyAllTodoButton.textContent = `${allUrls.length} URL(s) copied to clipboard!`;
  } catch (error) {
    console.error('Error copying all todo URLs:', error);
    copyAllTodoButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      copyAllTodoButton.disabled = false;
      copyAllTodoButton.textContent = 'Copy All Todo URLs';
    }, 500);
  }
});

// Save manual todo URLs button
saveTodoButton.addEventListener('click', async () => {
  const inputText = manualTodoUrls.value.trim();
  if (!inputText) {
    saveTodoButton.textContent = 'Please enter at least one URL.';
    await setTimeout(() => {
      saveTodoButton.textContent = 'Save URLs manually to the <b>Todo URL List</b>';
    }, 500);
    return;
  }

  const urls = inputText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(input => {
      if (input.startsWith('http')) {
        return input;
      }
      return usernameToUrl(input);
    })
    .filter(url => url !== null);

  if (urls.length === 0) {
    saveTodoButton.textContent = 'No valid URLs found.';
    return;
  }

  try {
    saveTodoButton.disabled = true;
    saveTodoButton.textContent = 'Saving...';
    const newUrls = await saveUrlsToTodo(urls);

    if (newUrls.length > 0) {
      saveTodoButton.textContent = `${newUrls.length} new URL(s) added to todo!`;
      manualTodoUrls.value = '';
      await loadTodoCount();
    } else {
      saveTodoButton.textContent = "All URLs already exist in todo.";
    }
  } catch (error) {
    console.error('Error saving todo:', error);
    saveTodoButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      saveTodoButton.disabled = false;
      saveTodoButton.textContent = 'Add to Todo';
    }, 500);
  }
});

// Process 20 URLs from todo button
processTodoButton.addEventListener('click', async () => {
  try {
    processTodoButton.disabled = true;
    processTodoButton.textContent = 'Processing...';

    const urls = await getTodoUrlsFromGist();

    if (urls.length === 0) {
      processTodoButton.textContent = "No URLs in todo list.";
      await setTimeout(() => {
        processTodoButton.textContent = 'Process 20 URLs (Open + Copy)';
      }, 500);
      return;
    }

    const count = 20;
    const urlsToProcess = urls.slice(0, count).map(url => url.trim());

    console.log(`Processing ${urlsToProcess.length} URLs from todo:`, urlsToProcess);

    // Copy to clipboard first
    const textToCopy = urlsToProcess.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    console.log('Copied to clipboard');

    // Remove from todo FIRST (before opening, so it happens even if opening fails)
    try {
      await removeUrlsFromTodo(urlsToProcess);
      processTodoButton.textContent = 'Removed URLs from todo';
    } catch (error) {
      console.error('Error removing URLs from todo:', error);
      processTodoButton.textContent = `Error removing URLs: ${error.message}`;
      return; // Don't continue if removal fails
    } finally {
      await setTimeout(() => {
        processTodoButton.textContent = 'Process 20 URLs (Open + Copy)';
      }, 500);
    }

    // Open in browser (after removal, so removal always happens)
    try {
      const opened = await openUrlsInBrowser(urlsToProcess);
      processTodoButton.textContent = `${opened} URLs opened in browser`;
    } catch (error) {
      console.error('Error opening URLs:', error);
      // Continue even if opening fails - removal already happened
      await setTimeout(() => {
        processTodoButton.textContent = `Error opening URLs: ${error.message}`;
      }, 500);
      return; // Don't continue if opening fails
    }

    await loadTodoCount();
    processTodoButton.textContent = `${urlsToProcess.length} URL(s)! Removed from todo, opened in browser, and copied to clipboard.`;
  } catch (error) {
    console.error('Error processing todo:', error);
    processTodoButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      processTodoButton.disabled = false;
      processTodoButton.textContent = 'Process 20 URLs (Open + Copy)';
    }, 500);
  }
});

// Save manual final URLs button
saveFinalButton.addEventListener('click', async () => {
  const inputText = manualFinalUrls.value.trim();
  if (!inputText) {
    saveFinalButton.textContent = 'Please enter at least one URL.';
    await setTimeout(() => {
      saveFinalButton.textContent = 'Save URLs manually to the <b>Final URL List</b>';
    }, 500);
    return;
  }

  // Split by newlines and filter empty lines, extract URLs
  const urls = inputText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(input => {
      // If it's already a full URL, use it; otherwise convert username to URL
      if (input.startsWith('http')) {
        return input;
      }
      return usernameToUrl(input);
    })
    .filter(url => url !== null && url.includes('/freelancers/'));

  if (urls.length === 0) {
    saveFinalButton.textContent = 'No valid freelancer URLs found.';
    return;
  }

  try {
    saveFinalButton.disabled = true;
    saveFinalButton.textContent = 'Saving...';
    const newUrls = await addUrlsToFinal(urls);

    if (newUrls.length > 0) {
      saveFinalButton.textContent = `${newUrls.length} new URL(s) added to final list!`;
      manualFinalUrls.value = '';
      await loadFinalCount();
    } else {
      saveFinalButton.textContent = 'All URLs already exist in final list.';
    }
  } catch (error) {
    console.error('Error saving final:', error);
    saveFinalButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      saveFinalButton.disabled = false;
      saveFinalButton.textContent = 'Add to Final';
    }, 500);
  }
});

// Scan final button
scanFinalButton.addEventListener('click', async () => {
  scanFinalButton.disabled = true;
  scanFinalButton.textContent = 'Scanning...';

  try {
    console.log('Starting scan for final list...');
    const response = await chrome.runtime.sendMessage({ action: 'scanAllTabs' });

    if (!response) {
      scanFinalButton.textContent = 'No response from background script. Please try again.';
      return;
    }

    if (response.error) {
      throw new Error(response.error);
    }

    console.log('Scan response:', response);
    console.log('URLs found:', response.urls?.length || 0);

    if (response.urls && response.urls.length > 0) {
      // Convert all URLs to full freelancer URLs (format: https://pro.fiverr.com/freelancers/username)
      const freelancerUrls = [];

      for (const href of response.urls) {
        try {
          let fullUrl = null;

          // If it's already a full URL
          if (href.startsWith('http')) {
            // Check if it's a freelancer URL
            if (href.includes('pro.fiverr.com/freelancers/') || href.includes('fiverr.com/freelancers/')) {
              // Extract the clean URL
              const urlObj = new URL(href);
              if (urlObj.pathname.includes('/freelancers/')) {
                // Ensure it's pro.fiverr.com
                const username = urlObj.pathname.split('/freelancers/')[1]?.split('/')[0];
                if (username) {
                  fullUrl = `https://pro.fiverr.com/freelancers/${username}`;
                }
              }
            }
          } else {
            // It's a relative URL, extract username and convert
            const username = extractUsername(href);
            if (username) {
              fullUrl = usernameToUrl(username);
            }
          }

          // Only add if it's a valid freelancer URL
          if (fullUrl && fullUrl.startsWith('https://pro.fiverr.com/freelancers/')) {
            freelancerUrls.push(fullUrl);
          }
        } catch (error) {
          console.error(`Error processing URL ${href}:`, error);
        }
      }

      // Remove duplicates
      const uniqueUrls = [...new Set(freelancerUrls)];
      console.log(`Found ${uniqueUrls.length} unique freelancer URLs:`, uniqueUrls);

      if (uniqueUrls.length === 0) {
        scanFinalButton.textContent = 'No freelancer URLs found in tabs. Make sure you have Fiverr pages with profile links open.';
        return;
      }

      // Add to final list
      const newUrls = await addUrlsToFinal(uniqueUrls);
      console.log(`Added ${newUrls.length} new URLs to final list`);

      // Close scanned tabs
      if (response.tabIds && response.tabIds.length > 0) {
        try {
          const closeResponse = await chrome.runtime.sendMessage({
            action: 'closeTabs',
            tabIds: response.tabIds
          });
          console.log(`Closed ${closeResponse?.closed || 0} tabs`);
        } catch (error) {
          console.error('Error closing tabs:', error);
          // Continue even if closing fails
        }
      }

      if (newUrls.length > 0) {
        scanFinalButton.textContent = `${newUrls.length} new freelancer URL(s) added to final list! Closed scanned tabs.`;
        await loadFinalCount();
      } else {
        scanFinalButton.textContent = `Found ${uniqueUrls.length} freelancer URL(s), but all already exist in final list. Closed scanned tabs.`;
      }
    } else {
      scanFinalButton.textContent = 'No URLs found in any tabs. Make sure you have Fiverr pages open.';
    }
  } catch (error) {
    console.error('Error scanning for final:', error);
    scanFinalButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      scanFinalButton.disabled = false;
      scanFinalButton.textContent = 'Scan Tabs & Add to Final';
    }, 500);
  }
});

// Remove URLs from Final Gist
async function removeUrlsFromFinal(urlsToRemove) {
  const config = await getGitHubConfig();

  if (!config.token || !config.finalGistId) {
    throw new Error('Final Gist not configured');
  }

  console.log('Starting removal. URLs to remove:', urlsToRemove.length);

  const allUrls = await getFinalUrlsFromGist();
  console.log('Total URLs in final before removal:', allUrls.length);

  // Normalize URLs for comparison (trim and ensure consistent format)
  const normalizedRemoveSet = new Set(
    urlsToRemove.map(url => url.trim().toLowerCase())
  );

  const remainingUrls = allUrls
    .map(url => url.trim())
    .filter(url => {
      const normalized = url.trim().toLowerCase();
      const shouldRemove = normalizedRemoveSet.has(normalized);
      if (shouldRemove) {
        console.log('Removing:', url);
      }
      return !shouldRemove;
    });

  console.log(`Removing ${urlsToRemove.length} URLs from final. Remaining: ${remainingUrls.length}`);

  if (remainingUrls.length === 0) {
    // Delete the Gist if empty
    console.log('Final list is empty, deleting Gist');
    const deleteResponse = await fetch(`https://api.github.com/gists/${config.finalGistId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (deleteResponse.ok || deleteResponse.status === 404) {
      await saveGitHubConfig(config.token, config.gistId, config.todoGistId, '');
      console.log('Deleted empty final Gist');
    } else {
      const errorText = await deleteResponse.text();
      console.error('Failed to delete Gist:', errorText);
      throw new Error('Failed to delete empty final Gist');
    }
  } else {
    console.log('Updating final Gist with remaining URLs');
    await updateFinalGist(config.finalGistId, remainingUrls);
    console.log('Final Gist updated successfully');
  }
}

// Copy all final URLs button
copyAllFinalButton.addEventListener('click', async () => {
  try {
    copyAllFinalButton.disabled = true;
    copyAllFinalButton.textContent = 'Copying...';

    const allUrls = await getFinalUrlsFromGist();

    if (allUrls.length === 0) {
      copyAllFinalButton.textContent = 'No URLs in final list.';
      return;
    }

    const textToCopy = allUrls.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    copyAllFinalButton.textContent = `${allUrls.length} URL(s) copied to clipboard!`;
  } catch (error) {
    console.error('Error copying all final URLs:', error);
    copyAllFinalButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      copyAllFinalButton.disabled = false;
      copyAllFinalButton.textContent = 'Copy All Final URLs';
    }, 500);
  }
});

// Copy final URLs button (limited by count)
copyFinalButton.addEventListener('click', async () => {
  try {
    copyFinalButton.disabled = true;
    copyFinalButton.textContent = 'Copying...';

    const count = parseInt(finalNumber.value) || 12;
    const allUrls = await getFinalUrlsFromGist();

    if (allUrls.length === 0) {
      copyFinalButton.textContent = 'No URLs in final list.';
      return;
    }

    const urlsToCopy = allUrls.slice(0, count).map(url => url.trim());

    // Copy to clipboard
    const textToCopy = urlsToCopy.join('\n');
    await navigator.clipboard.writeText(textToCopy);
    console.log('Copied to clipboard');

    // Remove from final list
    await removeUrlsFromFinal(urlsToCopy);
    console.log('Removed URLs from final list');

    await loadFinalCount();
    copyFinalButton.textContent = `${urlsToCopy.length} URL(s) copied to clipboard and removed from final list!`;
  } catch (error) {
    console.error('Error copying final URLs:', error);
    copyFinalButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      copyFinalButton.disabled = false;
      copyFinalButton.textContent = 'Copy URLs';
    }, 500);
  }
});

// Open final URLs button
openFinalButton.addEventListener('click', async () => {
  try {
    openFinalButton.disabled = true;
    openFinalButton.textContent = 'Opening...';

    const count = parseInt(finalNumber.value) || 12;
    const allUrls = await getFinalUrlsFromGist();

    if (allUrls.length === 0) {
      openFinalButton.textContent = 'No URLs in final list.';
      return;
    }

    const urlsToOpen = allUrls.slice(0, count).map(url => url.trim());

    // Remove from final list FIRST (before opening, so it happens even if opening fails)
    try {
      await removeUrlsFromFinal(urlsToOpen);
      console.log('Removed URLs from final list');
    } catch (error) {
      console.error('Error removing URLs from final:', error);
      openFinalButton.textContent = `Error removing URLs: ${error.message}`;
      await setTimeout(() => {
        openFinalButton.textContent = 'Open Tabs';
      }, 500);
      return; // Don't continue if removal fails
    }

    // Open in browser (after removal, so removal always happens)
    try {
      const opened = await openUrlsInBrowser(urlsToOpen);
      console.log(`Opened ${opened} URLs in browser`);
    } catch (error) {
      console.error('Error opening URLs:', error);
      // Continue even if opening fails - removal already happened
    }

    await loadFinalCount();
    openFinalButton.textContent = `${urlsToOpen.length} URL(s) in browser and removed from final list!`;
  } catch (error) {
    console.error('Error opening final URLs:', error);
    openFinalButton.textContent = `Error: ${error.message}`;
  } finally {
    await setTimeout(() => {
      openFinalButton.disabled = false;
      openFinalButton.textContent = 'Open Tabs';
    }, 500);
  }
});

// Load configuration and URLs on popup open
loadConfig();
loadNewUrls();
loadTodoCount();
loadFinalCount();

// Listen for storage changes to update display
chrome.storage.onChanged.addListener(() => {
  loadNewUrls();
  loadTodoCount();
  loadFinalCount();
});
