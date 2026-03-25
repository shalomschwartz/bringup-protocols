// ── State ──
const state = {
  projects: [],
  users: [],
  selectedProject: null,
  participants: [],   // { id, name, role, selected, color }
  externalContacts: [],  // { id, name, role, group, selected }
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
    const [projects, users, contacts] = await Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/contacts').then(r => r.json()).catch(() => []),
    ]);

    state.projects = projects;
    state.users = users;
    state.externalContacts = (contacts || []).map(c => ({
      id: c.id, name: c.name, role: c.role || '', group: c.group || '', selected: false,
    }));

    populateProjectDropdown();
    buildParticipantsList();
    buildExternalContactsList();
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
let silenceTimer = null;
const SILENCE_TIMEOUT = 3000; // Auto-stop after 3 seconds of silence

// Check browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function toggleRec() {
  if (recOn) {
    stopRecording();
  } else {
    startRecording();
  }
}

function setRecState(state) {
  const area = document.getElementById('rec-area');
  area.className = 'rec-area rec-' + state;
  const icon = document.getElementById('rec-icon');
  const label = document.getElementById('rec-label');
  const live = document.getElementById('rec-live');
  const result = document.getElementById('rec-result');

  switch (state) {
    case 'idle':
      icon.textContent = '🎙';
      label.textContent = 'לחץ להקלטת משימה';
      live.style.display = 'none';
      result.style.display = 'none';
      break;
    case 'recording':
      icon.textContent = '⏹';
      label.textContent = 'דבר עכשיו — ייעצר אוטומטית';
      live.style.display = 'block';
      result.style.display = 'none';
      document.getElementById('rec-transcript').textContent = 'מקשיב...';
      break;
    case 'processing':
      icon.textContent = '⏳';
      label.textContent = 'מנתח את המשימה...';
      live.style.display = 'none';
      result.style.display = 'none';
      break;
    case 'done':
      icon.textContent = '✅';
      label.textContent = 'משימה נוספה!';
      live.style.display = 'none';
      result.style.display = 'block';
      break;
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

  document.getElementById('rec-form').style.display = 'none';
  setRecState('recording');

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

    const currentText = (fullTranscript + interim).trim();
    document.getElementById('rec-transcript').textContent = currentText || 'מקשיב...';

    // Reset silence timer — user is still speaking
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (recOn && fullTranscript.trim().length > 0) {
        stopRecording();
      }
    }, SILENCE_TIMEOUT);
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      alert('לא ניתנה הרשאה למיקרופון.\nאנא אשר גישה למיקרופון בהגדרות הדפדפן.');
    }
    stopRecording();
  };

  recognition.onend = () => {
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
  clearTimeout(silenceTimer);

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
    recognition = null;
  }

  const spokenText = fullTranscript.trim();
  if (!spokenText) {
    setRecState('idle');
    return;
  }

  setRecState('processing');

  try {
    const selectedParticipants = state.participants.filter(p => p.selected);
    const participantNames = selectedParticipants.map(p => p.name);
    const meetingDate = document.getElementById('meeting-date').value;

    let parsed = null;

    // Try AI parsing first
    try {
      const res = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spokenText, participants: participantNames, meetingDate }),
      });
      const data = await res.json();
      if (!data.error && data.description) {
        parsed = data;
      }
    } catch (err) {
      console.error('AI parse failed, using local fallback:', err);
    }

    // Fallback: local text parsing if AI failed
    if (!parsed) {
      parsed = localParseTask(spokenText, participantNames, meetingDate);
    }

    // Find the matching participant to get their Monday user ID
    const ownerName = parsed.owner || '';
    let ownerId = '';
    if (ownerName) {
      const matchedParticipant = selectedParticipants.find(p =>
        p.name === ownerName || p.name.includes(ownerName) || ownerName.includes(p.name)
      );
      if (matchedParticipant && matchedParticipant.id.startsWith('user-')) {
        ownerId = matchedParticipant.id.replace('user-', '');
      }
    }

    // Auto-add the task directly — zero keyboard interaction
    // Clean the description: strip date/owner text that shouldn't be in the task content
    var cleanDesc = cleanDescription(parsed.description || spokenText, ownerName);

    state.tasks.push({
      desc: cleanDesc,
      owner: ownerName,
      ownerId: ownerId,
      date: parsed.dueDate || '',
    });

    renderTasks();

    // Show result card
    const resultEl = document.getElementById('rec-result');
    let resultHTML = '';
    resultHTML += '<div class="result-row"><span class="result-label">תיאור:</span><span class="result-val">' + escapeHtml((parsed.description || spokenText).substring(0, 50)) + '</span></div>';
    if (ownerName) resultHTML += '<div class="result-row"><span class="result-label">אחריות:</span><span class="result-val">' + escapeHtml(ownerName) + '</span></div>';
    if (parsed.dueDate) resultHTML += '<div class="result-row"><span class="result-label">תאריך יעד:</span><span class="result-val">' + formatDateHe(parsed.dueDate) + '</span></div>';
    resultEl.innerHTML = resultHTML;
    setRecState('done');

    // Reset to idle after 4 seconds
    setTimeout(() => { setRecState('idle'); }, 1000);
  } catch (err) {
    // Last resort: add raw text as task
    console.error('Task parsing completely failed:', err);
    state.tasks.push({ desc: spokenText, owner: '', ownerId: '', date: '' });
    renderTasks();
    setRecState('idle');
  }
}

