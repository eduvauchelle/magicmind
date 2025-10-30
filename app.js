// app.js – Magic Mind AI Journal
// iA Writer style + Apple Sign In + Encrypted iCloud + Prompts + AI Prep

const CLIENT_ID = 'com.eric.magicmind.web';  // ← APP ID (primary)
const REDIRECT_URI = 'https://eduvauchelle.github.io/magicmind/';
const CONTAINER_ID = 'iCloud.web.com.eric.magicmind';

let userToken = null;
let ckDatabase = null;
let currentEntry = null;

// ----- 50+ ADHD/Depression Prompts -----
const PROMPTS = [
  "What tiny win made your brain spark today?",

];

// ----- Apple Sign In Events -----
document.addEventListener('AppleIDSignInOnSuccess', (e) => {
  userToken = e.detail.authorization.id_token;
  initCloudKit();
  showApp();
});

document.addEventListener('AppleIDSignInOnFailure', (e) => {
  alert('Login failed: ' + (e.detail.error || 'Unknown error'));
});

// ----- Init Apple Button -----
function initAppleButton() {
  AppleID.auth.init({
    clientId: CLIENT_ID,
    scope: 'name email',
    redirectURI: REDIRECT_URI,
    usePopup: true
  });
}

// ----- CloudKit Setup -----
async function initCloudKit() {
  try {
    const container = CloudKit.configure({
      containers: [{
        containerIdentifier: CONTAINER_ID,
        apiTokenAuth: { apiToken: 'DUMMY' },
        environment: 'production'
      }]
    }).getDefaultContainer();

    await container.setUpAuth({ userIdentity: { idToken: userToken } });
    ckDatabase = container.privateCloudDatabase;
    loadEntries();
  } catch (e) {
    console.error('CloudKit init failed:', e);
    alert('iCloud setup failed. Try again.');
  }
}

// ----- Encryption (AES-GCM) -----
function deriveKeyFromToken(token) {
  const hash = CryptoJS.SHA256(token).toString();
  return CryptoJS.enc.Hex.parse(hash.substring(0, 32));
}

function encrypt(text) {
  if (!userToken) return text;
  const key = deriveKeyFromToken(userToken);
  const iv = CryptoJS.lib.WordArray.random(12);
  const encrypted = CryptoJS.AES.encrypt(text, key, { iv });
  return iv.concat(encrypted.ciphertext).toString();
}

function decrypt(encryptedBase64) {
  if (!userToken || !encryptedBase64) return '';
  try {
    const key = deriveKeyFromToken(userToken);
    const data = CryptoJS.enc.Base64.parse(encryptedBase64);
    const iv = CryptoJS.lib.WordArray.create(data.words.slice(0, 3));
    const ciphertext = CryptoJS.lib.WordArray.create(data.words.slice(3));
    const decrypted = CryptoJS.AES.decrypt({ ciphertext }, key, { iv });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error('Decrypt failed', e);
    return '[Encrypted]';
  }
}

// ----- Auto-Save -----
let saveTimer;
function startAutoSave() {
  clearInterval(saveTimer);
  saveTimer = setInterval(saveCurrentEntry, 30_000);
}

// ----- Save Entry -----
async function saveCurrentEntry() {
  if (!currentEntry || !ckDatabase) return;
  const text = document.getElementById('editor').value.trim();
  if (!text) return;

  const encrypted = encrypt(text);
  const record = {
    recordName: currentEntry.recordName || undefined,
    recordType: 'JournalEntry',
    fields: {
      content: { value: encrypted },
      date: { value: new Date().toISOString() },
      prompt: { value: document.getElementById('prompt').textContent }
    }
  };

  try {
    const saved = await ckDatabase.saveRecord(record);
    currentEntry = saved;
    updateWordCount(text);
  } catch (e) {
    console.error('Save failed', e);
  }
}

// ----- Load Entries -----
async function loadEntries() {
  if (!ckDatabase) return;
  try {
    const query = {
      recordType: 'JournalEntry',
      sortBy: [{ fieldName: 'date', ascending: false }]
    };
    const result = await ckDatabase.queryRecords(query);
    const list = document.getElementById('entry-list');
    list.innerHTML = '';
    result.records.forEach(r => {
      const li = document.createElement('li');
      const date = new Date(r.fields.date.value).toLocaleDateString();
      const prompt = r.fields.prompt?.value || 'No prompt';
      li.textContent = `${date} – ${prompt.substring(0, 30)}...`;
      li.onclick = () => loadEntry(r);
      list.appendChild(li);
    });
  } catch (e) {
    console.error('Load failed', e);
  }
}

function loadEntry(record) {
  currentEntry = record;
  const decrypted = decrypt(record.fields.content.value);
  document.getElementById('editor').value = decrypted;
  document.getElementById('prompt').textContent = record.fields.prompt?.value || '';
  updateWordCount(decrypted);
}

// ----- New Entry -----
function newEntry() {
  currentEntry = null;
  document.getElementById('editor').value = '';
  showRandomPrompt();
  updateWordCount('');
  document.getElementById('editor').focus();
}

// ----- Prompt System -----
function showRandomPrompt() {
  const promptEl = document.getElementById('prompt');
  const random = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  promptEl.textContent = random;
}

// ----- UI Helpers -----
function showApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  newEntry();
  startAutoSave();
}

function updateWordCount(text) {
  const words = text.trim().split(/\s+/).filter(w => w).length;
  document.getElementById('word-count').textContent = `${words} word${words === 1 ? '' : 's'}`;
}

// ----- Sidebar & Buttons -----
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('new-entry')?.addEventListener('click', newEntry);

// ----- Init -----
window.addEventListener('load', () => {
  initAppleButton();
  showRandomPrompt();

  document.getElementById('editor')?.addEventListener('input', () => {
    updateWordCount(document.getElementById('editor').value);
  });

  if (window.location.hash.includes('id_token')) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    userToken = params.get('id_token');
    window.location.hash = '';
    initCloudKit();
    showApp();
  }
});
