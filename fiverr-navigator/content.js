(function() {
  'use strict';

  let currentIndex = -1;
  let contacts = [];
  let sortedContacts = []; // Array of {element, translateY, originalIndex}
  let savedPosition = null; // {sortedIndex, translateY} - saved position for navigation
  
  // Message sending state
  let clickState = 0; // 0: 👋 Hey, 1: Add message, 2: Send message

  // Function to find the nav element containing contacts
  function findContactNav() {
    // Try to find nav element that contains contacts
    const navs = document.querySelectorAll('nav');
    for (const nav of navs) {
      const contacts = nav.querySelectorAll('[data-testid="contact"]');
      if (contacts.length > 0) {
        return nav;
      }
    }
    return null;
  }

  // Function to get all contact elements (divs with translateY in style)
  function getContacts() {
    // First try to find contacts within the nav
    const nav = findContactNav();
    const searchRoot = nav || document;
    
    // Find all divs that have translateY in their style attribute
    const allDivs = Array.from(searchRoot.querySelectorAll('div[style*="translateY"]'));
    
    // Filter to only include divs that are contact items (have data-testid="contact" or are in contact structure)
    const contacts = allDivs.filter(div => {
      const hasContactTestId = div.getAttribute('data-testid') === 'contact';
      const hasContactClass = div.classList.contains('contact');
      const hasRoleButton = div.getAttribute('role') === 'button';
      return hasContactTestId || (hasContactClass && hasRoleButton);
    });
    
    // If we found contacts, return them
    if (contacts.length > 0) {
      return contacts;
    }
    
    // Fallback to data-testid="contact"
    return Array.from(searchRoot.querySelectorAll('[data-testid="contact"]'));
  }

  // Function to extract translateY value from style attribute
  function getTranslateY(element) {
    const style = element.getAttribute('style') || '';
    const match = style.match(/translateY\(([^)]+)\)/);
    if (match) {
      const value = parseFloat(match[1]);
      return isNaN(value) ? 0 : value;
    }
    return 0;
  }

  // Function to get and sort all contacts by translateY
  function getSortedContacts() {
    contacts = getContacts();
    if (contacts.length === 0) {
      sortedContacts = [];
      return [];
    }

    // Get all contacts with their translateY values
    sortedContacts = contacts.map((contact, index) => ({
      element: contact,
      translateY: getTranslateY(contact),
      originalIndex: index
    }));

    // Sort by translateY (ascending order)
    sortedContacts.sort((a, b) => a.translateY - b.translateY);

    return sortedContacts;
  }

  // Function to find the currently active contact index in sorted list
  function findCurrentContactIndex() {
    if (sortedContacts.length === 0) {
      getSortedContacts();
    }
    if (sortedContacts.length === 0) return -1;

    // If we have a current index, try to find it in sorted list
    if (currentIndex >= 0 && currentIndex < contacts.length) {
      const currentElement = contacts[currentIndex];
      const foundIndex = sortedContacts.findIndex(item => item.element === currentElement);
      if (foundIndex >= 0) {
        return foundIndex;
      }
    }

    // Find contact closest to viewport center or first visible
    const viewportCenter = window.innerHeight / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;

    sortedContacts.forEach((item, index) => {
      const rect = item.element.getBoundingClientRect();
      const elementCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elementCenter - viewportCenter);
      
      // Prefer elements that are in viewport
      if (rect.top >= 0 && rect.bottom <= window.innerHeight && distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    // If no element in viewport, find first element below viewport
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

  // Function to click a contact and scroll it into view
  // index is the index in the sortedContacts array
  function navigateToContact(sortedIndex) {
    if (sortedContacts.length === 0) {
      getSortedContacts();
    }
    if (sortedContacts.length === 0) return;

    // Clamp index to valid range
    if (sortedIndex < 0) sortedIndex = 0;
    if (sortedIndex >= sortedContacts.length) sortedIndex = sortedContacts.length - 1;

    const contactItem = sortedContacts[sortedIndex];
    if (!contactItem || !contactItem.element) return;

    const contact = contactItem.element;

    // Save the current position before navigating
    savedPosition = {
      sortedIndex: sortedIndex,
      translateY: contactItem.translateY
    };

    // Find the clickable button element (the contact div with role="button" or its parent)
    let clickableElement = contact;
    
    // If contact itself has role="button", use it
    if (contact.getAttribute('role') === 'button') {
      clickableElement = contact;
    } else {
      // Otherwise, find the parent with role="button"
      const parentButton = contact.closest('[role="button"]');
      if (parentButton) {
        clickableElement = parentButton;
      }
    }

    // Scroll contact into view
    contact.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Click the contact button after a short delay to ensure it's visible
    setTimeout(() => {
      // Use a more reliable click method
      if (clickableElement) {
        clickableElement.click();
        currentIndex = contactItem.originalIndex;
      } else {
        contact.click();
        currentIndex = contactItem.originalIndex;
      }
    }, 150);
  }

  // Get random message from storage
  function getRandomMessage(callback) {
    chrome.storage.local.get(['messages'], (data) => {
      const messagesText = data.messages || '';
      if (!messagesText.trim()) {
        console.log('Fiverr Navigator: No messages found in storage');
        callback(null);
        return;
      }
      
      const messages = messagesText.split('|').map(msg => msg.trim()).filter(msg => msg.length > 0);
      if (messages.length === 0) {
        console.log('Fiverr Navigator: No valid messages found');
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
      console.log('Fiverr Navigator: Could not find message textarea');
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
    
    console.log(`Fiverr Navigator: Added message to textarea: "${message}"`);
    return true;
  }

  // Find button by title or text content
  function findButton(config) {
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

  // Button selectors for message sending
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
          console.log('Fiverr Navigator: Clicked 👋 Hey button (state: 0 -> 1)');
          clickState = 1;
        }, 100);
      } else {
        console.log('Fiverr Navigator: Could not find 👋 Hey button');
        clickState = 1; // Still advance state
      }
    } else if (clickState === 1) {
      // State 1: Add random message to textarea
      getRandomMessage((message) => {
        if (message) {
          const success = setMessageInTextarea(message);
          if (success) {
            console.log('Fiverr Navigator: Added message to textarea (state: 1 -> 2)');
            clickState = 2;
          } else {
            clickState = 2;
          }
        } else {
          console.log('Fiverr Navigator: No messages available, skipping to send (state: 1 -> 2)');
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
          console.log('Fiverr Navigator: Clicked Send message button (state: 2 -> 0)');
          clickState = 0; // Reset to beginning
        }, 100);
      } else {
        console.log('Fiverr Navigator: Could not find Send message button');
        clickState = 0; // Reset to beginning
      }
    }
  }

  // Handle keyboard events
  function handleKeyDown(event) {
    // Handle Page Down/Up/Home for navigation FIRST (before Space handler)
    if (event.key === 'PageDown' || event.key === 'Page Down') {
      event.preventDefault();
      event.stopPropagation();
      
      // Get sorted contacts
      getSortedContacts();
      if (sortedContacts.length === 0) return;

      // Use saved position if available, otherwise find current
      let sortedIndex;
      if (savedPosition && savedPosition.sortedIndex !== undefined) {
        // Use saved position to find next contact
        sortedIndex = savedPosition.sortedIndex;
      } else {
        // Find current contact index in sorted list
        sortedIndex = findCurrentContactIndex();
      }
      
      // Move to next contact in sorted list
      const nextIndex = sortedIndex + 1;
      if (nextIndex < sortedContacts.length) {
        navigateToContact(nextIndex);
      }
    } else if (event.key === 'PageUp' || event.key === 'Page Up') {
      event.preventDefault();
      event.stopPropagation();
      
      // Get sorted contacts
      getSortedContacts();
      if (sortedContacts.length === 0) return;

      // Use saved position if available, otherwise find current
      let sortedIndex;
      if (savedPosition && savedPosition.sortedIndex !== undefined) {
        // Use saved position to find previous contact
        sortedIndex = savedPosition.sortedIndex;
      } else {
        // Find current contact index in sorted list
        sortedIndex = findCurrentContactIndex();
      }
      
      // Move to previous contact in sorted list
      const prevIndex = sortedIndex - 1;
      if (prevIndex >= 0) {
        navigateToContact(prevIndex);
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      
      // Get sorted contacts
      getSortedContacts();
      if (sortedContacts.length === 0) return;

      // Find contact at 0px (first in sorted list, or closest to 0px)
      let targetIndex = 0;
      
      // Since contacts are sorted by translateY, the first one should be at or closest to 0px
      // But let's find the one exactly at 0px if it exists
      for (let i = 0; i < sortedContacts.length; i++) {
        if (sortedContacts[i].translateY === 0) {
          targetIndex = i;
          break;
        }
        // If we've passed 0px, use the previous one (closest to 0px)
        if (sortedContacts[i].translateY > 0) {
          targetIndex = i > 0 ? i - 1 : 0;
          break;
        }
      }
      
      navigateToContact(targetIndex);
      return;
    }
    
    // Check for Space key (for message sending) - only after checking navigation keys
    const isSpace = event.code === 'Space' || 
                   event.key === ' ' || 
                   event.key === 'Space' ||
                   event.keyCode === 32 ||
                   event.which === 32;
    
    if (isSpace) {
      // Check if user is typing in an input field
      const target = event.target;
      const isInputField = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable ||
        (target.closest && target.closest('input, textarea, [contenteditable]'))
      );
      
      // Only handle space if not in input field (or if it's the message box we want to control)
      if (!isInputField || (target && target.getAttribute('data-testid') === 'message-box')) {
        // If input field is focused (likely message box), blur it and proceed with automation
        if (isInputField) {
          target.blur();
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          setTimeout(() => {
            handleSpaceAction();
          }, 50);
          return;
        }
        
        // Prevent default scrolling behavior and stop propagation
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        handleSpaceAction();
        return;
      }
      // If in other input fields, let normal behavior work
      return;
    }
  }

  // Initialize: Listen for keyboard events
  document.addEventListener('keydown', handleKeyDown, true);

  // Reset current index when contacts change (e.g., new messages loaded)
  const observer = new MutationObserver(() => {
    // Check if translateY values changed (indicating a re-render after message send)
    let translateYChanged = false;
    
    // Reset current index when DOM changes significantly
    const newContacts = getContacts();
    if (newContacts.length !== contacts.length) {
      currentIndex = -1;
      contacts = newContacts;
      sortedContacts = []; // Clear sorted list to force re-sort
      translateYChanged = true;
    } else {
      // Check if any contact's translateY changed
      if (sortedContacts.length > 0 && savedPosition) {
        // Re-sort to get updated translateY values
        getSortedContacts();
        // Check if the saved position's translateY still matches
        if (savedPosition.sortedIndex < sortedContacts.length) {
          const currentTranslateY = sortedContacts[savedPosition.sortedIndex].translateY;
          if (currentTranslateY !== savedPosition.translateY) {
            translateYChanged = true;
            // Update saved position with new translateY but keep the sortedIndex
            savedPosition.translateY = currentTranslateY;
          }
        }
      }
    }
    
    // Reset message sending state when message is sent (DOM changes significantly)
    if (translateYChanged) {
      clickState = 0;
    }
    
    // Note: We keep savedPosition even when translateY changes
    // This allows navigation to continue from the saved position
  });

  // Observe changes to the contact list container
  function setupObserver() {
    const nav = findContactNav();
    const contactContainer = nav || document.body;

    if (contactContainer) {
      observer.observe(contactContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
      });
    }
  }

  // Setup observer when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObserver);
  } else {
    setupObserver();
  }

  console.log('Fiverr Navigator: Page Up/Down navigation enabled');
  console.log('Fiverr Navigator: Space key message sending enabled');
})();

