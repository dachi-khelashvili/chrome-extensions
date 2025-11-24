
// Rules: [{ trigger: string, replacements: [string, ...] }, ...]
let rules = [
  {
    trigger: "secret",
    replacements: ["Secret 1", "Secret 2"]
  },
  {
    trigger: "hello",
    replacements: ["Hey there!", "Hi!", "Hello friend"]
  }
];

let manualEdit = false;

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(["rules", "manualEdit"], (data) => {
    if (Array.isArray(data.rules) && data.rules.length > 0) {
      // Basic validation
      rules = data.rules
        .filter(r => r && typeof r.trigger === "string")
        .map(r => ({
          trigger: String(r.trigger),
          replacements: Array.isArray(r.replacements) ? r.replacements.map(String) : []
        }));
    }
    if (typeof data.manualEdit === "boolean") {
      manualEdit = data.manualEdit;
    }
  });
}

loadSettings();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    if (changes.rules && Array.isArray(changes.rules.newValue)) {
      rules = changes.rules.newValue
        .filter(r => r && typeof r.trigger === "string")
        .map(r => ({
          trigger: String(r.trigger),
          replacements: Array.isArray(r.replacements) ? r.replacements.map(String) : []
        }));
    }
    if (changes.manualEdit && typeof changes.manualEdit.newValue === "boolean") {
      manualEdit = changes.manualEdit.newValue;
    }
  }
});

function findRuleForText(text) {
  const trimmed = text.trim().toLowerCase();
  for (const rule of rules) {
    if (!rule.trigger) continue;
    if (trimmed === rule.trigger.trim().toLowerCase()) {
      return rule;
    }
  }
  return null;
}

document.addEventListener("copy", (e) => {
  const selection = window.getSelection().toString();
  if (!selection) return;

  const rule = findRuleForText(selection);
  if (!rule) return;

  const replacements = Array.isArray(rule.replacements) ? rule.replacements.filter(r => r.trim().length > 0) : [];
  if (!replacements.length && !manualEdit) {
    // No replacement defined and no manual edit -> do nothing
    return;
  }

  let outputText;

  if (manualEdit) {
    // Base suggestion: random from this trigger's replacements or original selection
    let base = replacements.length
      ? replacements[Math.floor(Math.random() * replacements.length)]
      : selection;

    const edited = window.prompt("Edit copied text:", base);
    if (edited === null) {
      // User cancelled -> let normal copy happen
      return;
    }
    outputText = edited;
  } else {
    // Random from this rule's own replacements
    outputText = replacements[Math.floor(Math.random() * replacements.length)];
  }

  e.clipboardData.setData("text/plain", outputText);
  e.preventDefault();
});
