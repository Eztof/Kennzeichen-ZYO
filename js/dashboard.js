// js/dashboard.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';
import {
  doc,
  getDoc,
  updateDoc,
  getDocs
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

const btnLogout       = document.getElementById('btn-logout');
const btnSettings     = document.getElementById('btn-settings');
const versionEl       = document.getElementById('app-version');
const modalSettingsEl = document.getElementById('modal-settings');
const formSettings    = document.getElementById('settings-form');
const cbShowRemaining = document.getElementById('set-show-remaining');
const selTimeFormat   = document.getElementById('set-time-format');

let currentUid = null;
const settingsModal = new bootstrap.Modal(modalSettingsEl);

// 1) Auth & initiales Laden
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'index.html';
  currentUid = user.uid;

  // 1a) Versionsnummer
  const infoSnap = await getDoc(doc(db, 'infos', 'webapp'));
  versionEl.textContent = infoSnap.exists()
    ? infoSnap.data().version
    : 'unbekannt';

  // 1b) Nutzereinstellungen laden
  const uDoc = await getDoc(doc(db, 'users', currentUid));
  if (uDoc.exists()) {
    const data = uDoc.data();
    cbShowRemaining.checked = !!data.bucketShowRemaining;
    selTimeFormat.value     = data.bucketTimeFormat || 'days';
  }
});

// 2) Logout
btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// 3) Settings-Modal öffnen
btnSettings.addEventListener('click', () => {
  settingsModal.show();
});

// 4) Settings speichern
formSettings.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUid) return;
  const ref = doc(db, 'users', currentUid);
  await updateDoc(ref, {
    bucketShowRemaining: cbShowRemaining.checked,
    bucketTimeFormat: selTimeFormat.value
  });
  // kurzes Feedback
  const btn = formSettings.querySelector('button[type=submit]');
  btn.textContent = 'Gespeichert';
  setTimeout(() => { btn.textContent = 'Speichern'; }, 1500);
  settingsModal.hide();
});
