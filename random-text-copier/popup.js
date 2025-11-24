
function rulesToText(rules) {
  return rules
    .map(rule => {
      const trigger = (rule.trigger || "").trim();
      const replacements = Array.isArray(rule.replacements)
        ? rule.replacements.map(r => r.trim()).filter(r => r.length > 0)
        : [];
      if (!trigger) return "";
      if (!replacements.length) return trigger;
      return trigger + " => " + replacements.join(" | ");
    })
    .filter(line => line.length > 0)
    .join("\n");
}

function textToRules(text) {
  const lines = text.split("\n");
  const rules = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    let trigger = line;
    let replacements = [];

    const parts = line.split("=>");
    if (parts.length >= 2) {
      trigger = parts[0].trim();
      const right = parts.slice(1).join("=>").trim();
      if (right.length > 0) {
        replacements = right.split("|").map(r => r.trim()).filter(r => r.length > 0);
      }
    }

    if (!trigger) continue;

    rules.push({
      trigger,
      replacements
    });
  }

  return rules;
}

function loadSettings() {
  chrome.storage.sync.get(["rules", "manualEdit"], (data) => {
    const rulesArea = document.getElementById("rules");
    const manualEditCheckbox = document.getElementById("manualEdit");

    if (Array.isArray(data.rules) && data.rules.length > 0) {
      rulesArea.value = rulesToText(data.rules);
    } else {
      // Default example
      rulesArea.value = "secret => Secret 1 | Secret 2\nhello => Hey there! | Hi! | Hello friend";
    }

    if (typeof data.manualEdit === "boolean") {
      manualEditCheckbox.checked = data.manualEdit;
    }
  });
}

function saveSettings() {
  const rulesArea = document.getElementById("rules");
  const manualEditCheckbox = document.getElementById("manualEdit");
  const status = document.getElementById("status");

  const rulesText = rulesArea.value || "";
  const rules = textToRules(rulesText);
  const manualEdit = manualEditCheckbox.checked;

  chrome.storage.sync.set({ rules, manualEdit }, () => {
    status.textContent = "Saved!";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
}

document.getElementById("save").addEventListener("click", saveSettings);
document.addEventListener("DOMContentLoaded", loadSettings);

function randomWord(len = 3) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  const btn = document.getElementById("copyCodeBtn");
  // Prevent the same code from repeating
  if (btn) {
    btn.addEventListener("click", async () => {
      const code = randomWord(3);
      // Copy to clipboard (modern browsers)
      try {
        await navigator.clipboard.writeText(code);
        const status = document.getElementById("status");
        if (status) {
          status.textContent = `Copied: ${code}`;
          setTimeout(() => (status.textContent = ""), 1500);
        }
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    });
  }
});