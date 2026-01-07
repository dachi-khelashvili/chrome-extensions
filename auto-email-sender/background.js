let isAutomationRunning = false;
let automationInterval = null;

// Get Vladivostok timezone datetime
function getVladivostokDateTime() {
  const now = new Date();
  return now.toLocaleString("en-US", {
    timeZone: 'Asia/Vladivostok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Random number between min and max
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Update timeline in storage
async function updateTimeline(step, status, isActive = false, isCompleted = false) {
  await chrome.storage.local.set({
    timeline: { step, status, isActive, isCompleted }
  });
  
  // Try to send message to popup if open
  try {
    chrome.runtime.sendMessage({
      action: 'updateTimeline',
      step,
      status,
      isActive,
      isCompleted
    });
  } catch (e) {
    // Popup might be closed, that's okay
  }
}

// Update history
async function addToHistory(email, subject) {
  const result = await chrome.storage.local.get(['history']);
  const history = result.history || [];
  
  history.unshift({
    email,
    subject,
    datetime: getVladivostokDateTime()
  });

  // Keep only last 50 entries
  if (history.length > 50) {
    history.pop();
  }

  await chrome.storage.local.set({ history });

  // Try to send message to popup if open
  try {
    chrome.runtime.sendMessage({
      action: 'updateHistory',
      history
    });
  } catch (e) {
    // Popup might be closed, that's okay
  }
}

// Wait for specified seconds with countdown
async function waitWithCountdown(seconds, stepNumber, stepName) {
  for (let i = seconds; i > 0 && isAutomationRunning; i--) {
    await updateTimeline(stepNumber, `${stepName}... ${i} seconds left`, true, false);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (isAutomationRunning) {
    await updateTimeline(stepNumber, `${stepName}... Complete`, false, true);
  }
}

// Process email automation
async function processEmail(email, subjects, messages, settings) {
  if (!isAutomationRunning) return;

  // Select random subject and message
  const subject = subjects.length > 0 ? subjects[Math.floor(Math.random() * subjects.length)] : '';
  const message = messages.length > 0 ? messages[Math.floor(Math.random() * messages.length)] : '';

  // Step 1: Open tab
  await updateTimeline(1, 'Opening tab...', true, false);
  
  const url = `https://mail.google.com/mail/u/0/?fs=1&tf=cm&source=mailto&to=${encodeURIComponent(email)}`;
  const tab = await chrome.tabs.create({ url, active: true });

  // Wait for tab to load
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Wait after open tab
  await waitWithCountdown(settings.waitAfterOpen, 1, 'Waiting after opening tab');

  if (!isAutomationRunning) {
    await chrome.tabs.remove(tab.id);
    return;
  }

  // Wait for form to be ready
  let retries = 10;
  let formReady = false;
  
  while (retries > 0 && !formReady && isAutomationRunning) {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: checkFormReady
      });
      
      if (result[0]?.result) {
        formReady = true;
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
      }
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 500));
      retries--;
    }
  }

  // Step 2: Fill form and send email
  await updateTimeline(2, 'Filling form and sending email...', true, false);

  // Fill email form
  if (formReady && isAutomationRunning) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillEmailForm,
        args: [subject, message]
      });
    } catch (error) {
      console.error('Error filling form:', error);
    }
  }

  // Wait a bit for form to be fully ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Click send button
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: clickSendButton
    });
    
    if (!result[0]?.result) {
      // Retry after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: clickSendButton
      });
    }
  } catch (error) {
    console.error('Error clicking send:', error);
  }

  // Wait after send
  await waitWithCountdown(settings.waitAfterSend, 2, 'Waiting after send');

  if (!isAutomationRunning) {
    await chrome.tabs.remove(tab.id);
    return;
  }

  // Close tab
  await chrome.tabs.remove(tab.id);

  // Update timeline
  await updateTimeline(2, 'Email sent', false, true);

  // Add to history
  await addToHistory(email, subject);

  // Remove email from list
  const result = await chrome.storage.local.get(['emails']);
  const emails = result.emails || [];
  const updatedEmails = emails.filter(e => e !== email);
  await chrome.storage.local.set({ emails: updatedEmails });

  // Step 3: Wait for next email
  if (updatedEmails.length > 0 && isAutomationRunning) {
    const waitTime = randomBetween(settings.minWaitTime*60, settings.maxWaitTime*60);
    await waitWithCountdown(waitTime, 3, 'Waiting for next email');
  }

  // Reset timeline
  if (!isAutomationRunning || updatedEmails.length === 0) {
    await updateTimeline(1, 'Waiting...', false, false);
    await updateTimeline(2, 'Waiting...', false, false);
    await updateTimeline(3, 'Waiting...', false, false);
  }
}

