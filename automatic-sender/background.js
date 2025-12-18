// ============================================================================
// TIME CONFIGURATION - Adjust these values to change timing behavior
// ============================================================================
const TIME_AFTER_TAB_OPEN = 5000; // Wait time after opening URL tab (milliseconds) - Default: 30 seconds
const TIME_AFTER_CONTACT_BUTTON = 2000; // Wait time after clicking contact seller button (milliseconds) - Default: 5 seconds
const TIME_AFTER_HEY_BUTTON = 2000; // Wait time after clicking "👋 Hey" button (milliseconds) - Default: 5 seconds
const TIME_BEFORE_SEND_BUTTON = 1000; // Wait time before clicking send button (milliseconds) - Default: 1 second
const TIME_AFTER_SEND_BUTTON = 5000; // Wait time after clicking send button (milliseconds) - Default: 20 seconds
const TIME_BETWEEN_MESSAGES = 5 * 60 * 1000; // Wait time between messages (milliseconds) - Default: 30 minutes
const TIME_ERROR_RETRY = 5000; // Wait time before retrying after error (milliseconds) - Default: 5 seconds
const TIME_PROGRESS_UPDATE_INTERVAL = 2; // Progress update interval (seconds) - Default: 5 seconds
const TIME_COUNTDOWN_UPDATE_INTERVAL = 1000; // Countdown update interval (milliseconds) - Default: 1 second

// ============================================================================

let isRunning = false;
let currentTabId = null;
let activeIntervals = []; // Track active intervals to clear on stop
let redirectDetected = false; // Track if redirect was detected
let currentProcessingUrl = null; // Track the URL currently being processed

// Listen for tab updates to catch redirects in real-time
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only check if this is the current tab being processed
  if (tabId === currentTabId && isRunning && changeInfo.url) {
    // Check if redirected to inbox
    if (tab.url && tab.url.includes('pro.fiverr.com/inbox/')) {
      redirectDetected = true;
      // Immediately handle the redirect
      if (currentProcessingUrl) {
        updateDetails('Redirect to inbox detected via tab update. Closing tab and marking as failed.', 'error');
        // Add to history directly
        addHistoryEntry({
          href: currentProcessingUrl,
          status: 'failed',
          reason: 'Redirected to inbox page'
        });
        continueProcess();
      }
    }
  }
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start') {
    startProcess();
  } else if (message.action === 'stop') {
    stopProcess();
  } else if (message.action === 'processComplete') {
    // Continue with next URL
    continueProcess();
  } else if (message.action === 'urlResult') {
    // Record URL-level success/failure history
    addHistoryEntry({
      href: message.href,
      status: message.status,
      reason: message.reason
    });
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});

async function startProcess() {
  const result = await chrome.storage.local.get(['urls', 'messages', 'isRunning', 'minMinutes', 'maxMinutes', 'skipHeyButton']);
  
  if (!result.urls || result.urls.length === 0) {
    updateStatus('No URLs to process', false);
    return;
  }
  
  if (!result.messages || result.messages.length === 0) {
    updateStatus('No messages available', false);
    return;
  }

  isRunning = true;
  await chrome.storage.local.set({ isRunning: true });
  updateStatus('Process started', true);
  updateDetails(`Process started - ${result.urls.length} URL(s) to process, ${result.messages.length} message(s) available`, 'info');
  
  // Start processing
  processNextUrl();
}

function stopProcess() {
  isRunning = false;
  chrome.storage.local.set({ isRunning: false });
  
  // Clear all active intervals
  activeIntervals.forEach(intervalId => clearInterval(intervalId));
  activeIntervals = [];
  
  // Clear process logs/history
  chrome.storage.local.set({ processLogs: [] });
  
  updateStatus('Process stopped', false);
  updateDetails('🛑 Automation stopped by user. History cleared.', 'warning');
  
  if (currentTabId) {
    chrome.tabs.remove(currentTabId).catch(() => {});
    currentTabId = null;
  }
}

