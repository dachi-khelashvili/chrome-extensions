// Content script for Gmail page
// This helps with finding elements on Gmail's dynamic page

// Function to find subject input field
function findSubjectInput() {
  // Try multiple selectors
  const selectors = [
    'input[name="subjectbox"]',
    'input[aria-label="Subject"]',
    'input[placeholder="Subject"]',
    'input[class*="subject"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.offsetParent !== null) {
      return element;
    }
  }

  return null;
}

// Function to find message body
function findMessageBody() {
  // Try multiple selectors
  const selectors = [
    'div[role="textbox"][aria-label="Message Body"]',
    'div[role="textbox"][aria-label*="Message"]',
    'div[contenteditable="true"][aria-label*="Message"]',
    'div[contenteditable="true"][role="textbox"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.offsetParent !== null) {
      return element;
    }
  }

  return null;
}

// Function to find send button
function findSendButton() {
  // Try multiple selectors
  const selectors = [
    'div[role="button"][data-tooltip*="Send"]',
    'div[role="button"][aria-label*="Send"]',
    'div[aria-label*="Send"][role="button"]',
    'div[data-tooltip*="send"][role="button"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.offsetParent !== null && !element.disabled) {
      return element;
    }
  }

  return null;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fillForm') {
    const { subject, message: msg } = message;

    // Fill subject
    const subjectInput = findSubjectInput();
    if (subjectInput) {
      subjectInput.value = subject;
      subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
      subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Fill message
    const messageBody = findMessageBody();
    if (messageBody) {
      const formattedMessage = msg.replace(/\\n/g, '\n');
      messageBody.textContent = formattedMessage;
      messageBody.dispatchEvent(new Event('input', { bubbles: true }));
    }

    sendResponse({ success: true });
  } else if (message.action === 'clickSend') {
    const sendButton = findSendButton();
    if (sendButton) {
      sendButton.click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Send button not found' });
    }
  }
});
