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
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

let currentUserUid;
let editId    = null;
let detailId  = null;

// DOM
const placesList    = document.getElementById('placesList');
const btnAdd        = document.getElementById('btn-add');
const btnLogout     = document.getElementById('btn-logout');
const versionEl     = document.getElementById('app-version');

const modalPlace    = new bootstrap.Modal(document.getElementById('modal-place'));
const placeForm     = document.getElementById('form-place');
const placeTitleEl  = document.getElementById('place-modal-title');
const inputPlace    = document.getElementById('input-place');

const modalDetail   = new bootstrap.Modal(document.getElementById('modal-place-detail'));
const detailTitleEl = document.getElementById('detail-place-title');
const btnDelete     = document.getElementById('btn-delete');
const btnEdit       = document.getElementById('btn-edit');

onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  currentUserUid = user.uid;

  // Version
  const infoSnap = await getDoc(doc(db, 'infos', 'webapp'));
  versionEl.textContent = infoSnap.exists()
    ? infoSnap.data().version
    : 'unbekannt';

  // Echtzeit-Listener
  onSnapshot(collection(db, 'orte'), snap => {
    renderList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
});

btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

function renderList(items) {
  placesList.innerHTML = '';
  // sortiere alphabetisch
  items.sort((a,b)=>a.name.localeCompare(b.name))
       .forEach(item => {
    const li = document.createElement('li');
    li.className = 'list-group-item list-group-item-action';
    li.textContent = item.name;
    li.dataset.id = item.id;
    li.addEventListener('click', () => showDetail(item));
    placesList.append(li);
  });
}

btnAdd.onclick = () => {
  editId = null;
  placeTitleEl.textContent = 'Ort hinzufügen';
  placeForm.reset();
  inputPlace.classList.remove('is-invalid');
  modalPlace.show();
};

placeForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = inputPlace.value.trim();
  if (!name) return;

  // Unique-Check
  const snap = await getDocs(collection(db, 'orte'));
  const exists = snap.docs.some(d => d.data().name.toLowerCase() === name.toLowerCase()
    && (!editId || d.id !== editId));
  if (exists) {
    inputPlace.classList.add('is-invalid');
    return;
  }
  inputPlace.classList.remove('is-invalid');

  if (editId) {
    await updateDoc(doc(db, 'orte', editId), { name });
  } else {
    await addDoc(collection(db, 'orte'), { name, createdBy: currentUserUid, createdAt: serverTimestamp() });
  }
  modalPlace.hide();
});

function showDetail(item) {
  detailId = item.id;
  detailTitleEl.textContent = item.name;
  modalDetail.show();
}

btnDelete.onclick = async () => {
  if (confirm('Ort wirklich löschen?')) {
    await deleteDoc(doc(db, 'orte', detailId));
    modalDetail.hide();
  }
};

btnEdit.onclick = () => {
  placeTitleEl.textContent = 'Ort bearbeiten';
  editId = detailId;
  inputPlace.value = detailTitleEl.textContent;
  inputPlace.classList.remove('is-invalid');
  modalDetail.hide();
  modalPlace.show();
};