async function processNextUrl() {
  if (!isRunning) {
    return;
  }

  const result = await chrome.storage.local.get(['urls', 'messages']);
  
  if (!result.urls || result.urls.length === 0) {
    updateStatus('All URLs processed', false);
    updateDetails('✓ All URLs have been processed successfully!', 'success');
    
    // Stop automation
    isRunning = false;
    await chrome.storage.local.set({ isRunning: false });
    
    // Clear all active intervals
    activeIntervals.forEach(intervalId => clearInterval(intervalId));
    activeIntervals = [];
    
    // Note: we keep URL history (success/failed) in urlHistory; do not clear it here.
    
    // Send message to popup to clear timeline display
    chrome.runtime.sendMessage({ action: 'clearTimeline' }).catch(() => {
      // Ignore errors if popup is closed
    });
    
    // Close current tab if exists
    if (currentTabId) {
      try {
        await chrome.tabs.remove(currentTabId);
      } catch (error) {
        // Tab might already be closed
      }
      currentTabId = null;
    }
    
    return;
  }

  // Get first URL and remove it
  const url = result.urls[0];
  const remainingUrls = result.urls.slice(1);
  await chrome.storage.local.set({ urls: remainingUrls });
  
  // Reset redirect flag and track current URL
  redirectDetected = false;
  currentProcessingUrl = url;
  
  updateStatus(`Processing: ${url}`, true);
  updateDetails(`Starting to process URL: ${url}`, 'info');

  // Open URL in new tab (background tab, not focused)
  try {
    updateDetails('Opening URL in new tab (background)...', 'info');
    chrome.runtime.sendMessage({
      action: 'timeline',
      step: 'open',
      label: 'Opening URL'
    }).catch(() => {});
    const tab = await chrome.tabs.create({ url, active: false });
    currentTabId = tab.id;
    updateDetails(`Tab opened (ID: ${tab.id})`, 'success');

    // Wait for page to fully load
    updateDetails('Waiting for page to load...', 'info');
    await waitForTabComplete(tab.id);

    // Additional wait time after page is loaded, with 1s countdown
    const waitSecondsTotal = TIME_AFTER_TAB_OPEN / 1000;
    let remaining = waitSecondsTotal;
    while (remaining > 0 && isRunning) {
      // Check if redirect was detected
      if (redirectDetected) {
        updateDetails('Redirect to inbox detected during wait. Closing tab and marking as failed.', 'error');
        // Add directly to history
        addHistoryEntry({
          href: url,
          status: 'failed',
          reason: 'Redirected to inbox page'
        });
        continueProcess();
        return;
      }
      
      // Check if redirected to inbox during wait
      try {
        const checkTab = await chrome.tabs.get(tab.id);
        if (checkTab && checkTab.url && checkTab.url.includes('pro.fiverr.com/inbox/')) {
          redirectDetected = true;
          updateDetails('Page was redirected to inbox during wait. Closing tab and marking as failed.', 'error');
          // Mark as failed with original URL - add directly to history
          addHistoryEntry({
            href: url,
            status: 'failed',
            reason: 'Redirected to inbox page'
          });
          // Close tab and continue to next URL
          continueProcess();
          return;
        }
      } catch (e) {
        // Ignore errors checking tab URL
      }
      
      updateDetails(`Waiting after page load... ${remaining}s left`, 'info');
      chrome.runtime.sendMessage({
        action: 'timeline',
        step: 'open', // keep timeline on Open URL while we finish loading
        label: 'Opening URL & waiting',
        remainingSeconds: remaining
      }).catch(() => {});
      await sleep(1000);
      remaining -= 1;
    }

    if (!isRunning) {
      updateDetails('Process stopped by user', 'warning');
      return;
    }

    // Check if redirect was detected or if page was redirected to inbox
    if (redirectDetected) {
      updateDetails('Redirect to inbox detected. Closing tab and marking as failed.', 'error');
      // Add directly to history
      addHistoryEntry({
        href: url,
        status: 'failed',
        reason: 'Redirected to inbox page'
      });
      continueProcess();
      return;
    }
    
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      if (currentTab && currentTab.url && currentTab.url.includes('pro.fiverr.com/inbox/')) {
        updateDetails('Page was redirected to inbox. Closing tab and marking as failed.', 'error');
        // Add directly to history
        addHistoryEntry({
          href: url,
          status: 'failed',
          reason: 'Redirected to inbox page'
        });
        // Close tab and continue to next URL
        continueProcess();
        return;
      }
    } catch (e) {
      // If we can't read the tab URL, just continue
      console.warn('Could not read tab URL for redirect check:', e);
    }

    // Check for human verification page: title "It needs a human touch" or "It needs a human verify"
    try {
      const currentTab = await chrome.tabs.get(tab.id);
      const needsHumanVerify = currentTab && currentTab.title && 
        (currentTab.title.includes('It needs a human touch') || currentTab.title.includes('It needs a human verify'));
      
      if (needsHumanVerify) {
        updateDetails('Page requires human verification. Please complete the challenge in that tab.', 'warning');

        // Bring the tab to the foreground so the user can solve the challenge
        try {
          await chrome.tabs.update(tab.id, { active: true });
        } catch (e) {
          // Ignore if we can't activate the tab
        }

        // Wait until the human verification is resolved (title changes)
        const verificationResolved = await waitForHumanVerification(tab.id);

        if (!isRunning) {
          updateDetails('Process stopped by user during human verification.', 'warning');
          return;
        }

        // If verification was not resolved (timeout), skip this URL and continue to next
        if (!verificationResolved) {
          updateDetails('Human verification not completed in time; skipping this URL and continuing to next.', 'warning');
          // Mark as failed but continue to next URL
          chrome.runtime.sendMessage({
            action: 'urlResult',
            status: 'failed',
            reason: 'Human verification not completed in time',
            href: url
          }).catch(() => {});
          continueProcess();
          return;
        }

        // After verification is resolved, wait 15 seconds before continuing
        let hvRemain = 15;
        while (hvRemain > 0 && isRunning) {
          updateDetails(`Human verification resolved, waiting ${hvRemain}s before continuing...`, 'info');
          chrome.runtime.sendMessage({
            action: 'timeline',
            step: 'open', // still part of opening/readying the page
            label: 'After human verification',
            remainingSeconds: hvRemain
          }).catch(() => {});
          await sleep(1000);
          hvRemain -= 1;
        }
      }
    } catch (e) {
      // If we can't read the tab title, just continue
      console.warn('Could not read tab title for human verification check:', e);
    }

    if (!isRunning) {
      updateDetails('Process stopped by user', 'warning');
      return;
    }

    // Final check for redirect before injecting script
    try {
      const finalTabCheck = await chrome.tabs.get(tab.id);
      if (finalTabCheck && finalTabCheck.url && finalTabCheck.url.includes('pro.fiverr.com/inbox/')) {
        updateDetails('Page was redirected to inbox before automation. Closing tab and marking as failed.', 'error');
        // Mark as failed with original URL
        chrome.runtime.sendMessage({
          action: 'urlResult',
          status: 'failed',
          reason: 'Redirected to inbox page',
          href: url
        }).catch(() => {});
        // Close tab and continue to next URL
        continueProcess();
        return;
      }
    } catch (e) {
      console.warn('Could not read tab URL for final redirect check:', e);
    }

    updateDetails('Page loaded, starting automation...', 'info');
    chrome.runtime.sendMessage({
      action: 'timeline',
      step: 'prepare',
      label: 'Prepare contact'
    }).catch(() => {});
    
    // Inject content script to find and click buttons
    try {
      const settings = await chrome.storage.local.get(['skipHeyButton']);
      const skipHeyButton = settings.skipHeyButton || false;
      
      // Check if redirect was detected or check URL one more time right before injection
      if (redirectDetected) {
        updateDetails('Redirect to inbox detected before injection. Closing tab and marking as failed.', 'error');
        // Add directly to history
        addHistoryEntry({
          href: url,
          status: 'failed',
          reason: 'Redirected to inbox page'
        });
        continueProcess();
        return;
      }
      
      const preInjectTab = await chrome.tabs.get(tab.id);
      if (preInjectTab && preInjectTab.url && preInjectTab.url.includes('pro.fiverr.com/inbox/')) {
        updateDetails('Page was redirected to inbox. Closing tab and marking as failed.', 'error');
        // Add directly to history
        addHistoryEntry({
          href: url,
          status: 'failed',
          reason: 'Redirected to inbox page'
        });
        continueProcess();
        return;
      }
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: automatePage,
        args: [
          result.messages,
          TIME_AFTER_CONTACT_BUTTON,
          TIME_AFTER_HEY_BUTTON,
          TIME_BEFORE_SEND_BUTTON,
          TIME_AFTER_SEND_BUTTON,
          skipHeyButton,
          url // Pass the original URL for history tracking
        ]
      });
    } catch (error) {
      console.error('Error executing automation:', error);
      updateDetails(`Error in automation: ${error.message}`, 'error');
      // Mark as failed but continue to next URL
      chrome.runtime.sendMessage({
        action: 'urlResult',
        status: 'failed',
        reason: `Automation error: ${error.message}`,
        href: url
      }).catch(() => {});
      // Still continue to next URL
      continueProcess();
    }

  } catch (error) {
    console.error('Error processing URL:', error);
    updateDetails(`Error processing URL: ${error.message}`, 'error');
    updateStatus(`Error: ${error.message}`, true);
    // Mark as failed but continue to next URL
    chrome.runtime.sendMessage({
      action: 'urlResult',
      status: 'failed',
      reason: `Processing error: ${error.message}`,
      href: url
    }).catch(() => {});
    // Continue with next URL after a delay
    setTimeout(() => processNextUrl(), TIME_ERROR_RETRY);
  }
}

