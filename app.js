/* ═══════════════════════════════════════════════
   InvigilateIQ v2 — app.js
   PDF export via jsPDF + jsPDF-AutoTable
═══════════════════════════════════════════════ */

const S = {
  teachers: [], rooms: [], exams: [], schedule: [], currentStep: 1
};
let _id = 1;
const uid = () => _id++;

// ─── Step navigation ──────────────────────────
function goStep(n) {
  if (n === 2 && (!S.teachers.length || !S.rooms.length)) { toast('Upload teacher and room data first.', 'error'); return; }
  if (n === 3) { if (!S.exams.length) { toast('Add at least one exam date.', 'error'); return; } generateSchedule(); }
  if (n === 4 && !S.schedule.length) { toast('Generate schedule first.', 'error'); return; }
  S.currentStep = n;
  document.querySelectorAll('.page').forEach((p, i) => p.classList.toggle('active', i + 1 === n));
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 === n) s.classList.add('active');
    if (i + 1 < n)  s.classList.add('done');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Toast ────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// ─── File loading ─────────────────────────────
function loadFile(event, type) { const file = event.target.files[0]; if (!file) return; parseFile(file, type); }
function dz_over(e, id)  { e.preventDefault(); document.getElementById(id).classList.add('over'); }
function dz_leave(id)    { document.getElementById(id).classList.remove('over'); }
function dz_drop(e, type) {
  e.preventDefault();
  document.getElementById(type + '-dz').classList.remove('over');
  const file = e.dataTransfer.files[0];
  if (file) parseFile(file, type);
}

function parseFile(file, type) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = e => processRows(csvToRows(e.target.result), type);
    reader.readAsText(file);
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    if (typeof XLSX === 'undefined') { toast('Excel library not loaded. Use CSV.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const wb   = XLSX.read(e.target.result, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const rows    = [headers, ...data.slice(1).map(r => r.map(c => String(c).trim()))];
      processRows(rows, type);
    };
    reader.readAsArrayBuffer(file);
  } else { toast('Unsupported format. Use .xlsx, .xls, or .csv', 'error'); }
}

function csvToRows(text) {
  return text.split('\n').filter(l => l.trim()).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
}

function processRows(rows, type) {
  if (rows.length < 2) { toast('File has no data rows.', 'error'); return; }
  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  const data    = rows.slice(1).filter(r => r.some(c => c.toString().trim() !== ''));

  if (type === 'teacher') {
    const ni  = colIdx(headers, ['name', 'teacher', 'full name', 'faculty']);
    const ai  = colIdx(headers, ['age', 'years']);
    const di  = colIdx(headers, ['desig', 'designation', 'position', 'rank', 'role', 'post']);
    const dpi = colIdx(headers, ['dept', 'department', 'subject', 'branch']);
    if (ni < 0 || ai < 0 || di < 0) { toast('Cannot find Name / Age / Designation columns.', 'error'); showErrorHint('teacher-status', headers); return; }
    const added = [];
    data.forEach(row => {
      const name = (row[ni] || '').toString().trim();
      const age  = parseInt(row[ai]);
      const desg = normalizeDesg((row[di] || '').toString().trim());
      const dept = dpi >= 0 ? (row[dpi] || '').toString().trim() : '';
      if (name && age > 0 && desg) { S.teachers.push({ id: uid(), name, age, desg, dept }); added.push([name, age, desg, dept]); }
    });
    document.getElementById('teacher-status').className = 'upload-status ok';
    document.getElementById('teacher-status').textContent = `✓ ${added.length} teachers loaded`;
    document.getElementById('teacher-dz').classList.add('loaded');
    document.getElementById('teacher-dz').querySelector('.dz-text').textContent = `${added.length} teachers loaded`;
    showPreviewTable('teacher-preview', ['Name', 'Age', 'Designation', 'Department'], added);
    toast(`${added.length} teachers imported.`, 'success');

  } else if (type === 'room') {
    const ni = colIdx(headers, ['room', 'hall', 'block', 'venue', 'name', 'room no', 'room number']);
    const fi = colIdx(headers, ['floor', 'storey', 'level', 'floor no']);
    const si = colIdx(headers, ['strength', 'students', 'count', 'capacity', 'total', 'no of students', 'student count']);
    if (ni < 0 || fi < 0 || si < 0) { toast('Cannot find Room / Floor / Strength columns.', 'error'); showErrorHint('room-status', headers); return; }
    const added = [];
    data.forEach(row => {
      const name     = (row[ni] || '').toString().trim();
      const floor    = parseInt(row[fi]);
      const strength = parseInt(row[si]);
      if (name && !isNaN(floor) && strength > 0) { S.rooms.push({ id: uid(), name, floor, strength }); added.push([name, `Floor ${floor}`, strength + ' students']); }
    });
    document.getElementById('room-status').className = 'upload-status ok';
    document.getElementById('room-status').textContent = `✓ ${added.length} rooms loaded`;
    document.getElementById('room-dz').classList.add('loaded');
    document.getElementById('room-dz').querySelector('.dz-text').textContent = `${added.length} rooms loaded`;
    showPreviewTable('room-preview', ['Room', 'Floor', 'Strength'], added);
    toast(`${added.length} rooms imported.`, 'success');
  }
  updateDataSummary();
}

