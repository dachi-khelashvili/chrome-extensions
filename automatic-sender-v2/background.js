// ============================================================================
// TIME CONFIGURATION - Adjust these values to change timing behavior
// ============================================================================
const TIME_AFTER_TAB_OPEN = 5000; // Wait time after opening URL tab (milliseconds)
const TIME_AFTER_CONTACT_BUTTON = 2000; // Wait time after clicking contact seller button (milliseconds)
const TIME_AFTER_HEY_BUTTON = 2000; // Wait time after clicking "👋 Hey" button (milliseconds)
const TIME_BEFORE_SEND_BUTTON = 1000; // Wait time before clicking send button (milliseconds)
const TIME_AFTER_SEND_BUTTON = 5000; // Wait time after clicking send button (milliseconds)
const TIME_BETWEEN_MESSAGES = 5 * 60 * 1000; // Wait time between messages (milliseconds)
const TIME_ERROR_RETRY = 5000; // Wait time before retrying after error (milliseconds)
const TIME_COUNTDOWN_UPDATE_INTERVAL = 1000; // Countdown update interval (milliseconds)

// ============================================================================
// BROWSER COMPATIBILITY LAYER
// ============================================================================
const browserAPI = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : 
                   (typeof browser !== 'undefined' && browser.runtime) ? browser : null;

if (!browserAPI) {
  console.error('Browser API not available');
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
let isRunning = false;
let currentTabId = null;
let activeIntervals = new Set(); // Use Set for O(1) operations
let redirectDetected = false;
let currentProcessingUrl = null;
let cachedSettings = null; // Cache settings to reduce storage calls

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeStorageGet(keys) {
  try {
    return await browserAPI.storage.local.get(keys);
  } catch (error) {
    console.error('Storage get error:', error);
    return {};
  }
}

async function safeStorageSet(data) {
  try {
    await browserAPI.storage.local.set(data);
  } catch (error) {
    console.error('Storage set error:', error);
  }
}

async function safeMessageSend(message) {
  try {
    await browserAPI.runtime.sendMessage(message);
  } catch (error) {
    // Ignore errors if popup is closed or extension context invalidated
  }
}

function updateStatus(status, running) {
  safeMessageSend({
    action: 'updateStatus',
    status: status,
    isRunning: running
  });
}

function updateDetails(detail, type = 'info') {
  safeMessageSend({
    action: 'updateDetails',
    detail: detail,
    type: type
  });
}

// Get UTC timestamp (we'll convert to Vladivostok timezone when displaying)
function getVladivostokTimestamp() {
  // Store UTC timestamp, convert to Vladivostok timezone when displaying
  return Date.now();
}

// Add history entry when URL is finished (success or failed)
async function addHistoryEntry({ href, status, reason }) {
  try {
    // Only add to history when finished (success or failed)
    if (status !== 'success' && status !== 'failed' && status !== 'stopped') {
      return;
    }
    
    const result = await safeStorageGet(['urlHistory']);
    const history = result.urlHistory || [];
    
    // Add new entry with completion timestamp
    history.unshift({
      url: href || '',
      status,
      reason: reason || '',
      timestamp: getVladivostokTimestamp() // Use completion time
    });
    
    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(1000);
    }
    await safeStorageSet({ urlHistory: history });
    safeMessageSend({ action: 'updateHistory', history });
  } catch (e) {
    console.error('Error updating history:', e);
  }
}

// Consolidated redirect check function
async function checkRedirect(tabId, url) {
  if (redirectDetected) return true;
  
  try {
    const tab = await browserAPI.tabs.get(tabId);
    if (tab && tab.url && tab.url.includes('pro.fiverr.com/inbox/')) {
      redirectDetected = true;
      return true;
    }
  } catch (e) {
    // Tab might be closed or inaccessible
  }
  return false;
}

