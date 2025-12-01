
const DEFAULT_RULES_TEXT = "secret => Secret 1 | Secret 2\nhello => Hey there! | Hi! | Hello friend";

function rulesToText(rules = []) {
  return rules
    .map(rule => {
      const trigger = (rule?.trigger || "").trim();
      if (!trigger) return "";

      const replacements = Array.isArray(rule?.replacements)
        ? rule.replacements.map(text => text.trim()).filter(Boolean)
        : [];

      return replacements.length
        ? `${trigger} => ${replacements.join(" | ")}`
        : trigger;
    })
    .filter(Boolean)
    .join("\n");
}

function textToRules(text = "") {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [left, ...rightParts] = line.split("=>");
      const trigger = (left || "").trim();
      const right = rightParts.join("=>").trim();
      const replacements = right
        ? right.split("|").map(part => part.trim()).filter(Boolean)
        : [];
      return trigger ? { trigger, replacements } : null;
    })
    .filter(Boolean);
}

function setStatus(el, message) {
  if (!el) return;
  el.textContent = message;
  if (!message) return;
  setTimeout(() => {
    if (el.textContent === message) {
      el.textContent = "";
    }
  }, 1500);
}

document.addEventListener("DOMContentLoaded", () => {
  const rulesArea = document.getElementById("rules");
  const statusEl = document.getElementById("status");
  const saveBtn = document.getElementById("save");

  chrome.storage.sync.get(["rules"], data => {
    if (rulesArea) {
      rulesArea.value = Array.isArray(data.rules) && data.rules.length
        ? rulesToText(data.rules)
        : DEFAULT_RULES_TEXT;
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const rulesText = rulesArea?.value || "";
      const rules = textToRules(rulesText);

      chrome.storage.sync.set({ rules }, () => {
        setStatus(statusEl, "Saved!");
      });
    });
  }
});