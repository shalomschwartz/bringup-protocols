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
    state.tasks.push({
      desc: parsed.description || spokenText,
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
    setTimeout(() => { setRecState('idle'); }, 4000);
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
  document.getElementById('preview-participants').textContent =
    selected.map(p => p.name).join(', ') || 'לא נבחרו';

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
        <span class="confirm-task-desc">${escapeHtml(t.desc)}</span>
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
    participants: selected.map(p => p.name),
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
      filled += '<td style="' + tdStyle(COL_DESC, 'right') + 'padding:3px 8px;direction:rtl;word-wrap:break-word;">' + escapeHtml(t.desc || '') + '</td>';
      filled += '<td style="' + tdStyle(COL_NUM) + '">' + (startIdx + i + 1) + '</td>';
      filled += '</tr>';
    });
    // Fill remaining rows with empty cells (matches original template)
    var empty = '';
    for (var i = 0; i < maxRows - tArr.length; i++) {
      empty += '<tr style="height:' + rowH + 'px;">';
      empty += '<td style="background:white;border:1px solid #000;"></td>';
      empty += '<td style="background:white;border:1px solid #000;"></td>';
      empty += '<td style="background:white;border:1px solid #000;"></td>';
      empty += '<td style="background:white;border:1px solid #000;"></td>';
      empty += '</tr>';
    }
    return filled + empty;
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
  if (data.phase) {
    headerHtml += '<span style="position:absolute;top:282px;right:26px;' + txtS + 'direction:rtl;">בשלב ביצוע הפגישה : ' + escapeHtml(data.phase) + '</span>';
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

  // Footer on last page
  var footerHtml = '<div style="position:absolute;top:' + (PAGE_H - 85) + 'px;right:26px;' + txtS + 'font-size:13px;direction:rtl;line-height:1.8;">'
    + '<div>רשם: ' + escapeHtml(data.recorder || '') + '</div>'
    + '<div>תפוצה : משתתפי הפגישה' + (participants ? ', ' + escapeHtml(participants) : '') + '</div></div>';

  if (needsP2) {
    page2 = page2.slice(0, -6) + footerHtml + '</div>';
  } else {
    page1 = page1.slice(0, -6) + footerHtml + '</div>';
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
        name: t.desc + (t.owner ? ' [אחריות: ' + t.owner + ']' : ''),
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
      }),
    });
    const protocol = await protocolRes.json();

    if (protocol.error) throw new Error(JSON.stringify(protocol.error));

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

  // Pattern: עד ה-25 למרץ 2026 / עד לתאריך 28 למרץ / עד תאריך 25 למרס / בתאריך 25 למרץ
  const hebrewMonthPattern = text.match(/(?:עד|בתאריך|לתאריך)\s+(?:ל?תאריך\s+)?(?:ה[\-\s]?)?(\d{1,2})\s+(?:ל|של\s+)?(\S+?)(?:\s+(\d{2,4}))?(?:\s|$|,|\.)/);
  if (hebrewMonthPattern) {
    const day = hebrewMonthPattern[1].padStart(2, '0');
    const monthWord = hebrewMonthPattern[2].replace(/^ל/, '');
    const monthNum = hebrewMonths[monthWord];
    if (monthNum) {
      let year = hebrewMonthPattern[3] ? (hebrewMonthPattern[3].length === 2 ? '20' + hebrewMonthPattern[3] : hebrewMonthPattern[3]) : String(refYear);
      result.dueDate = year + '-' + monthNum + '-' + day;
      result.description = result.description.replace(hebrewMonthPattern[0], ' ').trim();
    }
  }

  // Pattern: עד ה-23 ל-12 or עד ה 23 ל 12 or עד לתאריך 23 ל 12 (numeric month)
  if (!result.dueDate) {
    const dateMatch1 = text.match(/(?:עד|בתאריך|לתאריך)\s+(?:ל?תאריך\s+)?(?:ה[\-\s]?)?(\d{1,2})\s+(?:ל[\-\s]?)?(\d{1,2})(?:\s+(\d{2,4}))?/);
    if (dateMatch1) {
      const day = dateMatch1[1].padStart(2, '0');
      const month = dateMatch1[2].padStart(2, '0');
      let year = dateMatch1[3] ? (dateMatch1[3].length === 2 ? '20' + dateMatch1[3] : dateMatch1[3]) : String(refYear);
      result.dueDate = year + '-' + month + '-' + day;
      result.description = result.description.replace(dateMatch1[0], '').trim();
    }
  }

  // Pattern: עד DD/MM/YYYY or DD.MM.YYYY
  if (!result.dueDate) {
    const dateMatch2 = text.match(/עד\s+(\d{1,2})[\/\.](\d{1,2})(?:[\/\.](\d{2,4}))?/);
    if (dateMatch2) {
      const day = dateMatch2[1].padStart(2, '0');
      const month = dateMatch2[2].padStart(2, '0');
      let year = dateMatch2[3] ? (dateMatch2[3].length === 2 ? '20' + dateMatch2[3] : dateMatch2[3]) : String(refYear);
      result.dueDate = year + '-' + month + '-' + day;
      result.description = result.description.replace(dateMatch2[0], '').trim();
    }
  }

  // Pattern: "מחר", "עד מחר"
  if (!result.dueDate && /מחר/.test(text)) {
    const tomorrow = new Date(refDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    result.dueDate = tomorrow.toISOString().split('T')[0];
  }

  // Pattern: "עד סוף השבוע"
  if (!result.dueDate && /סוף השבוע/.test(text)) {
    const friday = new Date(refDate);
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
