// Modern popup script with optimized performance
(function() {
  'use strict';

  const elements = {
    total: document.getElementById('total'),
    eligible: document.getElementById('eligible'),
    updated: document.getElementById('updated'),
    list: document.getElementById('list'),
    listCount: document.getElementById('list-count'),
    refresh: document.getElementById('refresh'),
    template: document.getElementById('row-template')
  };

  // Constants
  const MIN_COUNT = 500;

  // Pre-compiled regex for performance
  const ASCII_REGEX = /^[\x00-\x7F]*$/;
  const JOIN_COUNT_REGEX = /([\d.,]+)\s*([km])?\s*(members?|joined|online|users?)/i;
  const LETTERS_REGEX = /[^A-Za-z]/g;

  // Helper functions
  function isEnglishOnly(text) {
    if (!text) return false;
    if (!ASCII_REGEX.test(text)) return false;
    return text.replace(LETTERS_REGEX, "").length > 0;
  }

  function findNonEnglishChars(text) {
    if (!text) return [];
    const nonEnglish = [];
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (!ASCII_REGEX.test(char) || (char.match(/[^A-Za-z0-9\s.,!?;:'"()\-]/))) {
        if (!nonEnglish.includes(char) && char.trim() !== '') {
          nonEnglish.push(char);
        }
      }
    }
    return nonEnglish;
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
    const titleEl = card.querySelector(SELECTORS.title);
    const overviewEl = card.querySelector(SELECTORS.overview);
    const inviteEl = card.querySelector(SELECTORS.invite);

    const title = titleEl?.textContent?.trim() || "";
    const overview = overviewEl?.textContent?.trim() || "";
    const inviteText = inviteEl?.textContent?.trim() || "";

    const englishOk = isEnglishOnly(title) && isEnglishOnly(overview);
    const count = parseJoinCount(inviteText);
    const eligible = englishOk && count > MIN_COUNT;

    // Find non-English characters
    const titleNonEnglish = findNonEnglishChars(title);
    const overviewNonEnglish = findNonEnglishChars(overview);
    const allNonEnglish = [...new Set([...titleNonEnglish, ...overviewNonEnglish])];

    return { title, overview, inviteText, count, englishOk, eligible, nonEnglishChars: allNonEnglish };
  }

  async function findServersFromDiscord() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !/^https:\/\/discord\.com\//.test(tab.url || '')) {
        return [];
      }

      // Execute script in Discord page to find servers
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const ASCII_REGEX = /^[\x00-\x7F]*$/;
          const JOIN_COUNT_REGEX = /([\d.,]+)\s*([km])?\s*(members?|joined|online|users?)/i;
          const LETTERS_REGEX = /[^A-Za-z]/g;
          const MIN_COUNT = 500;

          // Flexible selector functions with fallbacks
          function findServerCards() {
            // Try multiple strategies to find server cards
            let cards = Array.from(document.querySelectorAll('div[class*="container"]')).filter(el => {
              const hasTitle = el.querySelector('h2, h3') !== null;
              const hasDescription = Array.from(el.querySelectorAll('div')).some(div => 
                div.textContent && div.textContent.length > 20 && div.textContent.length < 500
              );
              return hasTitle && hasDescription;
            });

            if (cards.length === 0) {
              const grid = document.querySelector('[class*="grid"], [class*="list"], [class*="container"]');
              if (grid) {
                cards = Array.from(grid.children).filter(el => {
                  if (el.tagName !== 'DIV') return false;
                  const text = el.textContent || '';
                  return /members?|joined|online/i.test(text) && text.length > 50;
                });
              }
            }

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
            let titleEl = card.querySelector('h2, h3');
            if (!titleEl) {
              titleEl = card.querySelector('[class*="title"], [class*="name"], [class*="guild"]');
            }
            if (!titleEl) {
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
            let overviewEl = card.querySelector('[class*="description"], [class*="overview"]');
            if (!overviewEl) {
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
            let memberEl = card.querySelector('[class*="member"], [class*="count"], [class*="invite"]');
            if (!memberEl) {
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

          function isEnglishOnly(text) {
            if (!text) return false;
            if (!ASCII_REGEX.test(text)) return false;
            return text.replace(LETTERS_REGEX, "").length > 0;
          }

          function findNonEnglishChars(text) {
            if (!text) return [];
            const nonEnglish = [];
            for (let i = 0; i < text.length; i++) {
              const char = text[i];
              if (!ASCII_REGEX.test(char) || (char.match(/[^A-Za-z0-9\s.,!?;:'"()\-]/))) {
                if (!nonEnglish.includes(char) && char.trim() !== '') {
                  nonEnglish.push(char);
                }
              }
            }
            return nonEnglish;
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
            try {
              const titleEl = findCardTitle(card);
              const overviewEl = findCardOverview(card);
              const inviteEl = findCardMemberInfo(card);

              const title = titleEl?.textContent?.trim() || "";
              const overview = overviewEl?.textContent?.trim() || "";
              const inviteText = inviteEl?.textContent?.trim() || "";

              if (!title && !overview) {
                return null;
              }

              const englishOk = isEnglishOnly(title) && isEnglishOnly(overview);
              const count = parseJoinCount(inviteText);
              const eligible = englishOk && count > MIN_COUNT;

              const titleNonEnglish = findNonEnglishChars(title);
              const overviewNonEnglish = findNonEnglishChars(overview);
              const allNonEnglish = [...new Set([...titleNonEnglish, ...overviewNonEnglish])];

              return { title, overview, inviteText, count, englishOk, eligible, nonEnglishChars: allNonEnglish };
            } catch (e) {
              console.warn('[DSBF] Error evaluating card:', e);
              return null;
            }
          }

          const cards = findServerCards();
          const data = [];
          for (let i = 0; i < cards.length; i++) {
            try {
              const result = evaluateCard(cards[i]);
              if (result) {
                data.push(result);
              }
            } catch (e) {
              console.error('Error evaluating card:', e);
            }
          }
          return data;
        }
      });

      return results[0]?.result || [];
    } catch (error) {
      console.error('Error finding servers:', error);
      return [];
    }
  }

  // Load and manage overrides
  async function loadOverrides() {
    const { overrides = {} } = await chrome.storage.local.get(['overrides']);
    return overrides;
  }

  async function saveOverride(serverTitle, isEligible) {
    const overrides = await loadOverrides();
    if (isEligible) {
      overrides[serverTitle] = true;
    } else {
      delete overrides[serverTitle];
    }
    await chrome.storage.local.set({ overrides });
  }

  let isLoading = false;

  async function loadData() {
    if (isLoading) return;
    isLoading = true;
    elements.list.classList.add('loading');

    try {
      // Find servers directly from Discord page
      const servers = await findServersFromDiscord();
      const overrides = await loadOverrides();
      
      // Apply overrides
      const serversWithOverrides = servers.map(server => {
        const isOverridden = overrides[server.title] === true;
        return {
          ...server,
          eligible: isOverridden ? true : server.eligible,
          isOverridden
        };
      });
      
      const total = serversWithOverrides.length;
      const eligible = serversWithOverrides.filter(s => s.eligible).length;

      // Update stats
      elements.total.textContent = total;
      elements.eligible.textContent = eligible;
      elements.listCount.textContent = total;
      
      // Update timestamp
      const now = new Date();
      elements.updated.textContent = 'Just now';

      // Clear and render list
      elements.list.innerHTML = '';
      
      if (serversWithOverrides.length === 0) {
        elements.list.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No servers found. Make sure you are on a Discord server discovery page and click refresh.</div>';
        return;
      }

      // Use DocumentFragment for better performance
      const fragment = document.createDocumentFragment();
      
      // Show ALL servers (both eligible and ineligible)
      serversWithOverrides.forEach(server => {
        const node = elements.template.content.cloneNode(true);
        const card = node.querySelector('.server-card');
        
        // Set title
        const titleEl = node.querySelector('.server-title');
        titleEl.textContent = server.title || '(no title)';
        
        // Set overview
        const overviewEl = node.querySelector('.server-overview');
        overviewEl.textContent = server.overview || '(no overview)';
        
        // Show non-English characters for ineligible servers
        const nonEnglishEl = node.querySelector('.server-non-english');
        if (!server.eligible && server.nonEnglishChars && server.nonEnglishChars.length > 0) {
          nonEnglishEl.style.display = 'block';
          // Properly display special characters with UTF-8 encoding
          const charsDisplay = server.nonEnglishChars.map(char => {
            // Show the character and its Unicode code point for clarity
            const codePoint = char.codePointAt(0);
            const hexCode = codePoint.toString(16).toUpperCase().padStart(4, '0');
            return `<span title="U+${hexCode}">${char}</span>`;
          }).join(' ');
          nonEnglishEl.innerHTML = `<strong>Non-English characters:</strong> <span style="font-family: monospace; background: #fff3cd; padding: 4px 8px; border-radius: 4px; color: #856404; font-size: 14px; display: inline-block; margin-top: 4px;">${charsDisplay}</span>`;
        } else if (!server.eligible && server.count <= MIN_COUNT) {
          nonEnglishEl.style.display = 'block';
          nonEnglishEl.innerHTML = `<strong>Issue:</strong> <span style="color: #dc3545;">Member count (${formatCount(server.count)}) is below minimum (${MIN_COUNT})</span>`;
        }
        
        // Set badge based on eligibility
        const badgeEl = node.querySelector('.server-badge');
        if (server.eligible) {
          badgeEl.textContent = server.isOverridden ? '✓ Eligible (Manual)' : '✓ Eligible';
          badgeEl.classList.add('eligible');
          card.classList.add('server-eligible');
        } else {
          badgeEl.textContent = '✗ Not Eligible';
          badgeEl.classList.add('not-eligible');
          card.classList.add('server-ineligible');
        }
        
        // Set count
        const countEl = node.querySelector('.count-text');
        countEl.textContent = formatCount(server.count);
        
        // Add toggle button for ineligible servers
        const toggleBtn = node.querySelector('.toggle-eligible-btn');
        if (!server.eligible) {
          toggleBtn.style.display = 'block';
          toggleBtn.textContent = 'Mark as Eligible';
          toggleBtn.onclick = async () => {
            await saveOverride(server.title, true);
            // Notify content script to update transparency
            try {
              const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tab && /^https:\/\/discord\.com\//.test(tab.url || '')) {
                chrome.tabs.sendMessage(tab.id, { type: 'update-overrides' });
              }
            } catch (e) {
              console.error('Error notifying content script:', e);
            }
            await loadData(); // Reload to update UI
          };
        } else if (server.isOverridden) {
          toggleBtn.style.display = 'block';
          toggleBtn.textContent = 'Remove Override';
          toggleBtn.classList.add('remove-override');
          toggleBtn.onclick = async () => {
            await saveOverride(server.title, false);
            // Notify content script to update transparency
            try {
              const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tab && /^https:\/\/discord\.com\//.test(tab.url || '')) {
                chrome.tabs.sendMessage(tab.id, { type: 'update-overrides' });
              }
            } catch (e) {
              console.error('Error notifying content script:', e);
            }
            await loadData(); // Reload to update UI
          };
        }
        
        fragment.appendChild(node);
      });
      
      elements.list.appendChild(fragment);

    } catch (error) {
      console.error('Error loading data:', error);
      elements.list.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Error loading servers. Make sure you are on a Discord page.</div>';
    } finally {
      isLoading = false;
      elements.list.classList.remove('loading');
    }
  }

  function formatCount(count) {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M members`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K members`;
    }
    return `${count} members`;
  }

  async function refreshData() {
    elements.refresh.style.pointerEvents = 'none';
    elements.refresh.style.opacity = '0.6';
    
    try {
      await loadData();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      elements.refresh.style.pointerEvents = '';
      elements.refresh.style.opacity = '1';
    }
  }

  // Event listeners
  elements.refresh.addEventListener('click', refreshData);

  // Initial load
  loadData();

})();