function resetRecordingUI() {
  recOn = false;
  manualOn = false;
  clearTimeout(silenceTimer);
  setRecState('idle');
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

function cancelManualTask() {
  manualOn = false;
  document.getElementById('rec-form').style.display = 'none';
  document.getElementById('task-desc').value = '';
  document.getElementById('task-date').value = '';
}

function buildExternalContactsList(filter) {
  const container = document.getElementById('external-participants-list');
  if (!container) return;
  if (!state.externalContacts.length) {
    container.innerHTML = '<div style="text-align:center;color:#999;font-size:13px;padding:10px 0;">אין אנשי קשר חיצוניים</div>';
    return;
  }
  const q = (filter || '').trim().toLowerCase();
  const filtered = state.externalContacts
    .map((c, i) => ({ ...c, idx: i }))
    .filter(c => !q || c.name.toLowerCase().startsWith(q) || c.name.split(' ').some(w => w.toLowerCase().startsWith(q)));

  if (!filtered.length) {
    container.innerHTML = '<div style="text-align:center;color:#999;font-size:13px;padding:10px 0;">לא נמצאו תוצאות</div>';
    return;
  }
  container.innerHTML = filtered.map(c => `
    <div class="participant-row" onclick="toggleExtContact(${c.idx})" style="cursor:pointer;">
      <div class="chk ${c.selected ? '' : 'chk-off'}" id="ext-chk-${c.idx}">
        ${c.selected ? '<svg viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
      </div>
      <div class="avatar av-o">${c.name.charAt(0)}</div>
      <div style="flex:1;direction:rtl;"><div class="pname">${c.name}</div><div class="prole">${c.role || c.group || ''}</div></div>
    </div>
  `).join('');
}

function filterExternalContacts() {
  const q = document.getElementById('ext-search')?.value || '';
  buildExternalContactsList(q);
}

function toggleExtContact(idx) {
  state.externalContacts[idx].selected = !state.externalContacts[idx].selected;
  buildExternalContactsList();
  buildTaskOwnerDropdown();
}

async function addNewContact() {
  const name = document.getElementById('new-contact-name').value.trim();
  const phone = document.getElementById('new-contact-phone').value.trim();
  const email = document.getElementById('new-contact-email').value.trim();
  if (!name) return alert('נא להזין שם');

  const btn = document.querySelector('#add-contact-form .btn-primary');
  btn.textContent = 'מוסיף...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email }),
    });
    const newContact = await res.json();
    if (newContact.error) throw new Error(newContact.error);

    state.externalContacts.push({
      id: newContact.id, name: newContact.name || name, role: '', group: '', selected: true,
    });
    buildExternalContactsList();
    buildTaskOwnerDropdown();

    document.getElementById('new-contact-name').value = '';
    document.getElementById('new-contact-phone').value = '';
    document.getElementById('new-contact-email').value = '';
    document.getElementById('add-contact-form').style.display = 'none';
  } catch (err) {
    console.error('Failed to add contact:', err);
    alert('שגיאה בהוספת איש קשר');
  } finally {
    btn.textContent = '+ הוסף';
    btn.disabled = false;
  }
}

function buildTaskOwnerDropdown() {
  const sel = document.getElementById('task-owner');
  sel.innerHTML = '';
  const selected = state.participants.filter(p => p.selected);
  selected.forEach(p => {
    const opt = document.createElement('option');
    const mondayId = p.id.startsWith('user-') ? p.id.replace('user-', '') : '';
    opt.value = p.name;
    opt.dataset.userId = mondayId;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  // Also add selected external contacts
  const extSelected = state.externalContacts.filter(c => c.selected);
  extSelected.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.dataset.contactId = c.id;
    opt.textContent = c.name + (c.role ? ' (' + c.role + ')' : '');
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
    list.innerHTML = '<div style="text-align:center;color:#999;font-size:13px;padding:20px 0;">אין משימות עדיין</div>';
    return;
  }

  list.innerHTML = '';
  state.tasks.forEach((t, idx) => {
    const formattedDate = t.date ? formatDateHe(t.date) : '';
    const row = document.createElement('div');
    row.className = 'task-row';
    row.dataset.idx = idx;

    if (t._editing) {
      // Edit mode
      row.innerHTML = `
        <div class="task-edit-form" style="direction:rtl;">
          <div class="label">תיאור</div>
          <textarea class="input" id="edit-desc-${idx}" rows="2" style="resize:none;margin-bottom:6px;">${escapeHtml(t.desc)}</textarea>
          <div style="display:flex;gap:8px;">
            <div style="flex:1;">
              <div class="label">אחריות</div>
              <select class="select" id="edit-owner-${idx}" style="margin-bottom:0;"></select>
            </div>
            <div style="flex:1;">
              <div class="label">תאריך יעד</div>
              <input type="date" class="input" id="edit-date-${idx}" value="${t.date || ''}" style="margin-bottom:0;" />
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn-primary" style="flex:1;margin-bottom:0;font-size:13px;padding:8px;" onclick="saveTaskEdit(${idx})">✓ שמור</button>
            <button class="btn-secondary" style="flex:1;margin-bottom:0;font-size:13px;padding:8px;" onclick="cancelTaskEdit(${idx})">✕ ביטול</button>
          </div>
        </div>
      `;
      // Populate owner dropdown after DOM is ready
      setTimeout(() => {
        const sel = document.getElementById('edit-owner-' + idx);
        if (sel) {
          const selected = state.participants.filter(p => p.selected);
          selected.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.name;
            sel.appendChild(opt);
          });
          // Also add custom option if owner isn't in participants
          if (t.owner && !selected.find(p => p.name === t.owner)) {
            const opt = document.createElement('option');
            opt.value = t.owner;
            opt.textContent = t.owner;
            sel.appendChild(opt);
          }
          sel.value = t.owner || '';
        }
      }, 0);
    } else {
      // View mode
      row.innerHTML = `
        <div class="task-top">
          <div class="task-text">${escapeHtml(t.desc)}</div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="task-edit-btn" onclick="editTask(${idx})">✏️</button>
            <button class="task-remove" onclick="removeTask(${idx})">✕</button>
          </div>
        </div>
        <div class="task-meta">
          ${formattedDate ? '<span class="task-date">' + formattedDate + '</span>' : ''}
          ${t.owner ? '<span class="task-owner">' + escapeHtml(t.owner) + '</span>' : ''}
        </div>
      `;
    }
    list.appendChild(row);
  });
}

function editTask(idx) {
  state.tasks[idx]._editing = true;
  renderTasks();
}

function cancelTaskEdit(idx) {
  delete state.tasks[idx]._editing;
  renderTasks();
}

function saveTaskEdit(idx) {
  const desc = document.getElementById('edit-desc-' + idx).value.trim();
  const owner = document.getElementById('edit-owner-' + idx).value;
  const date = document.getElementById('edit-date-' + idx).value;

  if (desc) state.tasks[idx].desc = desc;
  state.tasks[idx].owner = owner;
  state.tasks[idx].date = date;

  // Update owner ID
  const matchedP = state.participants.find(p => p.selected && p.name === owner);
  state.tasks[idx].ownerId = matchedP && matchedP.id.startsWith('user-') ? matchedP.id.replace('user-', '') : '';

  delete state.tasks[idx]._editing;
  renderTasks();
}

