// DOM elements
const minWaitTimeInput = document.getElementById('minWaitTime');
const maxWaitTimeInput = document.getElementById('maxWaitTime');
const waitAfterOpenInput = document.getElementById('waitAfterOpen');
const waitAfterSendInput = document.getElementById('waitAfterSend');
const emailsInput = document.getElementById('emails');
const subjectsInput = document.getElementById('subjects');
const messagesInput = document.getElementById('messages');
const emailCount = document.querySelector('.email-count');
const subjectCount = document.getElementById('subject-count');
const messageCount = document.getElementById('message-count');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyList = document.getElementById('historyList');
const timelineSteps = {
  step1: { element: document.getElementById('step1'), status: document.getElementById('status1') },
  step2: { element: document.getElementById('step2'), status: document.getElementById('status2') },
  step3: { element: document.getElementById('step3'), status: document.getElementById('status3') }
};

// Load saved settings
async function loadSettings() {
  const result = await chrome.storage.local.get([
    'minWaitTime', 'maxWaitTime', 'waitAfterOpen', 'waitAfterSend',
    'emails', 'subjects', 'messages', 'history', 'isRunning'
  ]);

  if (result.minWaitTime !== undefined) minWaitTimeInput.value = result.minWaitTime;
  if (result.maxWaitTime !== undefined) maxWaitTimeInput.value = result.maxWaitTime;
  if (result.waitAfterOpen !== undefined) waitAfterOpenInput.value = result.waitAfterOpen;
  if (result.waitAfterSend !== undefined) waitAfterSendInput.value = result.waitAfterSend;
  if (result.emails !== undefined) emailsInput.value = result.emails.join('\n');
  if (result.subjects !== undefined) subjectsInput.value = result.subjects.join(' | ');
  if (result.messages !== undefined) messagesInput.value = result.messages.join(' | ');
  
  updateEmailCount();
  loadHistory(result.history || []);

  // Check if automation is running
  if (result.isRunning) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    clearTimeline();
  }
}

// Save settings
async function saveSettings() {
  const emails = emailsInput.value.split('\n').filter(e => e.trim());
  const subjects = subjectsInput.value.split(' | ').map(s => s.trim()).filter(s => s);
  // Split messages by " | ", keep internal newlines in each message
  const messages = messagesInput.value
    .split(/\s*\|\s*/)
    .map(m => m.trim())
    .filter(m => m);

  subjectCount.textContent = `${subjects.length} subjects`;
  messageCount.textContent = `${messages.length} messages`;

  await chrome.storage.local.set({
    minWaitTime: parseInt(minWaitTimeInput.value) || 5,
    maxWaitTime: parseInt(maxWaitTimeInput.value) || 10,
    waitAfterOpen: parseInt(waitAfterOpenInput.value) || 3,
    waitAfterSend: parseInt(waitAfterSendInput.value) || 2,
    emails: emails,
    subjects: subjects,
    messages: messages
  });

  updateEmailCount();
}

// Update email count
function updateEmailCount() {
  const emails = emailsInput.value.split('\n').filter(e => e.trim());
  const subjects = subjectsInput.value.split(' | ').map(s => s.trim()).filter(s => s);
  const messages = messagesInput.value
    .split(/\s*\|\s*/)
    .map(m => m.trim())
    .filter(m => m);
  emailCount.textContent = `${emails.length} emails`;
  subjectCount.textContent = `${subjects.length} subjects`;
  messageCount.textContent = `${messages.length} messages`;
}

// Load history
function loadHistory(history) {
  if (!history || history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No emails sent yet</div>';
    return;
  }

  historyList.innerHTML = `<div class="history-count">${history.length} emails sent</div>` + history.map(item => `
    <div class="history-item">
      <div class="history-email">${escapeHtml(item.email)}</div>
      <div class="history-time">${escapeHtml(item.datetime)}</div>
    </div>
  `).join('');
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Clear timeline highlights
function clearTimeline() {
  Object.values(timelineSteps).forEach(step => {
    step.element.classList.remove('active', 'completed');
    step.status.textContent = 'Waiting...';
  });
}

// Update timeline step
function updateTimeline(stepNumber, status, isActive = false, isCompleted = false) {
  const step = timelineSteps[`step${stepNumber}`];
  if (!step) return;

  step.element.classList.remove('active', 'completed');
  if (isActive) {
    step.element.classList.add('active');
  } else if (isCompleted) {
    step.element.classList.add('completed');
  }
  step.status.textContent = status;
}

// Event listeners
emailsInput.addEventListener('input', () => {
  saveSettings();
  updateEmailCount();
});

minWaitTimeInput.addEventListener('change', saveSettings);
maxWaitTimeInput.addEventListener('change', saveSettings);
waitAfterOpenInput.addEventListener('change', saveSettings);
waitAfterSendInput.addEventListener('change', saveSettings);
subjectsInput.addEventListener('input', saveSettings);
messagesInput.addEventListener('input', saveSettings);

startBtn.addEventListener('click', async () => {
  await saveSettings();
  
  const emails = emailsInput.value.split('\n').filter(e => e.trim());
  if (emails.length === 0) {
    alert('Please enter at least one email');
    return;
  }

  startBtn.disabled = true;
  stopBtn.disabled = false;
  clearTimeline();

  await chrome.storage.local.set({ isRunning: true });
  chrome.runtime.sendMessage({ action: 'startAutomation' });
});

stopBtn.addEventListener('click', async () => {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  clearTimeline();

  await chrome.storage.local.set({ isRunning: false });
  chrome.runtime.sendMessage({ action: 'stopAutomation' });
});

clearHistoryBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all history?')) {
    await chrome.storage.local.set({ history: [] });
    loadHistory([]);
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateTimeline') {
    updateTimeline(message.step, message.status, message.isActive, message.isCompleted);
  } else if (message.action === 'automationStopped') {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    clearTimeline();
    loadSettings(); // Reload to refresh history
  } else if (message.action === 'updateHistory') {
    loadHistory(message.history);
  }
});

// Initialize
loadSettings();

// Poll for timeline updates (since popup might close)
let pollInterval;
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    const result = await chrome.storage.local.get(['timeline', 'isRunning']);
    if (result.timeline) {
      updateTimeline(
        result.timeline.step,
        result.timeline.status,
        result.timeline.isActive,
        result.timeline.isCompleted
      );
    }
    if (result.isRunning) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      clearInterval(pollInterval);
    }
  }, 500);
}

startPolling();
