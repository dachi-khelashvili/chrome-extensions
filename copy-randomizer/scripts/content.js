
const DEFAULT_RULES = [
  { trigger: "secret", replacements: ["Secret 1", "Secret 2"] },
  { trigger: "hello", replacements: ["Hey there!", "Hi!", "Hello friend"] }
];

const state = {
  rulesMap: buildRulesMap(DEFAULT_RULES)
};

function normalizeTrigger(value) {
  return value ? String(value).trim().toLowerCase() : "";
}

function sanitizeRule(rule) {
  const trigger = normalizeTrigger(rule?.trigger);
  if (!trigger) return null;

  const replacements = Array.isArray(rule?.replacements)
    ? rule.replacements
        .map(text => String(text).trim())
        .filter(Boolean)
    : [];

  return { trigger, replacements };
}

function buildRulesMap(rules = []) {
  const map = new Map();
  rules.forEach(rule => {
    const clean = sanitizeRule(rule);
    if (clean && !map.has(clean.trigger)) {
      map.set(clean.trigger, clean.replacements);
    }
  });
  return map;
}

function applyRules(rules) {
  if (Array.isArray(rules) && rules.length) {
    state.rulesMap = buildRulesMap(rules);
  } else {
    state.rulesMap = buildRulesMap(DEFAULT_RULES);
  }
}

function loadSettings() {
  chrome.storage.sync.get(["rules"], data => {
    applyRules(data.rules);
  });
}

loadSettings();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;

  if (changes.rules && Array.isArray(changes.rules.newValue)) {
    applyRules(changes.rules.newValue);
  }
});

document.addEventListener("copy", event => {
  const selection = window.getSelection().toString();
  const normalizedSelection = normalizeTrigger(selection);
  if (!normalizedSelection) return;

  const replacements = state.rulesMap.get(normalizedSelection);
  if (!replacements || !replacements.length) {
    return;
  }

  const outputText = replacements[Math.floor(Math.random() * replacements.length)];

  event.clipboardData.setData("text/plain", outputText);
  event.preventDefault();
});
