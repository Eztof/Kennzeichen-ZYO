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

const btnLogout       = document.getElementById('btn-logout');
const btnSettings     = document.getElementById('btn-settings');
const versionEl       = document.getElementById('app-version');
const modalSettingsEl = document.getElementById('modal-settings');
const formSettings    = document.getElementById('settings-form');
const cbShowRemaining = document.getElementById('set-show-remaining');
const selTimeFormat   = document.getElementById('set-time-format');

let currentUid = null;
const settingsModal = new bootstrap.Modal(modalSettingsEl);

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = 'index.html';
    return;
  }
  currentUid = user.uid;

  // Version laden
  const infoSnap = await getDoc(doc(db, 'infos', 'webapp'));
  versionEl.textContent = infoSnap.exists()
    ? infoSnap.data().version
    : 'unbekannt';

  // Nutzereinstellungen
  const uSnap = await getDoc(doc(db, 'users', currentUid));
  if (uSnap.exists()) {
    const d = uSnap.data();
    cbShowRemaining.checked = !!d.bucketShowRemaining;
    selTimeFormat.value     = d.bucketTimeFormat || 'days';
  }
});

btnLogout.onclick = () =>
  signOut(auth).then(() => location.href = 'index.html');

btnSettings.onclick = () =>
  settingsModal.show();

formSettings.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUid) return;
  await updateDoc(doc(db, 'users', currentUid), {
    bucketShowRemaining: cbShowRemaining.checked,
    bucketTimeFormat: selTimeFormat.value
  });
  const btn = formSettings.querySelector('button[type=submit]');
  btn.textContent = 'Gespeichert';
  setTimeout(() => btn.textContent = 'Speichern', 1500);
  settingsModal.hide();
});
