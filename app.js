/* ==============================
   1. Apple Sign-In + CloudKit
   ============================== */
const APPLE_CONTAINER = 'iCloud.com.yourdomain.magicmind'; // <-- change to your container
let ckDatabase, userID;

// Initialise Apple Sign-In
AppleID.auth.init({
  clientId: 'com.yourdomain.magicmind.web',   // <-- your Service ID
  scope: 'name email',
  redirectURI: location.href,
  usePopup: true
});

document.getElementById('appleid-signin').addEventListener('click', () => AppleID.auth.signIn());

// Listen for sign-in result
document.addEventListener('AppleIDSignInOnSuccess', async (e) => {
  userID = e.detail.authorization.id_token; // JWT, safe to use as identifier
  await initCloudKit();
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  await loadEntries();
});
document.addEventListener('AppleIDSignInOnFailure', (e) => console.error(e.detail.error));

/* ---- CloudKit helper ---- */
async function initCloudKit() {
  const container = CloudKit.configure({
    containers: [{ containerIdentifier: APPLE_CONTAINER }]
  }).getDefaultContainer();
  ckDatabase = container.privateCloudDatabase;
}

/* ==============================
   2. Data model (JournalEntry)
   ============================== */
class JournalEntry {
  constructor({recordName, date, text}) {
    this.id = recordName;
    this.date = new Date(date);
    this.text = text;
  }
}

/* ==============================
   3. CRUD with CloudKit
   ============================== */
async function loadEntries() {
  const query = { recordType: 'JournalEntry' };
  const { records } = await ckDatabase.fetchRecords(query);
  const entries = records.map(r => new JournalEntry({
    recordName: r.recordName,
    date: r.fields.date.value,
    text: r.fields.text.value
  }));
  renderList(entries);
  updateStreak(entries);
}

async function saveEntry(text) {
  const record = {
    recordType: 'JournalEntry',
    fields: {
      date: { value: new Date().toISOString() },
      text: { value: text }
    }
  };
  if (currentEditId) {
    // edit existing
    await ckDatabase.saveRecord({ ...record, recordName: currentEditId });
  } else {
    await ckDatabase.saveRecord(record);
  }
  await loadEntries();
  switchView('list');
}

async function deleteEntry(id) {
  await ckDatabase.deleteRecord({ recordName: id });
  await loadEntries();
}

/* ==============================
   4. UI state
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
document.getElementById('insightsBtn').onclick = async () => {
  const { records } = await ckDatabase.fetchRecords({ recordType: 'JournalEntry' });
  const entries = records.map(r => r.fields.text.value);
  renderInsights(entries);
  switchView('insights');
};

function renderInsights(texts) {
  const container = document.getElementById('clusters');
  container.innerHTML = '';
  const clusters = {
    Rumination: [],
    Progress: [],
    Overwhelm: []
  };
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
    // therapist-style tip
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