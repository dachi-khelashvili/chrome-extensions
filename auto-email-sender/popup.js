// Update email count
function updateEmailCount() {
  const emailsTextarea = document.getElementById('emails');
  const emailCountEl = document.getElementById('emailCount');
  const emails = emailsTextarea.value.split('\n').filter(e => e.trim()).length;
  emailCountEl.textContent = `Total: ${emails} email${emails !== 1 ? 's' : ''}`;
}

// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get([
    'minWait', 'maxWait', 'waitAfterOpen', 'waitAfterSend',
    'emails', 'subjects', 'messages'
  ], (result) => {
    if (result.minWait) document.getElementById('minWait').value = result.minWait;
    if (result.maxWait) document.getElementById('maxWait').value = result.maxWait;
    if (result.waitAfterOpen) document.getElementById('waitAfterOpen').value = result.waitAfterOpen;
    if (result.waitAfterSend) document.getElementById('waitAfterSend').value = result.waitAfterSend;
    if (result.emails) document.getElementById('emails').value = result.emails;
    if (result.subjects) document.getElementById('subjects').value = result.subjects;
    if (result.messages) document.getElementById('messages').value = result.messages;
    updateEmailCount();
  });

  // Load history
  loadHistory();

  // Clear history button
  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all history?')) {
      chrome.storage.local.set({ emailHistory: [] });
      loadHistory();
    }
  });

  // Check if automation is running
  chrome.storage.local.get(['isRunning'], (result) => {
    if (result.isRunning) {
      document.getElementById('startBtn').disabled = true;
      document.getElementById('stopBtn').disabled = false;
      updateStatus('Automation is running...');
    }
  });
});

// Save settings on input change
['minWait', 'maxWait', 'waitAfterOpen', 'waitAfterSend', 'subjects', 'messages'].forEach(id => {
  document.getElementById(id).addEventListener('input', (e) => {
    chrome.storage.local.set({ [id]: e.target.value });
  });
});

// Special handling for emails to update count
document.getElementById('emails').addEventListener('input', (e) => {
  chrome.storage.local.set({ emails: e.target.value });
  updateEmailCount();
});

// Start button
document.getElementById('startBtn').addEventListener('click', () => {
  const minWait = parseInt(document.getElementById('minWait').value);
  const maxWait = parseInt(document.getElementById('maxWait').value);
  const waitAfterOpen = parseInt(document.getElementById('waitAfterOpen').value);
  const waitAfterSend = parseInt(document.getElementById('waitAfterSend').value);
  const emails = document.getElementById('emails').value.trim();
  const subjects = document.getElementById('subjects').value.trim();
  const messages = document.getElementById('messages').value.trim();

  // Validation
  if (!emails) {
    updateStatus('Error: Please enter at least one email', 'error');
    return;
  }
  if (!subjects) {
    updateStatus('Error: Please enter at least one subject', 'error');
    return;
  }
  if (!messages) {
    updateStatus('Error: Please enter at least one message', 'error');
    return;
  }
  if (minWait < 1 || maxWait < 1 || minWait > maxWait) {
    updateStatus('Error: Invalid waiting time settings', 'error');
    return;
  }

  // Save settings
  chrome.storage.local.set({
    minWait,
    maxWait,
    waitAfterOpen,
    waitAfterSend,
    emails,
    subjects,
    messages,
    isRunning: true
  });

  // Start automation
  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  updateStatus('Starting automation...', 'info');
  resetTimeline();

  chrome.runtime.sendMessage({ action: 'startAutomation' });
});

// Stop button
document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.storage.local.set({ isRunning: false });
  chrome.runtime.sendMessage({ action: 'stopAutomation' });
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
  updateStatus('Automation stopped', 'info');
});

let countdownInterval = null;

// Listen for status updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateStatus') {
    updateStatus(message.text, message.type);
  }
  if (message.action === 'updateTimeline') {
    updateTimeline(message.step, message.status, message.countdown);
  }
  if (message.action === 'resetTimeline') {
    resetTimeline();
  }
  if (message.action === 'addHistoryItem') {
    addHistoryItem(message.email, message.subject, message.time);
  }
  if (message.action === 'updateEmailList') {
    // Update the email textarea to reflect remaining emails
    const emailsTextarea = document.getElementById('emails');
    emailsTextarea.value = message.remainingEmails || '';
    updateEmailCount();
    updateStatus(`Email sent! ${message.remaining} remaining, ${message.total} processed.`, 'info');
  }
  if (message.action === 'automationComplete') {
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    chrome.storage.local.set({ isRunning: false });
    resetTimeline();
  }
});

function updateStatus(text, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = text;
  statusEl.className = `status ${type}`;
}

function updateTimeline(step, status, countdown = null) {
  // Reset all steps
  document.querySelectorAll('.timeline-step').forEach(el => {
    el.classList.remove('active', 'completed');
  });

  // Update the current step
  const stepEl = document.querySelector(`[data-step="${step}"]`);
  if (stepEl) {
    stepEl.classList.add('active');
    const statusEl = stepEl.querySelector('.step-status');
    if (countdown !== null) {
      statusEl.textContent = `${status} (${countdown}s)`;
    } else {
      statusEl.textContent = status;
    }
  }

  // Mark previous steps as completed
  const steps = ['open-tab', 'add-subject', 'add-description', 'waiting'];
  const currentIndex = steps.indexOf(step);
  for (let i = 0; i < currentIndex; i++) {
    const prevStepEl = document.querySelector(`[data-step="${steps[i]}"]`);
    if (prevStepEl) {
      prevStepEl.classList.add('completed');
      prevStepEl.classList.remove('active');
    }
  }

  // Handle countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (countdown !== null && countdown > 0) {
    let remaining = countdown;
    countdownInterval = setInterval(() => {
      remaining--;
      if (remaining >= 0 && stepEl) {
        const statusEl = stepEl.querySelector('.step-status');
        statusEl.textContent = `${status} (${remaining}s)`;
      }
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }, 1000);
  }
}

function resetTimeline() {
  document.querySelectorAll('.timeline-step').forEach(el => {
    el.classList.remove('active', 'completed');
    const statusEl = el.querySelector('.step-status');
    statusEl.textContent = 'Waiting...';
  });
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// Reset timeline when stopping
document.getElementById('stopBtn').addEventListener('click', () => {
  resetTimeline();
});

// History functions
function loadHistory() {
  chrome.storage.local.get(['emailHistory'], (result) => {
    const history = result.emailHistory || [];
    const historyList = document.getElementById('historyList');
    
    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No history yet</div>';
      return;
    }
    
    historyList.innerHTML = history.map(item => `
      <div class="history-item">
        <div class="history-email">${escapeHtml(item.email)}</div>
        <div class="history-subject">${escapeHtml(item.subject)}</div>
        <div class="history-time">${escapeHtml(item.time)}</div>
      </div>
    `).join('');
  });
}

function addHistoryItem(email, subject, time) {
  const historyList = document.getElementById('historyList');
  const emptyMsg = historyList.querySelector('.history-empty');
  if (emptyMsg) {
    emptyMsg.remove();
  }
  
  const item = document.createElement('div');
  item.className = 'history-item';
  item.innerHTML = `
    <div class="history-email">${escapeHtml(email)}</div>
    <div class="history-subject">${escapeHtml(subject)}</div>
    <div class="history-time">${escapeHtml(time)}</div>
  `;
  
  historyList.insertBefore(item, historyList.firstChild);
  
  // Keep only last 100 items in DOM
  while (historyList.children.length > 100) {
    historyList.removeChild(historyList.lastChild);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