// ── Screen 4: Preview & Send ──
function buildPreview() {
  const proj = state.selectedProject;
  const date = document.getElementById('meeting-date').value;
  const location = document.getElementById('meeting-location').value;
  const selected = state.participants.filter(p => p.selected);

  document.getElementById('preview-title').textContent =
    'פרוטוקול פגישה' + (proj ? ' — ' + proj.name : '');
  document.getElementById('preview-date').textContent = date ? formatDateHe(date) : '';
  document.getElementById('preview-location').textContent = location || '';
  const extSelected = state.externalContacts.filter(c => c.selected);
  const allNames = [...selected.map(p => p.name), ...extSelected.map(c => c.name)];
  document.getElementById('preview-participants').textContent =
    allNames.join(', ') || 'לא נבחרו';

  // Show summary if provided
  const summaryVal = document.getElementById('meeting-summary').value.trim();
  const summaryRow = document.getElementById('preview-summary-row');
  if (summaryRow) {
    if (summaryVal) {
      summaryRow.style.display = 'flex';
      document.getElementById('preview-summary').textContent = summaryVal.length > 60 ? summaryVal.substring(0, 60) + '...' : summaryVal;
    } else {
      summaryRow.style.display = 'none';
    }
  }

  // Build compact tasks summary
  document.getElementById('preview-task-count').textContent = state.tasks.length;
  const tasksList = document.getElementById('preview-tasks-list');

  if (state.tasks.length === 0) {
    tasksList.innerHTML = '<div style="text-align:center;color:#999;font-size:12px;padding:6px 0;">אין משימות</div>';
  } else {
    tasksList.innerHTML = '';
    state.tasks.forEach((t, i) => {
      const meta = [t.owner, t.date ? formatDateHe(t.date) : ''].filter(Boolean).join(' · ');
      const row = document.createElement('div');
      row.className = 'confirm-task';
      row.innerHTML = `
        <span class="confirm-task-num">${i + 1}.</span>
        <span class="confirm-task-desc">${escapeHtml(cleanDescription(t.desc, t.owner))}</span>
        ${meta ? '<span class="confirm-task-meta">' + escapeHtml(meta) + '</span>' : ''}
      `;
      tasksList.appendChild(row);
    });
  }

  // Also store protocol data for PDF download
  storeProtocolData();
}

function storeProtocolData() {
  const proj = state.selectedProject;
  const date = document.getElementById('meeting-date').value;
  const location = document.getElementById('meeting-location').value;
  const summary = document.getElementById('meeting-summary').value;
  const selected = state.participants.filter(p => p.selected);
  const phase = proj?.columns?.portfolio_project_step?.text || '';
  const recorder = selected.length > 0 ? selected[0].name : '';

  const protocolData = {
    projectName: proj ? proj.name : '',
    date,
    location,
    summary,
    participants: [...selected.map(p => p.name), ...state.externalContacts.filter(c => c.selected).map(c => c.name)],
    tasks: state.tasks.map(t => ({ desc: t.desc, owner: t.owner, date: t.date })),
    phase,
    recorder,
  };
  localStorage.setItem('bringup_protocol', JSON.stringify(protocolData));
}

async function downloadDocumentPDF() {
  const btn = document.querySelector('[onclick="downloadDocumentPDF()"]');
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.textContent = '⏳ מייצר PDF...'; btn.disabled = true; }

  storeProtocolData();
  const data = JSON.parse(localStorage.getItem('bringup_protocol'));

  try {
    // Load libraries dynamically (same approach as meeting-chatbot)
    const [html2canvas, jsPDFModule] = await Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', 'html2canvas'),
      loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js', 'jspdf'),
    ]);
    const { jsPDF } = window.jspdf;

    // Convert bg images to base64 (bypass CORS)
    const [bg1, bg2] = await Promise.all([
      toBase64('bgimg/bg00001.jpg'),
      toBase64('bgimg/bg00002.jpg'),
    ]);

    const docHTML = buildPdfHtml(data, bg1, bg2);
    const parser = new DOMParser();
    const parsed = parser.parseFromString(docHTML, 'text/html');

    // Hidden render container
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:0;width:794px;z-index:-1;pointer-events:none;';
    document.body.appendChild(container);

    parsed.querySelectorAll('body > div').forEach(page => {
      container.appendChild(document.adoptNode(page));
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [794, 1123] });
    const pages = Array.from(container.children);

    for (let i = 0; i < pages.length; i++) {
      const canvas = await window.html2canvas(pages[i], {
        scale: 2, useCORS: false,
        width: 794, height: 1123,
        windowWidth: 794, windowHeight: 1123,
        scrollX: 0, scrollY: 0,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 794, 1123);
    }

    document.body.removeChild(container);
    pdf.save((data.projectName || 'protocol') + ' - סיכום פגישה ' + formatDateHe(data.date) + '.pdf');

    if (btn) { btn.textContent = '✓ PDF הורד'; btn.disabled = false; }
    setTimeout(() => { if (btn) btn.textContent = origText; }, 3000);
  } catch (e) {
    console.error('PDF error:', e);
    if (btn) { btn.textContent = origText; btn.disabled = false; }
    alert('שגיאה בייצור PDF: ' + (e.message || e));
  }
}

