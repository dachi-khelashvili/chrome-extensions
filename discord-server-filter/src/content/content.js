// Ultra-optimized Discord Badge Filter
(function() {
  'use strict';

  // Constants
  const MIN_COUNT = 500;
  const PROCESSED_ATTR = "data-dsbf-processed";
  const DIM_CLASS = "dsbf-dim";

  // Flexible selector functions with fallbacks
  function findServerCards() {
    // Try multiple strategies to find server cards
    // Strategy 1: Look for cards with specific structure (server discovery cards)
    let cards = Array.from(document.querySelectorAll('div[class*="container"]')).filter(el => {
      // Check if it looks like a server card by structure
      const hasTitle = el.querySelector('h2, h3') !== null;
      const hasDescription = Array.from(el.querySelectorAll('div')).some(div => 
        div.textContent && div.textContent.length > 20 && div.textContent.length < 500
      );
      return hasTitle && hasDescription;
    });

    // Strategy 2: Look for cards in server discovery grid
    if (cards.length === 0) {
      const grid = document.querySelector('[class*="grid"], [class*="list"], [class*="container"]');
      if (grid) {
        cards = Array.from(grid.children).filter(el => {
          if (el.tagName !== 'DIV') return false;
          const text = el.textContent || '';
          // Server cards typically have member count info
          return /members?|joined|online/i.test(text) && text.length > 50;
        });
      }
    }

    // Strategy 3: Look for any divs that contain server-like structure
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll('div')).filter(el => {
        const text = el.textContent || '';
        const hasMemberInfo = /([\d.,]+)\s*(k|m)?\s*members?/i.test(text);
        const hasTitle = el.querySelector('h2, h3, [class*="title"], [class*="name"]') !== null;
        return hasMemberInfo && hasTitle && el.children.length >= 2;
      });
    }

    return cards;
  }

  function findCardTitle(card) {
    // Try multiple strategies
    let titleEl = card.querySelector('h2, h3');
    if (!titleEl) {
      titleEl = card.querySelector('[class*="title"], [class*="name"], [class*="guild"]');
    }
    if (!titleEl) {
      // Find first heading-like element
      const headings = card.querySelectorAll('*');
      for (let i = 0; i < headings.length; i++) {
        const el = headings[i];
        const text = el.textContent?.trim() || '';
        if (text.length > 0 && text.length < 100 && !/[0-9]+\s*(k|m)?\s*members?/i.test(text)) {
          const style = window.getComputedStyle(el);
          if (parseFloat(style.fontSize) >= 16 || el.tagName.match(/^H[1-6]$/)) {
            titleEl = el;
            break;
          }
        }
      }
    }
    return titleEl;
  }

  function findCardOverview(card) {
    // Try multiple strategies
    let overviewEl = card.querySelector('[class*="description"], [class*="overview"]');
    if (!overviewEl) {
      // Find div with description-like text
      const divs = card.querySelectorAll('div');
      for (let i = 0; i < divs.length; i++) {
        const el = divs[i];
        const text = el.textContent?.trim() || '';
        if (text.length > 20 && text.length < 500 && !/[0-9]+\s*(k|m)?\s*members?/i.test(text)) {
          const hasTitle = el.querySelector('h2, h3') === null;
          if (hasTitle) {
            overviewEl = el;
            break;
          }
        }
      }
    }
    return overviewEl;
  }

  function findCardMemberInfo(card) {
    // Try multiple strategies
    let memberEl = card.querySelector('[class*="member"], [class*="count"], [class*="invite"]');
    if (!memberEl) {
      // Find element containing member count text
      const allElements = card.querySelectorAll('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const text = el.textContent || '';
        if (/([\d.,]+)\s*(k|m)?\s*members?/i.test(text) || /([\d.,]+)\s*(k|m)?\s*joined/i.test(text)) {
          memberEl = el;
          break;
        }
      }
    }
    return memberEl;
  }

  // Pre-compiled regex for performance
  const ASCII_REGEX = /^[\x00-\x7F]*$/;
  const JOIN_COUNT_REGEX = /([\d.,]+)\s*([km])?\s*(members?|joined|online|users?)/i;
  const LETTERS_REGEX = /[^A-Za-z]/g;

  // Cache
  const cardCache = new WeakMap();
  const processedCards = new WeakSet();
  let overrides = {};
  
  // Helper to clear cache (create new WeakMap/WeakSet)
  function clearCache() {
    // Note: WeakMap/WeakSet can't be cleared, but we can track processed items differently
    // We'll use the PROCESSED_ATTR to track which cards need reprocessing
    const cards = findServerCards();
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      cardCache.delete(card);
      processedCards.delete(card);
      card.removeAttribute(PROCESSED_ATTR);
    }
  }

  // Load overrides from storage
  async function loadOverrides() {
    try {
      const { overrides: storedOverrides = {} } = await chrome.storage.local.get(['overrides']);
      overrides = storedOverrides;
    } catch (e) {
      console.error('Error loading overrides:', e);
    }
  }

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.overrides) {
      loadOverrides().then(() => {
        // Reprocess all cards when overrides change
        const cards = findServerCards();
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          cardCache.delete(card);
          processedCards.delete(card);
          processCard(card);
        }
      });
    }
  });

  // Initial load of overrides
  loadOverrides();

  // Optimized helpers
  function isEnglishOnly(text) {
    if (!text) return false;
    if (!ASCII_REGEX.test(text)) return false;
    return text.replace(LETTERS_REGEX, "").length > 0;
  }

  function parseJoinCount(raw) {
    if (!raw) return 0;
    // Try multiple patterns
    let match = raw.toLowerCase().match(JOIN_COUNT_REGEX);
    if (!match) {
      // Fallback: look for number followed by k/m
      match = raw.toLowerCase().match(/([\d.,]+)\s*([km])\b/);
    }
    if (!match) {
      // Fallback: look for any number in the text
      match = raw.match(/([\d.,]+)/);
      if (match) {
        const num = parseFloat(match[1].replace(/,/g, ""));
        return isNaN(num) ? 0 : Math.round(num);
      }
      return 0;
    }
    const num = parseFloat(match[1].replace(/,/g, ""));
    if (isNaN(num)) return 0;
    const suffix = match[2]?.toLowerCase();
    if (suffix === "k") return Math.round(num * 1000);
    if (suffix === "m") return Math.round(num * 1000000);
    return Math.round(num);
  }

  function evaluateCard(card) {
    if (cardCache.has(card)) {
      return cardCache.get(card);
    }

    try {
      const titleEl = findCardTitle(card);
      const overviewEl = findCardOverview(card);
      const inviteEl = findCardMemberInfo(card);

      const title = titleEl?.textContent?.trim() || "";
      const overview = overviewEl?.textContent?.trim() || "";
      const inviteText = inviteEl?.textContent?.trim() || "";

      // Skip if we don't have enough data to evaluate
      if (!title && !overview) {
        return null;
      }

      const englishOk = isEnglishOnly(title) && isEnglishOnly(overview);
      const count = parseJoinCount(inviteText);
      
      // Check if this server is manually overridden
      const isOverridden = overrides[title] === true;
      
      // If overridden, always eligible; otherwise use normal logic
      const eligible = isOverridden ? true : (englishOk && count > MIN_COUNT);

      // Direct class manipulation for performance
      if (eligible) {
        card.classList.remove(DIM_CLASS);
      } else {
        card.classList.add(DIM_CLASS);
      }

      const result = { title, overview, inviteText, count, englishOk, eligible, isOverridden };
      cardCache.set(card, result);
      processedCards.add(card);
      card.setAttribute(PROCESSED_ATTR, "1");
      return result;
    } catch (e) {
      console.warn('[DSBF] Error evaluating card:', e);
      return null;
    }
  }

  function processCard(card) {
    if (!card || typeof card.querySelector !== 'function') return;
    
    if (processedCards.has(card)) {
      // Force re-evaluation if overrides might have changed
      cardCache.delete(card);
    }
    try {
      const result = evaluateCard(card);
      if (!result) {
        processedCards.delete(card);
      }
    } catch (e) {
      console.warn('[DSBF] Error processing card:', e);
    }
  }

  function processAllAndCollect() {
    const cards = findServerCards();
    const data = [];
    for (let i = 0; i < cards.length; i++) {
      try {
        const result = evaluateCard(cards[i]);
        if (result) {
          data.push(result);
        }
      } catch (e) {
        console.warn('[DSBF] Error evaluating card:', e);
      }
    }
    return data;
  }

  // Batch processing with requestIdleCallback for better performance
  let pendingCards = new Set();
  let processingScheduled = false;

  function scheduleProcess(newCards) {
    if (newCards) {
      newCards.forEach(card => pendingCards.add(card));
    }

    if (processingScheduled) return;
    processingScheduled = true;

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        processPendingCards();
        processingScheduled = false;
      }, { timeout: 100 });
    } else {
      requestAnimationFrame(() => {
        processPendingCards();
        processingScheduled = false;
      });
    }
  }

  function processPendingCards() {
    if (pendingCards.size === 0) {
      // Initial full scan
      const cards = findServerCards();
      for (let i = 0; i < cards.length; i++) {
        processCard(cards[i]);
      }
    } else {
      pendingCards.forEach(processCard);
      pendingCards.clear();
    }
  }

  // Ultra-optimized MutationObserver
  function findNewCards(mutations) {
    const newCards = new Set();
    for (let i = 0; i < mutations.length; i++) {
      const addedNodes = mutations[i].addedNodes;
      for (let j = 0; j < addedNodes.length; j++) {
        const node = addedNodes[j];
        if (node.nodeType !== 1) continue;
        
        // Check if the node itself looks like a server card
        if (node.tagName === 'DIV' && !node.hasAttribute(PROCESSED_ATTR)) {
          const text = node.textContent || '';
          if (/([\d.,]+)\s*(k|m)?\s*members?/i.test(text) && node.children.length >= 2) {
            newCards.add(node);
            continue;
          }
        }
        
        // Check children for server cards
        const allCards = findServerCards();
        for (let k = 0; k < allCards.length; k++) {
          const card = allCards[k];
          if (!card.hasAttribute(PROCESSED_ATTR) && (node.contains(card) || node === card)) {
            newCards.add(card);
          }
        }
      }
    }
    return newCards;
  }

  let observer = null;
  function initObserver() {
    if (observer) return;
    
    observer = new MutationObserver((mutations) => {
      const newCards = findNewCards(mutations);
      if (newCards.size > 0) {
        scheduleProcess(newCards);
      }
    });

    // Find the most specific container - try multiple strategies
    let container = document.querySelector('[class*="container"]') || 
                    document.querySelector('[class*="grid"]') ||
                    document.querySelector('[class*="list"]') ||
                    document.querySelector('main') ||
                    document.body;
    
    if (container) {
      observer.observe(container, { 
        childList: true, 
        subtree: true 
      });
    }
  }

  // Initial processing with retries
  function initialize() {
    const cards = findServerCards();
    if (cards.length > 0) {
      scheduleProcess();
      initObserver();
    } else {
      // Retry if no cards found yet (page might still be loading)
      setTimeout(() => {
        const retryCards = findServerCards();
        if (retryCards.length > 0) {
          scheduleProcess();
          initObserver();
        } else {
          // Final retry after a longer delay
          setTimeout(() => {
            scheduleProcess();
            initObserver();
          }, 2000);
        }
      }, 500);
    }
  }

  // Delayed observer init to avoid blocking initial render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initialize, 100);
    });
  } else {
    setTimeout(initialize, 100);
  }

  // Also listen for navigation changes (Discord is a SPA)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Clear cache and reprocess on navigation
      clearCache();
      setTimeout(initialize, 500);
    }
  }, 1000);

  // Message handler
  chrome.runtime.onMessage?.addListener((msg, _sender, sendResponse) => {
    if (msg === "force-scan") {
      const results = processAllAndCollect();
      chrome.storage.local.set({ 
        servers: results, 
        updatedAt: Date.now() 
      }).then(() => {
        sendResponse({ ok: true, count: results.length });
      });
      return true;
    } else if (msg && msg.type === 'update-overrides') {
      // Reload overrides and reprocess all cards
      loadOverrides().then(() => {
        const cards = findServerCards();
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          cardCache.delete(card);
          processedCards.delete(card);
          processCard(card);
        }
        sendResponse({ ok: true });
      });
      return true;
    }
  });
})();

