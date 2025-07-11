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
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

let currentUserUid, map, markersLayer, editId = null, detailId = null;

// DOM
const navLinks     = document.querySelectorAll('.nav-link');
const views        = document.querySelectorAll('.view');
const btnLogout    = document.getElementById('btn-logout');
const versionEl    = document.getElementById('app-version');
const placesList   = document.getElementById('placesList');
const btnAdd       = document.getElementById('btn-add');

const modalPlace      = new bootstrap.Modal(document.getElementById('modal-place'));
const formPlace       = document.getElementById('form-place');
const titleEl         = document.getElementById('place-modal-title');
const inputPlace      = document.getElementById('input-place');
const inputDesc       = document.getElementById('input-desc');
const inputDate       = document.getElementById('input-date');
const inputLat        = document.getElementById('input-lat');
const inputLng        = document.getElementById('input-lng');

const modalDetail       = new bootstrap.Modal(document.getElementById('modal-place-detail'));
const detailTitleEl     = document.getElementById('detail-place-title');
const detailDescEl      = document.getElementById('detail-place-desc');
const detailDateEl      = document.getElementById('detail-place-date');
const detailCoordsEl    = document.getElementById('detail-place-coords');
const btnDelete         = document.getElementById('btn-delete');
const btnEdit           = document.getElementById('btn-edit');

let itemsCache = [];

// NAVIGATION
navLinks.forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    const view = a.dataset.view;
    views.forEach(v => v.id === 'view-'+view 
      ? v.classList.remove('d-none') : v.classList.add('d-none'));
    navLinks.forEach(n=>n.classList.toggle('active', n===a));
    if (view === 'map' && !map) initMap();
    if (view === 'map') updateMarkers();
  };
});

// AUTH & LOAD
onAuthStateChanged(auth, async user => {
  if (!user) return location.href='index.html';
  currentUserUid = user.uid;

  // Version
  const info = await getDoc(doc(db,'infos','webapp'));
  versionEl.textContent = info.exists()? info.data().version : '–';

  // Realtime Listener
  onSnapshot(collection(db,'orte'), snap => {
    itemsCache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderList();
    if (map) updateMarkers();
  });
});

// INIT MAP
function initMap(){
  map = L.map('map').setView([51.1657,10.4515],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

// RENDER LIST
function renderList(){
  placesList.innerHTML = '';
  itemsCache.sort((a,b)=>a.name.localeCompare(b.name))
    .forEach(item=>{
      const li = document.createElement('li');
      li.className='list-group-item list-group-item-action';
      li.textContent=item.name;
      li.onclick=()=>showDetail(item.id);
      placesList.append(li);
    });
}

// UPDATE MARKERS
function updateMarkers(){
  markersLayer.clearLayers();
  itemsCache.forEach(item=>{
    if (item.lat!=null && item.lng!=null){
      const marker = L.marker([item.lat,item.lng])
        .bindPopup(`<strong>${item.name}</strong>`);
      markersLayer.addLayer(marker);
    }
  });
}

// SHOW DETAIL
async function showDetail(id){
  detailId = id;
  const snap = await getDoc(doc(db,'orte',id));
  const d = snap.data();
  detailTitleEl.textContent = d.name;
  detailDescEl.textContent  = d.description||'';
  if (d.date){
    const dd = d.date.toDate? d.date.toDate():new Date(d.date);
    detailDateEl.textContent = dd.toLocaleDateString();
    detailDateEl.parentElement.classList.remove('d-none');
  } else detailDateEl.parentElement.classList.add('d-none');
  if (d.lat!=null && d.lng!=null){
    detailCoordsEl.textContent = `Lat: ${d.lat}, Lng: ${d.lng}`;
    detailCoordsEl.parentElement.classList.remove('d-none');
  } else detailCoordsEl.parentElement.classList.add('d-none');
  modalDetail.show();
}

// DELETE & EDIT
btnDelete.onclick = async ()=>{
  if(confirm('Ort wirklich löschen?')){
    await deleteDoc(doc(db,'orte',detailId));
    modalDetail.hide();
  }
};
btnEdit.onclick = async ()=>{
  const snap = await getDoc(doc(db,'orte',detailId));
  const d = snap.data();
  editId = detailId;
  titleEl.textContent = 'Ort bearbeiten';
  inputPlace.value = d.name;
  inputDesc.value  = d.description||'';
  inputDate.value  = d.date
    ? (d.date.toDate?d.date.toDate():new Date(d.date))
      .toISOString().slice(0,10) : '';
  inputLat.value   = d.lat!=null? d.lat : '';
  inputLng.value   = d.lng!=null? d.lng : '';
  inputPlace.classList.remove('is-invalid');
  modalDetail.hide();
  modalPlace.show();
};

// ADD NEW
btnAdd.onclick=()=>{
  editId=null;
  titleEl.textContent='Ort hinzufügen';
  formPlace.reset();
  inputPlace.classList.remove('is-invalid');
  modalPlace.show();
};

// SAVE/Create
formPlace.addEventListener('submit', async e=>{
  e.preventDefault();
  const name = inputPlace.value.trim();
  if(!name) return;
  const exists = itemsCache.some(it=>
    it.name.toLowerCase()===name.toLowerCase() && it.id!==editId
  );
  if(exists){
    inputPlace.classList.add('is-invalid');
    return;
  }
  inputPlace.classList.remove('is-invalid');

  const descVal = inputDesc.value.trim();
  const dateVal = inputDate.value
    ? Timestamp.fromDate(new Date(inputDate.value))
    : null;
  const latVal  = parseFloat(inputLat.value);
  const lngVal  = parseFloat(inputLng.value);

  const data = {
    name, description: descVal, date: dateVal,
    lat: isFinite(latVal)? latVal : null,
    lng: isFinite(lngVal)? lngVal : null
  };

  if(editId){
    await updateDoc(doc(db,'orte',editId), data);
  } else {
    await addDoc(collection(db,'orte'), {
      ...data, createdBy: currentUserUid,
      createdAt: serverTimestamp()
    });
  }
  modalPlace.hide();
});

// LOGOUT
btnLogout.onclick = ()=>signOut(auth).then(()=>location.href='index.html');
