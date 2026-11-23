// Live State (loaded from backend API on startup, with fallback defaults)
let subjectPerformance = [
  { name: 'DS', avg: 82 },
  { name: 'DBMS', avg: 76 },
  { name: 'CN', avg: 71 },
  { name: 'OS', avg: 79 },
  { name: 'Maths', avg: 85 }
];

let studentsData = [];
let alertsList = [];
let currentSelectedStudentId = null;

// Default avatars for students coming from db.json
const defaultAvatars = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80'
];

// Utility: Toast Message
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

// Utility: Badge CSS class by percentage
function getPctClass(pct) {
  if (pct >= 75) return 'pct-safe';
  if (pct >= 65) return 'pct-warn';
  return 'pct-crit';
}

function getBarColor(pct) {
  if (pct >= 75) return '#16a34a';
  if (pct >= 65) return '#eab308';
  return '#ef4444';
}

// Normalize backend student object into frontend format
function normalizeStudent(raw, idx) {
  const overall = Math.round(raw.overallPercentage ?? raw.overall ?? 75);
  const tier =
    raw.riskTier ||
    raw.tier ||
    (overall >= 75 ? 'Safe' : overall >= 65 ? 'Warning' : 'Critical');

  const rawSubjects = Array.isArray(raw.subjects) ? raw.subjects : [];
  const subjects =
    rawSubjects.length > 0
      ? rawSubjects.map(sub => ({
          id: sub.subjectId || sub.id || sub.code || sub.name,
          code: sub.code || sub.shortName || sub.name,
          name: sub.name || sub.subjectName || sub.code,
          pct: Math.round(sub.percentage ?? sub.pct ?? overall),
          attended: sub.attended ?? 0,
          total: sub.total ?? 0
        }))
      : [
          { id: 'DS', code: 'DS', name: 'Data Structures', pct: overall },
          { id: 'DBMS', code: 'DBMS', name: 'DBMS', pct: overall },
          { id: 'CN', code: 'CN', name: 'CN', pct: overall },
          { id: 'OS', code: 'OS', name: 'OS', pct: overall },
          { id: 'Maths', code: 'Maths', name: 'Maths', pct: overall }
        ];

  const totalAttended = subjects.reduce((acc, s) => acc + (s.attended || 0), 0);
  const totalClasses = subjects.reduce((acc, s) => acc + (s.total || 0), 0);
  const recoveryClasses =
    raw.classesNeeded ??
    raw.recoveryClasses ??
    (overall >= 75 ? 0 : Math.max(0, Math.ceil((0.75 * totalClasses - totalAttended) / 0.25)));

  const statuses = raw.statuses || { DS: 'P', DBMS: 'P', CN: 'P', OS: 'P', Maths: 'P' };

  return {
    id: raw.id || raw.studentId || idx + 1,
    name: raw.name || `Student ${idx + 1}`,
    roll: raw.roll || raw.rollNo || `26CS${101 + idx}`,
    branch: raw.branch || raw.department || 'CSE',
    overall,
    tier,
    avatar: raw.avatar || defaultAvatars[idx % defaultAvatars.length],
    attendedText:
      totalClasses > 0
        ? `Attended: ${totalAttended} / ${totalClasses} Classes`
        : raw.attendedText || 'Attended: -- / -- Classes',
    recoveryClasses,
    statuses,
    subjects,
    interventions: raw.interventions || []
  };
}