async function continueProcess() {
  if (!isRunning) {
    return;
  }

  // Close current tab if exists
  if (currentTabId) {
    try {
      await chrome.tabs.remove(currentTabId);
    } catch (error) {
      // Tab might already be closed
    }
    currentTabId = null;
  }
  
  // Clear current processing URL
  currentProcessingUrl = null;

  // Wait before processing next URL with countdown
  updateDetails('Message sent successfully, closing tab...', 'success');
  
  // Get min and max minutes from storage, or use defaults
  const settings = await chrome.storage.local.get(['minMinutes', 'maxMinutes']);
  const minMinutes = settings.minMinutes || (TIME_BETWEEN_MESSAGES / (60 * 1000));
  const maxMinutes = settings.maxMinutes || (TIME_BETWEEN_MESSAGES / (60 * 1000));
  
  // Calculate random wait time between min and max
  const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
  const waitTimeMs = randomMinutes * 60 * 1000;
  const startTime = Date.now();
  const endTime = startTime + waitTimeMs;
  
  updateDetails(`Waiting ${randomMinutes} minutes (random ${minMinutes}-${maxMinutes}) before next message...`, 'info');
  
  const countdownInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(countdownInterval);
      activeIntervals = activeIntervals.filter(id => id !== countdownInterval);
      updateDetails('Process stopped during wait', 'warning');
      return;
    }
    
    const remaining = Math.max(0, endTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    updateStatus(`Waiting before next message... ${minutes}m ${seconds}s left`, true);
    chrome.runtime.sendMessage({
      action: 'timeline',
      step: 'wait',
      label: 'Waiting before next message',
      remainingSeconds: Math.floor(remaining / 1000)
    }).catch(() => {});
    
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      activeIntervals = activeIntervals.filter(id => id !== countdownInterval);
      updateDetails('Wait completed, processing next URL...', 'info');
    }
  }, TIME_COUNTDOWN_UPDATE_INTERVAL);
  
  // Track the interval so it can be cleared on stop
  activeIntervals.push(countdownInterval);
  
  await sleep(waitTimeMs);
  
  // Clear interval if it's still running
  clearInterval(countdownInterval);
  activeIntervals = activeIntervals.filter(id => id !== countdownInterval);
  
  if (isRunning) {
    processNextUrl();
  }
}

