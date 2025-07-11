// js/dashboard.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';
import {
  doc,
  getDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

const btnLogout        = document.getElementById('btn-logout');
const versionEl        = document.getElementById('app-version');
const formSettings     = document.getElementById('settings-form');
const cbShowRemaining  = document.getElementById('set-show-remaining');
const selTimeFormat    = document.getElementById('set-time-format');

let currentUid = null;

onAuthStateChanged(auth, async user => {
  if (!user) {
    return location.href = 'index.html';
  }
  currentUid = user.uid;

  // Version
  const infoSnap  = await getDoc(doc(db,'infos','webapp'));
  versionEl.textContent = infoSnap.exists()
    ? infoSnap.data().version
    : 'unbekannt';

  // Nutzereinstellungen laden
  const uDoc = await getDoc(doc(db,'users',currentUid));
  if (uDoc.exists()) {
    const data = uDoc.data();
    cbShowRemaining.checked = !!data.bucketShowRemaining;
    selTimeFormat.value     = data.bucketTimeFormat || 'days';
  }
});

// Logout
btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

// Einstellungen speichern
formSettings.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUid) return;
  const ref = doc(db,'users',currentUid);
  await updateDoc(ref, {
    bucketShowRemaining: cbShowRemaining.checked,
    bucketTimeFormat: selTimeFormat.value
  });
  // Feedback
  formSettings.querySelector('button[type=submit]').textContent = 'Gespeichert';
  setTimeout(() => {
    formSettings.querySelector('button[type=submit]').textContent = 'Speichern';
  }, 1500);
});
