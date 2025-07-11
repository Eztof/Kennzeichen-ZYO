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
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

let currentUserUid;
let users = [];

// DOM-Elemente
const entriesList     = document.getElementById('entriesList');
const btnAdd          = document.getElementById('btn-add');
const btnLogout       = document.getElementById('btn-logout');
const versionEl       = document.getElementById('app-version');
const modalCreateEl   = document.getElementById('modal-create');
const formCreate      = document.getElementById('form-create');
const inputTitle      = document.getElementById('input-title');
const inputDesc       = document.getElementById('input-desc');
const inputDue        = document.getElementById('input-due');
const participantsDiv = document.getElementById('create-participants');
const modalDetailEl   = document.getElementById('modal-detail');
const detailTitle     = document.getElementById('detail-title');
const detailDesc      = document.getElementById('detail-desc');
const detailDue       = document.getElementById('detail-due');
const detailParts     = document.getElementById('detail-participants');

const createModal = new bootstrap.Modal(modalCreateEl);
const detailModal = new bootstrap.Modal(modalDetailEl);

// 1) Teilnehmer-Checkboxen für Create-Modal
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

// 2) Auth-State & Setup
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  currentUserUid = user.uid;

  // 2a) Nutzerliste aus Firestore
  const userSnap = await getDocs(collection(db, 'users'));
  users = userSnap.docs.map(d => ({
    uid: d.id,
    username: d.data().username
  }));
  populateCreateParticipants();

  // 2b) Versionsnummer
  const infoSnap = await getDocs(collection(db, 'infos'));
  const webappDoc = infoSnap.docs.find(d => d.id === 'webapp');
  versionEl.textContent = webappDoc
    ? webappDoc.data().version
    : 'unbekannt';

  // 2c) Realtime-Listener für bucketlist
  onSnapshot(collection(db, 'bucketlist'), snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList(items);
  });
});

// 3) Logout
btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// 4) Liste rendern
function renderList(items) {
  entriesList.innerHTML = '';
  items.forEach(item => {
    const { id, title, dueDate, participants, statuses } = item;
    const isParticipant = participants.includes(currentUserUid);
    const allChecked = participants.length > 0 &&
                       participants.every(u => statuses?.[u]);

    const div = document.createElement('div');
    div.className = 'list-group-item d-flex align-items-center '
                   + (allChecked ? 'list-group-item-success' : '');
    div.dataset.id = id;

    // 4a) Checkbox für Teilnehmende
    if (isParticipant) {
      const chk = document.createElement('input');
      chk.type      = 'checkbox';
      chk.className = 'form-check-input me-2 entry-checkbox';
      chk.checked   = !!statuses?.[currentUserUid];
      chk.dataset.id= id;
      div.appendChild(chk);
    }

    // 4b) Titel
    const span = document.createElement('span');
    span.textContent = title;
    div.appendChild(span);

    // 4c) Datum (falls gesetzt)
    const due = document.createElement('small');
    due.className = 'text-muted ms-auto';
    if (dueDate) {
      let d;
      if (dueDate instanceof Timestamp) {
        d = dueDate.toDate();
      } else {
        d = new Date(dueDate);
      }
      due.textContent = d.toLocaleDateString();
    }
    div.appendChild(due);

    entriesList.appendChild(div);
  });
}

// 5) Klick-Handling
entriesList.addEventListener('click', async e => {
  const item = e.target.closest('.list-group-item');
  if (!item) return;
  const id = item.dataset.id;

  // 5a) Checkbox togglen
  if (e.target.classList.contains('entry-checkbox')) {
    await updateDoc(doc(db, 'bucketlist', id), {
      [`statuses.${currentUserUid}`]: e.target.checked
    });
    return;
  }

  // 5b) Details anzeigen
  const ref  = doc(db, 'bucketlist', id);
  const snap = await getDoc(ref);
  const data = snap.data();

  detailTitle.textContent = data.title;
  detailDesc.textContent  = data.description || '–';
  if (data.dueDate) {
    const d = data.dueDate instanceof Timestamp
      ? data.dueDate.toDate()
      : new Date(data.dueDate);
    detailDue.textContent = 'Fällig bis: ' + d.toLocaleDateString();
  } else {
    detailDue.textContent = '';
  }

  detailParts.innerHTML = '';
  data.participants.forEach(uid => {
    const u  = users.find(x => x.uid === uid);
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between';
    li.textContent = u ? u.username : uid;
    if (data.statuses?.[uid]) {
      const chk = document.createElement('span');
      chk.textContent = '✓';
      chk.className   = 'text-success';
      li.appendChild(chk);
    }
    detailParts.appendChild(li);
  });

  detailModal.show();
});

// 6) "+“ öffnet Create-Modal
btnAdd.addEventListener('click', () => {
  formCreate.reset();
  populateCreateParticipants();
  createModal.show();
});

// 7) Create-Formular absenden
formCreate.addEventListener('submit', async e => {
  e.preventDefault();
  const title = inputTitle.value.trim();
  if (!title) {
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

  await addDoc(collection(db, 'bucketlist'), {
    title,
    description: descVal,
    dueDate: due,
    participants: selected,
    statuses,
    createdBy: currentUserUid,
    createdAt: serverTimestamp()
  });

  createModal.hide();
});