function buildDocxDocument(data, D) {
  var participants = (data.participants || []).join(', ');
  var formattedDate = formatDateHe(data.date);

  // RTL helper for paragraphs
  var rtlP = function(txt, opts) {
    opts = opts || {};
    return new D.Paragraph(Object.assign({ alignment: D.AlignmentType.RIGHT }, opts, {
      children: [new D.TextRun({ text: txt, font: 'Arial', size: opts.sz || 24, rightToLeft: true, bold: opts.bold || false })]
    }));
  };

  // Table cell helper
  var hdrFill = { fill: '1B2A4A', type: D.ShadingType.CLEAR };
  var hdrMar = { top: 60, bottom: 60, left: 80, right: 80 };
  var dataMar = { top: 40, bottom: 40, left: 80, right: 80 };
  var border = { style: D.BorderStyle.SINGLE, size: 1, color: '000000' };
  var borders = { top: border, bottom: border, left: border, right: border };

  // RTL table: columns defined right-to-left visually
  // Visual order (right to left): ס'פ | הסיכום | לביצוע עד | אחריות
  var headerRow = new D.TableRow({
    tableHeader: true,
    children: [
      new D.TableCell({ borders: borders, width: { size: 1800, type: D.WidthType.DXA }, shading: hdrFill, margins: hdrMar, children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: 'אחריות', bold: true, font: 'Arial', size: 22, color: 'FFFFFF', rightToLeft: true })] })] }),
      new D.TableCell({ borders: borders, width: { size: 1800, type: D.WidthType.DXA }, shading: hdrFill, margins: hdrMar, children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: 'לביצוע עד', bold: true, font: 'Arial', size: 22, color: 'FFFFFF', rightToLeft: true })] })] }),
      new D.TableCell({ borders: borders, width: { size: 5000, type: D.WidthType.DXA }, shading: hdrFill, margins: hdrMar, children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: 'הסיכום', bold: true, font: 'Arial', size: 22, color: 'FFFFFF', rightToLeft: true })] })] }),
      new D.TableCell({ borders: borders, width: { size: 800, type: D.WidthType.DXA }, shading: hdrFill, margins: hdrMar, children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: "ס'פ", bold: true, font: 'Arial', size: 22, color: 'FFFFFF', rightToLeft: true })] })] }),
    ]
  });

  var taskRows = (data.tasks || []).map(function(t, i) {
    var desc = cleanDescription(t.desc || '', t.owner || '');
    return new D.TableRow({
      children: [
        new D.TableCell({ borders: borders, width: { size: 1800, type: D.WidthType.DXA }, margins: dataMar, children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: t.owner || '', font: 'Arial', size: 22, rightToLeft: true })] })] }),
        new D.TableCell({ borders: borders, width: { size: 1800, type: D.WidthType.DXA }, margins: dataMar, children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: t.date ? formatDateHe(t.date) : '', font: 'Arial', size: 22 })] })] }),
        new D.TableCell({ borders: borders, width: { size: 5000, type: D.WidthType.DXA }, margins: dataMar, children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ text: desc, font: 'Arial', size: 22, rightToLeft: true })] })] }),
        new D.TableCell({ borders: borders, width: { size: 800, type: D.WidthType.DXA }, margins: dataMar, children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: String(i + 1), font: 'Arial', size: 22 })] })] }),
      ]
    });
  });

  var children = [
    // Company header — styled text with dark blue background
    new D.Paragraph({
      spacing: { after: 0 },
      shading: { fill: '1B2A4A', type: D.ShadingType.CLEAR },
      children: [
        new D.TextRun({ text: '  REUVEN HOCH', font: 'Arial', size: 32, bold: true, color: 'FFFFFF' }),
        new D.TextRun({ text: 'M', font: 'Arial', size: 32, bold: true, color: 'E24B4A' }),
        new D.TextRun({ text: 'AN 1990 Ltd', font: 'Arial', size: 32, bold: true, color: 'FFFFFF' }),
      ]
    }),
    new D.Paragraph({
      spacing: { before: 0, after: 200 },
      shading: { fill: '1B2A4A', type: D.ShadingType.CLEAR },
      children: [
        new D.TextRun({ text: '  B u i l d i n g   C o n s t r u c t i o n', font: 'Arial', size: 18, color: 'CCCCCC' }),
      ]
    }),
    // Date
    new D.Paragraph({ spacing: { before: 200 }, children: [new D.TextRun({ text: formattedDate, font: 'Arial', size: 24 })] }),
    new D.Paragraph({ spacing: { before: 200 } }),
    // לכבוד
    rtlP('לכבוד רשימת התפוצה'),
    // הנדון
    new D.Paragraph({
      alignment: D.AlignmentType.CENTER, spacing: { before: 100 },
      children: [
        new D.TextRun({ text: 'הנדון – ', font: 'Arial', size: 24, rightToLeft: true }),
        new D.TextRun({ text: (data.projectName || '') + ' – סיכום פגישה שבועית מתאריך ' + formattedDate, font: 'Arial', size: 24, bold: true, underline: {}, rightToLeft: true }),
      ]
    }),
    // משתתפים
    rtlP('משתתפים : ' + participants, { spacing: { before: 100 } }),
  ];

  if (data.location) children.push(rtlP('מיקום הפגישה : ' + data.location));
  if (data.summary) children.push(rtlP('בשלב ביצוע הפגישה : ' + data.summary));

  children.push(rtlP('להלן הסיכומים:-', { spacing: { before: 100 } }));
  children.push(new D.Table({
    width: { size: 9400, type: D.WidthType.DXA },
    columnWidths: [1800, 1800, 5000, 800],
    rows: [headerRow].concat(taskRows),
  }));
  children.push(new D.Paragraph({ spacing: { before: 400 } }));
  children.push(rtlP('רשם: ' + (data.recorder || ''), { sz: 22 }));
  children.push(rtlP('תפוצה : משתתפי הפגישה' + (participants ? ', ' + participants : ''), { sz: 22 }));

  return new D.Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 24, rightToLeft: true },
          paragraph: { alignment: D.AlignmentType.RIGHT, rightToLeft: true },
        },
      },
      paragraphStyles: [{
        id: 'Normal',
        name: 'Normal',
        run: { font: 'Arial', size: 24, rightToLeft: true },
        paragraph: { alignment: D.AlignmentType.RIGHT },
      }],
    },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1200, right: 1000, bottom: 1000, left: 1000 } },
        bidi: true,
      },
      children: children,
      footers: {
        default: new D.Footer({
          children: [new D.Paragraph({
            alignment: D.AlignmentType.CENTER,
            children: [new D.TextRun({ text: 'P.O.B. 3095 Herzliya | Tel. 09-9514920 | Fax. 09-9581351 | dan@dhbld.com', font: 'Arial', size: 18, color: 'E24B4A' })],
          })],
        }),
      },
    }],
  });
}

async function generateDocxBlob() {
  storeProtocolData();
  var data = JSON.parse(localStorage.getItem('bringup_protocol'));
  await loadScript('https://cdn.jsdelivr.net/npm/docx@9.0.2/build/index.umd.js', 'docx');
  var D = window.docx;
  var doc = buildDocxDocument(data, D);
  return D.Packer.toBlob(doc);
}

