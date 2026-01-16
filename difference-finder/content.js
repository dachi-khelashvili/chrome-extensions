// Content script to interact with GitHub pages
// Listens for messages from popup to click follow/unfollow buttons

// Function to find and click follow button on GitHub
function clickFollowButton() {
  // GitHub uses input[type="submit"] elements for follow buttons
  const selectors = [
    // Primary selector: input with value="Follow"
    'input[type="submit"][name="commit"][value="Follow"]',
    'input[type="submit"][value="Follow"]',
    // Alternative selectors with aria-label
    'input[type="submit"][aria-label^="Follow"]:not([aria-label*="Unfollow"])',
    // Form action based selectors
    'form[action*="/follow"] input[type="submit"]',
    // Class-based selectors
    'input.btn.btn-block[value="Follow"]'
  ];
  
  for (const selector of selectors) {
    try {
      const button = document.querySelector(selector);
      if (button) {
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Verify it's actually a Follow button (not Unfollow)
          const value = button.getAttribute('value') || button.value || '';
          const ariaLabel = button.getAttribute('aria-label') || '';
          
          if ((value.toLowerCase() === 'follow' || ariaLabel.toLowerCase().startsWith('follow')) &&
              !value.toLowerCase().includes('unfollow') && 
              !ariaLabel.toLowerCase().includes('unfollow')) {
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              try {
                button.click();
                return true;
              } catch (clickError) {
                console.error('Error clicking button:', clickError);
                // Try form submission if direct click fails
                const form = button.closest('form');
                if (form) {
                  form.requestSubmit(button);
                  return true;
                }
                return false;
              }
            }, 300);
            return true;
          }
        }
      }
    } catch (error) {
      console.error(`Error with selector ${selector}:`, error);
    }
  }
  
  // Fallback: find any input with "Follow" value
  const allInputs = document.querySelectorAll('input[type="submit"]');
  for (const input of allInputs) {
    const value = (input.value || input.getAttribute('value') || '').trim().toLowerCase();
    if (value === 'follow' && input.offsetParent !== null) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        input.click();
      }, 300);
      return true;
    }
  }
  
  return false;
}

// Function to find and click unfollow button on GitHub
function clickUnfollowButton() {
  // GitHub uses input[type="submit"] elements for unfollow buttons
  const selectors = [
    // Primary selector: input with value="Unfollow"
    'input[type="submit"][name="commit"][value="Unfollow"]',
    'input[type="submit"][value="Unfollow"]',
    // Alternative selectors with aria-label
    'input[type="submit"][aria-label*="Unfollow"]',
    // Form action based selectors
    'form[action*="/unfollow"] input[type="submit"]',
    // Class-based selectors
    'input.btn.btn-block[value="Unfollow"]',
    // Data attribute selectors
    'input[type="submit"][data-disable-with="Unfollow"]'
  ];
  
  for (const selector of selectors) {
    try {
      const button = document.querySelector(selector);
      if (button) {
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Verify it's actually an Unfollow button
          const value = button.getAttribute('value') || button.value || '';
          const ariaLabel = button.getAttribute('aria-label') || '';
          const dataDisableWith = button.getAttribute('data-disable-with') || '';
          
          if (value.toLowerCase() === 'unfollow' || 
              ariaLabel.toLowerCase().includes('unfollow') ||
              dataDisableWith.toLowerCase() === 'unfollow') {
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              try {
                button.click();
                return true;
              } catch (clickError) {
                console.error('Error clicking button:', clickError);
                // Try form submission if direct click fails
                const form = button.closest('form');
                if (form) {
                  form.requestSubmit(button);
                  return true;
                }
                return false;
              }
            }, 300);
            return true;
          }
        }
      }
    } catch (error) {
      console.error(`Error with selector ${selector}:`, error);
    }
  }
  
  // Fallback: find any input with "Unfollow" value
  const allInputs = document.querySelectorAll('input[type="submit"]');
  for (const input of allInputs) {
    const value = (input.value || input.getAttribute('value') || '').trim().toLowerCase();
    const dataDisableWith = (input.getAttribute('data-disable-with') || '').trim().toLowerCase();
    if ((value === 'unfollow' || dataDisableWith === 'unfollow') && input.offsetParent !== null) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        input.click();
      }, 300);
      return true;
    }
  }
  
  return false;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clickFollow') {
    try {
      const success = clickFollowButton();
      sendResponse({ success: success, message: success ? 'Follow button clicked' : 'Follow button not found' });
    } catch (error) {
      console.error('Error in content script:', error);
      sendResponse({ success: false, message: error.message });
    }
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'clickUnfollow') {
    try {
      const success = clickUnfollowButton();
      sendResponse({ success: success, message: success ? 'Unfollow button clicked' : 'Unfollow button not found' });
    } catch (error) {
      console.error('Error in content script:', error);
      sendResponse({ success: false, message: error.message });
    }
    return true; // Keep the message channel open for async response
  }
  
  return false;
});

// Optional: Log when content script loads
console.log('Difference Finder content script loaded');

