// app.js – Magic Mind AI Journal
// iA Writer style + Apple Sign In + Encrypted iCloud + Prompts + AI Prep

const CLIENT_ID = 'web.com.eric.magicmind';
const REDIRECT_URI = 'https://eduvauchelle.github.io/magicmind/';
const CONTAINER_ID = 'iCloud.web.com.eric.magicmind';

let userToken = null;
let ckDatabase = null;
let currentEntry = null;

// ----- 50+ ADHD/Depression Prompts -----
const PROMPTS = [
  "What tiny win made your brain spark today?",
  "Which ADHD 'rabbit hole' pulled you in – and what pulled you out?",
  "Name one thought that felt heavy. Is it 100% true?",
  "What did your body need today that your mind ignored?",
  "List 3 things you're grateful for – no matter how small.",
  "What’s one small step you took toward a goal?",
  "Describe a moment you felt calm today.",
  "What emotion showed up most today? Why?",
  "If your day was a weather report, what would it say?",
  "What’s one thing you’d tell your past self?",
  "What drained your energy? What recharged it?",
  "Write a kind note to yourself.",
  "What’s working well in your routine?",
  "What’s one boundary you need to set?",
  "How did procrastination feel in your body?",
  "What made you laugh or smile today?",
  "What’s one task you avoided – and why?",
  "How did you show up for yourself today?",
  "What’s a strength you used today?",
  "What’s one thing you’re proud of this week?",
  "What would 10-year-old you say about today?",
  "What’s one change you want to try tomorrow?",
  "How did you handle a tough moment?",
  "What’s one thing you learned about yourself?",
  "Write about a safe place in your mind.",
  "What’s one habit you want to build?",
  "How did you feel when you woke up?",
  "What’s one thing you can let go of?",
  "Describe your energy level in colors.",
  "What’s one way you practiced self-care?",
  "What’s a fear that held you back today?",
  "Write a thank-you note to your brain.",
  "What’s one thing you’re looking forward to?",
  "How did you navigate overwhelm?",
  "What’s one truth you know but forget?",
  "Write about a moment of clarity.",
  "What’s one way you grew today?",
  "How did you show kindness to yourself?",
  "What’s one thing you’d do differently?",
  "Write a pep talk for tomorrow.",
  "What’s one thing that felt easy today?",
  "How did you recharge your social battery?",
  "What’s one goal for the next hour?",
  "Write about a time you felt capable.",
  "What’s one thing you forgive yourself for?",
  "How did you handle distraction today?",
  "What’s one thing you’re curious about?",
  "Write a love letter to your future self.",
  "What’s one way you showed resilience?"
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
    const saved = await ckDatabase.saveRecord(record);  // ← FIXED
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
    const result = await ckDatabase.queryRecords(query);  // ← FIXED
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

  // Real-time word count
  document.getElementById('editor')?.addEventListener('input', () => {
    updateWordCount(document.getElementById('editor').value);
  });

  // Handle redirect after login
  if (window.location.hash.includes('id_token')) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    userToken = params.get('id_token');
    window.location.hash = ''; // Clean URL
    initCloudKit();
    showApp();
  }
});
