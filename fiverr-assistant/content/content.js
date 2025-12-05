// Fiverr Assistant - Keyboard button clicker
// Enter key: Clicks Message button
// Space key: Clicks 👋 Hey -> Send message

(function() {
  'use strict';

  // Generate unique identifier for this tab instance
  const tabId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  let clickState = 0; // 0: 👋 Hey, 1: Send message (independent per tab)

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

  // Click button and update state
  function clickNextButton() {
    const config = buttonConfigs[clickState];
    const button = findButton(config);

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
        
        console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Clicked "${config.title}" button (state: ${clickState} -> ${(clickState + 1) % buttonConfigs.length})`);
        
        // Move to next state
        clickState = (clickState + 1) % buttonConfigs.length;
      }, 100);
    } else {
      console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Could not find "${config.title}" button`);
      // Still advance state to allow retry
      clickState = (clickState + 1) % buttonConfigs.length;
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
        clickNextButton();
      }, 50);
      return false;
    }
    
    // Prevent default scrolling behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Space key pressed, state: ${clickState}`);
    clickNextButton();
    
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

