/* ═══════════════════════════════════════════════
   InvigilateIQ v2 — app.js
   Features:
   - Excel / CSV file parsing (teacher + room)
   - Morning & evening shift scheduling
   - Age-based floor assignment (oldest → lowest)
   - Equal duty distribution across all teachers
   - Three export modes (full / teacher-wise / room-wise)
═══════════════════════════════════════════════ */

// ─── Global State ─────────────────────────────
const S = {
  teachers:    [],   // { id, name, age, desg, dept }
  rooms:       [],   // { id, name, floor, strength }
  exams:       [],   // { id, name, date, morning, evening, hasMorning, hasEvening }
  schedule:    [],   // generated assignments
  currentStep: 1
};

let _id = 1;
const uid = () => _id++;

// ─── Step navigation ──────────────────────────
function goStep(n) {
  // Validation gates
  if (n === 2 && (!S.teachers.length || !S.rooms.length)) {
    toast('Upload teacher and room data first.', 'error'); return;
  }
  if (n === 3) {
    if (!S.exams.length) { toast('Add at least one exam date.', 'error'); return; }
    generateSchedule();
  }
  if (n === 4 && !S.schedule.length) {
    toast('Generate schedule first.', 'error'); return;
  }

  S.currentStep = n;
  document.querySelectorAll('.page').forEach((p, i) => {
    p.classList.toggle('active', i + 1 === n);
  });
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 === n) s.classList.add('active');
    if (i + 1 < n) s.classList.add('done');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Toast notifications ───────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// ─── File parsing ─────────────────────────────
function loadFile(event, type) {
  const file = event.target.files[0];
  if (!file) return;
  parseFile(file, type);
}

function dz_over(e, id) { e.preventDefault(); document.getElementById(id).classList.add('over'); }
function dz_leave(id) { document.getElementById(id).classList.remove('over'); }
function dz_drop(e, type) {
  e.preventDefault();
  const id = type + '-dz';
  document.getElementById(id).classList.remove('over');
  const file = e.dataTransfer.files[0];
  if (file) parseFile(file, type);
}

function parseFile(file, type) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = e => {
      const rows = csvToRows(e.target.result);
      processRows(rows, type);
    };
    reader.readAsText(file);
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    if (typeof XLSX === 'undefined') { toast('Excel library not loaded. Use CSV.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const rows = [headers, ...data.slice(1).map(r => r.map(c => String(c).trim()))];
      processRows(rows, type);
    };
    reader.readAsArrayBuffer(file);
  } else {
    toast('Unsupported format. Use .xlsx, .xls, or .csv', 'error');
  }
}

function csvToRows(text) {
  return text.split('\n')
    .filter(l => l.trim())
    .map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
}

function processRows(rows, type) {
  if (rows.length < 2) { toast('File has no data rows.', 'error'); return; }
  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  const data = rows.slice(1).filter(r => r.some(c => c.toString().trim() !== ''));

  if (type === 'teacher') {
    const ni  = colIdx(headers, ['name', 'teacher', 'full name', 'faculty']);
    const ai  = colIdx(headers, ['age', 'years']);
    const di  = colIdx(headers, ['desig', 'designation', 'position', 'rank', 'role', 'post']);
    const dpi = colIdx(headers, ['dept', 'department', 'subject', 'branch']);

    if (ni < 0 || ai < 0 || di < 0) {
      toast('Cannot find Name / Age / Designation columns. Check headers.', 'error');
      showErrorHint('teacher-status', headers);
      return;
    }

    const added = [];
    data.forEach(row => {
      const name = (row[ni] || '').toString().trim();
      const age  = parseInt(row[ai]);
      const raw  = (row[di] || '').toString().trim();
      const desg = normalizeDesg(raw);
      const dept = dpi >= 0 ? (row[dpi] || '').toString().trim() : '';
      if (name && age > 0 && desg) {
        S.teachers.push({ id: uid(), name, age, desg, dept });
        added.push([name, age, desg, dept]);
      }
    });

    document.getElementById('teacher-status').className = 'upload-status ok';
    document.getElementById('teacher-status').textContent = `✓ ${added.length} teachers loaded`;
    document.getElementById('teacher-dz').classList.add('loaded');
    document.getElementById('teacher-dz').querySelector('.dz-text').textContent = `${added.length} teachers loaded`;
    showPreviewTable('teacher-preview', ['Name', 'Age', 'Designation', 'Department'], added);
    toast(`${added.length} teachers imported successfully.`, 'success');

  } else if (type === 'room') {
    const ni = colIdx(headers, ['room', 'hall', 'block', 'venue', 'name', 'room no', 'room number']);
    const fi = colIdx(headers, ['floor', 'storey', 'level', 'floor no']);
    const si = colIdx(headers, ['strength', 'students', 'count', 'capacity', 'total', 'no of students', 'student count']);

    if (ni < 0 || fi < 0 || si < 0) {
      toast('Cannot find Room / Floor / Strength columns. Check headers.', 'error');
      showErrorHint('room-status', headers);
      return;
    }

    const added = [];
    data.forEach(row => {
      const name     = (row[ni] || '').toString().trim();
      const floor    = parseInt(row[fi]);
      const strength = parseInt(row[si]);
      if (name && !isNaN(floor) && strength > 0) {
        S.rooms.push({ id: uid(), name, floor, strength });
        added.push([name, `Floor ${floor}`, strength + ' students']);
      }
    });

    document.getElementById('room-status').className = 'upload-status ok';
    document.getElementById('room-status').textContent = `✓ ${added.length} rooms loaded`;
    document.getElementById('room-dz').classList.add('loaded');
    document.getElementById('room-dz').querySelector('.dz-text').textContent = `${added.length} rooms loaded`;
    showPreviewTable('room-preview', ['Room', 'Floor', 'Strength'], added);
    toast(`${added.length} rooms imported successfully.`, 'success');
  }

  updateDataSummary();
}