async function handleRedirect(url) {
  updateDetails('Redirected to inbox page. Closing tab and marking as failed.', 'error');
  await addHistoryEntry({
    href: url,
    status: 'failed',
    reason: 'Redirected to inbox page'
  });
  await continueProcess();
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================
function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const checkTab = async () => {
      try {
        const tab = await browserAPI.tabs.get(tabId);
        if (tab.status === 'complete') {
          resolve();
          return;
        }
        
        // Set up one-time listener
        const listener = (updatedTabId, changeInfo) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            browserAPI.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        browserAPI.tabs.onUpdated.addListener(listener);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          browserAPI.tabs.onUpdated.removeListener(listener);
          resolve(); // Resolve anyway to continue
        }, 30000);
      } catch (error) {
        console.error('Error checking tab status:', error);
        resolve(); // Resolve to continue even if error
      }
    };
    checkTab();
  });
}

async function waitForHumanVerification(tabId) {
  return new Promise((resolve) => {
    let resolved = false;

    const intervalId = setInterval(async () => {
      if (!isRunning || resolved) {
        clearInterval(intervalId);
        activeIntervals.delete(intervalId);
        if (!resolved) resolve(false);
        return;
      }

      try {
        const tab = await browserAPI.tabs.get(tabId);
        const stillNeedsVerify = tab && tab.title && 
          (tab.title.includes('It needs a human touch') || tab.title.includes('It needs a human verify'));
        
        if (!stillNeedsVerify) {
          clearInterval(intervalId);
          activeIntervals.delete(intervalId);
          resolved = true;
          resolve(true);
          return;
        }
        // No time limit - wait indefinitely until verification is complete or process is stopped
      } catch (error) {
        console.error('Error checking tab title for human verification:', error);
        clearInterval(intervalId);
        activeIntervals.delete(intervalId);
        resolve(false);
      }
    }, 2000);

    activeIntervals.add(intervalId);
  });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && isRunning && changeInfo.url) {
    if (tab.url && tab.url.includes('pro.fiverr.com/inbox/')) {
      redirectDetected = true;
      if (currentProcessingUrl) {
        handleRedirect(currentProcessingUrl);
      }
    }
  }
});

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start') {
    startProcess();
  } else if (message.action === 'stop') {
    stopProcess();
  } else if (message.action === 'processComplete') {
    continueProcess();
  } else if (message.action === 'urlResult') {
    addHistoryEntry({
      href: message.href,
      status: message.status,
      reason: message.reason
    });
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});

// ============================================================================
// PROCESS CONTROL
// ============================================================================
async function startProcess() {
  const result = await safeStorageGet(['urls', 'messages', 'isRunning', 'minMinutes', 'maxMinutes', 'skipHeyButton']);
  
  if (!result.urls || result.urls.length === 0) {
    updateStatus('No URLs to process', false);
    return;
  }
  
  if (!result.messages || result.messages.length === 0) {
    updateStatus('No messages available', false);
    return;
  }

  // Cache settings
  cachedSettings = {
    minMinutes: result.minMinutes || 20,
    maxMinutes: result.maxMinutes || 30,
    skipHeyButton: result.skipHeyButton || false,
    messages: result.messages
  };

  isRunning = true;
  await safeStorageSet({ isRunning: true });
  updateStatus('Process started', true);
  updateDetails(`Process started - ${result.urls.length} URL(s) to process, ${result.messages.length} message(s) available`, 'info');
  
  processNextUrl();
}

async function stopProcess() {
  isRunning = false;
  await safeStorageSet({ isRunning: false });
  
  // Clear all active intervals
  activeIntervals.forEach(intervalId => clearInterval(intervalId));
  activeIntervals.clear();
  
  // Add current URL to history if processing
  if (currentProcessingUrl) {
    await addHistoryEntry({
      href: currentProcessingUrl,
      status: 'stopped',
      reason: 'Stopped by user'
    });
  }
  
  updateStatus('Process stopped', false);
  updateDetails('🛑 Automation stopped by user.', 'warning');
  
  if (currentTabId) {
    browserAPI.tabs.remove(currentTabId).catch(() => {});
    currentTabId = null;
  }
  
  currentProcessingUrl = null;
  cachedSettings = null;
}

