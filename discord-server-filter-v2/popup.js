// Functions are available via window.DiscordServerUtils (loaded in popup.html)
// Get servers from page
async function getServersFromPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on Discord
    if (!tab.url.includes('discord.com')) {
      showError('Please navigate to a Discord page first');
      return;
    }
    
    // Inject content script and get servers
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'getServers' }, (response) => {
        if (chrome.runtime.lastError) {
          showError('Error: ' + chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (response && response.servers) {
          displayServers(response.servers);
          resolve(response.servers);
        } else {
          showError('No servers found on this page');
          resolve([]);
        }
      });
    });
  } catch (error) {
    showError('Error: ' + error.message);
    throw error;
  }
}

function displayServers(servers) {
  const container = document.getElementById('servers-container');
  
  if (servers.length === 0) {
    container.innerHTML = '<div class="no-servers">No servers found with title, description, and online count</div>';
    return;
  }
  
  container.innerHTML = servers.map(server => {
    const languageResult = window.DiscordServerUtils.detectServerLanguage(server.title, server.description);
    const language = languageResult.language;
    const languageMatchedItems = languageResult.matchedItems;
    const lgbtqResult = window.DiscordServerUtils.detectLGBTQContent(server.title, server.description);
    const isLGBTQ = lgbtqResult.isLGBTQ;
    const matchedKeywords = lgbtqResult.matchedKeywords;
    
    // Show matched keywords/items under description if it's LGBTQ+ or language is not English
    let keywordsText = '';
    if ((isLGBTQ && matchedKeywords.length > 0) || language !== 'English') {
      if (isLGBTQ && matchedKeywords.length > 0) {
        const keywordsList = matchedKeywords.join(', ');
        keywordsText = `<div class="server-keywords">${escapeHtml(keywordsList)}</div>`;
      } else if (language !== 'English' && languageMatchedItems.length > 0) {
        const itemsList = languageMatchedItems.join(', ');
        keywordsText = `<div class="server-keywords">${escapeHtml(itemsList)}</div>`;
      }
    }
    
    return `
    <div class="server-card">
      <div class="server-header">
        <h2 class="server-title">${escapeHtml(server.title)}</h2>
        <div class="server-badges">
          ${isLGBTQ ? '<span class="server-lgbtq" title="LGBTQ+ Community">🏳️‍🌈</span>' : ''}
          <span class="server-language">${escapeHtml(language)}</span>
        </div>
      </div>
      <p class="server-description">${escapeHtml(server.description)}</p>
      ${keywordsText}
      <div class="server-online">${escapeHtml(server.onlineCount)}</div>
    </div>
  `;
  }).join('');
}

function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  document.getElementById('servers-container').innerHTML = '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get minimum online count from storage
async function getMinOnlineCount() {
  const result = await chrome.storage.sync.get(['minOnlineCount']);
  return result.minOnlineCount || 500; // Default to 500
}

// Save minimum online count to storage
async function saveMinOnlineCount(count) {
  await chrome.storage.sync.set({ minOnlineCount: count });
  // Notify content script to update dimming
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url.includes('discord.com')) {
    const alpha = await getAlphaValue();
    chrome.tabs.sendMessage(tab.id, { action: 'updateDimming', minOnlineCount: count, alphaValue: alpha });
  }
}

// Get alpha value from storage
async function getAlphaValue() {
  const result = await chrome.storage.sync.get(['alphaValue']);
  return result.alphaValue !== undefined ? result.alphaValue : 0.1; // Default to 0.1
}

// Save alpha value to storage
async function saveAlphaValue(alpha) {
  await chrome.storage.sync.set({ alphaValue: alpha });
  // Notify content script to update dimming
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url.includes('discord.com')) {
    const minCount = await getMinOnlineCount();
    chrome.tabs.sendMessage(tab.id, { action: 'updateDimming', minOnlineCount: minCount, alphaValue: alpha });
  }
}

// Load servers when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  // Load and set minimum online count
  const minOnlineCount = await getMinOnlineCount();
  const minOnlineInput = document.getElementById('min-online-count');
  if (minOnlineInput) {
    minOnlineInput.value = minOnlineCount;
    minOnlineInput.addEventListener('change', async (e) => {
      const value = parseInt(e.target.value, 10) || 0;
      await saveMinOnlineCount(value);
    });
    minOnlineInput.addEventListener('input', async (e) => {
      const value = parseInt(e.target.value, 10) || 0;
      await saveMinOnlineCount(value);
    });
  }
  
  // Load and set alpha value
  const alphaValue = await getAlphaValue();
  const alphaInput = document.getElementById('alpha-value');
  if (alphaInput) {
    alphaInput.value = alphaValue;
    alphaInput.addEventListener('change', async (e) => {
      const value = parseFloat(e.target.value) || 0;
      const clampedValue = Math.max(0, Math.min(1, value)); // Clamp between 0 and 1
      alphaInput.value = clampedValue;
      await saveAlphaValue(clampedValue);
    });
    alphaInput.addEventListener('input', async (e) => {
      const value = parseFloat(e.target.value) || 0;
      const clampedValue = Math.max(0, Math.min(1, value)); // Clamp between 0 and 1
      await saveAlphaValue(clampedValue);
    });
  }
  
  // Setup random letters button
  const randomLettersButton = document.querySelector('.random-letters-button');
  const copiedLettersDisplay = document.getElementById('copied-letters');
  
  if (randomLettersButton) {
    randomLettersButton.addEventListener('click', async () => {
      // Generate 3 random lowercase English letters
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      const randomLetters = Array.from({ length: 3 }, () => 
        letters[Math.floor(Math.random() * letters.length)]
      ).join('');
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(randomLetters);
        // Show copied letters
        if (copiedLettersDisplay) {
          copiedLettersDisplay.textContent = randomLetters;
          copiedLettersDisplay.style.display = 'inline-block';
          setTimeout(() => {
            copiedLettersDisplay.style.display = 'none';
          }, 3000);
        }
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  }
  
  // Load servers initially
  getServersFromPage();
  
  // Setup refresh button
  const refreshButton = document.querySelector('.refresh-button');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      // Add refreshing class for animation
      refreshButton.classList.add('refreshing');
      
      // Hide error and show loading state
      document.getElementById('error').style.display = 'none';
      const container = document.getElementById('servers-container');
      container.innerHTML = '<div class="loading">Loading servers...</div>';
      
      getServersFromPage().finally(() => {
        // Remove refreshing class after a short delay
        setTimeout(() => {
          refreshButton.classList.remove('refreshing');
        }, 300);
      });
    });
  }
});