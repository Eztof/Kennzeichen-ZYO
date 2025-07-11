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
let itemsCache    = [];
let settings      = { bucketShowRemaining: false, bucketTimeFormat: 'days' };
let editId        = null;
let detailId      = null;

// DOM
const entriesList     = document.getElementById('entriesList');
const btnAdd          = document.getElementById('btn-add');
const btnLogout       = document.getElementById('btn-logout');
const versionEl       = document.getElementById('app-version');

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

// Hilfen
function populateCreateParticipants(selected = []) {
  participantsDiv.innerHTML = '';
  // hole alle Nutzer aus Firestore
  getDocs(collection(db, 'users')).then(snap => {
    snap.docs.forEach(d => {
      const u = d.data().username;
      const uid = d.id;
      const div = document.createElement('div');
      div.className = 'form-check';
      const inp = document.createElement('input');
      inp.className = 'form-check-input';
      inp.type      = 'checkbox';
      inp.id        = 'part_' + uid;
      inp.value     = uid;
      if (selected.includes(uid)) inp.checked = true;
      const lab = document.createElement('label');
      lab.className = 'form-check-label';
      lab.htmlFor   = inp.id;
      lab.textContent = u;
      div.append(inp, lab);
      participantsDiv.appendChild(div);
    });
  });
}

function formatRemaining(due) {
  const now = new Date();
  const d   = due instanceof Timestamp ? due.toDate() : new Date(due);
  let diff  = d - now;
  if (diff < 0) return 'erledigt';
  switch (settings.bucketTimeFormat) {
    case 'minutes': return Math.ceil(diff/60000) + ' Min';
    case 'hours':   return Math.ceil(diff/3600000) + ' Std';
    case 'days':    return Math.ceil(diff/86400000) + ' Tage';
    case 'weeks':   return Math.ceil(diff/604800000) + ' W';
    case 'months':  return Math.ceil(diff/2629800000) + ' M';
    default:        return Math.ceil(diff/86400000) + ' Tage';
  }
}

onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  currentUserUid = user.uid;

  // eigene Settings
  const uSnap = await getDoc(doc(db, 'users', currentUserUid));
  if (uSnap.exists()) {
    const d = uSnap.data();
    settings.bucketShowRemaining = !!d.bucketShowRemaining;
    settings.bucketTimeFormat    = d.bucketTimeFormat || 'days';
  }

  // Version
  const infoSnap = await getDoc(doc(db, 'infos', 'webapp'));
  versionEl.textContent = infoSnap.exists()
    ? infoSnap.data().version
    : '–';

  // Realtime
  onSnapshot(collection(db, 'bucketlist'), snap => {
    itemsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList(itemsCache);
  });
});

btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

function renderList(items) {
  entriesList.innerHTML = '';
  items
    .sort((a,b)=>{
      const da = a.dueDate? (a.dueDate.toDate? a.dueDate.toDate(): new Date(a.dueDate)) : Infinity;
      const db = b.dueDate? (b.dueDate.toDate? b.dueDate.toDate(): new Date(b.dueDate)) : Infinity;
      return da - db;
    })
    .forEach(item => {
      const { id, title, dueDate, participants, statuses } = item;
      const allChecked = participants.length > 0
        && participants.every(u=>statuses?.[u]);

      const div = document.createElement('div');
      div.className = 'list-group-item d-flex align-items-center '
                     + (allChecked?'list-group-item-success':'');
      div.dataset.id = id;

      div.addEventListener('click', e => onEntryClick(e, id));

      const span = document.createElement('span');
      span.textContent = title;
      div.append(span);

      if (settings.bucketShowRemaining && dueDate) {
        const rem = document.createElement('small');
        rem.className = 'text-muted ms-3';
        rem.textContent = formatRemaining(dueDate);
        div.append(rem);
      }

      const due = document.createElement('small');
      due.className = 'text-muted ms-auto';
      if (dueDate) {
        const d = dueDate.toDate? dueDate.toDate(): new Date(dueDate);
        due.textContent = d.toLocaleDateString();
      }
      div.append(due);

      entriesList.append(div);
    });
}

async function onEntryClick(e, id) {
  // Checkbox toggle?
  if (e.target.classList.contains('form-check-input')) {
    const checked = e.target.checked;
    await updateDoc(doc(db,'bucketlist',id), {
      [`statuses.${currentUserUid}`]: checked
    });
    return;
  }
  // Detail
  detailId = id;
  const snap = await getDoc(doc(db,'bucketlist',id));
  const data = snap.data();
  detailTitle.textContent = data.title;
  detailDesc.textContent  = data.description || '–';
  if (data.dueDate) {
    const d = data.dueDate.toDate? data.dueDate.toDate(): new Date(data.dueDate);
    detailDue.textContent = 'Fällig bis: '+d.toLocaleDateString();
  } else detailDue.textContent='';

  detailParts.innerHTML = '';
  data.participants.forEach(uid=>{
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between';
    li.textContent = uid;
    if (data.statuses?.[uid]) {
      const chk = document.createElement('span');
      chk.textContent='✓'; chk.className='text-success';
      li.append(chk);
    }
    detailParts.append(li);
  });

  btnDelete.onclick = async ()=>{
    if (confirm('Eintrag wirklich löschen?')) {
      await deleteDoc(doc(db,'bucketlist',detailId));
      detailModal.hide();
    }
  };
  btnEdit.onclick = ()=> startEdit(detailId, data);

  detailModal.show();
}

btnAdd.onclick = () => {
  editId = null;
  createModalTitle.textContent = 'Eintrag erstellen';
  formCreate.reset();
  inputTitle.classList.remove('is-invalid');
  populateCreateParticipants();
  createModal.show();
};

async function startEdit(id, data) {
  editId = id;
  createModalTitle.textContent = 'Eintrag bearbeiten';
  inputTitle.value = data.title;
  inputDesc.value  = data.description || '';
  inputDue.value   = data.dueDate
    ? (data.dueDate.toDate? data.dueDate.toDate(): new Date(data.dueDate))
        .toISOString().slice(0,10)
    : '';
  populateCreateParticipants(data.participants);
  detailModal.hide();
  createModal.show();
}

formCreate.addEventListener('submit', async e=>{
  e.preventDefault();
  const title = inputTitle.value.trim();
  if (!title) return;
  const conflict = itemsCache.some(it=>
    it.title===title && (!editId||it.id!==editId)
  );
  if (conflict) {
    inputTitle.classList.add('is-invalid');
    return;
  }
  inputTitle.classList.remove('is-invalid');

  const descVal = inputDesc.value.trim();
  const dueVal  = inputDue.value;
  const due     = dueVal ? Timestamp.fromDate(new Date(dueVal)) : null;
  const selected = Array.from(
    participantsDiv.querySelectorAll('input:checked')
  ).map(i=>i.value);
  const statuses = {};
  selected.forEach(uid=>statuses[uid]=false);

  if (editId) {
    await updateDoc(doc(db,'bucketlist',editId), {
      title,
      description: descVal,
      dueDate: due,
      participants: selected,
      statuses
    });
  } else {
    await addDoc(collection(db,'bucketlist'), {
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
