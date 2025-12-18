// Load saved data on popup open
document.addEventListener('DOMContentLoaded', async () => {
  const messagesTextarea = document.getElementById('messages');
  const urlsTextarea = document.getElementById('urls');
  const saveMessagesBtn = document.getElementById('saveMessages');
  const saveUrlsBtn = document.getElementById('saveUrls');
  const startStopBtn = document.getElementById('startStopBtn');
  const messagesStatus = document.getElementById('messagesStatus');
  const urlsStatus = document.getElementById('urlsStatus');
  const statusInfo = document.getElementById('status');
  const historyContainer = document.getElementById('history');
  const timelineEl = document.getElementById('timeline');
  const timelineInfo = document.getElementById('timelineInfo');
  const minMinutesInput = document.getElementById('minMinutes');
  const maxMinutesInput = document.getElementById('maxMinutes');
  const skipHeyButtonCheckbox = document.getElementById('skipHeyButton');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const timeStatus = document.getElementById('timeStatus');

  // Load saved data
  const result = await chrome.storage.local.get(['messages', 'urls', 'isRunning', 'minMinutes', 'maxMinutes', 'skipHeyButton']);
  if (result.messages) {
    messagesTextarea.value = result.messages.join('\n');
  }
  if (result.urls) {
    urlsTextarea.value = result.urls.join('\n');
  }
  if (result.minMinutes) {
    minMinutesInput.value = result.minMinutes;
  }
  if (result.maxMinutes) {
    maxMinutesInput.value = result.maxMinutes;
  }
  if (result.skipHeyButton !== undefined) {
    skipHeyButtonCheckbox.checked = result.skipHeyButton;
  }
  // Update button state based on running state and available URLs
  updateStartButton();

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
    const minMinutes = parseInt(minMinutesInput.value, 10);
    const maxMinutes = parseInt(maxMinutesInput.value, 10);
    const skipHeyButton = skipHeyButtonCheckbox.checked;
    
    if (isNaN(minMinutes) || minMinutes < 1 || minMinutes > 1440) {
      timeStatus.textContent = 'Please enter a valid min value (1-1440)';
      timeStatus.style.color = '#f44336';
      return;
    }
    
    if (isNaN(maxMinutes) || maxMinutes < 1 || maxMinutes > 1440) {
      timeStatus.textContent = 'Please enter a valid max value (1-1440)';
      timeStatus.style.color = '#f44336';
      return;
    }
    
    if (minMinutes > maxMinutes) {
      timeStatus.textContent = 'Min must be less than or equal to max';
      timeStatus.style.color = '#f44336';
      return;
    }
    
    await chrome.storage.local.set({ 
      minMinutes,
      maxMinutes,
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
    chrome.storage.local.get(['messages', 'urls', 'isRunning'], (result) => {
      const hasMessages = result.messages && result.messages.length > 0;
      const hasUrls = result.urls && result.urls.length > 0;
      const running = result.isRunning || false;
      
      // If no URLs, change to Start button and disable it
      if (!hasUrls) {
        startStopBtn.textContent = 'Start';
        startStopBtn.style.background = '';
        startStopBtn.disabled = true;
      } else if (!hasMessages) {
        startStopBtn.disabled = true;
      } else {
        // Enable/disable based on running state
        startStopBtn.disabled = false;
        if (running) {
          startStopBtn.textContent = 'Stop';
          startStopBtn.style.background = '#f44336';
        } else {
          startStopBtn.textContent = 'Start';
          startStopBtn.style.background = '';
        }
      }
    });
  }

  // Start/Stop toggle button
  startStopBtn.addEventListener('click', async () => {
    const { isRunning } = await chrome.storage.local.get(['isRunning']);
    if (isRunning) {
      // Stop
      await chrome.storage.local.set({ isRunning: false });
      setRunningUI(false);
      statusInfo.textContent = 'Process stopped';
      statusInfo.style.color = 'orange';
      chrome.runtime.sendMessage({ action: 'stop' });
      return;
    }

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
    
    setRunningUI(true);
    statusInfo.textContent = 'Process started...';
    statusInfo.style.color = 'blue';

    // Send message to background script to start
    chrome.runtime.sendMessage({ action: 'start' });
  });

  // Listen for status updates from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateStatus') {
      statusInfo.textContent = message.status;
      if (message.isRunning === false) {
        setRunningUI(false);
        // Check if URLs are empty and update button accordingly
        updateStartButton();
        // Clear timeline when automation fully completes
        // (timeline itself is reset via clearTimeline)
      } else if (message.isRunning === true) {
        setRunningUI(true);
      }
    } else if (message.action === 'updateDetails') {
      // No more processDetails field; we rely on status + timeline instead.
    } else if (message.action === 'clearTimeline') {
      // Clear timeline for new URL
      resetTimeline();
    } else if (message.action === 'updateHistory') {
      renderHistory(message.history || []);
    } else if (message.action === 'timeline') {
      updateTimeline(message.step, message.label, message.remainingSeconds);
    }
  });

  // Load existing URL history if any
  chrome.storage.local.get(['urlHistory'], (result) => {
    if (result.urlHistory && Array.isArray(result.urlHistory)) {
      renderHistory(result.urlHistory);
    }
  });

  function renderHistory(items) {
    if (!historyContainer) return;
    historyContainer.innerHTML = '';
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'history-entry';
      const meta = document.createElement('div');
      meta.className = 'history-meta';
      const statusSpan = document.createElement('span');
      statusSpan.className = item.status === 'success' ? 'history-status-success' : 'history-status-failed';
      statusSpan.textContent = item.status === 'success' ? 'Success' : 'Failed';
      const timeSpan = document.createElement('span');
      const d = new Date(item.timestamp || Date.now());
      timeSpan.textContent = d.toLocaleTimeString();
      meta.appendChild(statusSpan);
      meta.appendChild(timeSpan);

      const urlSpan = document.createElement('div');
      urlSpan.className = 'history-url';
      urlSpan.textContent = item.url || '';

      const reasonSpan = document.createElement('div');
      reasonSpan.textContent = item.reason || '';
      
      row.appendChild(meta);
      row.appendChild(urlSpan);
      if (item.reason) {
        row.appendChild(reasonSpan);
      }

      historyContainer.appendChild(row);
    });
  }

  function resetTimeline() {
    if (!timelineEl) return;
    const steps = timelineEl.querySelectorAll('.timeline-step');
    steps.forEach(step => {
      step.classList.remove('timeline-active', 'timeline-completed');
    });
    timelineInfo.textContent = '';
  }

  function updateTimeline(stepId, label, remainingSeconds) {
    if (!timelineEl) return;
    const order = ['open', 'prepare', 'send', 'wait'];
    const steps = timelineEl.querySelectorAll('.timeline-step');
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
      const secondsText = typeof remainingSeconds === 'number'
        ? ` – ${remainingSeconds}s left`
        : '';
      timelineInfo.textContent = `${label}${secondsText}`;
    }
  }

  updateStartButton();

  function setRunningUI(running) {
    if (running) {
      startStopBtn.disabled = false;
      startStopBtn.textContent = 'Stop';
      startStopBtn.style.background = '#f44336';
    } else {
      // Check if there are URLs before enabling
      chrome.storage.local.get(['urls'], (result) => {
        const hasUrls = result.urls && result.urls.length > 0;
        startStopBtn.textContent = 'Start';
        startStopBtn.style.background = '';
        // Disable if no URLs
        if (!hasUrls) {
          startStopBtn.disabled = true;
        }
      });
    }
  }
});

