// js/auth.js
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js';
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc
} from 'https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js';

const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegLink  = document.getElementById('show-register');
const showLogLink  = document.getElementById('show-login');
const errDiv       = document.getElementById('auth-error');

// Umschalten
showRegLink.onclick = e => {
  e.preventDefault();
  loginForm.classList.add('d-none');
  registerForm.classList.remove('d-none');
  errDiv.textContent = '';
};
showLogLink.onclick = e => {
  e.preventDefault();
  registerForm.classList.add('d-none');
  loginForm.classList.remove('d-none');
  errDiv.textContent = '';
};

// Persistence (lokal)
setPersistence(auth, browserLocalPersistence)
  .catch(e => console.error('Persistence error', e));

// Registrierung
registerForm.addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const email    = `${username}@kennzeichen-zyo.local`;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Profil speichern
    await setDoc(doc(db, 'users', cred.user.uid), {
      username,
      created: serverTimestamp()
    });
    // Weiter zur Startseite
    window.location.href = 'dashboard.html';
  } catch (err) {
    errDiv.textContent = err.message;
  }
});

// Login
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const email    = `${username}@kennzeichen-zyo.local`;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = 'dashboard.html';
  } catch (err) {
    errDiv.textContent = err.message;
  }
});

// Falls schon eingeloggt → sofort Dashboard
onAuthStateChanged(auth, async user => {
  if (user) {
    // Sicherheitshalber prüfen, ob Profil da ist
    const uDoc = await getDoc(doc(db, 'users', user.uid));
    if (uDoc.exists()) window.location.href = 'dashboard.html';
  }
});
