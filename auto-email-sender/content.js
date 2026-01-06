// ============================================================================
// MESSAGE LISTENER
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fillAndSend') {
    fillAndSendEmail(message.subject, message.message, message.tabId, message.email);
  }
  return true;
});

// ============================================================================
// FILL AND SEND EMAIL
// ============================================================================
function fillAndSendEmail(subject, message, tabId, email) {
  const maxAttempts = 50;
  let attempts = 0;

  const tryFill = () => {
    attempts++;

    // Find subject input
    const subjectInput = document.querySelector('input[name="subjectbox"]') || 
                        document.querySelector('input[aria-label="Subject"]') ||
                        document.querySelector('input[placeholder="Subject"]');
    
    // Find message body
    const messageBody = document.querySelector('div[aria-label="Message Body"]') ||
                       document.querySelector('div[contenteditable="true"][role="textbox"]') ||
                       document.querySelector('div[g_editable="true"]');

    // Find send button
    const sendButton = Array.from(document.querySelectorAll('div[role="button"]'))
      .find(btn => btn.getAttribute('aria-label') && btn.getAttribute('aria-label').includes('Send'));

    if (subjectInput && messageBody && sendButton) {
      // Step 1: Add subject
      chrome.runtime.sendMessage({ 
        action: 'updateTimeline', 
        step: 'add-subject', 
        status: 'Adding subject...', 
        countdown: null 
      });
      
      subjectInput.focus();
      subjectInput.value = subject;
      subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
      subjectInput.dispatchEvent(new Event('change', { bubbles: true }));

      chrome.runtime.sendMessage({ 
        action: 'updateTimeline', 
        step: 'add-subject', 
        status: 'Subject added', 
        countdown: null 
      });

      // Step 2: Add description
      chrome.runtime.sendMessage({ 
        action: 'updateTimeline', 
        step: 'add-description', 
        status: 'Adding description...', 
        countdown: null 
      });
      
      messageBody.focus();
      
      // Convert \n to actual newlines
      const formattedMessage = message.replace(/\\n/g, '\n');
      
      // Clear existing content
      messageBody.innerHTML = '';
      
      // Set text content with proper line breaks
      const lines = formattedMessage.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) {
          messageBody.appendChild(document.createElement('br'));
        }
        messageBody.appendChild(document.createTextNode(line));
      });

      // Trigger input events
      messageBody.dispatchEvent(new Event('input', { bubbles: true }));
      messageBody.dispatchEvent(new Event('change', { bubbles: true }));

      chrome.runtime.sendMessage({ 
        action: 'updateTimeline', 
        step: 'add-description', 
        status: 'Description added', 
        countdown: null 
      });

      // Step 3: Click send button
      setTimeout(() => {
        sendButton.click();
        
        chrome.runtime.sendMessage({ 
          action: 'updateTimeline', 
          step: 'add-description', 
          status: 'Sending email...', 
          countdown: null 
        });
        
        // Notify background that email was sent
        setTimeout(() => {
          chrome.runtime.sendMessage({ 
            action: 'emailSent', 
            tabId: tabId,
            email: email || 'unknown',
            subject: subject || 'unknown'
          });
        }, 1000);
      }, 500);
    } else if (attempts < maxAttempts) {
      setTimeout(tryFill, 200);
    } else {
      console.error('Could not find required elements on page');
      chrome.runtime.sendMessage({ 
        action: 'updateStatus', 
        text: 'Error: Could not find Gmail compose elements', 
        type: 'error' 
      });
      chrome.runtime.sendMessage({ 
        action: 'emailSent', 
        tabId: tabId,
        email: email || 'unknown',
        subject: subject || 'unknown'
      });
    }
  };

  tryFill();
}
