// Load saved data on popup open
document.addEventListener('DOMContentLoaded', async () => {
  const messagesTextarea = document.getElementById('messages');
  const urlsTextarea = document.getElementById('urls');
  const saveMessagesBtn = document.getElementById('saveMessages');
  const saveUrlsBtn = document.getElementById('saveUrls');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const messagesStatus = document.getElementById('messagesStatus');
  const urlsStatus = document.getElementById('urlsStatus');
  const statusInfo = document.getElementById('status');
  const processDetails = document.getElementById('processDetails');
  const timeBetweenMessagesInput = document.getElementById('timeBetweenMessages');
  const skipHeyButtonCheckbox = document.getElementById('skipHeyButton');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const timeStatus = document.getElementById('timeStatus');

  // Load saved data
  const result = await chrome.storage.local.get(['messages', 'urls', 'isRunning', 'timeBetweenMessages', 'skipHeyButton']);
  if (result.messages) {
    messagesTextarea.value = result.messages.join('\n');
  }
  if (result.urls) {
    urlsTextarea.value = result.urls.join('\n');
  }
  if (result.timeBetweenMessages) {
    timeBetweenMessagesInput.value = result.timeBetweenMessages;
  }
  if (result.skipHeyButton !== undefined) {
    skipHeyButtonCheckbox.checked = result.skipHeyButton;
  }
  if (result.isRunning) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusInfo.textContent = 'Process is running...';
  }

  // Save messages
  saveMessagesBtn.addEventListener('click', async () => {
    const messages = messagesTextarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    await chrome.storage.local.set({ messages });
    messagesStatus.textContent = `Saved ${messages.length} message(s)`;
    setTimeout(() => {
      messagesStatus.textContent = '';
    }, 2000);
    
    updateStartButton();
  });

  // Save URLs
  saveUrlsBtn.addEventListener('click', async () => {
    const urls = urlsTextarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    await chrome.storage.local.set({ urls });
    urlsStatus.textContent = `Saved ${urls.length} URL(s)`;
    setTimeout(() => {
      urlsStatus.textContent = '';
    }, 2000);
    
    updateStartButton();
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', async () => {
    const timeBetweenMessages = parseInt(timeBetweenMessagesInput.value, 10);
    const skipHeyButton = skipHeyButtonCheckbox.checked;
    
    if (isNaN(timeBetweenMessages) || timeBetweenMessages < 1) {
      timeStatus.textContent = 'Please enter a valid number (1-1440)';
      timeStatus.style.color = '#f44336';
      return;
    }
    
    await chrome.storage.local.set({ 
      timeBetweenMessages,
      skipHeyButton
    });
    
    timeStatus.textContent = 'Settings saved';
    timeStatus.style.color = '#1f8d4d';
    setTimeout(() => {
      timeStatus.textContent = '';
    }, 2000);
  });

  // Update start button state
  function updateStartButton() {
    chrome.storage.local.get(['messages', 'urls'], (result) => {
      const hasMessages = result.messages && result.messages.length > 0;
      const hasUrls = result.urls && result.urls.length > 0;
      startBtn.disabled = !hasMessages || !hasUrls;
    });
  }

  // Start button
  startBtn.addEventListener('click', async () => {
    const messages = messagesTextarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    const urls = urlsTextarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (messages.length === 0 || urls.length === 0) {
      statusInfo.textContent = 'Please save messages and URLs first';
      statusInfo.style.color = 'red';
      return;
    }

    await chrome.storage.local.set({ 
      messages, 
      urls, 
      isRunning: true 
    });
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusInfo.textContent = 'Process started...';
    statusInfo.style.color = 'blue';
    processDetails.innerHTML = ''; // Clear previous logs

    // Send message to background script to start
    chrome.runtime.sendMessage({ action: 'start' });
  });

  // Stop button
  stopBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ isRunning: false });
    
    // Clear process logs/history
    await chrome.storage.local.set({ processLogs: [] });
    processDetails.innerHTML = '';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusInfo.textContent = 'Process stopped';
    statusInfo.style.color = 'orange';

    chrome.runtime.sendMessage({ action: 'stop' });
  });

  // Listen for status updates from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateStatus') {
      statusInfo.textContent = message.status;
      if (message.isRunning === false) {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        // Clear process details if automation completed
        if (message.status && message.status.includes('All URLs processed')) {
          processDetails.innerHTML = '';
        }
      }
    } else if (message.action === 'updateDetails') {
      addProcessLog(message.detail, message.type || 'info');
    } else if (message.action === 'clearHistory') {
      processDetails.innerHTML = '';
    }
  });

  // Add log entry to process details
  function addProcessLog(detail, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `<span class="log-time">[${time}]</span><span>${detail}</span>`;
    processDetails.insertBefore(logEntry, processDetails.firstChild);
    
    // Keep only last 50 entries
    while (processDetails.children.length > 50) {
      processDetails.removeChild(processDetails.lastChild);
    }
  }

  // Load existing logs if any
  chrome.storage.local.get(['processLogs'], (result) => {
    if (result.processLogs && Array.isArray(result.processLogs)) {
      result.processLogs.forEach(log => {
        addProcessLog(log.detail, log.type);
      });
    }
  });

  updateStartButton();
});