function colIdx(headers, keywords) { return headers.findIndex(h => keywords.some(kw => h.includes(kw))); }

function normalizeDesg(raw) {
  const r = raw.toLowerCase();
  if (r.includes('associate') || r.includes('asso')) return 'Associate Professor';
  if (r.includes('assistant') || r.includes('asst') || r.includes('ast')) return 'Assistant Professor';
  if (r.includes('prof')) return 'Professor';
  if (r.includes('lecturer')) return 'Assistant Professor';
  return raw;
}

function showErrorHint(elId, headers) {
  const el = document.getElementById(elId);
  el.className = 'upload-status err';
  el.textContent = `Detected columns: ${headers.join(', ')}`;
}

function showPreviewTable(elId, cols, rows) {
  const shown = rows.slice(0, 5);
  const more  = rows.length > 5 ? `<div class="preview-more">…and ${rows.length - 5} more rows</div>` : '';
  document.getElementById(elId).innerHTML = `
    <div class="preview-scroll">
      <table class="preview-table">
        <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
        ${shown.map(r => `<tr>${r.map(c => `<td>${c || '—'}</td>`).join('')}</tr>`).join('')}
      </table>${more}
    </div>`;
}

function updateDataSummary() {
  const hasBoth = S.teachers.length > 0 && S.rooms.length > 0;
  document.getElementById('data-summary').style.display = hasBoth ? 'flex' : 'none';
  document.getElementById('ds-teachers').textContent = S.teachers.length;
  document.getElementById('ds-rooms').textContent    = S.rooms.length;
  document.getElementById('btn-step2').disabled = !hasBoth;
  if (hasBoth) computeDutyPreview();
}

// ─── Templates ────────────────────────────────
function downloadTemplate(type) {
  let csv, fn;
  if (type === 'teacher') { csv = `Name,Age,Designation,Department\nDr. Anjali Singh,52,Professor,Mathematics\nDr. Rajesh Kumar,45,Associate Professor,Physics\nMs. Priya Verma,34,Assistant Professor,Chemistry\nMr. Arjun Nair,28,Assistant Professor,Computer Science\n`; fn = 'teacher_template.csv'; }
  else { csv = `Room,Floor,Strength\nRoom 101,1,45\nRoom 102,1,38\nRoom 201,2,52\nRoom 202,2,30\nRoom 301,3,25\nRoom 302,3,40\n`; fn = 'room_template.csv'; }
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click(); URL.revokeObjectURL(a.href);
}

// ─── Manual add ───────────────────────────────
function toggleManual() {
  const p = document.getElementById('manual-panel'), ico = document.getElementById('manual-toggle-icon');
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
  updateDataSummary(); toast(`${name} added.`, 'success');
}

function manualAddRoom() {
  const name     = document.getElementById('m-rname').value.trim();
  const floor    = parseInt(document.getElementById('m-rfloor').value);
  const strength = parseInt(document.getElementById('m-rstrength').value);
  if (!name || isNaN(floor) || !strength) { toast('Fill all room fields.', 'error'); return; }
  S.rooms.push({ id: uid(), name, floor, strength });
  ['m-rname','m-rfloor','m-rstrength'].forEach(i => document.getElementById(i).value = '');
  updateDataSummary(); toast(`${name} added.`, 'success');
}

