// js/game.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collectionGroup,
  collection,
  query,
  getDocs,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

// UI-Elemente
const navUpload = document.getElementById('nav-upload');
const btnImport = document.getElementById('btn-import');
const uploadMsg = document.getElementById('upload-msg');

// Auth- und Admin-Check
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  const u = await getDoc(doc(db, 'users', user.uid));
  const name = u.exists() ? u.data().username : null;
  if (name === 'Eztof_1') navUpload.classList.remove('d-none');
});

// Logout
document.getElementById('btn-logout').onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// Navigation zwischen Views
const views = document.querySelectorAll('.view');
document.querySelectorAll('.nav-link').forEach(a => {
  a.onclick = e => {
    e.preventDefault();
    const v = a.dataset.view;
    views.forEach(x =>
      x.id === 'view-' + v
        ? x.classList.remove('d-none')
        : x.classList.add('d-none')
    );
    if (v === 'punktestand') loadScore();
    if (v === 'karte')      loadMap();
  };
});

// Picken ohne Versuchshinweis
document.getElementById('btn-pick').onclick = async () => {
  const inp  = document.getElementById('pick-input');
  const msg  = document.getElementById('pick-msg');
  const code = inp.value.trim().toUpperCase();
  if (!code) return;

  const uid  = auth.currentUser.uid;
  const ref  = doc(db, 'users', uid, 'picks', code);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    msg.textContent = `"${code}" schon gepickt!`;
    inp.classList.add('border-danger');
    await updateDoc(ref, {
      attempts: increment(1),
      lastAttempt: serverTimestamp()
    });
  } else {
    await setDoc(ref, {
      pickedAt: serverTimestamp(),
      attempts: 0
    });
    msg.textContent = `"${code}" wurde gepickt!`;
    inp.classList.add('border-success');
  }

  setTimeout(() => {
    msg.textContent = '';
    inp.value = '';
    inp.classList.remove('border-success','border-danger');
  }, 1500);
};

// Punktestand mit zusätzlicher Spalte "Ort"
async function loadScore() {
  const summaryDiv = document.getElementById('score-summary');
  const tableBody  = document.getElementById('score-table-body');
  summaryDiv.innerHTML = '';
  tableBody.innerHTML  = '<tr><td colspan="5">Lade…</td></tr>';

  // 1) alle Picks
  const pickSnap = await getDocs(query(collectionGroup(db,'picks')));
  const userPicks = {}; // uid → Array<Picks>
  pickSnap.docs.forEach(d => {
    const uid  = d.ref.parent.parent.id;
    const dat = d.data();
    const date = dat.pickedAt?.toDate() || new Date(0);
    const at   = dat.attempts || 0;
    if (!userPicks[uid]) userPicks[uid] = [];
    userPicks[uid].push({ code: d.id, date, attempts: at });
  });

  // 2) Nutzernamen
  const names = {};
  for (const uid of Object.keys(userPicks)) {
    const u = await getDoc(doc(db,'users', uid));
    names[uid] = u.exists() ? u.data().username : uid;
  }

  // 3) Zusammenfassung
  const badgeClasses = ['primary','success','info','warning','secondary'];
  Object.keys(userPicks).forEach((uid,i) => {
    const span = document.createElement('span');
    span.className = `badge bg-${badgeClasses[i%badgeClasses.length]} me-2`;
    span.textContent = `${names[uid]}: ${userPicks[uid].length} Picks`;
    summaryDiv.appendChild(span);
  });

  // 4) Flachliste & sortieren (neueste zuerst)
  const flat = [];
  Object.entries(userPicks).forEach(([uid,arr]) =>
    arr.forEach(p => flat.push({ uid, ...p }))
  );
  flat.sort((a,b) => b.date - a.date);

  // 5) City-Werte vorgeladen
  const cityMap = {};
  for (const item of flat) {
    if (!cityMap[item.code]) {
      const p = await getDoc(doc(db,'plates', item.code));
      cityMap[item.code] = p.exists() ? p.data().city : item.code;
    }
  }

  // 6) Tabelle füllen
  const rowClasses = ['table-primary','table-success','table-info','table-warning','table-secondary'];
  tableBody.innerHTML = '';
  if (flat.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">Noch keine Picks</td></tr>';
    return;
  }
  const uids = Object.keys(userPicks);
  flat.forEach(item => {
    const idx = uids.indexOf(item.uid) % rowClasses.length;
    const tr  = document.createElement('tr');
    tr.className = rowClasses[idx];
    tr.innerHTML = `
      <td>${names[item.uid]}</td>
      <td>${item.code}</td>
      <td>${cityMap[item.code]}</td>
      <td>${item.date.toLocaleDateString()}</td>
      <td>${item.attempts>0?item.attempts:''}</td>
    `;
    tableBody.appendChild(tr);
  });
}

// Karte (unchanged) …
let mapLoaded = false;
async function loadMap() { /* dein Leaflet/GeoJSON-Code */ }

// Hilfsfunktionen …
function loadScript(src){return new Promise(r=>{const s=document.createElement('script');s.src=src;s.onload=r;document.head.append(s);});}
function loadCSS(href){return new Promise(r=>{const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.onload=r;document.head.append(l);});}

// Upload & Import bleiben unverändert…
document.getElementById('btn-upload').onclick = async () => { /* … */ };
btnImport.onclick = async () => { /* … */ };
