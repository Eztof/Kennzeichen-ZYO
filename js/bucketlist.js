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
let editId   = null;
let detailId = null;

// DOM-Elemente
const entriesList     = document.getElementById('entriesList'); // <ul>
const btnAdd          = document.getElementById('btn-add');
const btnLogout       = document.getElementById('btn-logout');
const versionEl       = document.getElementById('app-version');

const modalCreateEl    = document.getElementById('modal-create');
const createModalTitle = document.getElementById('create-modal-title');
const formCreate       = document.getElementById('form-create');
const inputTitle       = document.getElementById('input-title');
const inputDesc        = document.getElementById('input-desc');
const inputDue         = document.getElementById('input-due');
const participantsDiv  = document.getElementById('create-participants');

const modalDetailEl    = document.getElementById('modal-detail');
const detailTitle      = document.getElementById('detail-title');
const detailDesc       = document.getElementById('detail-desc');
const detailDue        = document.getElementById('detail-due');
const detailParts      = document.getElementById('detail-participants');
const btnDelete        = document.getElementById('btn-delete');
const btnEdit          = document.getElementById('btn-edit');

const createModal = new bootstrap.Modal(modalCreateEl);
const detailModal = new bootstrap.Modal(modalDetailEl);

// Lade alle Nutzer in users[]
async function loadUsers() {
  const snap = await getDocs(collection(db, 'users'));
  users = snap.docs.map(d => ({ uid: d.id, username: d.data().username }));
}

// Teilnehmer-Checkboxen für Create/Edit
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

// Formatierung „verbleibende Zeit“
function formatRemaining(due) {
  const now = new Date();
  const d   = due instanceof Timestamp ? due.toDate() : new Date(due);
  let diff  = d - now;
  if (diff < 0) return 'erledigt';
  switch (settings.bucketTimeFormat) {
    case 'minutes': return Math.ceil(diff/60000)       + ' Min';
    case 'hours':   return Math.ceil(diff/3600000)     + ' Std';
    case 'days':    return Math.ceil(diff/86400000)    + ' Tage';
    case 'weeks':   return Math.ceil(diff/604800000)   + ' W';
    case 'months':  return Math.ceil(diff/2629800000)  + ' M';
    default:        return Math.ceil(diff/86400000)    + ' Tage';
  }
}

// Auth & Initialisierung
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  currentUserUid = user.uid;

  await loadUsers();

  // Nutzereinstellungen
  const meSnap = await getDoc(doc(db, 'users', currentUserUid));
  if (meSnap.exists()) {
    const d = meSnap.data();
    settings.bucketShowRemaining = !!d.bucketShowRemaining;
    settings.bucketTimeFormat    = d.bucketTimeFormat || 'days';
  }

  // Version
  const infoSnap = await getDoc(doc(db, 'infos', 'webapp'));
  versionEl.textContent = infoSnap.exists()
    ? infoSnap.data().version
    : 'unbekannt';

  // Realtime-Listener
  onSnapshot(collection(db, 'bucketlist'), snap => {
    itemsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
  });
});