async function generatePdfBlob() {
  storeProtocolData();
  var data = JSON.parse(localStorage.getItem('bringup_protocol'));

  await Promise.all([
    loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', 'html2canvas'),
    loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js', 'jspdf'),
  ]);
  var jsPDF = window.jspdf.jsPDF;

  var bgArr = await Promise.all([toBase64('bgimg/bg00001.jpg'), toBase64('bgimg/bg00002.jpg')]);
  var docHTML = buildPdfHtml(data, bgArr[0], bgArr[1]);
  var parser = new DOMParser();
  var parsed = parser.parseFromString(docHTML, 'text/html');

  var container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;width:794px;z-index:-1;pointer-events:none;';
  document.body.appendChild(container);

  parsed.querySelectorAll('body > div').forEach(function(page) {
    container.appendChild(document.adoptNode(page));
  });

  var pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [794, 1123] });
  var pages = Array.from(container.children);

  for (var i = 0; i < pages.length; i++) {
    var canvas = await window.html2canvas(pages[i], {
      scale: 2, useCORS: false,
      width: 794, height: 1123,
      windowWidth: 794, windowHeight: 1123,
      scrollX: 0, scrollY: 0,
    });
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 794, 1123);
  }

  document.body.removeChild(container);
  return pdf.output('blob');
}

async function downloadDocumentDOCX() {
  var btn = document.querySelector('[onclick="downloadDocumentDOCX()"]');
  var origText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '<span class="action-icon">⏳</span><span class="action-text"><span class="action-main">מייצר Word...</span></span>'; btn.disabled = true; }

  storeProtocolData();
  var data = JSON.parse(localStorage.getItem('bringup_protocol'));

  try {
    await loadScript('https://cdn.jsdelivr.net/npm/docx@9.0.2/build/index.umd.js', 'docx');
    var D = window.docx;
    var doc = buildDocxDocument(data, D);

    var blob = await D.Packer.toBlob(doc);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (data.projectName || 'protocol') + ' - סיכום פגישה ' + formatDateHe(data.date) + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (btn) { btn.innerHTML = '<span class="action-icon">✓</span><span class="action-text"><span class="action-main">Word הורד</span></span>'; btn.disabled = false; }
    setTimeout(function() { if (btn) btn.innerHTML = origText; }, 3000);
  } catch (e) {
    console.error('DOCX error:', e);
    if (btn) { btn.innerHTML = origText; btn.disabled = false; }
    alert('שגיאה בייצור Word: ' + (e.message || e));
  }
}

