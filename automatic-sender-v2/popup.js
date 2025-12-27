// Browser compatibility layer
const browserAPI = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : 
                   (typeof browser !== 'undefined' && browser.runtime) ? browser : null;

// Cache DOM elements and state
let elements = {};
let cachedState = {
  messages: null,
  urls: null,
  isRunning: false,
  minMinutes: null,
  maxMinutes: null,
  skipHeyButton: false
};

// Load saved data on popup open
document.addEventListener('DOMContentLoaded', async () => {
  // Cache DOM elements
  elements = {
    messagesTextarea: document.getElementById('messages'),
    urlsTextarea: document.getElementById('urls'),
    saveMessagesBtn: document.getElementById('saveMessages'),
    saveUrlsBtn: document.getElementById('saveUrls'),
    startStopBtn: document.getElementById('startStopBtn'),
    messagesStatus: document.getElementById('messagesStatus'),
    urlsStatus: document.getElementById('urlsStatus'),
    statusInfo: document.getElementById('status'),
    historyContainer: document.getElementById('history'),
    timelineEl: document.getElementById('timeline'),
    timelineInfo: document.getElementById('timelineInfo'),
    minMinutesInput: document.getElementById('minMinutes'),
    maxMinutesInput: document.getElementById('maxMinutes'),
    skipHeyButtonCheckbox: document.getElementById('skipHeyButton'),
    saveSettingsBtn: document.getElementById('saveSettings'),
    timeStatus: document.getElementById('timeStatus')
  };

  // Load saved data
  await loadSavedData();
  updateStartButton();

  // Set up event listeners
  setupEventListeners();

  // Load existing URL history
  loadHistory();
});

async function loadSavedData() {
  try {
    const result = await browserAPI.storage.local.get([
      'messages', 'urls', 'isRunning', 'minMinutes', 'maxMinutes', 'skipHeyButton'
    ]);
    
    // Update cache
    cachedState.messages = result.messages || null;
    cachedState.urls = result.urls || null;
    cachedState.isRunning = result.isRunning || false;
    cachedState.minMinutes = result.minMinutes || null;
    cachedState.maxMinutes = result.maxMinutes || null;
    cachedState.skipHeyButton = result.skipHeyButton !== undefined ? result.skipHeyButton : false;
    
    // Update UI
    if (cachedState.messages) {
      elements.messagesTextarea.value = cachedState.messages.join(' | ');
    }
    if (cachedState.urls) {
      elements.urlsTextarea.value = cachedState.urls.join('\n');
    }
    if (cachedState.minMinutes) {
      elements.minMinutesInput.value = cachedState.minMinutes;
    }
    if (cachedState.maxMinutes) {
      elements.maxMinutesInput.value = cachedState.maxMinutes;
    }
    elements.skipHeyButtonCheckbox.checked = cachedState.skipHeyButton;
  } catch (error) {
    console.error('Error loading saved data:', error);
  }
}

