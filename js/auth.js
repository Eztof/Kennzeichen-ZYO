// js/auth.js (Debug-Version)
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

console.log('🔥 auth.js geladen');

const loginForm    = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegLink  = document.getElementById('show-register');
const showLogLink  = document.getElementById('show-login');
const errDiv       = document.getElementById('auth-error');

// Umschalten Login ↔ Registrierung
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

// Local Persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log('🔒 Persistence gesetzt'))
  .catch(e => console.error('Persistence-Fehler', e));

// Registrierung
registerForm.addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const email    = `${username}@kennzeichen-zyo.local`;

  console.log('📝 Registrierung angefragt für:', username, email);

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✅ Firebase Auth User erstellt, UID =', cred.user.uid);

    // Firestore-Profil anlegen
    const userRef = doc(db, 'users', cred.user.uid);
    console.log('⏳ setDoc wird gerufen auf', userRef.path);
    await setDoc(userRef, {
      username: username,
      created: serverTimestamp()
    });
    console.log('✅ Firestore-Dokument users/' + cred.user.uid + ' angelegt');

    window.location.href = 'game.html';
  } catch (err) {
    console.error('❌ Registrierung fehlgeschlagen:', err);
    errDiv.textContent = err.message;
  }
});

// Login
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const email    = `${username}@kennzeichen-zyo.local`;

  console.log('🔑 Login angefragt für:', username, email);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Login erfolgreich');
    window.location.href = 'game.html';
  } catch (err) {
    console.error('❌ Login-Fehler:', err);
    errDiv.textContent = err.message;
  }
});
