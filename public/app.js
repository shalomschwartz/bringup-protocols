// ── State ──
const state = {
  projects: [],
  contacts: [],
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
    const [projects, contacts, users] = await Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/contacts').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]);

    state.projects = projects;
    state.contacts = contacts;
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
  sel.innerHTML = '<option value="">— \u05d1\u05d7\u05e8 \u05e4\u05e8\u05d5\u05d9\u05e7\u05d8 —</option>';
  state.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
}

function handleProjectSelect(id) {
  const card = document.getElementById('proj-card');
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

  const status = proj.columns.project_status?.text || '';
  document.getElementById('proj-status').textContent = '\u05e1\u05d8\u05d8\u05d5\u05e1: ' + (status || '\u05dc\u05d0 \u05d4\u05d5\u05d2\u05d3\u05e8');

  const timeline = proj.columns.project_timeline?.text || '';
  document.getElementById('proj-timeline').textContent = timeline ? '\u05e6\u05d9\u05e8 \u05d6\u05de\u05df: ' + timeline : '';

  const badge = document.getElementById('proj-badge');
  badge.textContent = status || '\u05e4\u05e8\u05d5\u05d9\u05e7\u05d8';
}

// ── Screen 2: Participants ──
function buildParticipantsList() {
  state.participants = [];

  // Add contacts
  state.contacts.forEach((c, i) => {
    const title = c.columns.title5?.text || '';
    const email = c.columns.contact_email?.text || '';
    state.participants.push({
      id: 'contact-' + c.id,
      name: c.name,
      role: title || '',
      email: email,
      selected: true,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    });
  });

  // Add users
  state.users.forEach((u, i) => {
    // Skip if already in contacts by name
    if (state.participants.some(p => p.name === u.name)) return;
    state.participants.push({
      id: 'user-' + u.id,
      name: u.name,
      role: '',
      email: u.email,
      selected: false,
      color: AVATAR_COLORS[(i + state.contacts.length) % AVATAR_COLORS.length],
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

function toggleRec() {
  recOn = !recOn;
  document.getElementById('rectxt').textContent = recOn ? '\u05e2\u05e6\u05d5\u05e8 \u05d4\u05e7\u05dc\u05d8\u05d4' : '\u05d4\u05e7\u05dc\u05d8 \u05de\u05e9\u05d9\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4';
  document.getElementById('rec-form').style.display = recOn ? 'block' : 'none';
}

function buildTaskOwnerDropdown() {
  const sel = document.getElementById('task-owner');
  sel.innerHTML = '';
  const selected = state.participants.filter(p => p.selected);
  selected.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
}

function addTask() {
  const desc = document.getElementById('task-desc').value.trim();
  const owner = document.getElementById('task-owner').value;
  const date = document.getElementById('task-date').value;

  if (!desc) return;

  state.tasks.push({ desc, owner, date });

  document.getElementById('task-desc').value = '';
  document.getElementById('task-date').value = '';

  recOn = false;
  document.getElementById('rectxt').textContent = '\u05d4\u05e7\u05dc\u05d8 \u05de\u05e9\u05d9\u05de\u05d4 \u05d7\u05d3\u05e9\u05d4';
  document.getElementById('rec-form').style.display = 'none';

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

    // 2. Create subitems (tasks)
    if (state.tasks.length > 0) {
      const tasksPayload = state.tasks.map(t => ({
        name: t.desc + (t.owner ? ' [\u05d0\u05d7\u05e8\u05d9\u05d5\u05ea: ' + t.owner + ']' : ''),
        owner: t.owner,
        date: t.date,
      }));

      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: protocol.id, tasks: tasksPayload }),
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