async function processNextUrl() {
  if (!isRunning) return;

  const result = await safeStorageGet(['urls']);
  
  if (!result.urls || result.urls.length === 0) {
    updateStatus('All URLs processed', false);
    updateDetails('✓ All URLs have been processed successfully!', 'success');
    
    isRunning = false;
    await safeStorageSet({ isRunning: false });
    
    activeIntervals.forEach(intervalId => clearInterval(intervalId));
    activeIntervals.clear();
    
    safeMessageSend({ action: 'clearTimeline' });
    
    if (currentTabId) {
      try {
        await browserAPI.tabs.remove(currentTabId);
      } catch (error) {
        // Tab might already be closed
      }
      currentTabId = null;
    }
    
    cachedSettings = null;
    return;
  }

  // Get first URL and remove it
  const url = result.urls[0];
  const remainingUrls = result.urls.slice(1);
  await safeStorageSet({ urls: remainingUrls });
  
  // Reset redirect flag and track current URL
  redirectDetected = false;
  currentProcessingUrl = url;
  
  updateStatus(`Processing: ${url}`, true);
  updateDetails(`Starting to process URL: ${url}`, 'info');

  try {
    updateDetails('Opening URL in new tab (background)...', 'info');
    safeMessageSend({
      action: 'timeline',
      step: 'open',
      label: 'Opening URL'
    });
    
    const tab = await browserAPI.tabs.create({ url, active: false });
    currentTabId = tab.id;
    updateDetails(`Tab opened (ID: ${tab.id})`, 'success');

    // Wait for page to fully load
    updateDetails('Waiting for page to load...', 'info');
    await waitForTabComplete(tab.id);

    // Additional wait time after page is loaded, with countdown
    const waitSecondsTotal = TIME_AFTER_TAB_OPEN / 1000;
    let remaining = waitSecondsTotal;
    
    while (remaining > 0 && isRunning) {
      if (redirectDetected || await checkRedirect(tab.id, url)) {
        await handleRedirect(url);
        return;
      }
      
      updateDetails(`Waiting after page load... ${remaining}s left`, 'info');
      safeMessageSend({
        action: 'timeline',
        step: 'open',
        label: `Opening URL & waiting - ${remaining}s left`,
        remainingSeconds: remaining
      });
      await sleep(1000);
      remaining -= 1;
    }

    if (!isRunning) {
      updateDetails('Process stopped by user', 'warning');
      if (currentProcessingUrl) {
        await addHistoryEntry({
          href: currentProcessingUrl,
          status: 'stopped',
          reason: 'Stopped by user',
          updateExisting: true
        });
      }
      return;
    }

    // Final redirect check
    if (redirectDetected || await checkRedirect(tab.id, url)) {
      await handleRedirect(url);
      return;
    }
    
    // Check for human verification page
    try {
      const currentTab = await browserAPI.tabs.get(tab.id);
      const needsHumanVerify = currentTab && currentTab.title && 
        (currentTab.title.includes('It needs a human touch') || currentTab.title.includes('It needs a human verify'));
      
      if (needsHumanVerify) {
        updateDetails('Page requires human verification. Please complete the challenge in that tab.', 'warning');

        try {
          await browserAPI.tabs.update(tab.id, { active: true });
        } catch (e) {
          // Ignore if we can't activate the tab
        }

        const verificationResolved = await waitForHumanVerification(tab.id);

        if (!isRunning) {
          updateDetails('Process stopped by user during human verification.', 'warning');
          if (currentProcessingUrl) {
            await addHistoryEntry({
              href: currentProcessingUrl,
              status: 'stopped',
              reason: 'Stopped by user during human verification'
            });
          }
          return;
        }

        if (!verificationResolved) {
          updateDetails('Human verification not completed; skipping this URL and continuing to next.', 'warning');
          await addHistoryEntry({
            href: url,
            status: 'failed',
            reason: 'Human verification not completed'
          });
          await continueProcess();
          return;
        }

        // After verification is resolved, wait 15 seconds
        let hvRemain = 5;
        while (hvRemain > 0 && isRunning) {
          updateDetails(`Human verification resolved, waiting ${hvRemain}s before continuing...`, 'info');
          safeMessageSend({
            action: 'timeline',
            step: 'open',
            label: `After human verification - ${hvRemain}s left`,
            remainingSeconds: hvRemain
          });
          await sleep(1000);
          hvRemain -= 1;
        }
        
        if (!isRunning) {
          if (currentProcessingUrl) {
            await addHistoryEntry({
              href: currentProcessingUrl,
              status: 'stopped',
              reason: 'Stopped by user after human verification'
            });
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read tab title for human verification check:', e);
    }

    if (!isRunning) {
      updateDetails('Process stopped by user', 'warning');
      if (currentProcessingUrl) {
        await addHistoryEntry({
          href: currentProcessingUrl,
          status: 'stopped',
          reason: 'Stopped by user'
        });
      }
      return;
    }

    // Final redirect check before injection
    if (redirectDetected || await checkRedirect(tab.id, url)) {
      await handleRedirect(url);
        return;
    }

    updateDetails('Page loaded, starting automation...', 'info');
    safeMessageSend({
      action: 'timeline',
      step: 'prepare',
      label: 'Prepare contact'
    });
    
    // Inject content script to find and click buttons
    try {
      await browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        func: automatePage,
        args: [
          cachedSettings.messages,
          TIME_AFTER_CONTACT_BUTTON,
          TIME_AFTER_HEY_BUTTON,
          TIME_BEFORE_SEND_BUTTON,
          TIME_AFTER_SEND_BUTTON,
          cachedSettings.skipHeyButton,
          url
        ]
      });
    } catch (error) {
      console.error('Error executing automation:', error);
      updateDetails(`Error in automation: ${error.message}`, 'error');
      await addHistoryEntry({
        href: url,
        status: 'failed',
        reason: `Automation error: ${error.message}`
      });
      await continueProcess();
    }

  } catch (error) {
    console.error('Error processing URL:', error);
    updateDetails(`Error processing URL: ${error.message}`, 'error');
    updateStatus(`Error: ${error.message}`, true);
    await addHistoryEntry({
      href: url,
      status: 'failed',
      reason: `Processing error: ${error.message}`
    });
    setTimeout(() => processNextUrl(), TIME_ERROR_RETRY);
  }
}

async function continueProcess() {
  if (!isRunning) return;

  // Close current tab if exists
  if (currentTabId) {
    try {
      await browserAPI.tabs.remove(currentTabId);
    } catch (error) {
      // Tab might already be closed
    }
    currentTabId = null;
  }
  
  currentProcessingUrl = null;
  redirectDetected = false;

  updateDetails('Message sent successfully, closing tab...', 'success');
  
  // Use cached settings or get from storage
  let minMinutes, maxMinutes;
  if (cachedSettings) {
    minMinutes = cachedSettings.minMinutes;
    maxMinutes = cachedSettings.maxMinutes;
  } else {
    const settings = await safeStorageGet(['minMinutes', 'maxMinutes']);
    minMinutes = settings.minMinutes || 20;
    maxMinutes = settings.maxMinutes || 30;
  }
  
  // Calculate random wait time
  const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
  const waitTimeMs = randomMinutes * 60 * 1000;
  const startTime = Date.now();
  const endTime = startTime + waitTimeMs;
  
  updateDetails(`Waiting ${randomMinutes} minutes (random ${minMinutes}-${maxMinutes}) before next message...`, 'info');
  
  const countdownInterval = setInterval(async () => {
    if (!isRunning) {
      clearInterval(countdownInterval);
      activeIntervals.delete(countdownInterval);
      updateDetails('Process stopped during wait', 'warning');
      if (currentProcessingUrl) {
        await addHistoryEntry({
          href: currentProcessingUrl,
          status: 'stopped',
          reason: 'Stopped by user during wait'
        });
      }
      return;
    }
    
    const remaining = Math.max(0, endTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const totalSeconds = Math.floor(remaining / 1000);
    updateStatus(`Waiting before next message... ${minutes}m ${seconds}s left`, true);
    safeMessageSend({
      action: 'timeline',
      step: 'wait',
      label: `Waiting before next message - ${minutes}m ${seconds}s left`,
      remainingSeconds: totalSeconds
    });
    
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      activeIntervals.delete(countdownInterval);
      updateDetails('Wait completed, processing next URL...', 'info');
    }
  }, TIME_COUNTDOWN_UPDATE_INTERVAL);
  
  activeIntervals.add(countdownInterval);
  
  await sleep(waitTimeMs);
  
  clearInterval(countdownInterval);
  activeIntervals.delete(countdownInterval);
  
  if (isRunning) {
    processNextUrl();
  }
}

// ============================================================================
// PAGE AUTOMATION FUNCTION (injected into pages)
// ============================================================================
function automatePage(messages, timeAfterContact, timeAfterHey, timeBeforeSend, timeAfterSend, skipHeyButton = false, originalUrl = null) {
  return new Promise((resolve, reject) => {
    const urlForHistory = originalUrl || window.location.href;
    const browserAPI = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : 
                       (typeof browser !== 'undefined' && browser.runtime) ? browser : null;

    // Helper function to wait for element with retries
    function waitForElement(selector, retries = 10, delay = 500) {
      return new Promise((resolveElement, rejectElement) => {
        let attempts = 0;
        const checkElement = () => {
          const element = document.querySelector(selector);
          if (element) {
            resolveElement(element);
          } else if (attempts < retries) {
            attempts++;
            setTimeout(checkElement, delay);
          } else {
            rejectElement(new Error(`Element not found: ${selector}`));
          }
        };
        checkElement();
      });
    }

    // Optimized click function
    function triggerClick(element) {
      if (element.click) {
        element.click();
      } else {
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        element.dispatchEvent(event);
      }
    }

    // Consolidated redirect check
    function checkInboxRedirect() {
      try {
        const currentUrl = window.location.href || document.URL || '';
        if (currentUrl && currentUrl.includes('pro.fiverr.com/inbox/')) {
          if (browserAPI && browserAPI.runtime) {
            browserAPI.runtime.sendMessage({ 
            action: 'updateDetails',
            detail: '❌ Redirected to inbox page after clicking contact button',
            type: 'error'
            }).catch(() => {});
            
            browserAPI.runtime.sendMessage({
            action: 'urlResult',
            status: 'failed',
            reason: 'Redirected to inbox page after clicking contact button',
            href: urlForHistory
            }, () => {
            setTimeout(() => {
                browserAPI.runtime.sendMessage({ action: 'processComplete' }).catch(() => {});
              reject(new Error('Redirected to inbox page'));
            }, 200);
            }).catch(() => {
              reject(new Error('Redirected to inbox page'));
          });
          }
          return true;
        }
      } catch (e) {
        console.warn('Could not check for redirect:', e);
      }
      return false;
    }

    // Optimized button finder with caching
    function findButtonByText(text, attributes = ['title', 'textContent', 'aria-label']) {
      // Try specific selectors first
      for (const attr of attributes) {
        if (attr === 'textContent') {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const pTag = btn.querySelector('p');
            if (pTag && pTag.textContent && pTag.textContent.includes(text)) {
              return btn;
            }
            if (btn.textContent && btn.textContent.includes(text)) {
              return btn;
            }
          }
        } else {
          const selector = `button[${attr}]`;
          const buttons = document.querySelectorAll(selector);
          for (const btn of buttons) {
            const value = attr === 'title' ? btn.title : btn.getAttribute(attr);
            if (value && value.includes(text)) {
              return btn;
            }
          }
        }
      }
      return null;
    }

    // Message input handler - preserves all newlines exactly as entered
    function fillMessageBox(messageBox, message) {
      // Keep message exactly as entered, preserving all newlines (no trimming)
      const messageToAdd = message;

                messageBox.focus();
                
                const existingText = messageBox.value || '';
      messageBox.value = existingText + messageToAdd;
                
      // Trigger events for React/other frameworks
                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                messageBox.dispatchEvent(inputEvent);
                messageBox.dispatchEvent(changeEvent);
                
      // Try native setter for better compatibility
                try {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
                  nativeInputValueSetter.call(messageBox, messageBox.value);
                  const inputEvent2 = new Event('input', { bubbles: true });
                  messageBox.dispatchEvent(inputEvent2);
                } catch (e) {
        // Fallback already handled
      }
    }

    // Shared function for sending message
    function sendMessage() {
      waitForElement('textarea[data-testid="message-box"]', 15, 500)
        .then((messageBox) => {
          const randomMessage = messages[Math.floor(Math.random() * messages.length)];
          
          if (browserAPI && browserAPI.runtime) {
            browserAPI.runtime.sendMessage({
              action: 'timeline',
              step: 'send',
              label: 'Adding message'
            }).catch(() => {});
          }
          
          fillMessageBox(messageBox, randomMessage);
          
          if (browserAPI && browserAPI.runtime) {
            browserAPI.runtime.sendMessage({ 
                  action: 'updateDetails',
                  detail: `✓ Added message: "${randomMessage.substring(0, 50)}${randomMessage.length > 50 ? '...' : ''}"`,
                  type: 'success'
            }).catch(() => {});
          }
          
          setTimeout(() => {
                  let sendButton = null;
                  let sendAttempts = 0;
                  const maxSendAttempts = 10;
            
                  const findSendBtn = setInterval(() => {
              sendButton = findButtonByText('Send message', ['textContent']);
              
                    if (sendButton) {
                      clearInterval(findSendBtn);
                      triggerClick(sendButton);
                
                if (browserAPI && browserAPI.runtime) {
                  browserAPI.runtime.sendMessage({ 
                        action: 'updateDetails',
                        detail: `✓ Clicked Send message button, waiting ${timeAfterSend / 1000} seconds...`,
                        type: 'success'
                  }).catch(() => {});
                  
                  // Start countdown for waiting after send
                  const waitAfterSendSeconds = timeAfterSend / 1000;
                  let remainingAfterSend = waitAfterSendSeconds;
                  
                  const sendWaitInterval = setInterval(() => {
                    if (browserAPI && browserAPI.runtime) {
                      browserAPI.runtime.sendMessage({
                        action: 'timeline',
                        step: 'send',
                        label: `Waiting ${remainingAfterSend}s after sending`,
                        remainingSeconds: remainingAfterSend
                      }).catch(() => {});
                    }
                    
                    remainingAfterSend -= 1;
                    
                    if (remainingAfterSend < 0) {
                      clearInterval(sendWaitInterval);
                      if (browserAPI && browserAPI.runtime) {
                        browserAPI.runtime.sendMessage({ 
                          action: 'updateDetails',
                          detail: '✓ Message sending completed',
                          type: 'success'
                        }).catch(() => {});
                        
                        browserAPI.runtime.sendMessage({
                          action: 'urlResult',
                          status: 'success',
                          reason: 'Message sent successfully',
                          href: urlForHistory
                        }).catch(() => {});
                        
                        browserAPI.runtime.sendMessage({ action: 'processComplete' }).catch(() => {});
                      }
                      resolve();
                    }
                  }, 1000);
                }
                    } else if (sendAttempts >= maxSendAttempts) {
                      clearInterval(findSendBtn);
                
                if (browserAPI && browserAPI.runtime) {
                  browserAPI.runtime.sendMessage({ 
                        action: 'updateDetails',
                        detail: '❌ Send message button not found',
                        type: 'error'
                  }).catch(() => {});
                  
                  browserAPI.runtime.sendMessage({
                        action: 'urlResult',
                        status: 'failed',
                        reason: 'Send message button not found',
                        href: urlForHistory
                  }).catch(() => {});
                  
                  browserAPI.runtime.sendMessage({ action: 'processComplete' }).catch(() => {});
                }
                      reject(new Error('Send message button not found'));
                    }
                    sendAttempts++;
                  }, 500);
                }, timeBeforeSend);
              })
              .catch((error) => {
          if (browserAPI && browserAPI.runtime) {
            browserAPI.runtime.sendMessage({ 
                  action: 'updateDetails',
                  detail: '❌ Message textarea not found',
                  type: 'error'
            }).catch(() => {});
            
            browserAPI.runtime.sendMessage({
                  action: 'urlResult',
                  status: 'failed',
                  reason: 'Message textarea not found',
                  href: urlForHistory
            }).catch(() => {});
            
            browserAPI.runtime.sendMessage({ action: 'processComplete' }).catch(() => {});
          }
                reject(error);
              });
    }

    // Step 1: Find and click contact seller button
    waitForElement('div[data-testid="contact-seller-button"]', 15, 500)
      .then((contactButton) => {
        triggerClick(contactButton);
        
        if (browserAPI && browserAPI.runtime) {
          browserAPI.runtime.sendMessage({ 
            action: 'updateDetails',
            detail: '✓ Clicked contact seller button',
            type: 'success'
          }).catch(() => {});
        }
        
        // Check for redirect after clicking
        setTimeout(() => {
          if (checkInboxRedirect()) return;
        }, 500);
        
        // Set up redirect monitoring and countdown during wait
        let redirectCheckCount = 0;
        const maxRedirectChecks = Math.ceil(timeAfterContact / 1000);
        const waitBeforeContactSeconds = timeAfterContact / 1000;
        let remainingBeforeContact = waitBeforeContactSeconds;
        
        const redirectCheckInterval = setInterval(() => {
          redirectCheckCount++;
          
          // Update timeline countdown
          if (browserAPI && browserAPI.runtime && !skipHeyButton) {
            browserAPI.runtime.sendMessage({
              action: 'timeline',
              step: 'prepare',
              label: `Waiting ${remainingBeforeContact}s before clicking "👋 Hey"`,
              remainingSeconds: remainingBeforeContact
            }).catch(() => {});
          }
          
          remainingBeforeContact -= 1;
          
          if (checkInboxRedirect()) {
            clearInterval(redirectCheckInterval);
            return;
          }
          if (redirectCheckCount >= maxRedirectChecks) {
            clearInterval(redirectCheckInterval);
          }
        }, 1000);
        
        setTimeout(() => {
          clearInterval(redirectCheckInterval);
          
          if (checkInboxRedirect()) return;
          
          // If skipHeyButton is enabled, go directly to message box
          if (skipHeyButton) {
            if (browserAPI && browserAPI.runtime) {
              browserAPI.runtime.sendMessage({ 
                action: 'updateDetails',
                detail: '⏭️ Skipping "👋 Hey" button (option enabled)',
                type: 'info'
              }).catch(() => {});
            }
            sendMessage();
            return;
          }
          
          // Step 2: Find and click "👋 Hey" button
          let heyButton = null;
          let attempts = 0;
          const maxAttempts = 10;
          
          const findButton = setInterval(() => {
            heyButton = findButtonByText('👋 Hey', ['title', 'textContent', 'aria-label']);
            
            if (heyButton) {
              clearInterval(findButton);
              triggerClick(heyButton);
              
              if (browserAPI && browserAPI.runtime) {
                browserAPI.runtime.sendMessage({ 
                action: 'updateDetails',
                detail: '✓ Clicked "👋 Hey" button',
                type: 'success'
                    }).catch(() => {});
              }
                    
                    setTimeout(() => {
                sendMessage();
              }, timeAfterHey);
            } else if (attempts >= maxAttempts) {
              clearInterval(findButton);
              
              if (browserAPI && browserAPI.runtime) {
                browserAPI.runtime.sendMessage({ 
                action: 'updateDetails',
                detail: '❌ Button starting with "👋 Hey" not found',
                type: 'error'
                }).catch(() => {});
                
                browserAPI.runtime.sendMessage({
                action: 'urlResult',
                status: 'failed',
                reason: 'Hey button not found',
                href: urlForHistory
                }).catch(() => {});
                
                browserAPI.runtime.sendMessage({ action: 'processComplete' }).catch(() => {});
              }
              reject(new Error('Hey button not found'));
            }
            attempts++;
          }, 500);
        }, timeAfterContact);
      })
      .catch((error) => {
        if (browserAPI && browserAPI.runtime) {
          browserAPI.runtime.sendMessage({ 
          action: 'updateDetails',
          detail: '❌ Contact seller button not found',
          type: 'error'
          }).catch(() => {});
          
          browserAPI.runtime.sendMessage({
          action: 'urlResult',
          status: 'failed',
          reason: 'Contact seller button not found',
          href: urlForHistory
          }).catch(() => {});
          
          browserAPI.runtime.sendMessage({ action: 'processComplete' }).catch(() => {});
        }
        reject(error);
      });
  });
}