// Functions to inject into Gmail page
function checkFormReady() {
  const subjectInput = document.querySelector('input[name="subjectbox"]') ||
                       document.querySelector('input[aria-label="Subject"]');
  const messageBody = document.querySelector('div[role="textbox"][aria-label="Message Body"]') ||
                      document.querySelector('div[contenteditable="true"][role="textbox"]');
  return !!(subjectInput && messageBody && subjectInput.offsetParent !== null);
}

function fillEmailForm(subject, message) {
  // Fill subject - try multiple selectors
  const subjectSelectors = [
    'input[name="subjectbox"]',
    'input[aria-label="Subject"]',
    'input[placeholder="Subject"]'
  ];
  
  let subjectInput = null;
  for (const selector of subjectSelectors) {
    subjectInput = document.querySelector(selector);
    if (subjectInput && subjectInput.offsetParent !== null) break;
  }
  
  if (subjectInput) {
    subjectInput.focus();
    subjectInput.value = subject;
    subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
    subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
    subjectInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    subjectInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  // Fill message body - try multiple selectors
  const messageSelectors = [
    'div[role="textbox"][aria-label="Message Body"]',
    'div[contenteditable="true"][aria-label*="Message"]',
    'div[contenteditable="true"][role="textbox"]'
  ];
  
  let messageDiv = null;
  for (const selector of messageSelectors) {
    messageDiv = document.querySelector(selector);
    if (messageDiv && messageDiv.offsetParent !== null) break;
  }
  
  if (messageDiv) {
    messageDiv.focus();
    // Message already contains actual newlines
    messageDiv.textContent = message;
    messageDiv.innerHTML = message.replace(/\n/g, '<br>');
    messageDiv.dispatchEvent(new Event('input', { bubbles: true }));
    messageDiv.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function clickSendButton() {
  // Try multiple selectors for send button
  const sendSelectors = [
    'div[role="button"][data-tooltip*="Send"]',
    'div[role="button"][aria-label*="Send"]',
    'div[aria-label*="Send"][role="button"]'
  ];
  
  for (const selector of sendSelectors) {
    const sendButton = document.querySelector(selector);
    if (sendButton && sendButton.offsetParent !== null && !sendButton.disabled) {
      sendButton.click();
      return true;
    }
  }
  
  return false;
}

// Main automation loop
async function startAutomationLoop() {
  while (isAutomationRunning) {
    const result = await chrome.storage.local.get([
      'emails', 'subjects', 'messages', 'minWaitTime', 'maxWaitTime',
      'waitAfterOpen', 'waitAfterSend'
    ]);

    const emails = result.emails || [];
    const subjects = (result.subjects || []).map(s => s.trim()).filter(s => s);
    const messages = (result.messages || []).map(m => m.trim()).filter(m => m);

    if (emails.length === 0) {
      // No more emails, stop automation
      await stopAutomation();
      break;
    }

    const email = emails[0];
    const settings = {
      minWaitTime: result.minWaitTime || 5,
      maxWaitTime: result.maxWaitTime || 10,
      waitAfterOpen: result.waitAfterOpen || 3,
      waitAfterSend: result.waitAfterSend || 2
    };

    await processEmail(email, subjects, messages, settings);

    // Small delay before next iteration
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Start automation
async function startAutomation() {
  if (isAutomationRunning) return;

  isAutomationRunning = true;
  await chrome.storage.local.set({ isRunning: true });

  // Clear timeline
  await updateTimeline(1, 'Waiting...', false, false);
  await updateTimeline(2, 'Waiting...', false, false);
  await updateTimeline(3, 'Waiting...', false, false);

  // Start loop
  startAutomationLoop();
}

// Stop automation
async function stopAutomation() {
  isAutomationRunning = false;
  await chrome.storage.local.set({ isRunning: false });

  // Clear timeline
  await updateTimeline(1, 'Waiting...', false, false);
  await updateTimeline(2, 'Waiting...', false, false);
  await updateTimeline(3, 'Waiting...', false, false);

  // Notify popup
  try {
    chrome.runtime.sendMessage({ action: 'automationStopped' });
  } catch (e) {
    // Popup might be closed
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startAutomation') {
    startAutomation();
    sendResponse({ success: true });
  } else if (message.action === 'stopAutomation') {
    stopAutomation();
    sendResponse({ success: true });
  }
  return true;
});

// Restore state on service worker restart
chrome.storage.local.get(['isRunning']).then(result => {
  if (result.isRunning) {
    startAutomation();
  }
});