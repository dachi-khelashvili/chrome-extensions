// Fiverr Assistant - Keyboard button clicker
// Enter key: Clicks Message button
// Space key: Clicks 👋 Hey -> Add message -> Send message
// Page Up/Down: Navigate contacts (inbox pages)

(function() {
  'use strict';

  // Generate unique identifier for this tab instance
  const tabId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  let clickState = 0; // 0: 👋 Hey, 1: Add message, 2: Send message (independent per tab)
  
  // Navigation state (for inbox pages)
  let currentIndex = -1;
  let contacts = [];
  let sortedContacts = []; // Array of {element, translateY, originalIndex}
  let savedPosition = null; // {sortedIndex, translateY} - saved position for navigation

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

  // Navigation functions (for inbox pages)
  function findContactNav() {
    const navs = document.querySelectorAll('nav');
    for (const nav of navs) {
      const contacts = nav.querySelectorAll('[data-testid="contact"]');
      if (contacts.length > 0) {
        return nav;
      }
    }
    return null;
  }

  function getContacts() {
    const nav = findContactNav();
    const searchRoot = nav || document;
    
    const allDivs = Array.from(searchRoot.querySelectorAll('div[style*="translateY"]'));
    
    const contacts = allDivs.filter(div => {
      const hasContactTestId = div.getAttribute('data-testid') === 'contact';
      const hasContactClass = div.classList.contains('contact');
      const hasRoleButton = div.getAttribute('role') === 'button';
      return hasContactTestId || (hasContactClass && hasRoleButton);
    });
    
    if (contacts.length > 0) {
      return contacts;
    }
    
    return Array.from(searchRoot.querySelectorAll('[data-testid="contact"]'));
  }

  function getTranslateY(element) {
    const style = element.getAttribute('style') || '';
    const match = style.match(/translateY\(([^)]+)\)/);
    if (match) {
      const value = parseFloat(match[1]);
      return isNaN(value) ? 0 : value;
    }
    return 0;
  }

  function getSortedContacts() {
    contacts = getContacts();
    if (contacts.length === 0) {
      sortedContacts = [];
      return [];
    }

    sortedContacts = contacts.map((contact, index) => ({
      element: contact,
      translateY: getTranslateY(contact),
      originalIndex: index
    }));

    sortedContacts.sort((a, b) => a.translateY - b.translateY);
    return sortedContacts;
  }

  function findCurrentContactIndex() {
    if (sortedContacts.length === 0) {
      getSortedContacts();
    }
    if (sortedContacts.length === 0) return -1;

    if (currentIndex >= 0 && currentIndex < contacts.length) {
      const currentElement = contacts[currentIndex];
      const foundIndex = sortedContacts.findIndex(item => item.element === currentElement);
      if (foundIndex >= 0) {
        return foundIndex;
      }
    }

    const viewportCenter = window.innerHeight / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;

    sortedContacts.forEach((item, index) => {
      const rect = item.element.getBoundingClientRect();
      const elementCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elementCenter - viewportCenter);
      
      if (rect.top >= 0 && rect.bottom <= window.innerHeight && distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    if (closestDistance === Infinity) {
      for (let i = 0; i < sortedContacts.length; i++) {
        const rect = sortedContacts[i].element.getBoundingClientRect();
        if (rect.top > 0) {
          return i;
        }
      }
    }

    return closestIndex;
  }

  function navigateToContact(sortedIndex) {
    if (sortedContacts.length === 0) {
      getSortedContacts();
    }
    if (sortedContacts.length === 0) return;

    if (sortedIndex < 0) sortedIndex = 0;
    if (sortedIndex >= sortedContacts.length) sortedIndex = sortedContacts.length - 1;

    const contactItem = sortedContacts[sortedIndex];
    if (!contactItem || !contactItem.element) return;

    const contact = contactItem.element;

    savedPosition = {
      sortedIndex: sortedIndex,
      translateY: contactItem.translateY
    };

    let clickableElement = contact;
    
    if (contact.getAttribute('role') === 'button') {
      clickableElement = contact;
    } else {
      const parentButton = contact.closest('[role="button"]');
      if (parentButton) {
        clickableElement = parentButton;
      }
    }

    contact.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      if (clickableElement) {
        clickableElement.click();
        currentIndex = contactItem.originalIndex;
      } else {
        contact.click();
        currentIndex = contactItem.originalIndex;
      }
    }, 150);
  }

  // Check if current URL is a freelancer page
  function isFreelancerPage() {
    return /^https:\/\/pro\.fiverr\.com\/freelancers\//.test(location.href);
  }

  // Handle key press (Enter for Message, Space for automation, Page Up/Down for navigation)
  function handleKeyPress(event) {
    // Handle Page Down/Up/Home for navigation FIRST (before other handlers)
    if (event.key === 'PageDown' || event.key === 'Page Down') {
      event.preventDefault();
      event.stopPropagation();
      
      getSortedContacts();
      if (sortedContacts.length === 0) return;

      let sortedIndex;
      if (savedPosition && savedPosition.sortedIndex !== undefined) {
        sortedIndex = savedPosition.sortedIndex;
      } else {
        sortedIndex = findCurrentContactIndex();
      }
      
      const nextIndex = sortedIndex + 1;
      if (nextIndex < sortedContacts.length) {
        navigateToContact(nextIndex);
      }
      return;
    } else if (event.key === 'PageUp' || event.key === 'Page Up') {
      event.preventDefault();
      event.stopPropagation();
      
      getSortedContacts();
      if (sortedContacts.length === 0) return;

      let sortedIndex;
      if (savedPosition && savedPosition.sortedIndex !== undefined) {
        sortedIndex = savedPosition.sortedIndex;
      } else {
        sortedIndex = findCurrentContactIndex();
      }
      
      const prevIndex = sortedIndex - 1;
      if (prevIndex >= 0) {
        navigateToContact(prevIndex);
      }
      return;
    } else if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      
      getSortedContacts();
      if (sortedContacts.length === 0) return;

      let targetIndex = 0;
      
      for (let i = 0; i < sortedContacts.length; i++) {
        if (sortedContacts[i].translateY === 0) {
          targetIndex = i;
          break;
        }
        if (sortedContacts[i].translateY > 0) {
          targetIndex = i > 0 ? i - 1 : 0;
          break;
        }
      }
      
      navigateToContact(targetIndex);
      return;
    }
    
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
    
    // Only handle Enter and Space on freelancer pages
    if (!isFreelancerPage()) {
      // If not on freelancer page, only allow navigation keys
      if (!isEnter && !isSpace) {
        return; // Let other keys work normally
      }
      // Don't handle Enter/Space on non-freelancer pages
      return;
    }
    
    // Handle Enter key - click Message button (only on freelancer pages)
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
  const urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      clickState = 0; // Reset to first automated button (👋 Hey) for this tab
      console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Page changed, reset state to 0`);
    }
  });
  urlObserver.observe(document, { subtree: true, childList: true });

  // Observer for contact list changes (inbox pages)
  const contactObserver = new MutationObserver(() => {
    let translateYChanged = false;
    
    const newContacts = getContacts();
    if (newContacts.length !== contacts.length) {
      currentIndex = -1;
      contacts = newContacts;
      sortedContacts = [];
      translateYChanged = true;
    } else {
      if (sortedContacts.length > 0 && savedPosition) {
        getSortedContacts();
        if (savedPosition.sortedIndex < sortedContacts.length) {
          const currentTranslateY = sortedContacts[savedPosition.sortedIndex].translateY;
          if (currentTranslateY !== savedPosition.translateY) {
            translateYChanged = true;
            savedPosition.translateY = currentTranslateY;
          }
        }
      }
    }
    
    if (translateYChanged) {
      clickState = 0;
    }
  });

  // Setup contact observer when DOM is ready
  function setupContactObserver() {
    const nav = findContactNav();
    const contactContainer = nav || document.body;

    if (contactContainer) {
      contactObserver.observe(contactContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupContactObserver);
  } else {
    setupContactObserver();
  }

  console.log(`Fiverr Assistant [Tab ${tabId.substring(0, 8)}]: Navigation enabled for inbox pages`);

})();

