// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
let automationRunning = false;
let emailList = [];
let subjectList = [];
let messageList = [];
let settings = {};
let processedCount = 0;
let currentTabId = null;

// ============================================================================
// MESSAGE LISTENER
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startAutomation') {
    startAutomation();
  } else if (message.action === 'stopAutomation') {
    stopAutomation();
  } else if (message.action === 'emailSent') {
    handleEmailSent(message.tabId, message.email, message.subject);
  } else if (message.action === 'updateTimeline') {
    updateTimeline(message.step, message.status, message.countdown);
  }
  return true;
});

// ============================================================================
// AUTOMATION CONTROL
// ============================================================================
async function startAutomation() {
  automationRunning = true;
  processedCount = 0;

  // Load settings
  const result = await chrome.storage.local.get([
    'minWait', 'maxWait', 'waitAfterOpen', 'waitAfterSend',
    'emails', 'subjects', 'messages'
  ]);

  settings = {
    minWait: parseInt(result.minWait) || 5,
    maxWait: parseInt(result.maxWait) || 10,
    waitAfterOpen: parseInt(result.waitAfterOpen) || 3,
    waitAfterSend: parseInt(result.waitAfterSend) || 2
  };

  // Parse emails, subjects, and messages
  if (!result.emails || !result.subjects || !result.messages) {
    updateStatus('Error: Missing email, subject, or message data', 'error');
    stopAutomation();
    return;
  }

  emailList = result.emails.split('\n').map(e => e.trim()).filter(e => e);
  subjectList = result.subjects.split('|').map(s => s.trim()).filter(s => s);
  messageList = result.messages.split('|').map(m => m.trim()).filter(m => m);

  if (emailList.length === 0 || subjectList.length === 0 || messageList.length === 0) {
    updateStatus('Error: Invalid input data', 'error');
    stopAutomation();
    return;
  }

  updateStatus(`Starting automation with ${emailList.length} emails...`, 'info');
  processNextEmail();
}

function stopAutomation() {
  automationRunning = false;
  updateStatus('Automation stopped', 'info');
  chrome.runtime.sendMessage({ action: 'automationComplete' });
  updateTimeline('waiting', 'Stopped', null);
}

// ============================================================================
// MAIN AUTOMATION FLOW
// ============================================================================
async function processNextEmail() {
  if (!automationRunning) return;
  if (emailList.length === 0) {
    updateStatus(`All emails sent! Processed ${processedCount} email(s).`, 'success');
    stopAutomation();
    return;
  }

  // Get email data
  const email = emailList[0];
  const subjectIndex = processedCount % subjectList.length;
  const messageIndex = processedCount % messageList.length;
  const subject = subjectList[subjectIndex];
  const message = messageList[messageIndex];

  updateStatus(`Processing email ${processedCount + 1} (${emailList.length} remaining): ${email}`, 'info');

  // Step 1: Open tab
  const tab = await openTabForEmail(email);
  if (!tab) return;

  // Step 2: Wait after tab open
  await waitAfterTabOpen(tab.id);

  // Step 3: Fill form and send email
  await fillAndSendEmailToTab(tab.id, email, subject, message);
}

// ============================================================================
// AUTOMATION STEP FUNCTIONS
// ============================================================================
async function openTabForEmail(email) {
  updateTimeline('open-tab', 'Opening tab...', null);
  
  const url = `https://mail.google.com/mail/u/0/?fs=1&tf=cm&source=mailto&to=${encodeURIComponent(email)}`;
  
  try {
    const tab = await chrome.tabs.create({ url, active: true });
    currentTabId = tab.id;
    updateTimeline('open-tab', 'Tab opened', null);
    return tab;
  } catch (error) {
    updateStatus(`Error opening tab: ${error.message}`, 'error');
    stopAutomation();
    return null;
  }
}

async function waitAfterTabOpen(tabId) {
  return new Promise((resolve) => {
    const listener = (tabIdParam, changeInfo) => {
      if (tabIdParam === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        
        let countdown = settings.waitAfterOpen;
        updateTimeline('open-tab', 'Waiting after tab open', countdown);
        
        const countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            updateTimeline('open-tab', 'Waiting after tab open', countdown);
          } else {
            clearInterval(countdownInterval);
            updateTimeline('open-tab', 'Tab ready', null);
          }
        }, 1000);
        
        setTimeout(() => {
          resolve();
        }, settings.waitAfterOpen * 1000);
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function fillAndSendEmailToTab(tabId, email, subject, message) {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  let success = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'fillAndSend',
        subject: subject,
        message: message,
        tabId: tabId,
        email: email
      });
      success = true;
      break;
    } catch (err) {
      console.log(`Attempt ${attempt + 1} failed:`, err.message);
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  if (!success) {
    updateStatus(`Error: Could not interact with Gmail page`, 'error');
    if (emailList.length > 0 && emailList[0] === email) {
      emailList.shift();
      await chrome.storage.local.set({ emails: emailList.join('\n') });
    }
    await closeTab(tabId);
    if (emailList.length > 0 && automationRunning) {
      setTimeout(() => processNextEmail(), 2000);
    } else {
      stopAutomation();
    }
  }
}