function colIdx(headers, keywords) {
  return headers.findIndex(h => keywords.some(kw => h.includes(kw)));
}

function normalizeDesg(raw) {
  const r = raw.toLowerCase();
  if (r.includes('associate') || r.includes('asso')) return 'Associate Professor';
  if (r.includes('assistant') || r.includes('asst') || r.includes('ast')) return 'Assistant Professor';
  if (r.includes('prof')) return 'Professor';
  if (r.includes('lecturer')) return 'Assistant Professor';
  return raw; // keep original if unrecognised
}

function showErrorHint(elId, headers) {
  const el = document.getElementById(elId);
  el.className = 'upload-status err';
  el.textContent = `Detected columns: ${headers.join(', ')}`;
}

function showPreviewTable(elId, cols, rows) {
  const shown = rows.slice(0, 5);
  const more  = rows.length > 5 ? `<div class="preview-more">...and ${rows.length - 5} more rows</div>` : '';
  document.getElementById(elId).innerHTML = `
    <div class="preview-scroll">
      <table class="preview-table">
        <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
        ${shown.map(r => `<tr>${r.map(c => `<td>${c || '—'}</td>`).join('')}</tr>`).join('')}
      </table>
      ${more}
    </div>`;
}

function updateDataSummary() {
  const hasBoth = S.teachers.length > 0 && S.rooms.length > 0;
  document.getElementById('data-summary').style.display = hasBoth ? 'flex' : 'none';
  document.getElementById('ds-teachers').textContent = S.teachers.length;
  document.getElementById('ds-rooms').textContent = S.rooms.length;
  document.getElementById('btn-step2').disabled = !hasBoth;
  if (hasBoth) computeDutyPreview();
}