function loadScript(src, globalName) {
  return new Promise((resolve, reject) => {
    if (window[globalName]) { resolve(window[globalName]); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve(window[globalName]);
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

function toBase64(url) {
  return fetch(url).then(r => r.blob()).then(blob => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  }));
}

function buildPdfHtml(data, bg1, bg2) {
  // === EXACT constants from the working chatbot ===
  const PAGE_W       = 794;
  const PAGE_H       = 1123;
  const TABLE_LEFT   = 67.757309;
  const TABLE_W      = 643.454102;
  const HEADER_ROW_H = 27.362671;

  // Column widths (physical left→right): אחריות | לביצוע עד | הסיכום | ס'פ
  const COL_RESP = 95;
  const COL_DATE = 95;
  const COL_DESC = 407;
  const COL_NUM  = 46;

  // Page 1: table area — dynamic top, fixed bottom boundary
  const P1_TABLE_TOP_DEFAULT = 324.577484;
  const P1_TABLE_BOTTOM = 987.77;   // table ends here (leaves room for footer)
  const P1_MAX = 10;

  // Page 2: table near top after logo
  const P2_TABLE_TOP = 128;
  const P2_TABLE_BOTTOM = 987.77;
  const P2_MAX = 5;

  var formattedDate = formatDateHe(data.date);
  var participants = (data.participants || []).join(', ');
  var tasks = data.tasks || [];
  var pageStyle = 'width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;position:relative;overflow:hidden;';
  var bgStyle = 'position:absolute;top:0;left:0;width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;z-index:0;';
  var txtS = 'z-index:1;font-size:14px;font-family:Arial,sans-serif;';
  var cellS = 'vertical-align:middle;padding:3px 4px;font-size:14px;font-family:Arial,sans-serif;background:white;border:1px solid #000;';

  // === Table builders (identical to chatbot) ===
  var tdStyle = function(w, align) {
    return 'width:' + w + 'px;text-align:' + (align || 'center') + ';' + cellS;
  };

  function th(w, label) {
    return '<th style="width:' + w + 'px;border:1px solid #000;font-size:14px;font-family:Arial,sans-serif;font-weight:bold;text-align:center;vertical-align:middle;padding:2px 4px;background:white;">' + label + '</th>';
  }

  function makeRows(tArr, startIdx, rowH, maxRows) {
    var filled = '';
    tArr.forEach(function(t, i) {
      filled += '<tr style="height:' + rowH + 'px;">';
      filled += '<td style="' + tdStyle(COL_RESP) + 'word-wrap:break-word;">' + escapeHtml(t.owner || '') + '</td>';
      filled += '<td style="' + tdStyle(COL_DATE) + '">' + (t.date ? formatDateHe(t.date) : '') + '</td>';
      filled += '<td style="' + tdStyle(COL_DESC, 'right') + 'padding:3px 8px;direction:rtl;word-wrap:break-word;">' + escapeHtml(cleanDescription(t.desc || '', t.owner || '')) + '</td>';
      filled += '<td style="' + tdStyle(COL_NUM) + '">' + (startIdx + i + 1) + '</td>';
      filled += '</tr>';
    });
    return filled;
  }

  function makeTable(top, rows) {
    return '<table style="position:absolute;top:' + top + 'px;left:' + TABLE_LEFT + 'px;width:' + TABLE_W + 'px;border-collapse:collapse;z-index:1;direction:ltr;">'
      + '<thead><tr style="height:' + HEADER_ROW_H + 'px;">'
      + th(COL_RESP, 'אחריות') + th(COL_DATE, 'לביצוע עד') + th(COL_DESC, 'הסיכום') + th(COL_NUM, "ס'פ")
      + '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  // === FIXED positions matching the original PDF template (like chatbot) ===
  // No dynamic calculations — every element at a known pixel position
  var headerHtml = '';
  if (data.location) {
    headerHtml += '<span style="position:absolute;top:262px;right:26px;' + txtS + 'direction:rtl;">מיקום הפגישה : ' + escapeHtml(data.location) + '</span>';
  }
  if (data.summary) {
    headerHtml += '<span style="position:absolute;top:282px;right:26px;left:66px;' + txtS + 'direction:rtl;line-height:1.4;">בשלב ביצוע הפגישה : ' + escapeHtml(data.summary) + '</span>';
  }
  headerHtml += '<span style="position:absolute;top:302px;right:26px;' + txtS + 'direction:rtl;">להלן הסיכומים:-</span>';

  // Table at fixed position (matching chatbot P1_TABLE_TOP)
  var tableTop = P1_TABLE_TOP_DEFAULT;

  // Row height to fill space between table top and footer area (like chatbot)
  var p1DataH = P1_TABLE_BOTTOM - tableTop - HEADER_ROW_H;
  var p1RowH = p1DataH / P1_MAX;

  var p2DataH = P2_TABLE_BOTTOM - P2_TABLE_TOP - HEADER_ROW_H;
  var p2RowH = p2DataH / P2_MAX;

  // Split tasks between pages
  var p1Tasks = tasks.slice(0, P1_MAX);
  var p2Tasks = tasks.slice(P1_MAX, P1_MAX + P2_MAX);
  var needsP2 = tasks.length > P1_MAX;

  // === Build pages (same structure as chatbot) ===
  var page1 = '<div style="' + pageStyle + '">'
    + '<img style="' + bgStyle + '" src="' + bg1 + '" />'
    + '<span style="position:absolute;top:132.6px;left:66.5px;' + txtS + 'direction:ltr;">' + formattedDate + '</span>'
    + '<span style="position:absolute;top:165.6px;right:26px;' + txtS + 'direction:rtl;">לכבוד רשימת התפוצה</span>'
    + '<div style="position:absolute;top:199.9px;left:0;width:' + PAGE_W + 'px;text-align:center;' + txtS + 'direction:rtl;">הנדון – <strong><u>' + escapeHtml(data.projectName || '') + ' – סיכום פגישה שבועית מתאריך ' + formattedDate + '</u></strong></div>'
    + '<span style="position:absolute;top:234.5px;right:26px;' + txtS + 'direction:rtl;">משתתפים : ' + escapeHtml(participants) + '</span>'
    + headerHtml
    + makeTable(tableTop, makeRows(p1Tasks, 0, p1RowH, P1_MAX))
    + '</div>';

  var page2 = '';
  if (needsP2) {
    page2 = '<div style="' + pageStyle + '">'
      + '<img style="' + bgStyle + '" src="' + bg2 + '" />'
      + makeTable(P2_TABLE_TOP, makeRows(p2Tasks, P1_MAX, p2RowH, P2_MAX))
      + '</div>';
  }

  // Footer positioned right below the actual tasks (not empty rows)
  var footerTop;
  if (needsP2) {
    footerTop = P2_TABLE_TOP + HEADER_ROW_H + (p2Tasks.length * p2RowH) + 15;
  } else {
    footerTop = tableTop + HEADER_ROW_H + (p1Tasks.length * p1RowH) + 15;
  }
  // Don't go below the letterhead contact info area
  footerTop = Math.min(footerTop, PAGE_H - 85);

  // White cover div to hide the background image below the table
  var coverDiv = '';
  var actualTaskCount = needsP2 ? p2Tasks.length : p1Tasks.length;
  var actualTableTop = needsP2 ? P2_TABLE_TOP : tableTop;
  var actualRowH = needsP2 ? p2RowH : p1RowH;
  var tableBottom = actualTableTop + HEADER_ROW_H + (actualTaskCount * actualRowH);
  var coverBottom = PAGE_H - 65; // just above letterhead contact info
  if (coverBottom > tableBottom) {
    coverDiv = '<div style="position:absolute;top:' + tableBottom + 'px;left:0;width:' + PAGE_W + 'px;height:' + (coverBottom - tableBottom) + 'px;background:white;z-index:2;"></div>';
  }

  var footerHtml = '<div style="position:absolute;top:' + footerTop + 'px;right:26px;' + txtS + 'font-size:13px;direction:rtl;line-height:1.8;z-index:3;">'
    + '<div>רשם: ' + escapeHtml(data.recorder || '') + '</div>'
    + '<div>תפוצה : משתתפי הפגישה' + (participants ? ', ' + escapeHtml(participants) : '') + '</div></div>';

  if (needsP2) {
    page2 = page2.slice(0, -6) + coverDiv + footerHtml + '</div>';
  } else {
    page1 = page1.slice(0, -6) + coverDiv + footerHtml + '</div>';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;">' + page1 + page2 + '</body></html>';
}

async function sendToMonday() {
  const btn = document.getElementById('send-monday-btn');
  const statusEl = document.getElementById('send-status');
  const textEl = document.getElementById('send-monday-text');

  btn.disabled = true;
  textEl.textContent = 'שולח...';
  statusEl.style.display = 'none';

  try {
    const proj = state.selectedProject;
    const date = document.getElementById('meeting-date').value;
    const location = document.getElementById('meeting-location').value;
    const selected = state.participants.filter(p => p.selected);

    const protocolName = 'פרוטוקול' + (proj ? ' — ' + proj.name : '') + ' — ' + formatDateHe(date);
    const summary = document.getElementById('meeting-summary').value;

    // Find recorder's Monday user ID
    const recorder = selected.length > 0 ? selected[0] : null;
    const recorderId = recorder && recorder.id.startsWith('user-') ? recorder.id.replace('user-', '') : '';

    // 1. Create tasks first to get their IDs
    let taskIds = [];
    if (state.tasks.length > 0) {
      const tasksPayload = state.tasks.map(t => ({
        name: cleanDescription(t.desc, t.owner),
        owner: t.owner,
        ownerId: t.ownerId,
        date: t.date,
      }));

      const tasksRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: proj?.id, tasks: tasksPayload }),
      });
      const tasksResult = await tasksRes.json();

      // Collect created task IDs
      taskIds = tasksResult
        .filter(r => r && r.id)
        .map(r => r.id);
    }

    // 2. Create protocol item on board 1718595738 with links to project and tasks
    const protocolRes = await fetch('/api/protocol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: protocolName,
        date,
        location,
        summary,
        projectId: proj?.id || '',
        recorderId,
        taskIds,
        externalContactIds: state.externalContacts.filter(c => c.selected).map(c => c.id),
      }),
    });
    const protocol = await protocolRes.json();

    if (protocol.error) throw new Error(JSON.stringify(protocol.error));

    const protocolItemId = protocol.id || (protocol.data && protocol.data.create_item && protocol.data.create_item.id);

    // 3. Generate Word doc and upload to protocol item
    if (protocolItemId) {
      textEl.textContent = 'מעלה Word...';
      try {
        var docxBlob = await generateDocxBlob();
        if (docxBlob) {
          var reader = new FileReader();
          var docxBase64 = await new Promise(function(resolve) {
            reader.onload = function() { resolve(reader.result.split(',')[1]); };
            reader.readAsDataURL(docxBlob);
          });
          var docxFilename = (proj ? proj.name : 'פרוטוקול') + '_' + formatDateHe(date).replace(/\./g, '-') + '.docx';

          await fetch('/api/upload-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: protocolItemId, filename: docxFilename, fileBase64: docxBase64 }),
          });
        }
      } catch (docErr) {
        console.error('Word upload failed (non-critical):', docErr);
      }
    }

    statusEl.className = 'success-msg';
    statusEl.textContent = '✅ הפרוטוקול נוצר בהצלחה ב-Monday.com!';
    statusEl.style.display = 'block';
    textEl.textContent = '✓ נשלח בהצלחה';
  } catch (err) {
    console.error('Send error:', err);
    statusEl.className = 'error-msg';
    statusEl.textContent = '❌ שגיאה בשליחה. נסה שוב.';
    statusEl.style.display = 'block';
    btn.disabled = false;
    textEl.textContent = 'שלח ל Monday ↑';
  }
}

