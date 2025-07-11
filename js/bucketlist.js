// js/bucketlist.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

let currentUserUid;
let users = [];
let itemsCache = [];
let settings = { bucketShowRemaining: false, bucketTimeFormat: 'days' };
let editId = null;
let detailId = null;

// DOM-Elemente
const entriesList       = document.getElementById('entriesList');
const btnAdd            = document.getElementById('btn-add');
const btnLogout         = document.getElementById('btn-logout');
const versionEl         = document.getElementById('app-version');
const modalCreateEl     = document.getElementById('modal-create');
const createModalTitle  = document.getElementById('create-modal-title');
const formCreate        = document.getElementById('form-create');
const inputTitle        = document.getElementById('input-title');
const inputDesc         = document.getElementById('input-desc');
const inputDue          = document.getElementById('input-due');
const participantsDiv   = document.getElementById('create-participants');
const btnSave           = document.getElementById('btn-save');
const modalDetailEl     = document.getElementById('modal-detail');
const detailTitle       = document.getElementById('detail-title');
const detailDesc        = document.getElementById('detail-desc');
const detailDue         = document.getElementById('detail-due');
const detailParts       = document.getElementById('detail-participants');
const btnDelete         = document.getElementById('btn-delete');
const btnEdit           = document.getElementById('btn-edit');

const createModal = new bootstrap.Modal(modalCreateEl);
const detailModal = new bootstrap.Modal(modalDetailEl);

// 1) Teilnehmer-Checkboxen für Create-Modal
function populateCreateParticipants(selected = []) {
  participantsDiv.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'form-check';
    const inp = document.createElement('input');
    inp.className = 'form-check-input';
    inp.type      = 'checkbox';
    inp.id        = 'part_' + u.uid;
    inp.value     = u.uid;
    if (selected.includes(u.uid)) inp.checked = true;
    const lab = document.createElement('label');
    lab.className = 'form-check-label';
    lab.htmlFor   = inp.id;
    lab.textContent = u.username;
    div.append(inp, lab);
    participantsDiv.appendChild(div);
  });
}

// 2) Formatierung verbleibender Zeit
function formatRemaining(due) {
  const now = new Date();
  const d   = due instanceof Timestamp ? due.toDate() : new Date(due);
  let diff  = d - now;
  if (diff < 0) return 'erledigt';
  switch (settings.bucketTimeFormat) {
    case 'hours':
      return Math.ceil(diff / 3600000) + ' h';
    case 'hhmm': {
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
    default:
      return Math.ceil(diff / 86400000) + ' d';
  }
}

// 3) Auth & Initialisierung
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  currentUserUid = user.uid;

  // Nutzerliste
  const userSnap = await getDocs(collection(db, 'users'));
  users = userSnap.docs.map(d => ({
    uid: d.id,
    username: d.data().username,
    bucketShowRemaining: d.data().bucketShowRemaining,
    bucketTimeFormat: d.data().bucketTimeFormat
  }));

  // eigene Settings
  const me = users.find(u => u.uid === currentUserUid);
  if (me) {
    settings.bucketShowRemaining = !!me.bucketShowRemaining;
    settings.bucketTimeFormat    = me.bucketTimeFormat || 'days';
  }

  populateCreateParticipants();

  // Versionsnummer
  const infoSnap  = await getDocs(collection(db, 'infos'));
  const webappDoc = infoSnap.docs.find(d => d.id === 'webapp');
  versionEl.textContent = webappDoc
    ? webappDoc.data().version
    : 'unbekannt';

  // Realtime-Listener Bucketlist
  onSnapshot(collection(db, 'bucketlist'), snap => {
    itemsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList(itemsCache);
  });
});

// 4) Logout
btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// 5) Liste rendern (sortiert nach Datum)
function renderList(items) {
  entriesList.innerHTML = '';
  const sorted = [...items].sort((a, b) => {
    const da = a.dueDate
      ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate))
      : Infinity;
    const db = b.dueDate
      ? (b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate))
      : Infinity;
    return da - db;
  });
  sorted.forEach(item => {
    const { id, title, dueDate, participants, statuses } = item;
    const isPart      = participants.includes(currentUserUid);
    const allChecked  = participants.length > 0 &&
                        participants.every(u => statuses?.[u]);

    const div = document.createElement('div');
    div.className   = 'list-group-item d-flex align-items-center ' +
                      (allChecked ? 'list-group-item-success' : '');
    div.dataset.id  = id;

    if (isPart) {
      const chk = document.createElement('input');
      chk.type        = 'checkbox';
      chk.className   = 'form-check-input me-2 entry-checkbox';
      chk.checked     = !!statuses?.[currentUserUid];
      chk.dataset.id  = id;
      div.append(chk);
    }

    const span = document.createElement('span');
    span.textContent = title;
    div.append(span);

    if (settings.bucketShowRemaining && dueDate) {
      const rem = document.createElement('small');
      rem.className   = 'text-muted ms-3';
      rem.textContent = formatRemaining(dueDate);
      div.append(rem);
    }

    const due = document.createElement('small');
    due.className = 'text-muted ms-auto';
    if (dueDate) {
      const d = dueDate.toDate
        ? dueDate.toDate()
        : new Date(dueDate);
      due.textContent = d.toLocaleDateString();
    }
    div.append(due);

    entriesList.append(div);
  });
}