// Fetch Dashboard & Students from Express Backend
async function loadBackendData() {
  try {
    const res = await fetch('/api/mentor/dashboard');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const rawStudents = Array.isArray(data)
      ? data
      : data.students || data.alerts || [];

    if (rawStudents.length > 0) {
      studentsData = rawStudents.map((s, idx) => normalizeStudent(s, idx));

      // Build Subject Performance averages dynamically from backend students
      const subCodes = ['DS', 'DBMS', 'CN', 'OS', 'Maths'];
      subjectPerformance = subCodes.map((code, i) => {
        const vals = studentsData
          .map(st => st.subjects[i]?.pct)
          .filter(v => typeof v === 'number');
        const avg =
          vals.length > 0
            ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
            : 75;
        return { name: code, avg };
      });

      // Build Alerts List from backend students (prioritizing Critical & Warning)
      alertsList = studentsData
        .map(s => ({
          id: s.id,
          name: s.name,
          roll: s.roll,
          attendance: s.overall,
          tier: s.tier
        }))
        .sort((a, b) => a.attendance - b.attendance);
    }

    renderSubjectBars();
    renderAttendanceSheet(document.getElementById('globalSearch')?.value || '');
    renderMentorAlerts(
      document.getElementById('riskFilter')?.value || 'all',
      document.getElementById('globalSearch')?.value || ''
    );
    renderStudentPortal();

    if (studentsData.length > 0) {
      await openStudentDetail(studentsData[0].name, false);
    }
  } catch (err) {
    console.error('Failed to load backend data:', err);
    showToast('Using offline preview data (check backend server).');
  }
}

// Switch Active View
function switchView(viewName) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.switch-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  const mentorNav = document.getElementById('mentorNav');
  const studentNav = document.getElementById('studentNav');
  const topUserBadge = document.getElementById('topUserBadge');

  if (viewName === 'student-portal') {
    mentorNav.classList.add('hidden');
    studentNav.classList.remove('hidden');
    const firstStudent = studentsData[0];
    topUserBadge.textContent = firstStudent
      ? firstStudent.name
          .split(' ')
          .map(n => n[0])
          .join('')
          .slice(0, 2)
      : 'ST';
    topUserBadge.title = firstStudent ? firstStudent.name : 'Student';
  } else {
    mentorNav.classList.remove('hidden');
    studentNav.classList.add('hidden');
    topUserBadge.textContent = 'DS';
    topUserBadge.title = 'Dr. Sharma';

    document.querySelectorAll('#mentorNav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });
  }
}

// Render Subject Performance Bar Chart
function renderSubjectBars() {
  const container = document.getElementById('subjectBarsContainer');
  if (!container) return;
  container.innerHTML = '<div class="target-line"></div>';

  subjectPerformance.forEach(sub => {
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `
      <span class="bar-val">${sub.avg}%</span>
      <div class="bar-fill" style="height: ${sub.avg}%"></div>
      <span class="bar-label">${sub.name}</span>
    `;
    container.appendChild(col);
  });
}

