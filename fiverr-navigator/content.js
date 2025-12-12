(function() {
  'use strict';

  let currentIndex = -1;
  let contacts = [];
  let sortedContacts = []; // Array of {element, translateY, originalIndex}
  let savedPosition = null; // {sortedIndex, translateY} - saved position for navigation

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

  // Handle keyboard events
  function handleKeyDown(event) {
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
})();

