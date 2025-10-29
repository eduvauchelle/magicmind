const STORAGE_KEY = 'magicmind-entries';
let entries = [];

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

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.map(e => ({
    id: e.id,
    date: e.date.toISOString(),
    text: e.text
  }))));
}

let currentEditId = null;

function switchView(view) {
  document.getElementById('listView').classList.toggle('hidden', view !== 'list');
  document.getElementById('editorView').classList.toggle('hidden', view !== 'editor');
  document.getElementById('insightsView').classList.toggle('hidden', view !== 'insights');
}

function renderList(entries) {
  const ul = document.getElementById('entriesList');
  ul.innerHTML = entries.length ? '' : '<li>No entries yet. Tap + to start!</li>';
  const sorted = entries.sort((a, b) => b.date - a.date);
  sorted.forEach(e => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${e.date.toLocaleDateString()}</strong><br>${e.text.slice(0,50)}…`;
    li.onclick = () => openEditor(e);
    ul.appendChild(li);
  });
}

function updateStreak(entries) {
  if (!entries.length) return document.getElementById('streak').textContent = 'Current Streak: 0 days';
  const sorted = entries.slice().sort((a,b) => b.date - a.date);
  let streak = 1;
  let prev = new Date(sorted[0].date);
  prev.setHours(0,0,0,0);
  for (let i=1; i<sorted.length; i++) {
    const cur = new Date(sorted[i].date);
    cur.setHours(0,0,0,0);
    const diff = (prev - cur) / 86400000;
    if (diff === 1) { streak++; prev = cur; } else break;
  }
  document.getElementById('streak').textContent = `Current Streak: ${streak} day${streak > 1 ? 's' : ''}`;
}

function openEditor(entry = null) {
  currentEditId = entry ? entry.id : null;
  document.getElementById('editor').value = entry ? entry.text : '';
  switchView('editor');
}

document.getElementById('newBtn').onclick = () => openEditor();

document.getElementById('saveBtn').onclick = () => {
  const txt = document.getElementById('editor').value.trim();
  if (txt) {
    const now = new Date();
    if (currentEditId) {
      const idx = entries.findIndex(e => e.id === currentEditId);
      if (idx > -1) entries[idx].text = txt;
    } else {
      entries.push({ id: Date.now().toString(), date: now, text: txt });
    }
    saveToStorage();
    renderList(entries);
    updateStreak(entries);
    switchView('list');
  }
};

document.getElementById('cancelBtn').onclick = () => switchView('list');

document.querySelectorAll('.prompt-btn').forEach(btn => {
  btn.onclick = () => {
    const editor = document.getElementById('editor');
    editor.value += (editor.value ? '\n\n' : '') + btn.textContent;
    editor.focus();
  };
});

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
      p.textContent = txt.slice(0,100) + '…';
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