// ─── Exams ────────────────────────────────────
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
  renderExamList(); computeDutyPreview();
  document.getElementById('btn-step3').disabled = false;
  toast(`Exam "${name}" added.`, 'success');
}

function deleteExam(id) {
  S.exams = S.exams.filter(e => e.id !== id);
  renderExamList(); computeDutyPreview();
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

// ─── Duty Preview ─────────────────────────────
function computeDutyPreview() {
  if (!S.teachers.length || !S.exams.length) return;
  const threshold = parseInt(document.getElementById('threshold').value) || 40;
  let totalSlots = 0;
  S.exams.forEach(e => { const shifts = (e.hasMorning?1:0)+(e.hasEvening?1:0); S.rooms.forEach(r => { totalSlots += shifts * (r.strength > threshold ? 2 : 1); }); });
  const base = Math.floor(totalSlots / S.teachers.length), extra = totalSlots % S.teachers.length;
  const el = document.getElementById('duty-preview-list');
  if (el) el.innerHTML = `<div style="font-size:13px;color:#475569;">Total duty slots: <strong>${totalSlots}</strong> across ${S.teachers.length} teachers<br>Each teacher gets <strong>${base}${extra > 0 ? '–'+(base+1) : ''}</strong> duties (balanced)</div>`;
  document.getElementById('duty-preview').style.display = 'block';
}

// ─── Scheduling Engine ────────────────────────
function generateSchedule() {
  const threshold   = parseInt(document.getElementById('threshold').value) || 40;
  const sortedRooms = [...S.rooms].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));
  const allSlots = [];
  S.exams.forEach(exam => {
    const shifts = [];
    if (exam.hasMorning) shifts.push({ label: 'Morning', time: exam.morning });
    if (exam.hasEvening) shifts.push({ label: 'Evening', time: exam.evening });
    shifts.forEach(shift => sortedRooms.forEach(room => allSlots.push({ exam, shift, room, need: room.strength > threshold ? 2 : 1, assigned: [] })));
  });
  const dutyCount = {};
  const desgRank  = d => d === 'Professor' ? 0 : d === 'Associate Professor' ? 1 : 2;
  S.teachers.forEach(t => { dutyCount[t.id] = 0; });
  const teachersByAge = [...S.teachers].sort((a, b) => b.age - a.age || desgRank(a.desg) - desgRank(b.desg));
  allSlots.forEach(slot => {
    const usedInShift = new Set(
      allSlots.filter(s => s !== slot && s.exam.id === slot.exam.id && s.shift.label === slot.shift.label && s.assigned.length)
        .flatMap(s => s.assigned.map(t => t.id))
    );
    let available = teachersByAge.filter(t => !usedInShift.has(t.id));
    if (!available.length) available = [...teachersByAge];
    const sorted = [...available].sort((a, b) => { const dc = dutyCount[a.id] - dutyCount[b.id]; return dc !== 0 ? dc : b.age - a.age; });
    const picks = [];
    if (slot.need === 2) {
      const topN   = sorted.slice(0, Math.min(6, sorted.length));
      const senior = topN.find(t => t.desg === 'Professor' || t.desg === 'Associate Professor') || topN[0];
      if (senior) { picks.push(senior); dutyCount[senior.id]++; }
      const next = sorted.find(t => !picks.find(p => p.id === t.id));
      if (next)   { picks.push(next);   dutyCount[next.id]++; }
    } else { const pick = sorted[0]; if (pick) { picks.push(pick); dutyCount[pick.id]++; } }
    slot.assigned = picks;
  });
  S.schedule = allSlots;
  S.teachers.forEach(t => { t.dutyCount = dutyCount[t.id] || 0; });
  renderSchedule();
}

// ─── Render Schedule ──────────────────────────
function renderSchedule() { renderDutySummary(); renderScheduleCards(); populateFilters(); renderStats(); }