// ─── Templates ────────────────────────────────
function downloadTemplate(type) {
  let csv, fn;
  if (type === 'teacher') {
    csv = `Name,Age,Designation,Department\nDr. Anjali Singh,52,Professor,Mathematics\nDr. Rajesh Kumar,45,Associate Professor,Physics\nMs. Priya Verma,34,Assistant Professor,Chemistry\nMr. Arjun Nair,28,Assistant Professor,Computer Science\n`;
    fn = 'teacher_template.csv';
  } else {
    csv = `Room,Floor,Strength\nRoom 101,1,45\nRoom 102,1,38\nRoom 201,2,52\nRoom 202,2,30\nRoom 301,3,25\nRoom 302,3,40\n`;
    fn = 'room_template.csv';
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Manual add ───────────────────────────────
function toggleManual() {
  const p = document.getElementById('manual-panel');
  const ico = document.getElementById('manual-toggle-icon');
  const hidden = p.style.display === 'none';
  p.style.display = hidden ? 'block' : 'none';
  ico.textContent = hidden ? '▼' : '▶';
}

function manualAddTeacher() {
  const name = document.getElementById('m-tname').value.trim();
  const age  = parseInt(document.getElementById('m-tage').value);
  const desg = document.getElementById('m-tdesg').value;
  const dept = document.getElementById('m-tdept').value.trim();
  if (!name || !age || !desg) { toast('Fill name, age and designation.', 'error'); return; }
  S.teachers.push({ id: uid(), name, age, desg, dept });
  ['m-tname','m-tage','m-tdept'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('m-tdesg').value = '';
  updateDataSummary();
  toast(`${name} added.`, 'success');
}

function manualAddRoom() {
  const name     = document.getElementById('m-rname').value.trim();
  const floor    = parseInt(document.getElementById('m-rfloor').value);
  const strength = parseInt(document.getElementById('m-rstrength').value);
  if (!name || isNaN(floor) || !strength) { toast('Fill all room fields.', 'error'); return; }
  S.rooms.push({ id: uid(), name, floor, strength });
  ['m-rname','m-rfloor','m-rstrength'].forEach(i => document.getElementById(i).value = '');
  updateDataSummary();
  toast(`${name} added.`, 'success');
}

// ─── Exams ────────────────────────────────────
document.getElementById('threshold').addEventListener('input', function() {
  document.getElementById('threshold-val').textContent = this.value;
  document.getElementById('th-display').textContent = this.value;
  computeDutyPreview();
});

function addExam() {
  const name       = document.getElementById('ex-name').value.trim();
  const date       = document.getElementById('ex-date').value;
  const morning    = document.getElementById('ex-morning').value;
  const evening    = document.getElementById('ex-evening').value;
  const hasMorning = document.getElementById('ex-has-morning').checked;
  const hasEvening = document.getElementById('ex-has-evening').checked;
  if (!name) { toast('Enter exam name.', 'error'); return; }
  if (!hasMorning && !hasEvening) { toast('Select at least one shift.', 'error'); return; }
  S.exams.push({ id: uid(), name, date, morning, evening, hasMorning, hasEvening });
  document.getElementById('ex-name').value = '';
  renderExamList();
  computeDutyPreview();
  document.getElementById('btn-step3').disabled = false;
  toast(`Exam "${name}" added.`, 'success');
}

function deleteExam(id) {
  S.exams = S.exams.filter(e => e.id !== id);
  renderExamList();
  computeDutyPreview();
  document.getElementById('btn-step3').disabled = S.exams.length === 0;
}

function renderExamList() {
  const el = document.getElementById('exam-list');
  if (!S.exams.length) { el.innerHTML = '<div class="empty-note">No exams added yet</div>'; return; }
  el.innerHTML = S.exams.map(e => `
    <div class="exam-item">
      <div class="exam-item-info">
        <div class="exam-item-name">${e.name}</div>
        <div class="exam-item-meta">${e.date ? fmtDate(e.date) : 'No date set'}</div>
        <div class="exam-shifts">
          ${e.hasMorning ? `<span class="shift-tag morning">☀ Morning ${e.morning}</span>` : ''}
          ${e.hasEvening ? `<span class="shift-tag evening">🌙 Evening ${e.evening}</span>` : ''}
        </div>
      </div>
      <button class="del-x" onclick="deleteExam(${e.id})">✕</button>
    </div>`).join('');
}

// ─── Duty Preview ──────────────────────────────
function computeDutyPreview() {
  if (!S.teachers.length || !S.exams.length) return;
  const threshold = parseInt(document.getElementById('threshold').value) || 40;

  // Count total slots needed
  let totalSlots = 0;
  S.exams.forEach(e => {
    const shifts = (e.hasMorning ? 1 : 0) + (e.hasEvening ? 1 : 0);
    S.rooms.forEach(r => {
      totalSlots += shifts * (r.strength > threshold ? 2 : 1);
    });
  });

  const base = Math.floor(totalSlots / S.teachers.length);
  const extra = totalSlots % S.teachers.length;

  const el = document.getElementById('duty-preview-list');
  if (el) {
    el.innerHTML = `<div style="font-size:13px;color:#475569;margin-bottom:6px;">
      Total duty slots: <strong>${totalSlots}</strong> across ${S.teachers.length} teachers<br>
      Each teacher gets <strong>${base}${extra > 0 ? '–' + (base + 1) : ''}</strong> duties (balanced)
    </div>`;
  }
  document.getElementById('duty-preview').style.display = 'block';
}

// ─── Core Scheduling Engine ────────────────────
function generateSchedule() {
  const threshold = parseInt(document.getElementById('threshold').value) || 40;

  // Sort rooms: lower floor first, then by name
  const sortedRooms = [...S.rooms].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));

  // Build all slots (exam × shift × room)
  // Each slot can need 1 or 2 teachers
  const allSlots = [];
  S.exams.forEach(exam => {
    const shifts = [];
    if (exam.hasMorning) shifts.push({ label: 'Morning', time: exam.morning });
    if (exam.hasEvening) shifts.push({ label: 'Evening', time: exam.evening });

    shifts.forEach(shift => {
      sortedRooms.forEach(room => {
        const need = room.strength > threshold ? 2 : 1;
        allSlots.push({ exam, shift, room, need, assigned: [] });
      });
    });
  });

  // ── Equal-duty engine ──
  // 1. Sort teachers oldest→youngest (oldest gets lowest-floor rooms)
  // 2. Track duty count per teacher
  // 3. For each slot, pick the teacher(s) with fewest duties who haven't
  //    already been assigned to this shift (to avoid same person in two rooms same shift)
  // 4. Prefer Professor/Associate for high-strength rooms

  const dutyCount = {};
  S.teachers.forEach(t => { dutyCount[t.id] = 0; });

  // Sort teachers: primary = age desc (oldest first for lower floors), 
  // secondary = designation rank (Professor > Associate > Assistant)
  const desgRank = d => d === 'Professor' ? 0 : d === 'Associate Professor' ? 1 : 2;
  const teachersByAge = [...S.teachers].sort((a, b) => b.age - a.age || desgRank(a.desg) - desgRank(b.desg));

  allSlots.forEach(slot => {
    const usedInShift = new Set(
      allSlots
        .filter(s => s !== slot && s.exam.id === slot.exam.id && s.shift.label === slot.shift.label && s.assigned.length)
        .flatMap(s => s.assigned.map(t => t.id))
    );

    const available = teachersByAge.filter(t => !usedInShift.has(t.id));
    if (!available.length) {
      // fallback: allow reuse if no available
      available.push(...teachersByAge);
    }

    // Sort available by duty count (ascending), then age desc for floor preference
    const sorted = [...available].sort((a, b) => {
      const dc = dutyCount[a.id] - dutyCount[b.id];
      if (dc !== 0) return dc;
      return b.age - a.age; // older → lower floors
    });

    const picks = [];
    if (slot.need === 2) {
      // Slot 1: prefer Professor/Associate among lowest-duty teachers
      const topN = sorted.slice(0, Math.min(6, sorted.length));
      const senior = topN.find(t => t.desg === 'Professor' || t.desg === 'Associate Professor') || topN[0];
      if (senior) { picks.push(senior); dutyCount[senior.id]++; }

      // Slot 2: next lowest duty among remaining
      const next = sorted.find(t => !picks.find(p => p.id === t.id));
      if (next) { picks.push(next); dutyCount[next.id]++; }
    } else {
      const pick = sorted[0];
      if (pick) { picks.push(pick); dutyCount[pick.id]++; }
    }

    slot.assigned = picks;
  });

  S.schedule = allSlots;

  // Store duty counts on teachers for display
  S.teachers.forEach(t => { t.dutyCount = dutyCount[t.id] || 0; });

  renderSchedule();
}

// ─── Render Schedule ──────────────────────────
function renderSchedule() {
  renderDutySummary();
  renderScheduleCards();
  populateFilters();
  renderStats();
}

function renderStats() {
  const totalDuties = S.schedule.length;
  const totalStudents = S.rooms.reduce((s, r) => s + r.strength, 0);
  const slots = S.exams.reduce((s, e) => s + (e.hasMorning ? 1 : 0) + (e.hasEvening ? 1 : 0), 0);

  document.getElementById('sched-stats').innerHTML = [
    { v: S.schedule.length, l: 'Room slots' },
    { v: slots, l: 'Exam shifts' },
    { v: S.teachers.length, l: 'Teachers' },
    { v: totalStudents, l: 'Total students' }
  ].map(s => `<div class="stat-chip"><div class="sv">${s.v}</div><div class="sl">${s.l}</div></div>`).join('');
}

function renderDutySummary() {
  const counts = S.teachers.map(t => t.dutyCount || 0);
  const min = Math.min(...counts), max = Math.max(...counts);
  const sorted = [...S.teachers].sort((a, b) => b.dutyCount - a.dutyCount);

  document.getElementById('duty-summary-grid').innerHTML = sorted.map(t => {
    const balanced = t.dutyCount >= min;
    return `<div class="duty-chip ${balanced ? 'balanced' : 'low'}">
      <div class="duty-chip-avatar">${ini(t.name)}</div>
      <div style="flex:1;min-width:0">
        <div class="duty-chip-name" title="${t.name}">${t.name}</div>
        <div class="duty-chip-sub">${t.desg.replace('Professor','Prof.').replace('Associate ','Assoc. ')}</div>
      </div>
      <div style="text-align:right">
        <div class="duty-chip-count">${t.dutyCount}</div>
        <div class="duty-chip-sub">duties</div>
      </div>
    </div>`;
  }).join('');
}

function renderScheduleCards(examFilter = '', shiftFilter = '', teacherFilter = '') {
  const out = document.getElementById('schedule-output');

  // Group slots by exam
  const examGroups = {};
  S.schedule.forEach(slot => {
    const key = slot.exam.id;
    if (!examGroups[key]) examGroups[key] = { exam: slot.exam, shifts: {} };
    const sk = slot.shift.label;
    if (!examGroups[key].shifts[sk]) examGroups[key].shifts[sk] = { shift: slot.shift, rooms: [] };
    examGroups[key].shifts[sk].rooms.push(slot);
  });

  let html = '';
  Object.values(examGroups).forEach(eg => {
    if (examFilter && eg.exam.id != examFilter) return;

    const shiftBlocks = Object.values(eg.shifts).filter(sg => {
      if (shiftFilter && sg.shift.label !== shiftFilter) return false;
      if (teacherFilter) {
        return sg.rooms.some(slot => slot.assigned.some(t => t.name.toLowerCase().includes(teacherFilter.toLowerCase())));
      }
      return true;
    });
    if (!shiftBlocks.length) return;

    html += `<div class="exam-block">
      <div class="exam-block-header">
        <div class="exam-block-name">${eg.exam.name}</div>
        <div class="exam-block-date">${eg.exam.date ? fmtDate(eg.exam.date) : ''}</div>
      </div>`;

    shiftBlocks.forEach(sg => {
      const cls = sg.shift.label === 'Morning' ? 'morning' : 'evening';
      let rooms = sg.rooms;
      if (teacherFilter) {
        rooms = rooms.filter(s => s.assigned.some(t => t.name.toLowerCase().includes(teacherFilter.toLowerCase())));
      }

      html += `<div class="shift-section">
        <div class="shift-header">
          <span class="shift-badge ${cls}">${sg.shift.label === 'Morning' ? '☀' : '🌙'} ${sg.shift.label}</span>
          <span class="shift-time">${sg.shift.time}</span>
          <span style="margin-left:auto;font-size:12px;color:#94a3b8;">${rooms.length} rooms</span>
        </div>
        <div class="rooms-grid">
          ${rooms.map(slot => `
            <div class="room-card">
              <div class="room-card-header">
                <div class="room-card-name">${slot.room.name}</div>
                <div class="room-card-strength">${slot.room.strength} students</div>
              </div>
              <div class="floor-dot">Floor ${slot.room.floor}</div>
              <div class="invig-list">
                ${slot.assigned.length ? slot.assigned.map(t => `
                  <div class="invig-row">
                    <div class="invig-av">${ini(t.name)}</div>
                    <div class="invig-name">${t.name}</div>
                    <span class="invig-tag ${tagClass(t.desg)}">${shortDesg(t.desg)}</span>
                  </div>`).join('') : '<div style="font-size:12px;color:#94a3b8;">Unassigned</div>'}
              </div>
            </div>`).join('')}
        </div>
      </div>`;
    });

    html += `</div>`;
  });

  out.innerHTML = html || '<div class="empty-note">No matching results</div>';
}

function populateFilters() {
  const sel = document.getElementById('filter-exam');
  sel.innerHTML = '<option value="">All exams</option>' + S.exams.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
}

function filterSchedule() {
  const ef = document.getElementById('filter-exam').value;
  const sf = document.getElementById('filter-shift').value;
  const tf = document.getElementById('filter-teacher').value;
  renderScheduleCards(ef, sf, tf);
}

// ─── Export Engine ────────────────────────────
const CSS_PDF = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;color:#111;font-size:12px;}
  .page{max-width:900px;margin:0 auto;padding:36px 32px;}
  h1{font-size:20px;font-weight:700;text-align:center;color:#0d1b3e;margin-bottom:4px;}
  h2{font-size:13px;font-weight:400;text-align:center;color:#64748b;margin-bottom:6px;}
  .meta{text-align:center;font-size:11px;color:#94a3b8;padding-bottom:14px;margin-bottom:24px;border-bottom:2px solid #0d1b3e;}
  .section{margin-bottom:20px;page-break-inside:avoid;}
  .exam-head{background:#0d1b3e;color:#fff;padding:9px 14px;border-radius:7px 7px 0 0;font-size:13px;font-weight:700;display:flex;justify-content:space-between;}
  .exam-date{font-size:11px;color:#93c5fd;font-weight:400;}
  .shift-head{background:#f1f5f9;padding:8px 14px;border:1px solid #e2e8f0;border-top:none;font-size:12px;font-weight:600;color:#334155;display:flex;gap:10px;align-items:center;}
  .shift-tag{padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;}
  .m{background:#fef9c3;color:#854d0e;}.e{background:#e0e7ff;color:#3730a3;}
  table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;}
  th{background:#f8fafc;padding:7px 10px;text-align:left;font-size:11px;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;}
  td{padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;vertical-align:top;}
  tr:last-child td{border:none;}
  .sig-row{display:flex;justify-content:space-between;margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;}
  .sig{text-align:center;font-size:11px;color:#64748b;}
  .sig-line{border-top:1px solid #334155;width:140px;margin:0 auto 6px;}
  .footer{text-align:center;margin-top:24px;font-size:10px;color:#94a3b8;}
  @media print{@page{margin:16mm;} .section{page-break-inside:avoid;}}
`;

function pdfWrap(title, body) {
  const inst = document.getElementById('inst-name').value || 'Institution';
  const ctrl = document.getElementById('inst-ctrl').value || '';
  const now  = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>${CSS_PDF}</style></head><body><div class="page">
  <h1>${inst}</h1>
  <h2>${title}</h2>
  <div class="meta">Generated: ${now}${ctrl ? ' · ' + ctrl : ''}</div>
  ${body}
  <div class="sig-row">
    ${ctrl ? `<div class="sig"><div class="sig-line"></div>Examination Superintendent<br>${ctrl}</div>` : '<div></div>'}
    <div class="sig"><div class="sig-line"></div>Controller of Examinations</div>
    <div class="sig"><div class="sig-line"></div>Principal</div>
  </div>
  <div class="footer">System-generated document · ${inst}</div>
  </div></body></html>`;
}

function exportFull() {
  // Group by exam → shift → rooms
  const groups = groupByExamShift();
  let body = '';

  groups.forEach(eg => {
    body += `<div class="section"><div class="exam-head"><span>${eg.exam.name}</span><span class="exam-date">${eg.exam.date ? fmtDate(eg.exam.date) : ''}</span></div>`;
    eg.shifts.forEach(sg => {
      const cls = sg.shift.label === 'Morning' ? 'm' : 'e';
      body += `<div class="shift-head"><span class="shift-tag ${cls}">${sg.shift.label}</span>${sg.shift.time}</div>
        <table><tr><th>Room</th><th>Floor</th><th>Strength</th><th>Invigilator 1</th><th>Invigilator 2</th></tr>
        ${sg.rooms.map(s => {
          const t1 = s.assigned[0], t2 = s.assigned[1];
          return `<tr><td>${s.room.name}</td><td>Floor ${s.room.floor}</td><td>${s.room.strength}</td>
            <td>${t1 ? t1.name + '<br><small>' + t1.desg + '</small>' : '—'}</td>
            <td>${t2 ? t2.name + '<br><small>' + t2.desg + '</small>' : '—'}</td></tr>`;
        }).join('')}
        </table>`;
    });
    body += `</div>`;
  });

  download(pdfWrap('Full Invigilation Schedule', body), 'invigilation_full_schedule.html');
  showExportStatus('Full schedule exported!');
}

function exportByTeacher() {
  // Build teacher → [duty] map
  const map = {};
  S.teachers.forEach(t => { map[t.id] = { teacher: t, duties: [] }; });
  S.schedule.forEach(slot => {
    slot.assigned.forEach(t => {
      if (map[t.id]) map[t.id].duties.push(slot);
    });
  });

  const sorted = Object.values(map).sort((a, b) => b.teacher.age - a.teacher.age);

  let body = '';
  sorted.forEach(({ teacher, duties }) => {
    body += `<div class="section" style="margin-bottom:24px;">
      <div class="exam-head"><span>${teacher.name} — ${teacher.desg}</span>
      <span class="exam-date">Age ${teacher.age}${teacher.dept ? ' · ' + teacher.dept : ''} · ${duties.length} duties</span></div>
      <table><tr><th>Exam</th><th>Date</th><th>Shift</th><th>Time</th><th>Room</th><th>Floor</th><th>Students</th></tr>
      ${duties.sort((a,b) => (a.exam.date||'').localeCompare(b.exam.date||'')).map(s =>
        `<tr><td>${s.exam.name}</td><td>${s.exam.date ? fmtDate(s.exam.date) : '—'}</td>
         <td>${s.shift.label}</td><td>${s.shift.time}</td>
         <td>${s.room.name}</td><td>Floor ${s.room.floor}</td><td>${s.room.strength}</td></tr>`
      ).join('')}
      </table></div>`;
  });

  download(pdfWrap('Teacher-wise Duty List', body), 'invigilation_teacher_duties.html');
  showExportStatus('Teacher duty list exported!');
}

function exportByRoom() {
  const groups = groupByExamShift();
  let body = '';

  groups.forEach(eg => {
    body += `<div class="section"><div class="exam-head"><span>${eg.exam.name}</span><span class="exam-date">${eg.exam.date ? fmtDate(eg.exam.date) : ''}</span></div>`;
    eg.shifts.forEach(sg => {
      const cls = sg.shift.label === 'Morning' ? 'm' : 'e';
      body += `<div class="shift-head"><span class="shift-tag ${cls}">${sg.shift.label}</span>${sg.shift.time}</div>
        <table><tr><th>Room</th><th>Floor</th><th>Students</th><th>Invigilator(s)</th><th>Designation</th></tr>
        ${sg.rooms.map(s => `<tr>
          <td>${s.room.name}</td><td>Floor ${s.room.floor}</td><td>${s.room.strength}</td>
          <td>${s.assigned.map(t => t.name).join('<br>') || '—'}</td>
          <td>${s.assigned.map(t => t.desg).join('<br>') || '—'}</td>
        </tr>`).join('')}
        </table>`;
    });
    body += `</div>`;
  });

  download(pdfWrap('Room-wise Invigilation Sheet', body), 'invigilation_room_sheet.html');
  showExportStatus('Room-wise sheet exported!');
}

function groupByExamShift() {
  const map = {};
  S.schedule.forEach(slot => {
    const ek = slot.exam.id;
    if (!map[ek]) map[ek] = { exam: slot.exam, shifts: {} };
    const sk = slot.shift.label;
    if (!map[ek].shifts[sk]) map[ek].shifts[sk] = { shift: slot.shift, rooms: [] };
    map[ek].shifts[sk].rooms.push(slot);
  });
  return Object.values(map).map(eg => ({
    ...eg,
    shifts: Object.values(eg.shifts)
  }));
}

function download(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

function showExportStatus(msg) {
  document.getElementById('export-status').innerHTML = `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:9px;padding:14px 18px;color:#15803d;font-size:14px;font-weight:500;">
      ✓ ${msg} &nbsp; Open the file in your browser → <strong>Ctrl+P</strong> → Save as PDF
    </div>`;
  toast(msg, 'success');
}

// ─── Utilities ────────────────────────────────
function ini(name) {
  return (name || '').trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function tagClass(desg) {
  if (desg === 'Professor') return 'tag-prof';
  if (desg === 'Associate Professor') return 'tag-assoc';
  return 'tag-asst';
}
function shortDesg(desg) {
  if (desg === 'Professor') return 'Prof';
  if (desg === 'Associate Professor') return 'Assoc';
  return 'Asst';
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
