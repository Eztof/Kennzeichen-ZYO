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
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

let currentUserUid;
let users = [];

// UI-Elemente
const entriesList      = document.getElementById('entriesList');
const btnAdd           = document.getElementById('btn-add');
const modalCreateEl    = document.getElementById('modal-create');
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
const versionEl        = document.getElementById('app-version');
const btnLogout        = document.getElementById('btn-logout');

const createModal = new bootstrap.Modal(modalCreateEl);
const detailModal = new bootstrap.Modal(modalDetailEl);

// Auth & Setup
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  currentUserUid = user.uid;

  // Nutzerliste laden
  const userSnap = await getDocs(collection(db, 'users'));
  users = userSnap.docs.map(d => ({ uid: d.id, username: d.data().username }));

  // Version laden
  const vDoc = await getDocs(collection(db, 'infos')).then(s=>s.docs.find(d=>d.id==='webapp'));
  versionEl.textContent = vDoc?.data().version || 'unbekannt';

  // Realtime Bucketlist abonnieren
  onSnapshot(collection(db, 'bucketlist'), snap => {
    renderList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    populateCreateParticipants();
  });
});

// Logout
btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// Render-Liste
function renderList(items) {
  entriesList.innerHTML = '';
  items.forEach(item => {
    const { id, title, dueDate, participants, statuses } = item;
    const isParticipant = participants.includes(currentUserUid);
    const checked       = statuses?.[currentUserUid];
    const allChecked    = participants.length > 0 &&
                          participants.every(u => statuses?.[u]);
    // List-Item
    const div = document.createElement('div');
    div.className = 'list-group-item d-flex align-items-center '
                   + (allChecked ? 'list-group-item-success' : '');
    div.dataset.id = id;

    // Checkbox
    if (isParticipant) {
      const chk = document.createElement('input');
      chk.type        = 'checkbox';
      chk.className   = 'form-check-input me-2 entry-checkbox';
      chk.checked     = !!checked;
      chk.dataset.id  = id;
      div.appendChild(chk);
    }

    // Titel
    const span = document.createElement('span');
    span.textContent = title;
    span.className   = 'entry-title';
    div.appendChild(span);

    // Due Date (rechts)
    const due = document.createElement('small');
    due.className   = 'text-muted ms-auto';
    due.textContent = dueDate
      ? Timestamp.isTimestamp(dueDate)
        ? dueDate.toDate().toLocaleDateString()
        : new Date(dueDate).toLocaleDateString()
      : '';
    div.appendChild(due);

    entriesList.appendChild(div);
  });
}

// Klick-Handling: Checkbox vs. Details
entriesList.addEventListener('click', async e => {
  const item = e.target.closest('.list-group-item');
  if (!item) return;
  const id = item.dataset.id;

  // Checkbox toggeln
  if (e.target.classList.contains('entry-checkbox')) {
    const checked = e.target.checked;
    await updateDoc(doc(db, 'bucketlist', id), {
      [`statuses.${currentUserUid}`]: checked
    });
    return;
  }

  // Details anzeigen
  showDetail(id);
});

// "+" → Create Modal öffnen
btnAdd.onclick = () => {
  formCreate.reset();
  participantsDiv.innerHTML = '';
  createModal.show();
};

// Teilnehmer-Checkboxen in Create-Modal
function populateCreateParticipants() {
  participantsDiv.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'form-check';
    const inp = document.createElement('input');
    inp.className = 'form-check-input';
    inp.type      = 'checkbox';
    inp.id        = 'part_' + u.uid;
    inp.value     = u.uid;
    const lab = document.createElement('label');
    lab.className = 'form-check-label';
    lab.htmlFor   = inp.id;
    lab.textContent = u.username;
    div.append(inp, lab);
    participantsDiv.appendChild(div);
  });
}

// Create-Form abschicken
formCreate.addEventListener('submit', async e => {
  e.preventDefault();
  const title = inputTitle.value.trim();
  if (!title) {
    inputTitle.classList.add('is-invalid');
    return;
  }
  inputTitle.classList.remove('is-invalid');

  const desc = inputDesc.value.trim();
  const due  = inputDue.value
    ? Timestamp.fromDate(new Date(inputDue.value))
    : null;

  // Beteiligte & Status-Map
  const selected = Array.from(
    participantsDiv.querySelectorAll('input:checked')
  ).map(i => i.value);
  const statuses = {};
  selected.forEach(uid => statuses[uid] = false);

  // Speichern
  await addDoc(collection(db, 'bucketlist'), {
    title,
    description: desc || '',
    dueDate: due,
    participants: selected,
    statuses,
    createdBy: currentUserUid,
    createdAt: serverTimestamp()
  });

  createModal.hide();
});

// Details anzeigen
async function showDetail(id) {
  const docSnap = await doc(db, 'bucketlist', id).get();
  const data    = docSnap.data();
  detailTitle.textContent = data.title;
  detailDesc.textContent  = data.description || '–';
  if (data.dueDate) {
    const d = Timestamp.isTimestamp(data.dueDate)
      ? data.dueDate.toDate()
      : new Date(data.dueDate);
    detailDue.textContent = 'Fällig bis: ' + d.toLocaleDateString();
  } else {
    detailDue.textContent = '';
  }
  detailParts.innerHTML = '';
  data.participants.forEach(uid => {
    const user = users.find(u => u.uid === uid);
    const li   = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between';
    li.textContent = user ? user.username : uid;
    if (data.statuses?.[uid]) {
      const chk = document.createElement('span');
      chk.textContent = '✓';
      chk.className   = 'text-success';
      li.appendChild(chk);
    }
    detailParts.appendChild(li);
  });
  detailModal.show();
}
