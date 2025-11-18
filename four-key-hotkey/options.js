const rows = document.getElementById("rows");
const saveBtn = document.getElementById("save");
const modeSel = document.getElementById("mode");
const delayInput = document.getElementById("delayMs");
const useCDP = document.getElementById("useCDP");

const labels = [
  "Snippet 1 (Ctrl/Cmd+Shift+1)",
  "Snippet 2 (Ctrl/Cmd+Shift+2)",
  "Snippet 3 (Ctrl/Cmd+Shift+6)",
  "Snippet 4 (Ctrl/Cmd+Shift+7)"
];

function linesToArray(text){
  return (text || "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function arrayToLines(arr){
  if (!Array.isArray(arr)) return String(arr || "");
  return arr.join("\\n");
}

async function load() {
  const { snippets, mode, delayMs, useCDP: useCDPVal } = await chrome.storage.sync.get(["snippets","mode","delayMs","useCDP"]);

  // Normalize to array-of-arrays for UI
  let vals = ["", "", "", ""];
  if (Array.isArray(snippets)) {
    vals = snippets.map(s => (Array.isArray(s) ? s : (s ? [s] : [])));
    while (vals.length < 4) vals.push([]);
    vals = vals.slice(0,4);
  }

  modeSel.value = mode || "type";
  delayInput.value = typeof delayMs === "number" ? delayMs : 30;
  useCDP.checked = typeof useCDPVal === "boolean" ? useCDPVal : true;

  rows.innerHTML = "";
  labels.forEach((label, i) => {
    const wrap = document.createElement("div");
    wrap.className = "row";
    wrap.innerHTML = `
      <label><strong>${label}</strong></label><br/>
      <textarea id="sn${i}" placeholder="Type one message per line...">${(arrayToLines(vals[i] || [])).replace(/</g,"&lt;")}</textarea>
    `;
    rows.appendChild(wrap);
  });
}

saveBtn.onclick = async () => {
  const snippets = [];
  for (let i = 0; i < 4; i++) {
    const raw = document.getElementById("sn"+i).value;
    const arr = linesToArray(raw);
    snippets.push(arr);
  }
  const mode = modeSel.value;
  const delayMs = Math.max(0, parseInt(delayInput.value || "30", 10));
  const useCDPVal = !!useCDP.checked;
  await chrome.storage.sync.set({ snippets, mode, delayMs, useCDP: useCDPVal });
  alert("Saved!");
};

load();
