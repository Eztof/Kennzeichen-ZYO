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

let currentUserUid, mainMap, markersLayer, modalMap, modalMarker;
let editId = null, detailId = null;
let selectedLat = null, selectedLng = null;
let itemsCache = [];

// DOM
const navLinks      = document.querySelectorAll('.nav-link');
const views         = document.querySelectorAll('.view');
const btnLogout     = document.getElementById('btn-logout');
const versionEl     = document.getElementById('app-version');
const placesList    = document.getElementById('placesList');
const btnAdd        = document.getElementById('btn-add');

const modalPlace       = new bootstrap.Modal(document.getElementById('modal-place'));
const formPlace        = document.getElementById('form-place');
const placeTitleEl     = document.getElementById('place-modal-title');
const inputPlace       = document.getElementById('input-place');
const inputDesc        = document.getElementById('input-desc');
const inputDate        = document.getElementById('input-date');
const chkManual        = document.getElementById('input-manual');
const modalMapDiv      = document.getElementById('modal-map');
const geocodeHint      = document.getElementById('geocode-hint');

const modalDetail      = new bootstrap.Modal(document.getElementById('modal-place-detail'));
const detailTitleEl    = document.getElementById('detail-place-title');
const detailDescEl     = document.getElementById('detail-place-desc');
const detailDateEl     = document.getElementById('detail-place-date');
const btnDelete        = document.getElementById('btn-delete');
const btnEdit          = document.getElementById('btn-edit');

// NAV-TABS
navLinks.forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    const view = a.dataset.view;
    views.forEach(v => v.id === 'view-'+view
      ? v.classList.remove('d-none')
      : v.classList.add('d-none'));
    navLinks.forEach(n=>n.classList.toggle('active', n===a));
    if (view==='map' && !mainMap) initMainMap();
    if (view==='map') updateMarkers();
  };
});

// AUTH & LISTENER
onAuthStateChanged(auth, async user => {
  if (!user) return location.href='index.html';
  currentUserUid = user.uid;
  // Version
  const info = await getDoc(doc(db,'infos','webapp'));
  versionEl.textContent = info.exists() ? info.data().version : '–';
  // Daten-Listener
  onSnapshot(collection(db,'orte'), snap => {
    itemsCache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderList();
    if (mainMap) updateMarkers();
  });
});

// INIT HAUPTKARTE
function initMainMap(){
  mainMap = L.map('map').setView([51.1657,10.4515],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap'
  }).addTo(mainMap);
  markersLayer = L.layerGroup().addTo(mainMap);
}

// RENDER LISTE
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

// UPDATE MARKER
function updateMarkers(){
  markersLayer.clearLayers();
  itemsCache.forEach(item=>{
    if(item.lat!=null&&item.lng!=null){
      L.marker([item.lat,item.lng])
        .bindPopup(`<strong>${item.name}</strong>`)
        .addTo(markersLayer);
    }
  });
}

// DETAIL-MODAL
async function showDetail(id){
  detailId = id;
  const snap = await getDoc(doc(db,'orte',id));
  const d    = snap.data();
  detailTitleEl.textContent = d.name;
  detailDescEl.textContent  = d.description||'';
  if(d.date){
    const dt = d.date.toDate?d.date.toDate():new Date(d.date);
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
btnEdit.onclick = ()=>{
  const d = itemsCache.find(x=>x.id===detailId);
  if(!d) return;
  editId = detailId;
  placeTitleEl.textContent = 'Ort bearbeiten';
  inputPlace.value  = d.name;
  inputDesc.value   = d.description||'';
  inputDate.value   = d.date
    ? (d.date.toDate?d.date.toDate():new Date(d.date))
        .toISOString().slice(0,10)
    : '';
  // lat/lng bereits gesetzt
  selectedLat = d.lat;
  selectedLng = d.lng;
  inputPlace.classList.remove('is-invalid');
  // Modal-Karte initialisieren/verstecken je nach Checkbox
  setupModalMap();
  modalDetail.hide();
  modalPlace.show();
};

// "+" Button
btnAdd.onclick = ()=>{
  editId = null;
  placeTitleEl.textContent = 'Ort hinzufügen';
  formPlace.reset();
  inputPlace.classList.remove('is-invalid');
  selectedLat = selectedLng = null;
  chkManual.checked = false;
  setupModalMap();
  modalPlace.show();
};

// Checkbox Toggle für manuelle Karte
chkManual.addEventListener('change', setupModalMap);

function setupModalMap(){
  if(chkManual.checked){
    modalMapDiv.classList.remove('d-none');
    geocodeHint.classList.add('d-none');
    if(!modalMap){
      modalMap = L.map('modal-map',{ attributionControl:false, zoomControl:true })
        .setView([51.1657,10.4515],6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
        .addTo(modalMap);
      modalMap.on('click', e=>{
        selectedLat = e.latlng.lat;
        selectedLng = e.latlng.lng;
        if(modalMarker) modalMap.removeLayer(modalMarker);
        modalMarker = L.marker([selectedLat,selectedLng]).addTo(modalMap);
      });
    } else {
      modalMap.invalidateSize();
    }
    // Wenn beim Editieren bereits Koords vorliegen:
    if(editId && selectedLat!=null && selectedLng!=null){
      if(modalMarker) modalMap.removeLayer(modalMarker);
      modalMarker = L.marker([selectedLat,selectedLng]).addTo(modalMap);
      modalMap.setView([selectedLat,selectedLng],10);
    }
  } else {
    modalMapDiv.classList.add('d-none');
    geocodeHint.classList.remove('d-none');
  }
}

// FORM SUBMIT (Create/Update)
formPlace.addEventListener('submit', async e=>{
  e.preventDefault();
  const name = inputPlace.value.trim();
  if(!name) return;
  const conflict = itemsCache.some(it=>
    it.name.toLowerCase()===name.toLowerCase() && it.id!==editId
  );
  if(conflict){
    inputPlace.classList.add('is-invalid');
    return;
  }
  inputPlace.classList.remove('is-invalid');

  const descVal = inputDesc.value.trim();
  const dateVal = inputDate.value
    ? Timestamp.fromDate(new Date(inputDate.value))
    : null;

  let lat = selectedLat, lng = selectedLng;
  // wenn nicht manuell, automatisch geocoden
  if(!chkManual.checked){
    try {
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&q='
        + encodeURIComponent(name)+'&limit=1'
      );
      const json = await res.json();
      if(json.length){
        lat = parseFloat(json[0].lat);
        lng = parseFloat(json[0].lon);
      }
    } catch {}
  }

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
btnLogout.onclick = ()=>signOut(auth).then(()=>location.href='index.html');
