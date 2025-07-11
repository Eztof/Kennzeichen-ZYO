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
let itemsCache   = [];
let editId       = null;
let detailId     = null;
let mapLoaded    = false;

// Views & Nav
const navLinks    = document.querySelectorAll('.nav-link');
const views       = document.querySelectorAll('.view');
const btnLogout   = document.getElementById('btn-logout');
const versionEl   = document.getElementById('app-version');

// List
const placesList  = document.getElementById('placesList');

// Create/Edit Modal
const modalPlace        = new bootstrap.Modal(document.getElementById('modal-place'));
const formPlace         = document.getElementById('form-place');
const placeModalTitle   = document.getElementById('place-modal-title');
const inputPlace        = document.getElementById('input-place');
const inputDesc         = document.getElementById('input-desc');
const inputDate         = document.getElementById('input-date');
const btnAdd            = document.getElementById('btn-add');

// Detail/Delete Modal
const modalDetail       = new bootstrap.Modal(document.getElementById('modal-place-detail'));
const detailPlaceTitle  = document.getElementById('detail-place-title');
const detailPlaceDesc   = document.getElementById('detail-place-desc');
const detailPlaceDate   = document.getElementById('detail-place-date');
const btnDelete         = document.getElementById('btn-delete');
const btnEdit           = document.getElementById('btn-edit');

// Helper: render list
function renderList(items) {
  placesList.innerHTML = '';
  // alphabetisch sortieren
  items.sort((a,b)=> a.name.localeCompare(b.name))
       .forEach(item => {
    const li = document.createElement('li');
    li.className = 'list-group-item list-group-item-action';
    li.textContent = item.name;
    li.dataset.id = item.id;
    li.addEventListener('click',()=> showDetail(item.id));
    placesList.append(li);
  });
}

// Helper: load map
async function loadMap() {
  if (mapLoaded) return;
  mapLoaded = true;
  const map = L.map('map').setView([51.1657,10.4515],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  // Wenn du später Koordinaten speicherst, hier Marker hinzufügen
}

// Click on nav → toggle views
navLinks.forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    const v = a.dataset.view;
    views.forEach(x =>
      x.id === 'view-'+v
        ? x.classList.remove('d-none')
        : x.classList.add('d-none')
    );
    navLinks.forEach(n=>n.classList.toggle('active', n===a));
    if (v==='map') loadMap();
  };
});

// Auth & initial load
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  currentUserUid = user.uid;

  // Version
  const infoSnap = await getDoc(doc(db,'infos','webapp'));
  versionEl.textContent = infoSnap.exists()
    ? infoSnap.data().version
    : 'unbekannt';

  // Realtime-Listener für Orte
  onSnapshot(collection(db,'orte'), snap => {
    itemsCache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderList(itemsCache);
  });
});

// Logout
btnLogout.onclick = () =>
  signOut(auth).then(()=>location.href='index.html');

// "+" → Create
btnAdd.onclick = () => {
  editId = null;
  placeModalTitle.textContent = 'Ort hinzufügen';
  formPlace.reset();
  inputPlace.classList.remove('is-invalid');
  modalPlace.show();
};

// Create/Edit submit
formPlace.addEventListener('submit', async e => {
  e.preventDefault();
  const name = inputPlace.value.trim();
  if (!name) return;
  // unique check
  const exists = itemsCache.some(it =>
    it.name.toLowerCase() === name.toLowerCase()
    && (!editId || it.id !== editId)
  );
  if (exists) {
    inputPlace.classList.add('is-invalid');
    return;
  }
  inputPlace.classList.remove('is-invalid');

  const descVal = inputDesc.value.trim();
  const dateVal = inputDate.value
    ? Timestamp.fromDate(new Date(inputDate.value))
    : null;

  if (editId) {
    await updateDoc(doc(db,'orte',editId), {
      name, description: descVal, date: dateVal
    });
  } else {
    await addDoc(collection(db,'orte'), {
      name, description: descVal, date: dateVal,
      createdBy: currentUserUid,
      createdAt: serverTimestamp()
    });
  }
  modalPlace.hide();
});

// Show detail
async function showDetail(id) {
  detailId = id;
  const snap = await getDoc(doc(db,'orte',id));
  const data = snap.data();
  detailPlaceTitle.textContent = data.name;
  detailPlaceDesc.textContent  = data.description || '';
  if (data.date) {
    const d = data.date.toDate ? data.date.toDate() : new Date(data.date);
    detailPlaceDate.textContent = d.toLocaleDateString();
    detailPlaceDate.parentElement.classList.remove('d-none');
  } else {
    detailPlaceDate.parentElement.classList.add('d-none');
  }
  modalDetail.show();
}

// Delete
btnDelete.onclick = async () => {
  if (!detailId) return;
  if (confirm('Ort wirklich löschen?')) {
    await deleteDoc(doc(db,'orte',detailId));
    modalDetail.hide();
  }
};

// Edit from detail
btnEdit.onclick = () => {
  const item = itemsCache.find(i=>i.id===detailId);
  if (!item) return;
  editId = detailId;
  placeModalTitle.textContent = 'Ort bearbeiten';
  inputPlace.value = item.name;
  inputDesc.value  = item.description || '';
  inputDate.value  = item.date
    ? (item.date.toDate
        ? item.date.toDate()
        : new Date(item.date))
        .toISOString().slice(0,10)
    : '';
  inputPlace.classList.remove('is-invalid');
  modalDetail.hide();
  modalPlace.show();
};
