// Ultra-optimized Discord Badge Filter
(function() {
  'use strict';

  // Constants
  const SELECTORS = {
    card: "div.container__4cb8a",
    title: "h2.defaultColor__4bd52.heading-md\\/semibold_cf4812.defaultColor__5345c.guildName__4cb8a",
    overview: "div.text-sm\\/normal_cf4812.description__4cb8a",
    invite: "div.text-xs\\/normal_cf4812.memberDetailsText__4cb8a"
  };
  const MIN_COUNT = 500;
  const PROCESSED_ATTR = "data-dsbf-processed";
  const DIM_CLASS = "dsbf-dim";

  // Pre-compiled regex for performance
  const ASCII_REGEX = /^[\x00-\x7F]*$/;
  const JOIN_COUNT_REGEX = /([\d.,]+)\s*([km])?\b/;
  const LETTERS_REGEX = /[^A-Za-z]/g;

  // Cache
  const cardCache = new WeakMap();
  const processedCards = new WeakSet();
  let overrides = {};

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
        const cards = document.querySelectorAll(SELECTORS.card);
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
    const match = raw.toLowerCase().match(JOIN_COUNT_REGEX);
    if (!match) return 0;
    const num = parseFloat(match[1].replace(/,/g, ""));
    if (isNaN(num)) return 0;
    const suffix = match[2];
    if (suffix === "k") return Math.round(num * 1000);
    if (suffix === "m") return Math.round(num * 1000000);
    return Math.round(num);
  }

  function evaluateCard(card) {
    if (cardCache.has(card)) {
      return cardCache.get(card);
    }

    const titleEl = card.querySelector(SELECTORS.title);
    const overviewEl = card.querySelector(SELECTORS.overview);
    const inviteEl = card.querySelector(SELECTORS.invite);

    const title = titleEl?.textContent?.trim() || "";
    const overview = overviewEl?.textContent?.trim() || "";
    const inviteText = inviteEl?.textContent?.trim() || "";

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
  }

  function processCard(card) {
    if (processedCards.has(card)) {
      // Force re-evaluation if overrides might have changed
      cardCache.delete(card);
    }
    try {
      evaluateCard(card);
    } catch (e) {}
  }

  function processAllAndCollect() {
    const cards = document.querySelectorAll(SELECTORS.card);
    const data = [];
    for (let i = 0; i < cards.length; i++) {
      try {
        data.push(evaluateCard(cards[i]));
      } catch (e) {}
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
      const cards = document.querySelectorAll(SELECTORS.card);
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
        if (node.matches?.(SELECTORS.card)) {
          newCards.add(node);
        } else {
          const children = node.querySelectorAll?.(SELECTORS.card);
          if (children) {
            for (let k = 0; k < children.length; k++) {
              newCards.add(children[k]);
            }
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

    // Find the most specific container
    const container = document.querySelector('[class*="container"]') || document.body;
    if (container) {
      observer.observe(container, { 
        childList: true, 
        subtree: true 
      });
    }
  }

  // Initial processing
  scheduleProcess();

  // Delayed observer init to avoid blocking initial render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initObserver, 50);
    });
  } else {
    setTimeout(initObserver, 50);
  }

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
        const cards = document.querySelectorAll(SELECTORS.card);
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