// ── Local task parser (fallback when AI is unavailable) ──
// Post-processing: strip date/owner text from description (runs after BOTH AI and local parsing)
function cleanDescription(desc, ownerName) {
  var clean = desc;

  // Remove owner patterns: "באחריות X", "אחריות של X"
  clean = clean.replace(/(?:באחריות|אחריות של?)\s+\S+(?:\s+\S+)?/gi, '');

  // Remove owner first name at start of sentence (e.g. "דני צריך..." → "צריך...")
  if (ownerName) {
    var firstName = ownerName.split(' ')[0];
    if (firstName.length > 1) {
      clean = clean.replace(new RegExp('^' + firstName + '\\s+', ''), '');
    }
  }

  // Remove Hebrew month date patterns: "עד ה-30 למרץ 2027", "ל-30 למרץ", "בתאריך 28 למרץ"
  var monthWords = 'ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר';
  clean = clean.replace(new RegExp('(?:עד\\s+(?:ל?תאריך\\s+)?)?(?:[הל][\\-\\s]?)?\\d{1,2}\\s+(?:ל|ב|של\\s+)?(?:' + monthWords + ')(?:\\s+\\d{2,4})?', 'g'), '');

  // Remove Hebrew ordinal date patterns: "הראשון ליולי 2026"
  var ordWords = 'ראשון|הראשון|שני|השני|שלישי|השלישי|רביעי|הרביעי|חמישי|החמישי|שישי|השישי|שביעי|השביעי|שמיני|השמיני|תשיעי|התשיעי|עשירי|העשירי|עשרים|שלושים';
  clean = clean.replace(new RegExp('(?:עד\\s+)?(?:' + ordWords + ')\\s+(?:ל|ב|של\\s+)?(?:' + monthWords + ')(?:\\s+\\d{2,4})?', 'g'), '');

  // Remove numeric date patterns: "עד ל-23 ל-12 2018", "עד ה-23 ל-12 2027"
  clean = clean.replace(/(?:עד|בתאריך|לתאריך)\s+(?:ל?תאריך\s+)?(?:[הל][\-\s]?)?\d{1,2}\s+(?:[הל][\-\s]?)?\d{1,2}(?:\s+\d{2,4})?/g, '');

  // Remove slash/dot dates: "30/03/2027", "30.03.2027"
  clean = clean.replace(/(?:עד\s+)?\d{1,2}[\/\.]\d{1,2}(?:[\/\.]\d{2,4})?/g, '');

  // Remove "מחר", "עד מחר", "עד סוף השבוע", "יום ראשון/שני/etc."
  clean = clean.replace(/(?:עד\s+)?מחר/g, '');
  clean = clean.replace(/(?:עד\s+)?סוף השבוע/g, '');
  clean = clean.replace(/(?:עד\s+)?יום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?:\s+הבא)?/g, '');

  // Remove trailing dangling conjunctions/prepositions
  clean = clean.replace(/\s+(ו|עד|את|של|ל|ב)\s*$/g, '');
  clean = clean.replace(/\s{2,}/g, ' ').trim();

  return clean || desc;
}