// Render Attendance Marking Sheet
function renderAttendanceSheet(filterText = '') {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const subjects = ['DS', 'DBMS', 'CN', 'OS', 'Maths'];
  const filtered = studentsData.filter(
    s =>
      s.name.toLowerCase().includes(filterText.toLowerCase()) ||
      s.roll.toLowerCase().includes(filterText.toLowerCase())
  );

  filtered.forEach((student, idx) => {
    const tr = document.createElement('tr');

    const statusCells = subjects
      .map(sub => {
        const current = student.statuses[sub] || 'P';
        return `
        <td>
          <div class="status-group" data-student="${student.id}" data-subject="${sub}">
            ${['P', 'A', 'L']
              .map(
                code => `
              <button type="button"
                class="status-btn ${current === code ? 'active-' + code : ''}"
                data-code="${code}">${code}</button>
            `
              )
              .join('')}
          </div>
        </td>
      `;
      })
      .join('');

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${student.name}</strong></td>
      ${statusCells}
      <td><span class="pct-pill ${getPctClass(student.overall)}">${student.overall}%</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Recalculate Student Overall Percentage on Status Toggle
function updateStudentAttendance(studentId, subject, code) {
  const student = studentsData.find(s => String(s.id) === String(studentId));
  if (!student) return;

  student.statuses[subject] = code;
  const vals = Object.values(student.statuses);
  const points = vals.reduce((acc, val) => acc + (val === 'P' ? 100 : val === 'L' ? 75 : 40), 0);
  student.overall = Math.round(points / vals.length);

  renderAttendanceSheet(document.getElementById('globalSearch').value);
}

// Save Attendance to Backend API (POST /api/attendance/mark)
async function syncAttendanceToBackend() {
  const today = new Date().toISOString().split('T')[0];
  const subjects = ['DS', 'DBMS', 'CN', 'OS', 'Maths'];

  try {
    for (let i = 0; i < subjects.length; i++) {
      const subCode = subjects[i];
      const firstSub = studentsData[0]?.subjects[i];
      const subjectId = firstSub?.id || `SUB${i + 1}`;

      const records = studentsData.map(student => {
        const code = student.statuses[subCode] || 'P';
        return {
          studentId: student.id,
          status: code === 'P' ? 'present' : code === 'L' ? 'late' : 'absent'
        };
      });

      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          date: today,
          records
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed saving ${subCode}`);
      }
    }

    showToast('Attendance saved to database!');
    await loadBackendData();
  } catch (err) {
    console.error('Attendance save error:', err);
    showToast(`Save error: ${err.message}`);
  }
}

// Render Mentor Alerts Table
function renderMentorAlerts(tierFilter = 'all', searchText = '') {
  const tbody = document.getElementById('mentorAlertsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = alertsList.filter(item => {
    const matchesTier = tierFilter === 'all' || item.tier === tierFilter;
    const matchesSearch =
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.roll.toLowerCase().includes(searchText.toLowerCase());
    return matchesTier && matchesSearch;
  });

  filtered.forEach((item, idx) => {
    const isCritical = item.tier === 'Critical';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${item.name}</strong></td>
      <td>${item.roll}</td>
      <td><strong class="${isCritical ? 'red-text' : ''}">${item.attendance}%</strong></td>
      <td>
        <span class="tier-pill ${isCritical ? 'critical' : 'warning'}">
          <i class="fa-solid ${isCritical ? 'fa-circle-exclamation' : 'fa-triangle-exclamation'}"></i>
          ${item.tier}
        </span>
      </td>
      <td>
        <button class="btn-view" data-student-name="${item.name}">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Open Student Detail Profile (fetches fresh details from GET /api/student/:id)
async function openStudentDetail(studentName, shouldSwitch = true) {
  let student = studentsData.find(s => s.name === studentName) || studentsData[0];
  if (!student) return;

  try {
    const res = await fetch(`/api/student/${encodeURIComponent(student.id)}`);
    if (res.ok) {
      const freshData = await res.json();
      student = normalizeStudent(freshData, 0);
    }
  } catch (err) {
    console.warn('Using cached student detail:', err);
  }

  currentSelectedStudentId = student.id;

  document.getElementById('detailName').textContent = student.name;
  document.getElementById('detailRoll').textContent = student.roll;
  document.getElementById('detailBranch').textContent = student.branch;
  document.getElementById('detailAvatar').src = student.avatar;
  document.getElementById('detailMainPct').textContent = `${student.overall}%`;
  document.getElementById('detailClassesAttended').textContent = student.attendedText;
  document.getElementById('detailRecoveryCount').textContent = student.recoveryClasses;
  document.getElementById('detailRecoveryInline').textContent = student.recoveryClasses;

  const badge = document.getElementById('detailTierBadge');
  badge.textContent = student.tier;
  badge.className = `tier-pill ${student.tier.toLowerCase()}`;

  const subTable = document.getElementById('detailSubjectTable');
  subTable.innerHTML = student.subjects
    .map(
      sub => `
    <tr>
      <td>${sub.name}</td>
      <td><span class="pct-pill ${getPctClass(sub.pct)}">${sub.pct}%</span></td>
    </tr>
  `
    )
    .join('');

  const notesList = document.getElementById('savedNotesList');
  if (notesList) {
    notesList.innerHTML = (student.interventions || [])
      .map(
        n => `
      <div class="note-item">Logged (${n.date || 'Recent'}): ${n.note || n.text}</div>
    `
      )
      .join('');
  }

  if (shouldSwitch) {
    switchView('student-detail');
  }
}

// Render Student Portal Subject Progress Bars
function renderStudentPortal() {
  const firstStudent = studentsData[0];
  const container = document.getElementById('studentPortalSubjects');
  if (!container || !firstStudent) return;

  container.innerHTML = firstStudent.subjects
    .map(
      sub => `
    <div class="progress-row">
      <span>${sub.name}</span>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${sub.pct}%; background: ${getBarColor(sub.pct)};"></div>
      </div>
      <strong>${sub.pct}%</strong>
    </div>
  `
    )
    .join('');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  await loadBackendData();
  switchView('dashboard');

  // Sidebar & Top Switcher Navigation
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.goto));
  });
  

  // Attendance P / A / L Click Delegation
  document.getElementById('attendanceTableBody').addEventListener('click', e => {
    const btn = e.target.closest('.status-btn');
    if (!btn) return;
    const group = btn.closest('.status-group');
    updateStudentAttendance(group.dataset.student, group.dataset.subject, btn.dataset.code);
  });

  // Mark All Present
  document.getElementById('markAllPresentBtn').addEventListener('click', () => {
    studentsData.forEach(s => {
      Object.keys(s.statuses).forEach(k => (s.statuses[k] = 'P'));
      s.overall = 100;
    });
    renderAttendanceSheet(document.getElementById('globalSearch').value);
    showToast('All students marked Present (P).');
  });
  

  // Save Attendance to Backend
  document.getElementById('saveAttendanceBtn').addEventListener('click', async () => {
    await syncAttendanceToBackend();
  });

  // Filter Alerts
  document.getElementById('riskFilter').addEventListener('change', e => {
    renderMentorAlerts(e.target.value, document.getElementById('globalSearch').value);
  });

  // View Student Detail from Alerts Table
  document.getElementById('mentorAlertsBody').addEventListener('click', async e => {
    const btn = e.target.closest('.btn-view');
    if (btn) await openStudentDetail(btn.dataset.studentName, true);
  });

  // Log Mentoring Intervention to Backend (POST /api/mentor/interventions)
  document.getElementById('logInterventionBtn').addEventListener('click', async () => {
    const input = document.getElementById('mentoringNotesInput');
    const text = input.value.trim();
    if (!text) {
      showToast('Please enter a mentoring note first.');
      return;
    }

    try {
      const res = await fetch('/api/mentor/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentSelectedStudentId,
          note: text
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const list = document.getElementById('savedNotesList');
      const note = document.createElement('div');
      note.className = 'note-item';
      note.textContent = `Logged (${new Date().toLocaleDateString()}): ${text}`;
      list.prepend(note);
      input.value = '';
      showToast('Mentoring intervention saved to database.');
    } catch (err) {
      console.error('Intervention save error:', err);
      showToast('Could not save intervention note.');
    }
  });

  // Global Search
  document.getElementById('globalSearch').addEventListener('input', e => {
    const q = e.target.value;
    renderAttendanceSheet(q);
    renderMentorAlerts(document.getElementById('riskFilter').value, q);
  });

  // Quick Action Buttons
  document.getElementById('uploadCsvBtn').addEventListener('click', () => {
    showToast('CSV import dialog ready.');
  });

  document.getElementById('sendAlertsBtn').addEventListener('click', () => {
    const criticalCount = alertsList.filter(a => a.tier === 'Critical').length;
    showToast(`SMS & Email alerts dispatched to ${criticalCount} critical-risk students.`);
  });

  document.getElementById('contactMentorBtn').addEventListener('click', () => {
    showToast('Meeting request sent to Dr. Sharma.');
  });

  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    showToast('Attendance_Report_Nov2026.csv downloaded.');
  });

  document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    showToast('Threshold settings updated.');
  });
});