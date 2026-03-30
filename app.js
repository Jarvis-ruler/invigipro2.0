// ─── State ───────────────────────────────────
let teachers = [];
let rooms = [];
let exams = [];
let assignments = [];
let nextId = 1;
const uid = () => nextId++;

// ─── Tab navigation ───────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'assign') populateExamSelect();
    });
});

// ─── Helpers ─────────────────────────────────
function initials(name) {
    return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function badgeClass(desg) {
    if (desg === 'Professor') return 'prof';
    if (desg === 'Associate Professor') return 'assoc';
    return 'asst';
}
function toast(msg, type = 'info') {
    const el = document.createElement('div');
    const colors = { info: '#1e40af:#dbeafe', success: '#166534:#dcfce7', error: '#991b1b:#fee2e2' };
    const [c, bg] = colors[type].split(':');
    el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${bg};color:${c};padding:12px 18px;border-radius:10px;font-size:14px;font-family:DM Sans,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.15);max-width:320px;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// ─── Teachers ────────────────────────────────
function addTeacher() {
    const name = document.getElementById('t-name').value.trim();
    const age = parseInt(document.getElementById('t-age').value);
    const desg = document.getElementById('t-desg').value;
    const dept = document.getElementById('t-dept').value.trim();
    if (!name || !age || !desg) { toast('Please fill name, age and designation.', 'error'); return; }
    teachers.push({ id: uid(), name, age, desg, dept });
    ['t-name', 't-age', 't-dept'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('t-desg').value = '';
    renderTeachers();
    toast(`${name} added.`, 'success');
}

function deleteTeacher(id) { teachers = teachers.filter(t => t.id !== id); renderTeachers(); }

function renderTeachers() {
    document.getElementById('teacher-count').textContent = teachers.length;
    const el = document.getElementById('teacher-list');
    if (!teachers.length) { el.innerHTML = '<div class="empty-msg">No teachers added yet</div>'; return; }
    el.innerHTML = teachers.map(t => `
    <div class="list-row">
      <div class="row-name">${t.name}</div>
      <div class="row-meta">Age ${t.age}${t.dept ? ' · ' + t.dept : ''}</div>
      <span class="badge ${badgeClass(t.desg)}">${t.desg}</span>
      <button class="del-btn" onclick="deleteTeacher(${t.id})" title="Remove">✕</button>
    </div>`).join('');
}

// ─── Teacher file upload ───────────────────────
function handleTeacherFile(event) {
    parseFile(event.target.files[0], (rows, headers) => {
        const ni = findCol(headers, ['name', 'teacher']);
        const ai = findCol(headers, ['age']);
        const di = findCol(headers, ['desig', 'designation', 'position', 'role']);
        const dpi = findCol(headers, ['dept', 'department']);
        if (ni < 0 || ai < 0 || di < 0) { toast('Could not detect Name / Age / Designation columns.', 'error'); return; }
        const added = [];
        rows.forEach(cols => {
            const name = (cols[ni] || '').toString().trim();
            const age = parseInt(cols[ai]);
            const desg = (cols[di] || '').toString().trim();
            const dept = dpi >= 0 ? (cols[dpi] || '').toString().trim() : '';
            if (name && age && desg) { teachers.push({ id: uid(), name, age, desg, dept }); added.push({ name, age, desg, dept }); }
        });
        renderTeachers();
        showPreview('teacher-csv-preview', ['Name', 'Age', 'Designation', 'Department'], added.map(t => [t.name, t.age, t.desg, t.dept]));
        toast(`${added.length} teachers imported.`, 'success');
    });
}

// ─── Rooms ────────────────────────────────────
function addRoom() {
    const name = document.getElementById('r-name').value.trim();
    const floor = parseInt(document.getElementById('r-floor').value);
    const strength = parseInt(document.getElementById('r-strength').value);
    if (!name || isNaN(floor) || !strength) { toast('Please fill all room fields.', 'error'); return; }
    rooms.push({ id: uid(), name, floor, strength });
    ['r-name', 'r-floor', 'r-strength'].forEach(i => document.getElementById(i).value = '');
    renderRooms();
    toast(`${name} added.`, 'success');
}

function deleteRoom(id) { rooms = rooms.filter(r => r.id !== id); renderRooms(); }

function renderRooms() {
    document.getElementById('room-count').textContent = rooms.length;
    const el = document.getElementById('room-list');
    if (!rooms.length) { el.innerHTML = '<div class="empty-msg">No rooms added yet</div>'; return; }
    el.innerHTML = rooms.map(r => `
    <div class="list-row">
      <div class="row-name">${r.name}</div>
      <span class="badge floor">Floor ${r.floor}</span>
      <div class="row-meta">${r.strength} students</div>
      <button class="del-btn" onclick="deleteRoom(${r.id})" title="Remove">✕</button>
    </div>`).join('');
}

// ─── Room file upload ─────────────────────────
function handleRoomFile(event) {
    parseFile(event.target.files[0], (rows, headers) => {
        const ni = findCol(headers, ['room', 'hall', 'venue', 'name', 'block']);
        const fi = findCol(headers, ['floor', 'storey', 'level']);
        const si = findCol(headers, ['strength', 'students', 'count', 'capacity', 'total']);
        if (ni < 0 || fi < 0 || si < 0) {
            toast('Could not detect Room / Floor / Strength columns. Check your file headers.', 'error');
            return;
        }
        const added = [];
        rows.forEach(cols => {
            const name = (cols[ni] || '').toString().trim();
            const floor = parseInt(cols[fi]);
            const strength = parseInt(cols[si]);
            if (name && !isNaN(floor) && strength > 0) {
                rooms.push({ id: uid(), name, floor, strength });
                added.push({ name, floor, strength });
            }
        });
        renderRooms();
        showPreview('room-csv-preview', ['Room', 'Floor', 'Strength'], added.map(r => [r.name, r.floor, r.strength]));
        toast(`${added.length} rooms imported.`, 'success');
    });
}

// ─── Download sample room template ────────────
function downloadRoomSample(e) {
    e.preventDefault();
    const csv = `Room,Floor,Strength\nRoom 101,1,45\nRoom 102,1,38\nRoom 201,2,50\nRoom 202,2,30\nRoom 301,3,25\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'room_template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ─── Exams ────────────────────────────────────
function addExam() {
    const name = document.getElementById('e-name').value.trim();
    const date = document.getElementById('e-date').value;
    const time = document.getElementById('e-time').value;
    const dur = document.getElementById('e-dur').value;
    if (!name) { toast('Exam name is required.', 'error'); return; }
    exams.push({ id: uid(), name, date, time, dur });
    ['e-name', 'e-date', 'e-time', 'e-dur'].forEach(i => document.getElementById(i).value = '');
    renderExams();
    toast(`Exam "${name}" added.`, 'success');
}

function deleteExam(id) { exams = exams.filter(e => e.id !== id); renderExams(); }

function renderExams() {
    document.getElementById('exam-count').textContent = exams.length;
    const el = document.getElementById('exam-list');
    if (!exams.length) { el.innerHTML = '<div class="empty-msg">No exams added yet</div>'; return; }
    el.innerHTML = exams.map(e => `
    <div class="list-row">
      <div class="row-name">${e.name}</div>
      <div class="row-meta">${e.date || 'No date'} ${e.time || ''} ${e.dur ? '· ' + e.dur + 'h' : ''}</div>
      <button class="del-btn" onclick="deleteExam(${e.id})" title="Remove">✕</button>
    </div>`).join('');
}

function populateExamSelect() {
    const sel = document.getElementById('a-exam');
    sel.innerHTML = '<option value="">All exams</option>' + exams.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
}

// ─── Assignment Engine ────────────────────────
function generateAssignments() {
    if (!teachers.length) { toast('Add at least one teacher first.', 'error'); return; }
    if (!rooms.length) { toast('Add at least one room first.', 'error'); return; }

    const threshold = parseInt(document.getElementById('a-threshold').value) || 40;
    const sortedRooms = [...rooms].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));
    const ranked = [...teachers].sort((a, b) => b.age - a.age);

    const used = new Set();
    assignments = [];

    sortedRooms.forEach(room => {
        const need = room.strength > threshold ? 2 : 1;
        const assigned = [];

        if (need === 2) {
            const s1 = ranked.find(t => !used.has(t.id) && (t.desg === 'Professor' || t.desg === 'Associate Professor'))
                || ranked.find(t => !used.has(t.id));
            if (s1) { assigned.push(s1); used.add(s1.id); }
            const s2 = ranked.find(t => !used.has(t.id));
            if (s2) { assigned.push(s2); used.add(s2.id); }
        } else {
            const s1 = ranked.find(t => !used.has(t.id));
            if (s1) { assigned.push(s1); used.add(s1.id); }
        }

        if (assigned.length === 0) {
            used.clear();
            const s1 = ranked[0];
            if (s1) { assigned.push(s1); used.add(s1.id); }
        }

        assignments.push({ room, teachers_assigned: assigned, need });
    });

    renderAssignments(assignments);

    const uniqueUsed = new Set(assignments.flatMap(a => a.teachers_assigned.map(t => t.id)));
    const doubleRooms = assignments.filter(a => a.teachers_assigned.length >= 2).length;

    document.getElementById('metrics-row').style.display = 'grid';
    document.getElementById('m-rooms').textContent = assignments.length;
    document.getElementById('m-teachers').textContent = uniqueUsed.size;
    document.getElementById('m-students').textContent = rooms.reduce((s, r) => s + r.strength, 0);
    document.getElementById('m-double').textContent = doubleRooms;

    updateExportPreview();
    toast('Assignments generated successfully!', 'success');
}

function renderAssignments(asgn) {
    const out = document.getElementById('assignment-output');
    if (!asgn.length) { out.innerHTML = '<div class="empty-msg">No assignments generated</div>'; return; }
    out.innerHTML = asgn.map(a => {
        const doubled = a.teachers_assigned.length >= 2;
        return `<div class="assign-card">
      <div class="assign-header">
        <div>
          <div class="assign-room-name">${a.room.name}</div>
          <div class="assign-room-meta">${a.room.strength} students · ${a.teachers_assigned.length} invigilator${a.teachers_assigned.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="assign-badges">
          <span class="badge floor">Floor ${a.room.floor}</span>
          ${doubled ? '<span class="badge prof">Double</span>' : ''}
        </div>
      </div>
      <div class="assign-body">
        ${a.teachers_assigned.length ? a.teachers_assigned.map(t => `
          <div class="invig-row">
            <div class="invig-avatar">${initials(t.name)}</div>
            <div class="invig-details">
              <div class="invig-name">${t.name}</div>
              <div class="invig-meta">${t.desg} · Age ${t.age}${t.dept ? ' · ' + t.dept : ''}</div>
            </div>
            <span class="badge ${badgeClass(t.desg)}">${t.desg}</span>
          </div>`).join('') : '<div class="empty-msg" style="padding:12px 0;">No teacher available</div>'}
      </div>
    </div>`;
    }).join('');
}

// ─── Export ───────────────────────────────────
function updateExportPreview() {
    const el = document.getElementById('export-preview');
    if (!assignments.length) return;
    el.innerHTML = `<p style="color:#64748b;font-size:13px;">${assignments.length} room assignments ready to export.</p>
    <ul style="margin-top:10px;padding-left:18px;font-size:13px;color:#475569;line-height:2;">
      ${assignments.slice(0, 5).map(a => `<li>${a.room.name} — ${a.teachers_assigned.map(t => t.name).join(', ') || 'Unassigned'}</li>`).join('')}
      ${assignments.length > 5 ? `<li style="color:#94a3b8;">...and ${assignments.length - 5} more rooms</li>` : ''}
    </ul>`;
}

function exportPDF() {
    if (!assignments.length) { toast('Generate assignments first.', 'error'); return; }
    const inst = document.getElementById('inst-name').value || 'Institution';
    const session = document.getElementById('session-name').value || 'Examination';
    const supr = document.getElementById('super-name').value;
    const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>Invigilation Schedule — ${inst}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;color:#111;font-size:13px;background:#fff;}
    .page{max-width:800px;margin:0 auto;padding:40px 36px;}
    h1{font-size:20px;font-weight:700;text-align:center;margin-bottom:4px;color:#0f2044;}
    h2{font-size:14px;font-weight:400;text-align:center;color:#475569;margin-bottom:6px;}
    .meta-row{text-align:center;font-size:12px;color:#64748b;margin-bottom:28px;border-bottom:2px solid #0f2044;padding-bottom:14px;}
    .card{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;}
    .card-head{display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:11px 16px;border-bottom:1px solid #e2e8f0;}
    .room-name{font-size:14px;font-weight:700;color:#0f2044;}
    .room-meta{font-size:11px;color:#64748b;margin-top:2px;}
    .pills{display:flex;gap:6px;}
    .pill{padding:2px 9px;border-radius:12px;font-size:11px;font-weight:600;}
    .pill-floor{background:#fef3c7;color:#92400e;}
    .pill-double{background:#dbeafe;color:#1e40af;}
    .card-body{padding:10px 16px;}
    .t-row{display:flex;align-items:center;gap:10px;padding:8px 10px;background:#f8fafc;border-radius:6px;margin-bottom:6px;}
    .t-row:last-child{margin-bottom:0;}
    .avatar{width:30px;height:30px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#1e40af;flex-shrink:0;}
    .t-name{font-weight:600;font-size:13px;}
    .t-meta{font-size:11px;color:#64748b;}
    .t-badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;margin-left:auto;}
    .bp{background:#dbeafe;color:#1e40af;}.ba{background:#ccfbf1;color:#0f766e;}.bap{background:#ede9fe;color:#5b21b6;}
    .exams-section{margin-top:24px;padding-top:18px;border-top:2px dashed #e2e8f0;}
    .exams-section h3{font-size:13px;font-weight:700;color:#0f2044;margin-bottom:10px;}
    .exam-row{padding:7px 12px;background:#f8fafc;border-radius:6px;margin-bottom:6px;font-size:12px;}
    .exam-name{font-weight:600;}
    .exam-meta{color:#64748b;margin-top:2px;}
    .sig-row{display:flex;justify-content:space-between;margin-top:48px;padding-top:20px;border-top:1px solid #e2e8f0;}
    .sig{text-align:center;font-size:12px;color:#64748b;}
    .sig-line{border-top:1px solid #334155;width:160px;margin:0 auto 6px;}
    .footer{text-align:center;margin-top:28px;font-size:11px;color:#94a3b8;}
    @media print{body{margin:0;}@page{margin:20mm;}}
  </style></head><body><div class="page">
  <h1>${inst}</h1>
  <h2>${session}</h2>
  <div class="meta-row">Invigilation Schedule · Generated: ${now}</div>`;

    assignments.forEach(a => {
        const doubled = a.teachers_assigned.length >= 2;
        html += `<div class="card"><div class="card-head">
      <div><div class="room-name">${a.room.name}</div>
      <div class="room-meta">${a.room.strength} students · ${a.teachers_assigned.length} invigilator${a.teachers_assigned.length !== 1 ? 's' : ''}</div></div>
      <div class="pills">
        <span class="pill pill-floor">Floor ${a.room.floor}</span>
        ${doubled ? '<span class="pill pill-double">Double</span>' : ''}
      </div></div><div class="card-body">`;
        a.teachers_assigned.forEach(t => {
            const ini = initials(t.name);
            const bc = t.desg === 'Professor' ? 'bp' : t.desg === 'Associate Professor' ? 'bap' : 'ba';
            html += `<div class="t-row"><div class="avatar">${ini}</div>
        <div><div class="t-name">${t.name}</div>
        <div class="t-meta">${t.desg}${t.dept ? ' · ' + t.dept : ''} · Age ${t.age}</div></div>
        <span class="t-badge ${bc}">${t.desg}</span></div>`;
        });
        html += `</div></div>`;
    });

    if (exams.length) {
        html += `<div class="exams-section"><h3>Exam schedule</h3>`;
        exams.forEach(e => {
            html += `<div class="exam-row"><div class="exam-name">${e.name}</div>
        <div class="exam-meta">${e.date || 'Date TBD'} ${e.time || ''} ${e.dur ? '· Duration: ' + e.dur + ' hrs' : ''}</div></div>`;
        });
        html += `</div>`;
    }

    html += `<div class="sig-row">
    ${supr ? `<div class="sig"><div class="sig-line"></div>Superintendent of Examination<br>${supr}</div>` : '<div></div>'}
    <div class="sig"><div class="sig-line"></div>Controller of Examinations</div>
    <div class="sig"><div class="sig-line"></div>Principal / Head of Institution</div>
  </div>
  <div class="footer">This document is system-generated · ${inst} · ${session}</div>
  </div></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `invigilation_schedule.html`;
    a.click();
    URL.revokeObjectURL(a.href);

    document.getElementById('export-preview').innerHTML = `<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px 16px;font-size:13px;color:#166534;">
    ✓ Schedule exported! Open the file in your browser and press <strong>Ctrl+P</strong> → choose <strong>Save as PDF</strong>.
  </div>`;
    updateExportPreview();
}

// ─── File parsing (CSV + XLSX) ─────────────────
function parseFile(file, callback) {
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = e => {
            const lines = e.target.result.split('\n').filter(l => l.trim());
            if (lines.length < 2) { toast('File must have a header row and at least one data row.', 'error'); return; }
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
            const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
            callback(rows, headers);
        };
        reader.readAsText(file);

    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') { toast('Excel parsing library not loaded. Please use CSV instead.', 'error'); return; }
        const reader = new FileReader();
        reader.onload = e => {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            if (data.length < 2) { toast('Excel file must have a header row and data.', 'error'); return; }
            const headers = data[0].map(h => String(h || '').trim().toLowerCase());
            const rows = data.slice(1).map(r => r.map(c => String(c || '').trim()));
            callback(rows, headers);
        };
        reader.readAsArrayBuffer(file);
    } else {
        toast('Unsupported file type. Please use .csv or .xlsx', 'error');
    }
}

function findCol(headers, keywords) {
    return headers.findIndex(h => keywords.some(kw => h.includes(kw)));
}

function showPreview(containerId, cols, rows) {
    const el = document.getElementById(containerId);
    const shown = rows.slice(0, 6);
    el.innerHTML = `<div class="success-box">✓ ${rows.length} record${rows.length !== 1 ? 's' : ''} imported.</div>
    <table class="preview-table">
      <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
      ${shown.map(r => `<tr>${r.map(c => `<td>${c || '—'}</td>`).join('')}</tr>`).join('')}
      ${rows.length > 6 ? `<tr><td colspan="${cols.length}" style="color:#94a3b8;font-size:12px;">...and ${rows.length - 6} more rows</td></tr>` : ''}
    </table>`;
}

// ─── Drag & drop ─────────────────────────────
function dragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}
function dropFile(e, type) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (type === 'teacher') handleTeacherFile({ target: { files: [file] } });
    else if (type === 'room') handleRoomFile({ target: { files: [file] } });
}

// ─── Copy Google Form link ─────────────────────
function copyLink() {
    const v = document.getElementById('gform-url').value;
    if (!v) { toast('Paste your form link first.', 'error'); return; }
    navigator.clipboard.writeText(v)
        .then(() => toast('Link copied to clipboard!', 'success'))
        .catch(() => toast('Copy failed — select the link manually.', 'error'));
}

// ─── Initial render ───────────────────────────
(function init() {
    renderTeachers();
    renderRooms();
    renderExams();
})();