async function handleEmailSent(tabId, sentEmail, sentSubject) {
  if (!automationRunning) return;

  try {
    await reloadSettings();

    // Step 1: Remove email from list
    const shouldStop = await removeEmailFromList(sentEmail, sentSubject);
    if (shouldStop) {
      await waitAfterSend();
      await closeTab(tabId);
      stopAutomation();
      return;
    }

    // Step 2: Wait after send
    await waitAfterSend();

    // Step 3: Close tab (handle errors gracefully)
    await closeTab(tabId);

    // Step 4: Wait random time before next email (THIS MUST HAPPEN)
    await waitRandomTimeBeforeNextEmail();

    // Step 5: Process next email
    if (automationRunning && emailList.length > 0) {
      resetTimelineForNewEmail();
      await new Promise(resolve => setTimeout(resolve, 100));
      processNextEmail();
    }
  } catch (error) {
    console.error('Error in handleEmailSent:', error);
    // Even if there's an error, try to continue with next email
    if (automationRunning && emailList.length > 0) {
      await waitRandomTimeBeforeNextEmail();
      if (automationRunning && emailList.length > 0) {
        processNextEmail();
      }
    } else {
      stopAutomation();
    }
  }
}

async function removeEmailFromList(email, subject) {
  if (emailList.length === 0) return true;

  const processedEmail = emailList.shift();
  processedCount++;
  
  const vladivostokTime = getVladivostokTime();
  await addToHistory(processedEmail, subject || 'N/A', vladivostokTime);
  
  const updatedEmailList = emailList.join('\n');
  await chrome.storage.local.set({ emails: updatedEmailList });
  
  try {
    chrome.runtime.sendMessage({ 
      action: 'updateEmailList', 
      remainingEmails: updatedEmailList,
      remaining: emailList.length,
      total: processedCount
    }).catch(() => {});
    
    chrome.runtime.sendMessage({ 
      action: 'addHistoryItem', 
      email: processedEmail,
      subject: subject || 'N/A',
      time: vladivostokTime
    }).catch(() => {});
  } catch (e) {}

  updateStatus(`Email sent to ${processedEmail}. ${emailList.length} remaining, ${processedCount} processed.`, 'info');
  
  return emailList.length === 0;
}

async function waitAfterSend() {
  let countdown = settings.waitAfterSend;
  updateTimeline('add-description', 'Waiting after send', countdown);
  updateStatus(`Waiting ${countdown} seconds after sending...`, 'info');
  
  const interval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      updateTimeline('add-description', 'Waiting after send', countdown);
    } else {
      clearInterval(interval);
    }
  }, 1000);
  
  await new Promise(resolve => setTimeout(resolve, settings.waitAfterSend * 1000));
}

async function closeTab(tabId) {
  updateStatus('Closing tab...', 'info');
  updateTimeline('add-description', 'Closing tab...', null);
  
  try {
    // Check if tab exists before trying to close it
    const tab = await chrome.tabs.get(tabId);
    if (tab) {
      await chrome.tabs.remove(tabId);
      updateTimeline('add-description', 'Tab closed', null);
    }
  } catch (error) {
    // Tab might already be closed or doesn't exist - that's okay, continue
    console.log('Tab may already be closed:', error.message);
    updateTimeline('add-description', 'Tab closed', null);
  }
}

async function waitRandomTimeBeforeNextEmail() {
  const waitTime = getRandomWaitTime();
  console.log(`Random wait: ${waitTime}s (min: ${settings.minWait}, max: ${settings.maxWait})`);
  updateStatus(`Tab closed. Waiting ${waitTime} seconds (random ${settings.minWait}-${settings.maxWait}s) before opening next tab... (${emailList.length} remaining)`, 'info');
  
  updateTimeline('waiting', 'Waiting for next email', waitTime);
  
  let waitCountdown = waitTime;
  const interval = setInterval(() => {
    waitCountdown--;
    if (waitCountdown > 0) {
      updateTimeline('waiting', 'Waiting for next email', waitCountdown);
    } else {
      clearInterval(interval);
      updateTimeline('waiting', 'Wait complete', null);
    }
  }, 1000);
  
  // Wait the full random time
  await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  
  // Clear interval in case it's still running
  clearInterval(interval);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
async function reloadSettings() {
  const result = await chrome.storage.local.get(['minWait', 'maxWait', 'waitAfterOpen', 'waitAfterSend']);
  settings.minWait = parseInt(result.minWait) || 5;
  settings.maxWait = parseInt(result.maxWait) || 10;
  settings.waitAfterOpen = parseInt(result.waitAfterOpen) || 3;
  settings.waitAfterSend = parseInt(result.waitAfterSend) || 2;
}

function getRandomWaitTime() {
  if (!settings || !settings.minWait || !settings.maxWait) {
    return 5;
  }
  const min = parseInt(settings.minWait);
  const max = parseInt(settings.maxWait);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateStatus(text, type = 'info') {
  chrome.runtime.sendMessage({ action: 'updateStatus', text, type });
}

function updateTimeline(step, status, countdown = null) {
  chrome.runtime.sendMessage({ 
    action: 'updateTimeline', 
    step: step, 
    status: status, 
    countdown: countdown 
  });
}

function resetTimelineForNewEmail() {
  try {
    chrome.runtime.sendMessage({ action: 'resetTimeline' }).catch(() => {});
  } catch (err) {}
}

function getVladivostokTime() {
  const now = new Date();
  const vladivostokTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Vladivostok"}));
  return vladivostokTime.toLocaleString("en-US", {
    timeZone: "Asia/Vladivostok",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

async function addToHistory(email, subject, time) {
  const result = await chrome.storage.local.get(['emailHistory']);
  const history = result.emailHistory || [];
  
  history.unshift({ email, subject, time });
  
  if (history.length > 100) {
    history.pop();
  }
  
  await chrome.storage.local.set({ emailHistory: history });
}