function setupEventListeners() {
  // Save messages
  elements.saveMessagesBtn.addEventListener('click', async () => {
    const messages = elements.messagesTextarea.value
      .split(' | ')
      .filter(msg => msg.length > 0); // Keep messages exactly as entered, no trimming
    
    try {
      await browserAPI.storage.local.set({ messages });
      cachedState.messages = messages;
      showStatus(elements.messagesStatus, `Saved ${messages.length} message(s)`, 2000);
      updateStartButton();
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  });

  // Save URLs
  elements.saveUrlsBtn.addEventListener('click', async () => {
    const urls = elements.urlsTextarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    try {
      await browserAPI.storage.local.set({ urls });
      cachedState.urls = urls;
      showStatus(elements.urlsStatus, `Saved ${urls.length} URL(s)`, 2000);
      updateStartButton();
    } catch (error) {
      console.error('Error saving URLs:', error);
    }
  });

  // Save settings
  elements.saveSettingsBtn.addEventListener('click', async () => {
    const minMinutes = parseInt(elements.minMinutesInput.value, 10);
    const maxMinutes = parseInt(elements.maxMinutesInput.value, 10);
    const skipHeyButton = elements.skipHeyButtonCheckbox.checked;
    
    if (isNaN(minMinutes) || minMinutes < 1 || minMinutes > 1440) {
      showStatus(elements.timeStatus, 'Please enter a valid min value (1-1440)', 2000, '#f44336');
      return;
    }
    
    if (isNaN(maxMinutes) || maxMinutes < 1 || maxMinutes > 1440) {
      showStatus(elements.timeStatus, 'Please enter a valid max value (1-1440)', 2000, '#f44336');
      return;
    }
    
    if (minMinutes > maxMinutes) {
      showStatus(elements.timeStatus, 'Min must be less than or equal to max', 2000, '#f44336');
      return;
    }
    
    try {
      await browserAPI.storage.local.set({ 
        minMinutes,
        maxMinutes,
        skipHeyButton
      });
      
      cachedState.minMinutes = minMinutes;
      cachedState.maxMinutes = maxMinutes;
      cachedState.skipHeyButton = skipHeyButton;
      
      showStatus(elements.timeStatus, 'Settings saved', 2000, '#1f8d4d');
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  });

  // Start/Stop toggle button
  elements.startStopBtn.addEventListener('click', async () => {
    if (cachedState.isRunning) {
      // Stop
      try {
        await browserAPI.storage.local.set({ isRunning: false });
        cachedState.isRunning = false;
        setRunningUI(false);
        elements.statusInfo.textContent = 'Process stopped';
        elements.statusInfo.style.color = 'orange';
        browserAPI.runtime.sendMessage({ action: 'stop' }).catch(() => {});
      } catch (error) {
        console.error('Error stopping process:', error);
      }
      return;
    }

    const messages = elements.messagesTextarea.value
      .split(' | ')
      .filter(msg => msg.length > 0); // Keep messages exactly as entered, no trimming
    const urls = elements.urlsTextarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (messages.length === 0 || urls.length === 0) {
      elements.statusInfo.textContent = 'Please save messages and URLs first';
      elements.statusInfo.style.color = 'red';
      return;
    }

    try {
      await browserAPI.storage.local.set({ 
        messages, 
        urls, 
        isRunning: true 
      });
      
      cachedState.messages = messages;
      cachedState.urls = urls;
      cachedState.isRunning = true;
      
      setRunningUI(true);
      elements.statusInfo.textContent = 'Process started...';
      elements.statusInfo.style.color = 'blue';

      browserAPI.runtime.sendMessage({ action: 'start' }).catch(() => {});
    } catch (error) {
      console.error('Error starting process:', error);
    }
  });

  // Listen for status updates from background
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateStatus') {
      elements.statusInfo.textContent = message.status;
      if (message.isRunning === false) {
        cachedState.isRunning = false;
        setRunningUI(false);
        updateStartButton();
      } else if (message.isRunning === true) {
        cachedState.isRunning = true;
        setRunningUI(true);
      }
    } else if (message.action === 'clearTimeline') {
      resetTimeline();
    } else if (message.action === 'updateHistory') {
      renderHistory(message.history || []);
    } else if (message.action === 'timeline') {
      updateTimeline(message.step, message.label, message.remainingSeconds);
    }
  });
}

function showStatus(element, text, duration, color = '#1f8d4d') {
  element.textContent = text;
  element.style.color = color;
  setTimeout(() => {
    element.textContent = '';
  }, duration);
}

// Update start button state
function updateStartButton() {
  const hasMessages = cachedState.messages && cachedState.messages.length > 0;
  const hasUrls = cachedState.urls && cachedState.urls.length > 0;
  const running = cachedState.isRunning || false;
  
  if (!hasUrls) {
    elements.startStopBtn.textContent = 'Start';
    elements.startStopBtn.style.background = '';
    elements.startStopBtn.disabled = true;
  } else if (!hasMessages) {
    elements.startStopBtn.disabled = true;
  } else {
    elements.startStopBtn.disabled = false;
    if (running) {
      elements.startStopBtn.textContent = 'Stop';
      elements.startStopBtn.style.background = '#f44336';
    } else {
      elements.startStopBtn.textContent = 'Start';
      elements.startStopBtn.style.background = '';
    }
  }
}