function automatePage(messages, timeAfterContact, timeAfterHey, timeBeforeSend, timeAfterSend, skipHeyButton = false, originalUrl = null) {
  return new Promise((resolve, reject) => {
    // Use original URL if provided, otherwise fall back to current URL
    const urlForHistory = originalUrl || window.location.href;
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

    // Helper function to trigger click event properly
    function triggerClick(element) {
      // Try multiple click methods
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

    // Helper function to check if redirected to inbox
    function checkInboxRedirect() {
      try {
        // Check both window.location.href and document.URL
        const currentUrl = window.location.href || document.URL || '';
        if (currentUrl && currentUrl.includes('pro.fiverr.com/inbox/')) {
          chrome.runtime.sendMessage({ 
            action: 'updateDetails',
            detail: '❌ Redirected to inbox page after clicking contact button',
            type: 'error'
          });
          // Report URL failed - use original URL for history, not the redirected URL
          // Send message and wait a bit to ensure it's processed
          chrome.runtime.sendMessage({
            action: 'urlResult',
            status: 'failed',
            reason: 'Redirected to inbox page after clicking contact button',
            href: urlForHistory
          }, (response) => {
            // After message is acknowledged, send processComplete
            if (chrome.runtime.lastError) {
              console.error('Error sending urlResult:', chrome.runtime.lastError);
            }
            // Small delay to ensure history is saved
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: 'processComplete' });
              reject(new Error('Redirected to inbox page'));
            }, 200);
          });
          return true;
        }
      } catch (e) {
        // If we can't check the URL, continue (might be during navigation)
        console.warn('Could not check for redirect:', e);
      }
      return false;
    }

    // Step 1: Find and click contact seller button
    waitForElement('div[data-testid="contact-seller-button"]', 15, 500)
      .then((contactButton) => {
        triggerClick(contactButton);
        chrome.runtime.sendMessage({ 
          action: 'updateDetails',
          detail: '✓ Clicked contact seller button',
          type: 'success'
        });
        
        // Check immediately after clicking for redirect
        setTimeout(() => {
          if (checkInboxRedirect()) {
            return;
          }
        }, 500); // Check after 500ms
        
        // If skipHeyButton is enabled, go directly to message box
        if (skipHeyButton) {
          chrome.runtime.sendMessage({ 
            action: 'updateDetails',
            detail: '⏭️ Skipping "👋 Hey" button (option enabled)',
            type: 'info'
          });
          
          // Check for redirect continuously during wait period
          let redirectCheckCount = 0;
          const maxRedirectChecks = Math.ceil(timeAfterContact / 1000); // Check every second
          const redirectCheckInterval = setInterval(() => {
            redirectCheckCount++;
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
            // Final check if redirected to inbox after wait time
            if (checkInboxRedirect()) {
              return;
            }
            // Step 3: Find textarea with data-testid="message-box" and add random message
            waitForElement('textarea[data-testid="message-box"]', 15, 500)
              .then((messageBox) => {
                // Get random message
                let randomMessage = messages[Math.floor(Math.random() * messages.length)];
                
                // Normalize message to single line - replace line breaks and normalize spaces
                randomMessage = randomMessage
                  .replace(/\r\n/g, ' ')
                  .replace(/\r/g, ' ')
                  .replace(/\n/g, ' ')
                  .replace(/\s+/g, ' ')  // Replace all whitespace sequences with single space
                  .trim();

                // Update timeline: we are now in Send Message phase (filling text)
                chrome.runtime.sendMessage({
                  action: 'timeline',
                  step: 'send',
                  label: 'Adding message'
                }).catch(() => {});
                
                // Focus the element first
                messageBox.focus();
                
                // Append message to existing content (don't replace)
                const existingText = messageBox.value || '';
                const separator = existingText.trim() ? ' ' : '';
                messageBox.value = existingText + separator + randomMessage;

                // Final cleanup: collapse any multiple spaces in the whole message
                messageBox.value = messageBox.value.replace(/\s+/g, ' ').trim();
                
                // Trigger events to ensure React/other frameworks detect the change
                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                messageBox.dispatchEvent(inputEvent);
                messageBox.dispatchEvent(changeEvent);
                
                // Also try InputEvent for better compatibility
                try {
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                  nativeInputValueSetter.call(messageBox, messageBox.value);
                  const inputEvent2 = new Event('input', { bubbles: true });
                  messageBox.dispatchEvent(inputEvent2);
                } catch (e) {
                  // Fallback to regular events
                }
                
                chrome.runtime.sendMessage({ 
                  action: 'updateDetails',
                  detail: `✓ Added message: "${randomMessage.substring(0, 50)}${randomMessage.length > 50 ? '...' : ''}"`,
                  type: 'success'
                });
                
                setTimeout(() => {
                  // Step 4: Find and click "Send message" button
                  function findSendButton() {
                    const allButtons = document.querySelectorAll('button');
                    for (const btn of allButtons) {
                      const pTag = btn.querySelector('p');
                      if (pTag && pTag.textContent && pTag.textContent.includes('Send message')) {
                        return btn;
                      }
                      if (btn.textContent && btn.textContent.includes('Send message')) {
                        return btn;
                      }
                    }
                    return null;
                  }

                  // Retry finding send button
                  let sendButton = null;
                  let sendAttempts = 0;
                  const maxSendAttempts = 10;
                  const findSendBtn = setInterval(() => {
                    sendButton = findSendButton();
                    if (sendButton) {
                      clearInterval(findSendBtn);
                      triggerClick(sendButton);
                      chrome.runtime.sendMessage({ 
                        action: 'updateDetails',
                        detail: `✓ Clicked Send message button, waiting ${timeAfterSend / 1000} seconds...`,
                        type: 'success'
                      });
                      // Timeline: waiting after send, still in Send Message phase
                      chrome.runtime.sendMessage({
                        action: 'timeline',
                        step: 'send',
                        label: `Waiting ${timeAfterSend / 1000}s after sending`,
                        remainingSeconds: timeAfterSend / 1000
                      }).catch(() => {});
                      
                      setTimeout(() => {
                        chrome.runtime.sendMessage({ 
                          action: 'updateDetails',
                          detail: '✓ Message sending completed',
                          type: 'success'
                        });
                        // Report URL processed successfully
                        chrome.runtime.sendMessage({
                          action: 'urlResult',
                          status: 'success',
                          reason: 'Message sent successfully',
                          href: urlForHistory
                        });
                        chrome.runtime.sendMessage({ action: 'processComplete' });
                        resolve();
                      }, timeAfterSend);
                    } else if (sendAttempts >= maxSendAttempts) {
                      clearInterval(findSendBtn);
                      chrome.runtime.sendMessage({ 
                        action: 'updateDetails',
                        detail: '❌ Send message button not found',
                        type: 'error'
                      });
                      // Report URL failed
                      chrome.runtime.sendMessage({
                        action: 'urlResult',
                        status: 'failed',
                        reason: 'Send message button not found',
                        href: urlForHistory
                      });
                      chrome.runtime.sendMessage({ action: 'processComplete' });
                      reject(new Error('Send message button not found'));
                    }
                    sendAttempts++;
                  }, 500);
                }, timeBeforeSend);
              })
              .catch((error) => {
                chrome.runtime.sendMessage({ 
                  action: 'updateDetails',
                  detail: '❌ Message textarea not found',
                  type: 'error'
                });
                // Report URL failed
                chrome.runtime.sendMessage({
                  action: 'urlResult',
                  status: 'failed',
                  reason: 'Message textarea not found',
                  href: urlForHistory
                });
                chrome.runtime.sendMessage({ action: 'processComplete' });
                reject(error);
              });
          }, timeAfterContact);
          
          return; // Exit early if skipHeyButton is enabled
        }
        
        // Inform timeline about upcoming Hey button click
        try {
          chrome.runtime.sendMessage({
            action: 'timeline',
            step: 'prepare',
            label: `Waiting ${(timeAfterHey / 1000) || 0}s before clicking "👋 Hey"`,
            remainingSeconds: Math.floor(timeAfterHey / 1000)
          }).catch(() => {});
        } catch (e) {
          // ignore timeline errors
        }

        // Check for redirect continuously during wait period
        let redirectCheckCount = 0;
        const maxRedirectChecks = Math.ceil(timeAfterContact / 1000); // Check every second
        const redirectCheckInterval = setInterval(() => {
          redirectCheckCount++;
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
          // Final check if redirected to inbox after wait time
          if (checkInboxRedirect()) {
            return;
          }
          
          // Step 2: Find button with title starting with "👋 Hey"
          function findHeyButton() {
            // First check buttons with title attribute
            const buttonsWithTitle = document.querySelectorAll('button[title]');
            for (const btn of buttonsWithTitle) {
              if (btn.title && btn.title.startsWith('👋 Hey')) {
                return btn;
              }
            }
            
            // Also check for buttons with text content starting with "👋 Hey"
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
              const text = btn.textContent ? btn.textContent.trim() : '';
              if (text.startsWith('👋 Hey')) {
                return btn;
              }
            }
            
            // Also check aria-label
            const buttonsWithAriaLabel = document.querySelectorAll('button[aria-label]');
            for (const btn of buttonsWithAriaLabel) {
              if (btn.getAttribute('aria-label') && btn.getAttribute('aria-label').startsWith('👋 Hey')) {
                return btn;
              }
            }
            
            return null;
          }

          // Retry finding hey button
          let heyButton = null;
          let attempts = 0;
          const maxAttempts = 10;
          const findButton = setInterval(() => {
            heyButton = findHeyButton();
            if (heyButton) {
              clearInterval(findButton);
              triggerClick(heyButton);
              chrome.runtime.sendMessage({ 
                action: 'updateDetails',
                detail: '✓ Clicked "👋 Hey" button',
                type: 'success'
              });
              
              setTimeout(() => {
                // Step 3: Find textarea with data-testid="message-box" and add random message
                waitForElement('textarea[data-testid="message-box"]', 15, 500)
                  .then((messageBox) => {
        
                    // Get random message
                    let randomMessage = messages[Math.floor(Math.random() * messages.length)];
                    
                    // Normalize message to single line - replace line breaks and normalize spaces
                    randomMessage = randomMessage
                      .replace(/\r\n/g, ' ')
                      .replace(/\r/g, ' ')
                      .replace(/\n/g, ' ')
                      .replace(/\s+/g, ' ')  // Replace all whitespace sequences with single space
                      .trim();

                    // Update timeline: we are now in Send Message phase (filling text)
                    chrome.runtime.sendMessage({
                      action: 'timeline',
                      step: 'send',
                      label: 'Adding message'
                    }).catch(() => {});
                    
                    // Focus the element first
                    messageBox.focus();
                    
                    // Append message to existing content (don't replace)
                    const existingText = messageBox.value || '';
                    const separator = existingText.trim() ? ' ' : '';
                    messageBox.value = existingText + separator + randomMessage;

                    // Final cleanup: collapse any multiple spaces in the whole message
                    messageBox.value = messageBox.value.replace(/\s+/g, ' ').trim();
                    
                    // Trigger events to ensure React/other frameworks detect the change
                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                    messageBox.dispatchEvent(inputEvent);
                    messageBox.dispatchEvent(changeEvent);
                    
                    // Also try InputEvent for better compatibility
                    try {
                      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                      nativeInputValueSetter.call(messageBox, messageBox.value);
                      const inputEvent2 = new Event('input', { bubbles: true });
                      messageBox.dispatchEvent(inputEvent2);
                    } catch (e) {
                      // Fallback to regular events
                    }
                    
                    chrome.runtime.sendMessage({ 
                      action: 'updateDetails',
                      detail: `✓ Added message: "${randomMessage.substring(0, 50)}${randomMessage.length > 50 ? '...' : ''}"`,
                      type: 'success'
                    });
                    
                    setTimeout(() => {
                      // Step 4: Find and click "Send message" button
                      function findSendButton() {
                        const allButtons = document.querySelectorAll('button');
                        for (const btn of allButtons) {
                          const pTag = btn.querySelector('p');
                          if (pTag && pTag.textContent && pTag.textContent.includes('Send message')) {
                            return btn;
                          }
                          if (btn.textContent && btn.textContent.includes('Send message')) {
                            return btn;
                          }
                        }
                        return null;
                      }

                      // Retry finding send button
                      let sendButton = null;
                      let sendAttempts = 0;
                      const maxSendAttempts = 10;
                      const findSendBtn = setInterval(() => {
                        sendButton = findSendButton();
                        if (sendButton) {
                          clearInterval(findSendBtn);
                          triggerClick(sendButton);
                          chrome.runtime.sendMessage({ 
                            action: 'updateDetails',
                            detail: `✓ Clicked Send message button, waiting ${timeAfterSend / 1000} seconds...`,
                            type: 'success'
                          });
                          chrome.runtime.sendMessage({
                            action: 'timeline',
                            step: 'send',
                            label: `Waiting ${timeAfterSend / 1000}s after sending`,
                            remainingSeconds: timeAfterSend / 1000
                          }).catch(() => {});
                          
                          setTimeout(() => {
                            chrome.runtime.sendMessage({ 
                              action: 'updateDetails',
                              detail: '✓ Message sending completed',
                              type: 'success'
                            });
                        // Report URL processed successfully
                        chrome.runtime.sendMessage({
                          action: 'urlResult',
                          status: 'success',
                          reason: 'Message sent successfully',
                          href: urlForHistory
                        });
                            chrome.runtime.sendMessage({ action: 'processComplete' });
                            resolve();
                          }, timeAfterSend);
                        } else if (sendAttempts >= maxSendAttempts) {
                          clearInterval(findSendBtn);
                          chrome.runtime.sendMessage({ 
                            action: 'updateDetails',
                            detail: '❌ Send message button not found',
                            type: 'error'
                          });
                          // Report URL failed but continue to next
                          chrome.runtime.sendMessage({
                            action: 'urlResult',
                            status: 'failed',
                            reason: 'Send message button not found',
                            href: urlForHistory
                          });
                          chrome.runtime.sendMessage({ action: 'processComplete' });
                          reject(new Error('Send message button not found'));
                        }
                        sendAttempts++;
                      }, 500);
                    }, timeBeforeSend);
                  })
                  .catch((error) => {
                    chrome.runtime.sendMessage({ 
                      action: 'updateDetails',
                      detail: '❌ Message textarea not found',
                      type: 'error'
                    });
                    // Report URL failed
                    chrome.runtime.sendMessage({
                      action: 'urlResult',
                      status: 'failed',
                      reason: 'Message textarea not found',
                      href: urlForHistory
                    });
                    chrome.runtime.sendMessage({ action: 'processComplete' });
                    reject(error);
                  });
              }, timeAfterHey);
            } else if (attempts >= maxAttempts) {
              clearInterval(findButton);
              chrome.runtime.sendMessage({ 
                action: 'updateDetails',
                detail: '❌ Button starting with "👋 Hey" not found',
                type: 'error'
              });
              // Report URL failed
              chrome.runtime.sendMessage({
                action: 'urlResult',
                status: 'failed',
                reason: 'Hey button not found',
                href: urlForHistory
              });
              chrome.runtime.sendMessage({ action: 'processComplete' });
              reject(new Error('Hey button not found'));
            }
            attempts++;
          }, 500);
        }, timeAfterContact);
      })
      .catch((error) => {
        chrome.runtime.sendMessage({ 
          action: 'updateDetails',
          detail: '❌ Contact seller button not found',
          type: 'error'
        });
        // Report URL failed
        chrome.runtime.sendMessage({
          action: 'urlResult',
          status: 'failed',
          reason: 'Contact seller button not found',
          href: urlForHistory
        });
        chrome.runtime.sendMessage({ action: 'processComplete' });
        reject(error);
      });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Wait for tab to complete loading
