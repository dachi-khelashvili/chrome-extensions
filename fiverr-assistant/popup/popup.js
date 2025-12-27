// Fiverr Assistant Popup
// Manages messages storage

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
  const messagesArea = document.getElementById("messages");
  const statusEl = document.getElementById("status");
  const saveBtn = document.getElementById("save");

  // Load saved messages
  chrome.storage.local.get(["messages"], (data) => {
    if (messagesArea && data.messages) {
      messagesArea.value = data.messages;
    }
  });

  // Save messages
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const messagesText = messagesArea?.value || "";
      chrome.storage.local.set({ messages: messagesText }, () => {
        setStatus(statusEl, "Saved!");
      });
    });
  }
});
