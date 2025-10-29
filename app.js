/* ==============================
   1. APPLE SIGN-IN + CLOUDKIT – COMMENTED OUT
   ============================== */
// const APPLE_CONTAINER = 'iCloud.com.YOURDOMAIN.magicmind';
// let ckDatabase, userID;

// AppleID.auth.init({
//   clientId: 'com.YOURDOMAIN.magicmind.web',
//   scope: 'name email',
//   redirectURI: location.href,
//   usePopup: true
// });

// document.getElementById('appleid-signin')?.addEventListener('click', () => AppleID.auth.signIn());

// document.addEventListener('AppleIDSignInOnSuccess', async (e) => { … });
// document.addEventListener('AppleIDSignInOnFailure', (e) => console.error(e.detail.error));

// async function initCloudKit() { … }

/* ==============================
   2. LOCAL STORAGE FALLBACK
   ============================== */
const STORAGE_KEY = 'magicmind-entries';
let entries = [];

/* Load from localStorage on start */
function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    entries = JSON.parse(raw).map(e => ({
      id: e.id,
      date: new Date(e.date),
      text: e.text
    }));
  }
  renderList(entries);
  updateStreak(entries);
}
loadFromStorage();

/* Save to localStorage */
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.map(e => ({
    id: e.id,
    date: e.date.toISOString(),
    text: e.text
  }))));
}

/* ==============================
   3. CRUD (localStorage)
   ============================== */
async function loadEntries() {
  // No-op – data already in memory
}

async function saveEntry(text) {
  const now = new Date();
  if (currentEditId) {
    const idx = entries.findIndex(e => e.id === currentEditId);
    if (idx > -1) entries[idx].text = text;
  } else {
    entries.push({ id: Date.now().toString(), date: now, text });
  }
  saveToStorage();
  renderList(entries);
  updateStreak(entries);
  switchView('list');
}

/* ==============================
   4. UI (unchanged)
   ============================== */
let currentEditId = null;

function switchView(view) {
  document.getElementById('listView').classList.toggle('hidden', view !== 'list');
  document.getElementById('editorView').classList.toggle('hidden', view !== 'editor');
  document.getElementById('insightsView').classList.toggle('hidden', view !== 'insights');
}

/* ---- List rendering ---- */
function renderList(entries) {
  const ul = document.getElementById('entriesList');
  ul.innerHTML = '';
  entries.forEach(e => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${e.date.toLocaleDateString()}</strong><br>${e.text.slice(0,50)}…`;
    li.onclick = () => openEditor(e);
    ul.appendChild(li);
  });
}

/* ---- Streak ---- */
function updateStreak(entries) {
  if (!entries.length) return document.getElementById('streak').textContent = 'Streak: 0 days';
  const sorted = entries.slice().sort((a,b)=>b.date-a.date);
  let streak = 1;
  let prev = new Date(sorted[0].date);
  prev.setHours(0,0,0,0);
  for (let i=1;i<sorted.length;i++) {
    const cur = new Date(sorted[i].date);
    cur.setHours(0,0,0,0);
    const diff = (prev - cur) / 86400000;
    if (diff === 1) { streak++; prev = cur; }
    else break;
  }
  document.getElementById('streak').textContent = `Current Streak: ${streak} day${streak>1?'s':''}`;
}

/* ---- Editor ---- */
function openEditor(entry = null) {
  currentEditId = entry ? entry.id : null;
  document.getElementById('editor').value = entry ? entry.text : '';
  switchView('editor');
}
document.getElementById('newBtn').onclick = () => openEditor();

document.getElementById('saveBtn').onclick = () => {
  const txt = document.getElementById('editor').value.trim();
  if (txt) saveEntry(txt);
};
document.getElementById('cancelBtn').onclick = () => switchView('list');

/* ---- Prompts ---- */
document.querySelectorAll('.prompt-btn').forEach(btn => {
  btn.onclick = () => {
    const editor = document.getElementById('editor');
    editor.value += (editor.value ? '\n\n' : '') + btn.textContent;
    editor.focus();
  };
});

/* ---- Insights (stub) ---- */
document.getElementById('insightsBtn').onclick = () => {
  renderInsights(entries.map(e => e.text));
  switchView('insights');
};

function renderInsights(texts) {
  const container = document.getElementById('clusters');
  container.innerHTML = '';
  const clusters = { Rumination: [], Progress: [], Overwhelm: [] };
  texts.forEach(t => {
    const low = t.toLowerCase();
    if (low.includes('stuck') || low.includes('why')) clusters.Rumination.push(t);
    else if (low.includes('win') || low.includes('better')) clusters.Progress.push(t);
    else if (low.includes('overwhelm') || low.includes('scattered')) clusters.Overwhelm.push(t);
  });
  for (const [name, list] of Object.entries(clusters)) {
    if (!list.length) continue;
    const sec = document.createElement('div');
    sec.className = 'cluster';
    sec.innerHTML = `<h3>${name}</h3>`;
    list.forEach(txt => {
      const p = document.createElement('p');
      p.className = 'entry';
      p.textContent = txt.slice(0,100)+'…';
      sec.appendChild(p);
    });
    const tip = document.createElement('p');
    tip.style.fontStyle = 'italic';
    tip.textContent = name === 'Rumination' ? 'Challenge: Is this thought a fact, or just a feeling?'
                    : name === 'Progress' ? 'Great! What helped create this shift?'
                    : 'Break one overwhelming thing into a tiny step.';
    sec.appendChild(tip);
    container.appendChild(sec);
  }
}
document.getElementById('backFromInsights').onclick = () => switchView('list');