function renderStats() {
  const totalStudents = S.rooms.reduce((s, r) => s + r.strength, 0);
  const shifts = S.exams.reduce((s, e) => s + (e.hasMorning?1:0) + (e.hasEvening?1:0), 0);
  document.getElementById('sched-stats').innerHTML = [
    { v: S.schedule.length, l: 'Room slots' }, { v: shifts, l: 'Exam shifts' },
    { v: S.teachers.length, l: 'Teachers'   }, { v: totalStudents, l: 'Students' }
  ].map(s => `<div class="stat-chip"><div class="sv">${s.v}</div><div class="sl">${s.l}</div></div>`).join('');
}

function renderDutySummary() {
  const minDuty = Math.min(...S.teachers.map(t => t.dutyCount || 0));
  document.getElementById('duty-summary-grid').innerHTML =
    [...S.teachers].sort((a, b) => b.dutyCount - a.dutyCount).map(t => `
      <div class="duty-chip ${t.dutyCount >= minDuty ? 'balanced' : 'low'}">
        <div class="duty-chip-avatar">${ini(t.name)}</div>
        <div style="flex:1;min-width:0">
          <div class="duty-chip-name" title="${t.name}">${t.name}</div>
          <div class="duty-chip-sub">${t.desg.replace('Professor','Prof.').replace('Associate ','Assoc. ')}</div>
        </div>
        <div style="text-align:right">
          <div class="duty-chip-count">${t.dutyCount}</div>
          <div class="duty-chip-sub">duties</div>
        </div>
      </div>`).join('');
}

function populateFilters() {
  document.getElementById('filter-exam').innerHTML =
    '<option value="">All exams</option>' + S.exams.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
}

function filterSchedule() {
  renderScheduleCards(
    document.getElementById('filter-exam').value,
    document.getElementById('filter-shift').value,
    document.getElementById('filter-teacher').value
  );
}

function renderScheduleCards(examFilter = '', shiftFilter = '', teacherFilter = '') {
  const out = document.getElementById('schedule-output');
  const examGroups = {};
  S.schedule.forEach(slot => {
    const ek = slot.exam.id;
    if (!examGroups[ek]) examGroups[ek] = { exam: slot.exam, shifts: {} };
    const sk = slot.shift.label;
    if (!examGroups[ek].shifts[sk]) examGroups[ek].shifts[sk] = { shift: slot.shift, rooms: [] };
    examGroups[ek].shifts[sk].rooms.push(slot);
  });
  let html = '';
  Object.values(examGroups).forEach(eg => {
    if (examFilter && eg.exam.id != examFilter) return;
    const shiftBlocks = Object.values(eg.shifts).filter(sg => {
      if (shiftFilter && sg.shift.label !== shiftFilter) return false;
      if (teacherFilter) return sg.rooms.some(s => s.assigned.some(t => t.name.toLowerCase().includes(teacherFilter.toLowerCase())));
      return true;
    });
    if (!shiftBlocks.length) return;
    html += `<div class="exam-block"><div class="exam-block-header"><div class="exam-block-name">${eg.exam.name}</div><div class="exam-block-date">${eg.exam.date ? fmtDate(eg.exam.date) : ''}</div></div>`;
    shiftBlocks.forEach(sg => {
      const cls = sg.shift.label === 'Morning' ? 'morning' : 'evening';
      let rooms = sg.rooms;
      if (teacherFilter) rooms = rooms.filter(s => s.assigned.some(t => t.name.toLowerCase().includes(teacherFilter.toLowerCase())));
      html += `<div class="shift-section">
        <div class="shift-header">
          <span class="shift-badge ${cls}">${sg.shift.label === 'Morning' ? '☀' : '🌙'} ${sg.shift.label}</span>
          <span class="shift-time">${sg.shift.time}</span>
          <span style="margin-left:auto;font-size:11px;color:#94a3b8;">${rooms.length} rooms</span>
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

// ═══════════════════════════════════════════════
//   PDF EXPORT ENGINE (jsPDF + AutoTable)
// ═══════════════════════════════════════════════

// ─── Shared PDF helpers ───────────────────────
const NAVY  = [13,  27,  62];   // #0d1b3e
const WHITE = [255, 255, 255];
const GRAY1 = [248, 250, 252];  // header row alt
const GRAY2 = [226, 232, 240];  // borders
const BLUE  = [37,  99,  235];
const AMBER = [180, 83,   9];
const GREEN = [21,  128,  61];
const MORN  = [254, 249, 195];  // morning tag bg
const EVE   = 