function setRunningUI(running) {
  if (running) {
    elements.startStopBtn.disabled = false;
    elements.startStopBtn.textContent = 'Stop';
    elements.startStopBtn.style.background = '#f44336';
  } else {
    const hasUrls = cachedState.urls && cachedState.urls.length > 0;
    elements.startStopBtn.textContent = 'Start';
    elements.startStopBtn.style.background = '';
    elements.startStopBtn.disabled = !hasUrls;
  }
}

async function loadHistory() {
  try {
    const result = await browserAPI.storage.local.get(['urlHistory']);
    if (result.urlHistory && Array.isArray(result.urlHistory)) {
      renderHistory(result.urlHistory);
    }
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

function renderHistory(items) {
  if (!elements.historyContainer) return;
  elements.historyContainer.innerHTML = '';
  
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-entry';
    
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    
    const statusSpan = document.createElement('span');
    if (item.status === 'success') {
      statusSpan.className = 'history-status-success';
      statusSpan.textContent = 'Success';
    } else if (item.status === 'stopped') {
      statusSpan.className = 'history-status-stopped';
      statusSpan.textContent = 'Stopped';
    } else if (item.status === 'processing') {
      statusSpan.className = 'history-status-processing';
      statusSpan.textContent = 'Processing';
    } else if (item.status === 'pending') {
      statusSpan.className = 'history-status-pending';
      statusSpan.textContent = 'Pending';
    } else {
      statusSpan.className = 'history-status-failed';
      statusSpan.textContent = 'Failed';
    }
    
    const timeSpan = document.createElement('span');
    const d = new Date(item.timestamp || Date.now());
    // Display in Vladivostok timezone
    timeSpan.textContent = d.toLocaleString('en-US', { 
      timeZone: 'Asia/Vladivostok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    meta.appendChild(statusSpan);
    meta.appendChild(timeSpan);

    const urlSpan = document.createElement('div');
    urlSpan.className = 'history-url';
    urlSpan.textContent = item.url || '';

    row.appendChild(meta);
    row.appendChild(urlSpan);
    
    if (item.reason) {
      const reasonSpan = document.createElement('div');
      reasonSpan.textContent = item.reason || '';
      row.appendChild(reasonSpan);
    }

    elements.historyContainer.appendChild(row);
  });
}

function resetTimeline() {
  if (!elements.timelineEl) return;
  const steps = elements.timelineEl.querySelectorAll('.timeline-step');
  steps.forEach(step => {
    step.classList.remove('timeline-active', 'timeline-completed');
  });
  elements.timelineInfo.textContent = '';
}

function updateTimeline(stepId, label, remainingSeconds) {
  if (!elements.timelineEl) return;
  const order = ['open', 'prepare', 'send', 'wait'];
  const steps = elements.timelineEl.querySelectorAll('.timeline-step');
  
  steps.forEach(step => {
    const id = step.getAttribute('data-step');
    step.classList.remove('timeline-active');
    
    if (order.indexOf(id) < order.indexOf(stepId)) {
      step.classList.add('timeline-completed');
    } else {
      step.classList.remove('timeline-completed');
    }
    
    if (id === stepId) {
      step.classList.add('timeline-active');
    }
  });

  if (label) {
    // If label already contains countdown (like "5s" or "5s left"), use label as-is
    // Otherwise append remainingSeconds if provided
    const hasCountdown = /\d+s/.test(label);
    const secondsText = (typeof remainingSeconds === 'number' && !hasCountdown)
      ? ` – ${remainingSeconds}s left`
      : '';
    elements.timelineInfo.textContent = `${label}${secondsText}`;
  }
}