function localParseTask(text, participantNames, meetingDate) {
  const result = { description: text, owner: '', dueDate: '' };

  // Extract owner: look for "באחריות X", "אחריות X", or match participant first name
  const ownerMatch = text.match(/(?:באחריות|אחריות)\s+([^\s,\.]+(?:\s+[^\s,\.]+)?)/);
  if (ownerMatch) {
    const spoken = ownerMatch[1].trim();
    const matched = participantNames.find(p =>
      p === spoken || p.includes(spoken) || spoken.includes(p.split(' ')[0])
    );
    if (matched) {
      result.owner = matched;
      // Clean owner mention from description
      result.description = text.replace(/(?:באחריות|אחריות)\s+[^\s,\.]+(?:\s+[^\s,\.]+)?/, '').trim();
    }
  }

  // If no explicit owner pattern, check if any participant name appears in the text
  if (!result.owner) {
    for (const name of participantNames) {
      const firstName = name.split(' ')[0];
      if (text.includes(firstName) && firstName.length > 1) {
        result.owner = name;
        break;
      }
    }
  }

  // Extract date
  const refDate = meetingDate ? new Date(meetingDate) : new Date();
  const refYear = refDate.getFullYear();

  // Hebrew month names to numbers
  const hebrewMonths = {
    'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'מרס': '03', 'אפריל': '04',
    'מאי': '05', 'יוני': '06', 'יולי': '07', 'אוגוסט': '08',
    'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12',
  };

  // Hebrew ordinal/cardinal number words → digits
  const hebrewNumbers = {
    'ראשון': 1, 'הראשון': 1, 'אחד': 1, 'אחת': 1,
    'שני': 2, 'השני': 2, 'שנייה': 2, 'שתיים': 2,
    'שלישי': 3, 'השלישי': 3, 'שלוש': 3, 'שלושה': 3,
    'רביעי': 4, 'הרביעי': 4, 'ארבע': 4, 'ארבעה': 4,
    'חמישי': 5, 'החמישי': 5, 'חמש': 5, 'חמישה': 5,
    'שישי': 6, 'השישי': 6, 'שש': 6, 'שישה': 6,
    'שביעי': 7, 'השביעי': 7, 'שבע': 7, 'שבעה': 7,
    'שמיני': 8, 'השמיני': 8, 'שמונה': 8,
    'תשיעי': 9, 'התשיעי': 9, 'תשע': 9, 'תשעה': 9,
    'עשירי': 10, 'העשירי': 10, 'עשר': 10, 'עשרה': 10,
    'עשרים': 20, 'שלושים': 30,
  };

  // Helper: resolve a day token (digit or Hebrew word) to a number
  function resolveDay(token) {
    if (!token) return 0;
    token = token.trim().replace(/^[הל][\-]?/, '');
    if (/^\d+$/.test(token)) return parseInt(token, 10);
    if (hebrewNumbers[token]) return hebrewNumbers[token];
    // Compound: "עשרים ושלוש" → look for base in the token
    for (var key in hebrewNumbers) {
      if (token.includes(key)) return hebrewNumbers[key];
    }
    return 0;
  }

  // Helper: resolve month from token (strip leading ל/ב and look up)
  function resolveMonth(token) {
    if (!token) return '';
    token = token.trim().replace(/^[לב]/, '');
    return hebrewMonths[token] || '';
  }

  // Pattern 1: "[עד/ב/ל] [ה]DAY [ל/ב]MONTH [YEAR]" — DAY can be digit or Hebrew word
  // Examples: "עד ה-25 למרץ 2026", "הראשון ליולי 2026", "בתאריך 28 למרץ", "ה-3 לאפריל"
  var dayWords = Object.keys(hebrewNumbers).join('|');
  var monthWords = Object.keys(hebrewMonths).join('|');
  var dateRegex = new RegExp('(?:עד\\s+(?:ל?תאריך\\s+)?)?(?:[הל][\\-\\s]?)?(\\d{1,2}|' + dayWords + ')\\s+(?:ל|ב|של\\s+)?(' + monthWords + ')(?:\\s+(\\d{2,4}))?', '');
  var hebrewMonthMatch = text.match(dateRegex);
  if (hebrewMonthMatch) {
    var day = resolveDay(hebrewMonthMatch[1]);
    var monthNum = hebrewMonths[hebrewMonthMatch[2]];
    if (day > 0 && day <= 31 && monthNum) {
      var year = hebrewMonthMatch[3] ? (hebrewMonthMatch[3].length === 2 ? '20' + hebrewMonthMatch[3] : hebrewMonthMatch[3]) : String(refYear);
      result.dueDate = year + '-' + monthNum + '-' + String(day).padStart(2, '0');
      result.description = result.description.replace(hebrewMonthMatch[0], ' ').trim();
    }
  }

  // Pattern 2: עד ה-23 ל-12 or עד ה 23 ל 12 (numeric day + numeric month)
  if (!result.dueDate) {
    var dateMatch1 = text.match(/(?:עד|בתאריך|לתאריך)\s+(?:ל?תאריך\s+)?(?:[הל][\-\s]?)?(\d{1,2})\s+(?:[הל][\-\s]?)?(\d{1,2})(?:\s+(\d{2,4}))?/);
    if (dateMatch1) {
      var d1 = dateMatch1[1].padStart(2, '0');
      var m1 = dateMatch1[2].padStart(2, '0');
      var y1 = dateMatch1[3] ? (dateMatch1[3].length === 2 ? '20' + dateMatch1[3] : dateMatch1[3]) : String(refYear);
      result.dueDate = y1 + '-' + m1 + '-' + d1;
      result.description = result.description.replace(dateMatch1[0], '').trim();
    }
  }

  // Pattern 3: עד DD/MM/YYYY or DD.MM.YYYY
  if (!result.dueDate) {
    var dateMatch2 = text.match(/(?:עד\s+)?(\d{1,2})[\/\.](\d{1,2})(?:[\/\.](\d{2,4}))?/);
    if (dateMatch2) {
      var d2 = dateMatch2[1].padStart(2, '0');
      var m2 = dateMatch2[2].padStart(2, '0');
      var y2 = dateMatch2[3] ? (dateMatch2[3].length === 2 ? '20' + dateMatch2[3] : dateMatch2[3]) : String(refYear);
      result.dueDate = y2 + '-' + m2 + '-' + d2;
      result.description = result.description.replace(dateMatch2[0], '').trim();
    }
  }

  // Pattern 4: Hebrew day names — "יום ראשון", "יום שני", etc.
  if (!result.dueDate) {
    var dayNames = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };
    var dayNameMatch = text.match(/יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/);
    if (dayNameMatch) {
      var target = dayNames[dayNameMatch[1]];
      var next = new Date(refDate);
      var diff = (target - next.getDay() + 7) % 7;
      if (diff === 0) diff = 7; // next week
      next.setDate(next.getDate() + diff);
      result.dueDate = next.toISOString().split('T')[0];
    }
  }

  // Pattern 5: "מחר", "עד מחר"
  if (!result.dueDate && /מחר/.test(text)) {
    var tomorrow = new Date(refDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    result.dueDate = tomorrow.toISOString().split('T')[0];
  }

  // Pattern 6: "עד סוף השבוע"
  if (!result.dueDate && /סוף השבוע/.test(text)) {
    var friday = new Date(refDate);
    friday.setDate(friday.getDate() + (5 - friday.getDay() + 7) % 7);
    result.dueDate = friday.toISOString().split('T')[0];
  }

  // Clean up description
  result.description = result.description.replace(/\s{2,}/g, ' ').trim();
  if (!result.description) result.description = text;

  return result;
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
