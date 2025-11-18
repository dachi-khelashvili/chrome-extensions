chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.ping) return sendResponse({ pong: true });
  if (msg?.type === "INSERT_TEXT") {
    insertTextAtCursor(msg.text || "", msg.mode || "type", Number(msg.delayMs ?? 30)).then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse({ ok: false, error: String(e) })
    );
    return true; // async response
  }
});

async function insertTextAtCursor(text, mode, delayMs) {
  if (!text) return;

  const active = getDeepActiveElement();
  if (active && isTextControl(active)) {
    if (mode === "type") {
      await typeIntoTextControl(active, text, delayMs);
    } else {
      pasteIntoTextControl(active, text);
    }
    return;
  }

  if (document.designMode === "on" || isInContentEditable()) {
    if (mode === "type") {
      await typeIntoContentEditable(text, delayMs);
    } else {
      try { document.execCommand("insertText", false, text); return; } catch {}
      pasteIntoContentEditable(text);
    }
    return;
  }

  alert("Click into a text field or editable area and press the hotkey again.");
}

function isTextControl(el) {
  return (el instanceof HTMLInputElement && ["text","search","email","url","tel","password","number"].includes(el.type))
      || (el instanceof HTMLTextAreaElement);
}

function pasteIntoTextControl(el, text){
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  el.value = before + text + after;
  const pos = start + text.length;
  el.setSelectionRange(pos, pos);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function typeIntoTextControl(el, text, delayMs){
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  let cursor = start;
  el.value = el.value.slice(0, start) + el.value.slice(end);
  el.setSelectionRange(start, start);
  for (const ch of text) {
    dispatchKey(el, "keydown", ch);
    const before = el.value.slice(0, cursor);
    const after = el.value.slice(cursor);
    el.value = before + ch + after;
    cursor += ch.length;
    el.setSelectionRange(cursor, cursor);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ch }));
    dispatchKey(el, "keyup", ch);
    await sleep(delayMs);
  }
}

function pasteIntoContentEditable(text){
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    const r = document.createRange();
    r.selectNodeContents(document.body);
    sel.removeAllRanges(); sel.addRange(r);
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  sel.removeAllRanges(); sel.addRange(range);
}

async function typeIntoContentEditable(text, delayMs){
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    const r = document.createRange();
    r.selectNodeContents(document.body);
    sel.removeAllRanges(); sel.addRange(r);
  }
  for (const ch of text) {
    try {
      document.execCommand("insertText", false, ch);
    } catch {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(ch));
      range.collapse(false);
      sel.removeAllRanges(); sel.addRange(range);
    }
    dispatchKey(document.activeElement || document.body, "keydown", ch);
    dispatchKey(document.activeElement || document.body, "keyup", ch);
    await sleep(delayMs);
  }
}

function dispatchKey(target, type, ch){
  const key = ch === "\n" ? "Enter" : ch;
  const code = key.length === 1 ? ("Key" + key.toUpperCase()) : key;
  const e = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
  (target || document).dispatchEvent(e);
}

function isInContentEditable() {
  let n = getDeepActiveElement();
  while (n) {
    if (n.nodeType === 1) {
      const el = n;
      if (el.isContentEditable) return true;
    }
    n = n.parentNode || (n.getRootNode && n.getRootNode().host);
  }
  return false;
}

function getDeepActiveElement(doc = document) {
  let a = doc.activeElement;
  while (a && a.shadowRoot && a.shadowRoot.activeElement) {
    a = a.shadowRoot.activeElement;
  }
  return a;
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }