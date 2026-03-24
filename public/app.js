// ── State ──
const state = {
  projects: [],
  users: [],
  selectedProject: null,
  participants: [],   // { id, name, role, selected, color }
  tasks: [],          // { desc, owner, date }
  currentStep: 1,
};

const AVATAR_COLORS = ['av-g', 'av-b', 'av-o', 'av-p'];

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  const now = new Date();
  const timeEl = document.getElementById('current-time');
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  const dateInput = document.getElementById('meeting-date');
  if (dateInput) dateInput.value = now.toISOString().split('T')[0];

  await loadData();
});

async function loadData() {
  const loading = document.getElementById('loading');
  loading.classList.add('active');
  document.getElementById('screen1').classList.remove('active');

  try {
    const [projects, users] = await Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]);

    state.projects = projects;
    state.users = users;

    populateProjectDropdown();
    buildParticipantsList();
    buildTaskOwnerDropdown();
  } catch (err) {
    console.error('Failed to load data:', err);
  } finally {
    loading.classList.remove('active');
    document.getElementById('screen1').classList.add('active');
  }
}

// ── Step Navigation ──
function goStep(n) {
  if (n === 4) buildPreview();
  state.currentStep = n;

  for (let i = 1; i <= 4; i++) {
    const sc = document.getElementById('screen' + i);
    if (sc) sc.classList.toggle('active', i === n);

    const tabs = document.querySelectorAll('.step-bar .step');
    const tab = tabs[i - 1];
    if (tab) {
      tab.classList.remove('active', 'done');
      if (i === n) tab.classList.add('active');
      else if (i < n) tab.classList.add('done');
      const dot = tab.querySelector('.step-dot');
      if (dot) dot.textContent = i < n ? '\u2713' : i;
    }
  }

  if (n === 3) buildTaskOwnerDropdown();
}

// ── Screen 1: Projects ──
function populateProjectDropdown() {
  const sel = document.getElementById('project-select');
  sel.innerHTML = '<option value="">— בחר פרויקט —</option>';
  state.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  // Add "create new" option
  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ צור פרויקט חדש';
  sel.appendChild(newOpt);
}

function handleProjectSelect(id) {
  const card = document.getElementById('proj-card');
  const newForm = document.getElementById('new-project-form');

  if (id === '__new__') {
    card.style.display = 'none';
    newForm.style.display = 'block';
    state.selectedProject = null;
    return;
  }

  newForm.style.display = 'none';

  if (!id) {
    card.style.display = 'none';
    state.selectedProject = null;
    return;
  }

  const proj = state.projects.find(p => p.id === id);
  if (!proj) return;

  state.selectedProject = proj;
  card.style.display = 'block';

  document.getElementById('proj-name').textContent = proj.name;

  const step = proj.columns.portfolio_project_step?.text || '';
  document.getElementById('proj-step').textContent = 'שלב: ' + (step || 'לא הוגדר');

  const health = proj.columns.portfolio_project_rag?.text || '';
  document.getElementById('proj-health').textContent = health ? 'בריאות: ' + health : '';

  const timeline = proj.columns.portfolio_project_planned_timeline?.text || '';
  document.getElementById('proj-timeline').textContent = timeline ? 'ציר זמן: ' + timeline : '';

  const badge = document.getElementById('proj-badge');
  badge.textContent = step || 'פרויקט';
}

async function createNewProject() {
  const nameInput = document.getElementById('new-project-name');
  const name = nameInput.value.trim();
  if (!name) return;

  const newForm = document.getElementById('new-project-form');
  const btn = newForm.querySelector('.btn-primary');
  btn.disabled = true;
  btn.textContent = 'יוצר...';

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const created = await res.json();

    if (created.error) throw new Error(JSON.stringify(created.error));

    // Add to state and select it
    const newProj = { id: created.id, name: created.name, columns: {} };
    state.projects.push(newProj);
    populateProjectDropdown();

    // Select the new project in dropdown
    const sel = document.getElementById('project-select');
    sel.value = created.id;
    handleProjectSelect(created.id);

    nameInput.value = '';
    newForm.style.display = 'none';
  } catch (err) {
    console.error('Error creating project:', err);
    alert('שגיאה ביצירת הפרויקט. נסה שוב.');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ צור פרויקט ב-Monday';
  }
}

// ── Screen 2: Participants ──
function buildParticipantsList() {
  state.participants = [];

  // Add workspace users from Monday.com directory
  state.users.forEach((u, i) => {
    state.participants.push({
      id: 'user-' + u.id,
      name: u.name,
      role: '',
      email: u.email,
      selected: false,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    });
  });

  renderParticipants();
}

function renderParticipants() {
  const list = document.getElementById('participants-list');
  list.innerHTML = '';

  state.participants.forEach((p, idx) => {
    const initial = p.name.charAt(0);
    const row = document.createElement('div');
    row.className = 'participant-row';
    row.innerHTML = `
      <div class="chk ${p.selected ? '' : 'chk-off'}" onclick="toggleParticipant(${idx})">
        ${p.selected ? '<svg viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
      </div>
      <div class="avatar ${p.color}">${initial}</div>
      <div style="flex:1;direction:rtl;">
        <div class="pname">${p.name}</div>
        ${p.role ? '<div class="prole">' + p.role + '</div>' : ''}
      </div>
    `;
    list.appendChild(row);
  });
}

function toggleParticipant(idx) {
  state.participants[idx].selected = !state.participants[idx].selected;
  renderParticipants();
}

function addParticipant() {
  const nameEl = document.getElementById('new-participant-name');
  const roleEl = document.getElementById('new-participant-role');
  const name = nameEl.value.trim();
  const role = roleEl.value.trim();

  if (!name) return;

  state.participants.push({
    id: 'custom-' + Date.now(),
    name,
    role,
    email: '',
    selected: true,
    color: AVATAR_COLORS[state.participants.length % AVATAR_COLORS.length],
  });

  nameEl.value = '';
  roleEl.value = '';
  renderParticipants();
}

// ── Screen 3: Tasks ──
let recOn = false;
let manualOn = false;
let recognition = null;
let fullTranscript = '';

// Check browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function toggleRec() {
  if (recOn) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  if (!SpeechRecognition) {
    alert('הדפדפן שלך לא תומך בהקלטה קולית.\nהשתמש ב-Chrome או Safari.');
    toggleManualTask();
    return;
  }

  recOn = true;
  manualOn = false;
  fullTranscript = '';

  const recBtn = document.getElementById('recbtn');
  const recTxt = document.getElementById('rectxt');
  const recStatus = document.getElementById('rec-status');
  const form = document.getElementById('rec-form');
  const descField = document.getElementById('task-desc');

  recBtn.classList.add('recording');
  recTxt.textContent = '🔴 מקליט... לחץ לעצירה';
  recStatus.style.display = 'block';
  recStatus.textContent = '🎙 מקשיב...';
  form.style.display = 'block';
  descField.value = '';
  descField.placeholder = 'דבר עכשיו...';
  descField.classList.add('transcribing');

  recognition = new SpeechRecognition();
  recognition.lang = 'he-IL';
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = '';
    fullTranscript = '';
    for (let i = 0; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        fullTranscript += transcript + ' ';
      } else {
        interim += transcript;
      }
    }
    descField.value = fullTranscript + interim;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      alert('לא ניתנה הרשאה למיקרופון.\nאנא אשר גישה למיקרופון בהגדרות הדפדפן.');
    } else if (event.error === 'no-speech') {
      recStatus.textContent = '🔇 לא זוהה דיבור, נסה שוב';
    }
    stopRecording();
  };

  recognition.onend = () => {
    // If still in recording mode (didn't manually stop), restart
    if (recOn) {
      try { recognition.start(); } catch (e) { stopRecording(); }
      return;
    }
  };

  try {
    recognition.start();
  } catch (e) {
    console.error('Failed to start recognition:', e);
    alert('שגיאה בהפעלת ההקלטה. נסה שוב.');
    resetRecordingUI();
  }
}

async function stopRecording() {
  recOn = false;

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
    recognition = null;
  }

  const recBtn = document.getElementById('recbtn');
  const recTxt = document.getElementById('rectxt');
  const recStatus = document.getElementById('rec-status');
  const descField = document.getElementById('task-desc');

  recBtn.classList.remove('recording');
  recTxt.textContent = '🎙 הקלט משימה';
  descField.classList.remove('transcribing');
  descField.placeholder = 'תאר את המשימה...';

  const spokenText = descField.value.trim();
  if (!spokenText) {
    recStatus.textContent = '🔇 לא זוהה טקסט';
    setTimeout(() => { recStatus.style.display = 'none'; }, 2000);
    return;
  }

  // Parse with Claude AI
  recStatus.textContent = '⏳ מנתח משימה...';
  recStatus.style.display = 'block';

  try {
    const participants = state.participants
      .filter(p => p.selected)
      .map(p => p.name);

    const res = await fetch('/api/parse-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: spokenText, participants }),
    });
    const parsed = await res.json();

    if (parsed.error) throw new Error(parsed.error);

    // Auto-fill description
    if (parsed.description) {
      descField.value = parsed.description;
    }

    // Auto-fill owner dropdown
    if (parsed.owner) {
      const ownerSel = document.getElementById('task-owner');
      const ownerOpts = Array.from(ownerSel.options);
      const match = ownerOpts.find(o =>
        o.value === parsed.owner || o.value.includes(parsed.owner) || parsed.owner.includes(o.value)
      );
      if (match) ownerSel.value = match.value;
    }

    // Auto-fill date
    if (parsed.dueDate) {
      document.getElementById('task-date').value = parsed.dueDate;
    }

    recStatus.textContent = '✅ המשימה נותחה — בדוק ואשר';
    setTimeout(() => { recStatus.style.display = 'none'; }, 3000);
  } catch (err) {
    console.error('Parse error:', err);
    recStatus.textContent = '⚠️ לא הצלחנו לנתח — ערוך ידנית';
    setTimeout(() => { recStatus.style.display = 'none'; }, 3000);
    // Keep raw text in description — user edits manually
  }
}

function resetRecordingUI() {
  recOn = false;
  manualOn = false;
  const recBtn = document.getElementById('recbtn');
  recBtn.classList.remove('recording');
  document.getElementById('rectxt').textContent = '🎙 הקלט משימה';
  document.getElementById('rec-status').style.display = 'none';
  document.getElementById('rec-form').style.display = 'none';
}

function toggleManualTask() {
  // Stop any active recording
  if (recOn) {
    if (recognition) { try { recognition.stop(); } catch (e) {} recognition = null; }
    recOn = false;
    document.getElementById('recbtn').classList.remove('recording');
    document.getElementById('rectxt').textContent = '🎙 הקלט משימה';
    document.getElementById('rec-status').style.display = 'none';
  }

  manualOn = !manualOn;
  const form = document.getElementById('rec-form');
  const descField = document.getElementById('task-desc');
  form.style.display = manualOn ? 'block' : 'none';
  if (manualOn) {
    descField.value = '';
    descField.placeholder = 'תאר את המשימה...';
    descField.classList.remove('transcribing');
    document.getElementById('task-date').value = '';
  }
}

function buildTaskOwnerDropdown() {
  const sel = document.getElementById('task-owner');
  sel.innerHTML = '';
  const selected = state.participants.filter(p => p.selected);
  selected.forEach(p => {
    const opt = document.createElement('option');
    // Store both name and Monday user ID (user-XXXXX -> XXXXX)
    const mondayId = p.id.startsWith('user-') ? p.id.replace('user-', '') : '';
    opt.value = p.name;
    opt.dataset.userId = mondayId;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
}

function addTask() {
  const desc = document.getElementById('task-desc').value.trim();
  const ownerSel = document.getElementById('task-owner');
  const owner = ownerSel.value;
  const selectedOpt = ownerSel.options[ownerSel.selectedIndex];
  const ownerId = selectedOpt ? selectedOpt.dataset.userId || '' : '';
  const date = document.getElementById('task-date').value;

  if (!desc) return;

  state.tasks.push({ desc, owner, ownerId, date });

  document.getElementById('task-desc').value = '';
  document.getElementById('task-date').value = '';

  resetRecordingUI();

  renderTasks();
}

function removeTask(idx) {
  state.tasks.splice(idx, 1);
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('tasks-list');

  if (state.tasks.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#999;font-size:13px;padding:20px 0;">\u05d0\u05d9\u05df \u05de\u05e9\u05d9\u05de\u05d5\u05ea \u05e2\u05d3\u05d9\u05d9\u05df</div>';
    return;
  }

  list.innerHTML = '';
  state.tasks.forEach((t, idx) => {
    const formattedDate = t.date ? formatDateHe(t.date) : '';
    const row = document.createElement('div');
    row.className = 'task-row';
    row.innerHTML = `
      <div class="task-top">
        <div class="task-text">${escapeHtml(t.desc)}</div>
        <button class="task-remove" onclick="removeTask(${idx})">\u2715</button>
      </div>
      <div class="task-meta">
        ${formattedDate ? '<span class="task-date">' + formattedDate + '</span>' : ''}
        ${t.owner ? '<span class="task-owner">' + escapeHtml(t.owner) + '</span>' : ''}
      </div>
    `;
    list.appendChild(row);
  });
}

// ── Screen 4: Preview & Send ──
function buildPreview() {
  const proj = state.selectedProject;
  const date = document.getElementById('meeting-date').value;
  const location = document.getElementById('meeting-location').value;
  const selected = state.participants.filter(p => p.selected);

  document.getElementById('preview-title').textContent =
    '\u05e4\u05e8\u05d5\u05d8\u05d5\u05e7\u05d5\u05dc \u05e4\u05d2\u05d9\u05e9\u05d4' + (proj ? ' \u2014 ' + proj.name : '');
  document.getElementById('preview-date').textContent = date ? formatDateHe(date) : '';
  document.getElementById('preview-location').textContent = location || '';
  document.getElementById('preview-participants').textContent =
    selected.map(p => p.name).join(', ') || '\u05dc\u05d0 \u05e0\u05d1\u05d7\u05e8\u05d5';
  document.getElementById('preview-tasks').textContent =
    state.tasks.length + ' \u05e4\u05e8\u05d9\u05d8\u05d9\u05dd \u2014 \u05d9\u05d5\u05e2\u05dc\u05d5 \u05db\u05e9\u05d5\u05e8\u05d5\u05ea \u05d7\u05d3\u05e9\u05d5\u05ea \u05d1-Monday';
}

async function sendToMonday() {
  const btn = document.getElementById('send-monday-btn');
  const statusEl = document.getElementById('send-status');
  const textEl = document.getElementById('send-monday-text');

  btn.disabled = true;
  textEl.textContent = '\u05e9\u05d5\u05dc\u05d7...';
  statusEl.style.display = 'none';

  try {
    const proj = state.selectedProject;
    const date = document.getElementById('meeting-date').value;
    const location = document.getElementById('meeting-location').value;
    const selected = state.participants.filter(p => p.selected);

    const protocolName = '\u05e4\u05e8\u05d5\u05d8\u05d5\u05e7\u05d5\u05dc' + (proj ? ' \u2014 ' + proj.name : '') + ' \u2014 ' + formatDateHe(date);
    const description = [
      '\u05de\u05d9\u05e7\u05d5\u05dd: ' + (location || '\u05dc\u05d0 \u05e6\u05d5\u05d9\u05df'),
      '\u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd: ' + selected.map(p => p.name).join(', '),
      '\u05de\u05e9\u05d9\u05de\u05d5\u05ea: ' + state.tasks.length,
    ].join('\n');

    // 1. Create protocol item
    const protocolRes = await fetch('/api/protocol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: protocolName, description, date }),
    });
    const protocol = await protocolRes.json();

    if (protocol.error) throw new Error(JSON.stringify(protocol.error));

    // 2. Create tasks on task board linked to the project
    if (state.tasks.length > 0) {
      const tasksPayload = state.tasks.map(t => ({
        name: t.desc + (t.owner ? ' [אחריות: ' + t.owner + ']' : ''),
        owner: t.owner,
        ownerId: t.ownerId,
        date: t.date,
      }));

      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: proj?.id, tasks: tasksPayload }),
      });
    }

    statusEl.className = 'success-msg';
    statusEl.textContent = '\u2705 \u05d4\u05e4\u05e8\u05d5\u05d8\u05d5\u05e7\u05d5\u05dc \u05e0\u05d5\u05e6\u05e8 \u05d1\u05d4\u05e6\u05dc\u05d7\u05d4 \u05d1-Monday.com!';
    statusEl.style.display = 'block';
    textEl.textContent = '\u2713 \u05e0\u05e9\u05dc\u05d7 \u05d1\u05d4\u05e6\u05dc\u05d7\u05d4';
  } catch (err) {
    console.error('Send error:', err);
    statusEl.className = 'error-msg';
    statusEl.textContent = '\u274c \u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05e9\u05dc\u05d9\u05d7\u05d4. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.';
    statusEl.style.display = 'block';
    btn.disabled = false;
    textEl.textContent = 'Monday \u2191 \u05e9\u05dc\u05d7 \u05dc';
  }
}

// ── Document Generation ──
function openDocument() {
  const proj = state.selectedProject;
  const date = document.getElementById('meeting-date').value;
  const location = document.getElementById('meeting-location').value;
  const selected = state.participants.filter(p => p.selected);

  const phase = proj?.columns?.portfolio_project_step?.text || '';

  // Find who is the recorder (first admin-like participant, or first selected)
  const recorder = selected.length > 0 ? selected[0].name : '';

  const protocolData = {
    projectName: proj ? proj.name : '',
    date: date,
    location: location,
    participants: selected.map(p => p.name),
    tasks: state.tasks.map(t => ({
      desc: t.desc,
      owner: t.owner,
      date: t.date,
    })),
    phase: phase,
    recorder: recorder,
  };

  // Store in localStorage for the document page to read
  localStorage.setItem('bringup_protocol', JSON.stringify(protocolData));

  // Open in new tab
  window.open('document.html', '_blank');
}

// ── Helpers ──
function formatDateHe(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
