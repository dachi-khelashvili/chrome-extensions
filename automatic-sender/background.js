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

// Listen for start/stop messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start') {
    startProcess();
  } else if (message.action === 'stop') {
    stopProcess();
  } else if (message.action === 'processComplete') {
    // Continue with next URL
    continueProcess();
  }
  return true;
});

async function startProcess() {
  const result = await chrome.storage.local.get(['urls', 'messages', 'isRunning', 'timeBetweenMessages', 'skipHeyButton']);
  
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
    
    // Clear process logs/history
    await chrome.storage.local.set({ processLogs: [] });
    updateDetails('📋 Process history cleared', 'info');
    
    // Send message to popup to clear history display
    chrome.runtime.sendMessage({ action: 'clearHistory' }).catch(() => {
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
  
  updateStatus(`Processing: ${url}`, true);
  updateDetails(`Starting to process URL: ${url}`, 'info');

  // Open URL in new tab (background tab, not focused)
  try {
    updateDetails('Opening URL in new tab (background)...', 'info');
    const tab = await chrome.tabs.create({ url, active: false });
    currentTabId = tab.id;
    updateDetails(`Tab opened (ID: ${tab.id})`, 'success');

    // Wait for page to fully load
    updateDetails('Waiting for page to load...', 'info');
    await waitForTabComplete(tab.id);

    // Additional wait time after page is loaded
    const waitSeconds = TIME_AFTER_TAB_OPEN / 1000;
    if (TIME_AFTER_TAB_OPEN > 0) {
      updateDetails(`Waiting ${waitSeconds} seconds after page load...`, 'info');
      await sleep(TIME_AFTER_TAB_OPEN);
    }

    if (!isRunning) {
      updateDetails('Process stopped by user', 'warning');
      return;
    }

    updateDetails('Page loaded, starting automation...', 'info');
    
    // Inject content script to find and click buttons
    try {
      const settings = await chrome.storage.local.get(['skipHeyButton']);
      const skipHeyButton = settings.skipHeyButton || false;
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: automatePage,
        args: [
          result.messages,
          TIME_AFTER_CONTACT_BUTTON,
          TIME_AFTER_HEY_BUTTON,
          TIME_BEFORE_SEND_BUTTON,
          TIME_AFTER_SEND_BUTTON,
          skipHeyButton
        ]
      });
    } catch (error) {
      console.error('Error executing automation:', error);
      updateDetails(`Error in automation: ${error.message}`, 'error');
      // Still continue to next URL
      continueProcess();
    }

  } catch (error) {
    console.error('Error processing URL:', error);
    updateDetails(`Error processing URL: ${error.message}`, 'error');
    updateStatus(`Error: ${error.message}`, true);
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

  // Wait before processing next URL with countdown
  updateDetails('Message sent successfully, closing tab...', 'success');
  
  // Get custom time between messages from storage, or use default
  const settings = await chrome.storage.local.get(['timeBetweenMessages']);
  const customTimeMinutes = settings.timeBetweenMessages || (TIME_BETWEEN_MESSAGES / (60 * 1000));
  const waitTimeMs = customTimeMinutes * 60 * 1000;
  const waitMinutes = customTimeMinutes;
  const startTime = Date.now();
  const endTime = startTime + waitTimeMs;
  
  updateDetails(`Waiting ${waitMinutes} minutes before next message...`, 'info');
  
  const countdownInterval = setInterval(() => {
    if (!isRunning) {
      clearInterval(countdownInterval);
      updateDetails('Process stopped during wait', 'warning');
      return;
    }
    
    const remaining = Math.max(0, endTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    updateStatus(`Waiting before next message... ${minutes}m ${seconds}s left`, true);
    
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      updateDetails('Wait completed, processing next URL...', 'info');
    }
  }, TIME_COUNTDOWN_UPDATE_INTERVAL);
  
  await sleep(waitTimeMs);
  clearInterval(countdownInterval);
  
  if (isRunning) {
    processNextUrl();
  }
}

function automatePage(messages, timeAfterContact, timeAfterHey, timeBeforeSend, timeAfterSend, skipHeyButton = false) {
  return new Promise((resolve, reject) => {
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

    // Step 1: Find and click contact seller button
    waitForElement('div[data-testid="contact-seller-button"]', 15, 500)
      .then((contactButton) => {
        triggerClick(contactButton);
        chrome.runtime.sendMessage({ 
          action: 'updateDetails',
          detail: '✓ Clicked contact seller button',
          type: 'success'
        });
        
        // If skipHeyButton is enabled, go directly to message box
        if (skipHeyButton) {
          chrome.runtime.sendMessage({ 
            action: 'updateDetails',
            detail: '⏭️ Skipping "👋 Hey" button (option enabled)',
            type: 'info'
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
                
                // Focus the element first
                messageBox.focus();
                
                // Append message to existing content (don't replace)
                const existingText = messageBox.value || '';
                const separator = existingText.trim() ? ' ' : '';
                messageBox.value = existingText + separator + randomMessage;
                
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
                      
                      setTimeout(() => {
                        chrome.runtime.sendMessage({ 
                          action: 'updateDetails',
                          detail: '✓ Message sending completed',
                          type: 'success'
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
                chrome.runtime.sendMessage({ action: 'processComplete' });
                reject(error);
              });
          }, timeAfterContact);
          
          return; // Exit early if skipHeyButton is enabled
        }
        
        setTimeout(() => {
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
                    
                    // Focus the element first
                    messageBox.focus();
                    
                    // Append message to existing content (don't replace)
                    const existingText = messageBox.value || '';
                    const separator = existingText.trim() ? ' ' : '';
                    messageBox.value = existingText + separator + randomMessage;
                    
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
                          
                          setTimeout(() => {
                            chrome.runtime.sendMessage({ 
                              action: 'updateDetails',
                              detail: '✓ Message sending completed',
                              type: 'success'
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
  
  // Also save to storage for persistence
  chrome.storage.local.get(['processLogs'], (result) => {
    const logs = result.processLogs || [];
    logs.unshift({ detail, type, timestamp: Date.now() });
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs.splice(100);
    }
    chrome.storage.local.set({ processLogs: logs });
  });
}

