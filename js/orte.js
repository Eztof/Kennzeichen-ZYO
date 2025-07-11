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
let itemsCache = [];

const navLinks    = document.querySelectorAll('.nav-link');
const views       = document.querySelectorAll('.view');
const btnLogout   = document.getElementById('btn-logout');
const versionEl   = document.getElementById('app-version');
const placesList  = document.getElementById('placesList');
const btnAdd      = document.getElementById('btn-add');

const modalPlace       = new bootstrap.Modal(document.getElementById('modal-place'));
const formPlace        = document.getElementById('form-place');
const placeModalTitle  = document.getElementById('place-modal-title');
const inputPlace       = document.getElementById('input-place');
const inputDesc        = document.getElementById('input-desc');
const inputDate        = document.getElementById('input-date');
const geocodeLoading   = document.getElementById('geocode-loading');

const modalDetail      = new bootstrap.Modal(document.getElementById('modal-place-detail'));
const detailTitleEl    = document.getElementById('detail-place-title');
const detailDescEl     = document.getElementById('detail-place-desc');
const detailDateEl     = document.getElementById('detail-place-date');
const btnDelete        = document.getElementById('btn-delete');
const btnEdit          = document.getElementById('btn-edit');

// NAVIGATION TABS
navLinks.forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    const view = a.dataset.view;
    views.forEach(v => v.id === 'view-'+view
      ? v.classList.remove('d-none')
      : v.classList.add('d-none'));
    navLinks.forEach(n=>n.classList.toggle('active', n===a));
    if (view==='map' && !map) initMap();
    if (view==='map') updateMarkers();
  };
});

// AUTH & DATA LOADING
onAuthStateChanged(auth, async user => {
  if (!user) return location.href='index.html';
  currentUserUid = user.uid;

  // Version
  const info = await getDoc(doc(db,'infos','webapp'));
  versionEl.textContent = info.exists() ? info.data().version : '–';

  // Firestore-Listener
  onSnapshot(collection(db,'orte'), snap => {
    itemsCache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderList();
    if (map) updateMarkers();
  });
});

// INITIALIZE LEAFLET MAP
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
      li.onclick=()=> showDetail(item.id);
      placesList.append(li);
    });
}

// UPDATE MARKERS ON MAP
function updateMarkers(){
  markersLayer.clearLayers();
  itemsCache.forEach(item=>{
    if (item.lat!=null && item.lng!=null){
      L.marker([item.lat,item.lng])
        .bindPopup(`<strong>${item.name}</strong>`)
        .addTo(markersLayer);
    }
  });
}

// SHOW DETAIL MODAL
async function showDetail(id){
  detailId = id;
  const snap = await getDoc(doc(db,'orte',id));
  const d = snap.data();
  detailTitleEl.textContent = d.name;
  detailDescEl.textContent  = d.description || '';
  if (d.date){
    const dt = d.date.toDate ? d.date.toDate() : new Date(d.date);
    detailDateEl.textContent = dt.toLocaleDateString();
    detailDateEl.parentElement.classList.remove('d-none');
  } else {
    detailDateEl.parentElement.classList.add('d-none');
  }
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
  placeModalTitle.textContent='Ort bearbeiten';
  inputPlace.value=d.name;
  inputDesc.value=d.description||'';
  inputDate.value=d.date
    ? (d.date.toDate?d.date.toDate():new Date(d.date)).toISOString().slice(0,10)
    : '';
  inputPlace.classList.remove('is-invalid');
  modalDetail.hide();
  modalPlace.show();
};

// "+" → Create-Modal
btnAdd.onclick=()=>{
  editId=null;
  placeModalTitle.textContent='Ort hinzufügen';
  formPlace.reset();
  inputPlace.classList.remove('is-invalid');
  modalPlace.show();
};

// GEOCODING via Nominatim
async function geocode(name){
  geocodeLoading.classList.remove('d-none');
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&q='
      + encodeURIComponent(name)
      + '&limit=1'
    );
    const data = await res.json();
    if (data && data.length){
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch{}
  return {lat:null, lng:null};
}  

// SAVE (Create/Edit)
formPlace.addEventListener('submit', async e=>{
  e.preventDefault();
  const name = inputPlace.value.trim();
  if(!name) return;
  const exists = itemsCache.some(it=>
    it.name.toLowerCase()===name.toLowerCase()
    && it.id!==editId
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

  // Geocode nach Name
  const {lat,lng} = await geocode(name);
  geocodeLoading.classList.add('d-none');

  const payload = { name, description: descVal, date: dateVal, lat, lng };

  if(editId){
    await updateDoc(doc(db,'orte',editId), payload);
  } else {
    await addDoc(collection(db,'orte'), {
      ...payload,
      createdBy: currentUserUid,
      createdAt: serverTimestamp()
    });
  }
  modalPlace.hide();
});

// LOGOUT
btnLogout.onclick = ()=> signOut(auth).then(()=>location.href='index.html');