function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          resolve();
        } else {
          // Set up listener for tab update
          const listener = (updatedTabId, changeInfo, updatedTab) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          
          // Timeout after 30 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve(); // Resolve anyway to continue
          }, 30000);
        }
      } catch (error) {
        console.error('Error checking tab status:', error);
        resolve(); // Resolve to continue even if error
      }
    };
    
    checkTab();
  });
}

// Wait until the "It needs a human touch" or "It needs a human verify" page is resolved (title changes)
function waitForHumanVerification(tabId) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const maxWaitMs = 10 * 60 * 1000; // 10 minutes max
    let resolved = false;

    const intervalId = setInterval(async () => {
      if (!isRunning) {
        clearInterval(intervalId);
        activeIntervals = activeIntervals.filter(id => id !== intervalId);
        resolve(false);
        return;
      }

      try {
        const tab = await chrome.tabs.get(tabId);
        const stillNeedsVerify = tab && tab.title && 
          (tab.title.includes('It needs a human touch') || tab.title.includes('It needs a human verify'));
        
        if (!stillNeedsVerify) {
          // Title changed - verification resolved
          clearInterval(intervalId);
          activeIntervals = activeIntervals.filter(id => id !== intervalId);
          resolved = true;
          resolve(true);
          return;
        }

        if (Date.now() - startTime > maxWaitMs) {
          clearInterval(intervalId);
          activeIntervals = activeIntervals.filter(id => id !== intervalId);
          updateDetails('Human verification not completed in time.', 'warning');
          resolve(false);
        }
      } catch (error) {
        console.error('Error checking tab title for human verification:', error);
        clearInterval(intervalId);
        activeIntervals = activeIntervals.filter(id => id !== intervalId);
        resolve(false);
      }
    }, 2000);

    activeIntervals.push(intervalId);
  });
}

function updateStatus(status, running) {
  chrome.runtime.sendMessage({
    action: 'updateStatus',
    status: status,
    isRunning: running
  }).catch(() => {
    // Ignore errors if popup is closed
  });
}

function updateDetails(detail, type = 'info') {
  chrome.runtime.sendMessage({
    action: 'updateDetails',
    detail: detail,
    type: type
  }).catch(() => {
    // Ignore errors if popup is closed
  });
}

async function addHistoryEntry({ href, status, reason }) {
  try {
    const result = await chrome.storage.local.get(['urlHistory']);
    const history = result.urlHistory || [];
    history.unshift({
      url: href || '',
      status,
      reason: reason || '',
      timestamp: Date.now()
    });
    if (history.length > 100) {
      history.splice(100);
    }
    await chrome.storage.local.set({ urlHistory: history });
    chrome.runtime.sendMessage({ action: 'updateHistory', history }).catch(() => {
      // Ignore errors if popup is closed
    });
  } catch (e) {
    console.error('Error updating history:', e);
  }
}