// Logout
btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// Liste rendern (erstellt <li> statt <div>)
function renderList() {
  entriesList.innerHTML = '';
  itemsCache
    .sort((a,b) => {
      const da = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : Infinity;
      const db = b.dueDate ? (b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate)) : Infinity;
      return da - db;
    })
    .forEach(item => {
      const { id, title, dueDate, participants = [], statuses = {} } = item;

      const li = document.createElement('li');
      li.className = 'list-group-item d-flex align-items-center';
      li.dataset.id = id;

      // Checkbox für aktuellen Nutzer
      const chk = document.createElement('input');
      chk.type      = 'checkbox';
      chk.className = 'form-check-input me-3';
      chk.checked   = !!statuses[currentUserUid];
      chk.disabled  = !participants.includes(currentUserUid);
      chk.addEventListener('click', async e => {
        e.stopPropagation();
        await updateDoc(doc(db, 'bucketlist', id), {
          [`statuses.${currentUserUid}`]: chk.checked
        });
      });
      li.append(chk);

      // Titel
      const span = document.createElement('span');
      span.textContent = title;
      li.append(span);

      // Verbleibende Zeit
      if (settings.bucketShowRemaining && dueDate) {
        const rem = document.createElement('small');
        rem.className   = 'text-muted ms-3';
        rem.textContent = formatRemaining(dueDate);
        li.append(rem);
      }

      // Fälligkeitsdatum
      const due = document.createElement('small');
      due.className = 'text-muted ms-auto';
      if (dueDate) {
        const d = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
        due.textContent = d.toLocaleDateString();
      }
      li.append(due);

      // Klick → Detail-Modal
      li.addEventListener('click', () => showDetail(id));

      entriesList.append(li);
    });
}

// Detail-Modal
async function showDetail(id) {
  detailId = id;
  const snap = await getDoc(doc(db, 'bucketlist', id));
  const data = snap.data();

  detailTitle.textContent = data.title;
  detailDesc.textContent  = data.description || '–';
  if (data.dueDate) {
    const d = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
    detailDue.textContent = 'Fällig bis: ' + d.toLocaleDateString();
  } else {
    detailDue.textContent = '';
  }

  detailParts.innerHTML = '';
  for (let uid of data.participants || []) {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between';
    const user = users.find(u => u.uid === uid);
    li.textContent = user ? user.username : uid;
    if (data.statuses?.[uid]) {
      const ok = document.createElement('span');
      ok.textContent = '✓'; ok.className = 'text-success';
      li.append(ok);
    }
    detailParts.append(li);
  }

  btnDelete.onclick = async () => {
    if (confirm('Eintrag wirklich löschen?')) {
      await deleteDoc(doc(db, 'bucketlist', detailId));
      detailModal.hide();
    }
  };
  btnEdit.onclick = () => startEdit(data);

  detailModal.show();
}

function startEdit(data) {
  editId = detailId;
  createModalTitle.textContent = 'Eintrag bearbeiten';
  formCreate.reset();
  inputTitle.value = data.title;
  inputDesc.value  = data.description || '';
  inputDue.value   = data.dueDate
    ? (data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate))
        .toISOString().slice(0,10)
    : '';
  populateCreateParticipants(data.participants || []);
  detailModal.hide();
  createModal.show();
}

// "+" → Create-Modal
btnAdd.onclick = () => {
  editId = null;
  createModalTitle.textContent = 'Eintrag erstellen';
  formCreate.reset();
  inputTitle.classList.remove('is-invalid');
  populateCreateParticipants();
  createModal.show();
};

// Create/Update
formCreate.addEventListener('submit', async e => {
  e.preventDefault();
  const title = inputTitle.value.trim();
  if (!title) return;

  const conflict = itemsCache.some(it =>
    it.title === title && (!editId || it.id !== editId)
  );
  if (conflict) {
    inputTitle.classList.add('is-invalid');
    return;
  }
  inputTitle.classList.remove('is-invalid');

  const descVal = inputDesc.value.trim();
  const dueVal  = inputDue.value;
  const dueDate = dueVal ? Timestamp.fromDate(new Date(dueVal)) : null;
  const selected = Array.from(
    participantsDiv.querySelectorAll('input:checked')
  ).map(i => i.value);
  const statuses = {};
  selected.forEach(uid => statuses[uid] = false);

  if (editId) {
    await updateDoc(doc(db, 'bucketlist', editId), {
      title,
      description: descVal,
      dueDate,
      participants: selected,
      statuses
    });
  } else {
    await addDoc(collection(db, 'bucketlist'), {
      title,
      description: descVal,
      dueDate,
      participants: selected,
      statuses,
      createdBy: currentUserUid,
      createdAt: serverTimestamp()
    });
  }
  createModal.hide();
});