// 6) Klick-Handling
entriesList.addEventListener('click', async e => {
  const itemEl = e.target.closest('.list-group-item');
  if (!itemEl) return;
  const id = itemEl.dataset.id;

  // Checkbox toggeln
  if (e.target.classList.contains('entry-checkbox')) {
    await updateDoc(doc(db, 'bucketlist', id), {
      [`statuses.${currentUserUid}`]: e.target.checked
    });
    return;
  }

  // Detail-Modal öffnen
  detailId = id;
  const snap = await getDoc(doc(db, 'bucketlist', id));
  const data = snap.data();

  detailTitle.textContent = data.title;
  detailDesc.textContent  = data.description || '–';
  if (data.dueDate) {
    const d = data.dueDate.toDate
      ? data.dueDate.toDate()
      : new Date(data.dueDate);
    detailDue.textContent = 'Fällig bis: ' + d.toLocaleDateString();
  } else detailDue.textContent = '';

  detailParts.innerHTML = '';
  data.participants.forEach(uid => {
    const u  = users.find(x => x.uid === uid);
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between';
    li.textContent = u ? u.username : uid;
    if (data.statuses?.[uid]) {
      const c = document.createElement('span');
      c.textContent = '✓'; c.className = 'text-success';
      li.append(c);
    }
    detailParts.append(li);
  });

  detailModal.show();
});

// 7) Delete & Edit (einmal binden)
btnDelete.addEventListener('click', async () => {
  if (!detailId) return;
  if (confirm('Eintrag wirklich löschen?')) {
    await deleteDoc(doc(db, 'bucketlist', detailId));
    detailModal.hide();
  }
});

btnEdit.addEventListener('click', async () => {
  if (!detailId) return;
  const snap = await getDoc(doc(db, 'bucketlist', detailId));
  const data = snap.data();
  editId = detailId;
  createModalTitle.textContent = 'Eintrag bearbeiten';
  inputTitle.value    = data.title;
  inputDesc.value     = data.description || '';
  inputDue.value      = data.dueDate
    ? (data.dueDate.toDate
        ? data.dueDate.toDate()
        : new Date(data.dueDate))
        .toISOString().slice(0,10)
    : '';
  populateCreateParticipants(data.participants);
  detailModal.hide();
  createModal.show();
});

// 8) "+" öffnet Create-Modal
btnAdd.addEventListener('click', () => {
  editId = null;
  createModalTitle.textContent = 'Eintrag erstellen';
  formCreate.reset();
  inputTitle.classList.remove('is-invalid');
  populateCreateParticipants();
  createModal.show();
});

// 9) Formular absenden (Create oder Update)
formCreate.addEventListener('submit', async e => {
  e.preventDefault();
  const title = inputTitle.value.trim();
  if (!title) return;

  // Unique-Titel prüfen
  const conflict = itemsCache.some(item =>
    item.title === title && (!editId || item.id !== editId)
  );
  if (conflict) {
    inputTitle.classList.add('is-invalid');
    return;
  }
  inputTitle.classList.remove('is-invalid');

  const descVal = inputDesc.value.trim();
  const dueVal  = inputDue.value;
  const due     = dueVal
    ? Timestamp.fromDate(new Date(dueVal))
    : null;
  const selected = Array.from(
    participantsDiv.querySelectorAll('input:checked')
  ).map(i => i.value);
  const statuses = {};
  selected.forEach(uid => statuses[uid] = false);

  if (editId) {
    await updateDoc(doc(db, 'bucketlist', editId), {
      title,
      description: descVal,
      dueDate: due,
      participants: selected,
      statuses
    });
  } else {
    await addDoc(collection(db, 'bucketlist'), {
      title,
      description: descVal,
      dueDate: due,
      participants: selected,
      statuses,
      createdBy: currentUserUid,
      createdAt: serverTimestamp()
    });
  }

  createModal.hide();
});
