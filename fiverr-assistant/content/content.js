// Fiverr Assistant - Keyboard button clicker
// Enter key: Clicks Message button
// Space key: Clicks 👋 Hey -> Add message -> Send message

(function() {
  'use strict';

  // Generate unique identifier for this tab instance
  const tabId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  let clickState = 0; // 0: 👋 Hey, 1: Add message, 2: Send message (independent per tab)

  // Button selectors based on title/text
  const buttonConfigs = [
    {
      title: '👋 Hey',
      selector: 'button, a, div[role="button"]',
      textMatch: /👋\s*Hey/i
    },
    {
      title: 'Send message',
      selector: 'button[title*="Send message"], button:has-text("Send message")',
      textMatch: /Send\s+message/i
    }
  ];

  // Get random message from storage
  function getRandomMessage(callback) {
    chrome.storage.local.get(['messages'], (data) => {
      const messagesText = data.messages || '';
      if (!messagesText.trim()) {
        console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: No messages found in storage`);
        callback(null);
        return;
      }
      
      const messages = messagesText.split('|').map(msg => msg.trim()).filter(msg => msg.length > 0);
      if (messages.length === 0) {
        console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: No valid messages found`);
        callback(null);
        return;
      }
      
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      callback(randomMessage);
    });
  }

  // Add message to textarea (append, not replace)
  function setMessageInTextarea(message) {
    const textarea = document.querySelector('textarea[data-testid="message-box"]');
    if (!textarea) {
      console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Could not find message textarea`);
      return false;
    }
    
    // Get current value
    const currentValue = textarea.value || '';
    
    // Append message with a space if there's existing content
    const newValue = currentValue.trim() 
      ? currentValue + message 
      : message;
    
    // Set the value
    textarea.value = newValue;
    
    // Set cursor position to end
    textarea.setSelectionRange(newValue.length, newValue.length);
    
    // Trigger input event to ensure React/other frameworks detect the change
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    textarea.dispatchEvent(inputEvent);
    
    // Also trigger change event
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    textarea.dispatchEvent(changeEvent);
    
    // Focus the textarea
    textarea.focus();
    
    console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Added message to textarea: "${message}"`);
    return true;
  }

  // Find button by title or text content
  function findButton(config) {
    // Try multiple strategies to find the button
    const strategies = [];
    
    // Strategy 1: Find by title attribute
    strategies.push(() => {
      const buttons = document.querySelectorAll('button, a, [role="button"]');
      for (const btn of buttons) {
        const title = btn.getAttribute('title') || btn.textContent.trim();
        if (config.textMatch && config.textMatch.test(title)) {
          return btn;
        }
      }
      return null;
    });
    
    // Strategy 2: Find by text content
    strategies.push(() => {
      const buttons = document.querySelectorAll('button, a, [role="button"], div[class*="button"]');
      for (const btn of buttons) {
        const text = btn.textContent.trim();
        if (config.textMatch && config.textMatch.test(text)) {
          return btn;
        }
      }
      return null;
    });
    
    // Strategy 3: Find by aria-label
    strategies.push(() => {
      const buttons = document.querySelectorAll('button, a, [role="button"]');
      for (const btn of buttons) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (config.textMatch && config.textMatch.test(ariaLabel)) {
          return btn;
        }
      }
      return null;
    });

    for (const strategy of strategies) {
      const button = strategy();
      if (button) {
        return button;
      }
    }

    return null;
  }

  // Find Message button by data-testid
  function findMessageButton() {
    // Try data-testid first (most reliable)
    const button = document.querySelector('[data-testid="contact-seller-button"]');
    if (button) {
      return button;
    }
    
    // Fallback: try finding by text content "Message"
    const allButtons = document.querySelectorAll('button, a, [role="button"], div');
    for (const btn of allButtons) {
      const text = btn.textContent || '';
      if (/Message/i.test(text) && text.trim().length < 50) {
        return btn;
      }
    }
    
    return null;
  }

  // Click Message button
  function clickMessageButton() {
    const button = findMessageButton();
    
    if (button) {
      // Scroll button into view
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Wait a bit for scroll, then click
      setTimeout(() => {
        // Try multiple click methods
        if (button.click) {
          button.click();
        } else if (button.dispatchEvent) {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          button.dispatchEvent(clickEvent);
        }
        
        console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Clicked Message button`);
        
        // Reset automation state after clicking Message button
        clickState = 0;
      }, 100);
    } else {
      console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Could not find Message button`);
    }
  }

  // Blur any focused input fields
  function blurFocusedInputs() {
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' || 
      activeElement.isContentEditable
    )) {
      activeElement.blur();
      console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Blurred focused input`);
      // Also try clicking on body to remove focus
      if (document.body) {
        document.body.focus();
      }
    }
  }

  // Handle space key actions based on state
  function handleSpaceAction() {
    if (clickState === 0) {
      // State 0: Click 👋 Hey button
      const config = buttonConfigs[0];
      const button = findButton(config);

      if (button) {
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          if (button.click) {
            button.click();
          } else if (button.dispatchEvent) {
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            button.dispatchEvent(clickEvent);
          }
          console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Clicked "${config.title}" button (state: 0 -> 1)`);
          clickState = 1;
        }, 100);
      } else {
        console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Could not find "${config.title}" button`);
        clickState = 1; // Still advance state
      }
    } else if (clickState === 1) {
      // State 1: Add random message to textarea
      getRandomMessage((message) => {
        if (message) {
          const success = setMessageInTextarea(message);
          if (success) {
            console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Added message to textarea (state: 1 -> 2)`);
            clickState = 2;
          } else {
            // If textarea not found, try to advance anyway
            clickState = 2;
          }
        } else {
          console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: No messages available, skipping to send (state: 1 -> 2)`);
          clickState = 2;
        }
      });
    } else if (clickState === 2) {
      // State 2: Click Send message button
      const config = buttonConfigs[1];
      const button = findButton(config);

      if (button) {
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          if (button.click) {
            button.click();
          } else if (button.dispatchEvent) {
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            button.dispatchEvent(clickEvent);
          }
          console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Clicked "${config.title}" button (state: 2 -> 0)`);
          clickState = 0; // Reset to beginning
        }, 100);
      } else {
        console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Could not find "${config.title}" button`);
        clickState = 0; // Reset to beginning
      }
    }
  }

  // Handle key press (Enter for Message, Space for automation)
  function handleKeyPress(event) {
    // Check for Enter key
    const isEnter = event.code === 'Enter' || 
                   event.key === 'Enter' ||
                   event.keyCode === 13 ||
                   event.which === 13;
    
    // Check for Space key
    const isSpace = event.code === 'Space' || 
                   event.key === ' ' || 
                   event.key === 'Space' ||
                   event.keyCode === 32 ||
                   event.which === 32;
    
    // Handle Enter key - click Message button
    if (isEnter) {
      // Don't trigger if user is submitting a form or in a textarea (let normal behavior work)
      const target = event.target;
      const isFormInput = target && (
        (target.tagName === 'INPUT' && target.type !== 'button' && target.type !== 'submit') ||
        target.tagName === 'TEXTAREA' ||
        (target.isContentEditable && target.closest && target.closest('form'))
      );
      
      // Only intercept Enter if not in a form input
      if (!isFormInput) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Enter key pressed - clicking Message button`);
        clickMessageButton();
        return false;
      }
      return; // Let normal Enter behavior work in forms
    }
    
    // Handle Space key - continue automation
    if (!isSpace) {
      return; // Not a space or enter key, ignore
    }
    
    // Check if user is typing in an input field
    // Since message box opens after manual Message click, we need to blur inputs
    const target = event.target;
    const isInputField = target && (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable ||
      (target.closest && target.closest('input, textarea, [contenteditable]'))
    );
    
    // If input field is focused (likely message box), blur it and proceed with automation
    if (isInputField) {
      blurFocusedInputs();
      // Prevent the space from being entered into the input
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Small delay to ensure blur happens, then proceed
      setTimeout(() => {
        console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Space key pressed (input focused), state: ${clickState}`);
        handleSpaceAction();
      }, 50);
      return false;
    }
    
    // Prevent default scrolling behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Space key pressed, state: ${clickState}`);
    handleSpaceAction();
    
    return false;
  }

  // Initialize - use capture phase to intercept before other handlers
  console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Extension loaded - each tab has independent state`);
  
  // Attach event listener immediately with capture phase (runs before other handlers)
  window.addEventListener('keydown', handleKeyPress, true);
  document.addEventListener('keydown', handleKeyPress, true);
  
  console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Event listeners attached (capture phase)`);
  
  // Reset state when page changes (for SPA navigation) - but keep tab ID
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      clickState = 0; // Reset to first automated button (👋 Hey) for this tab
      console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Page changed, reset state to 0`);
    }
  }).observe(document, { subtree: true, childList: true });

})();

