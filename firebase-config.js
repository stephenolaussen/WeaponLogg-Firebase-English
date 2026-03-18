import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Firebase configuration - REPLACE WITH YOUR NEW API KEY FROM FIREBASE CONSOLE
// This key was exposed and must be replaced with a new one from Google Cloud Console
const firebaseConfig = {
  apiKey: "YOUR_NEW_API_KEY_HERE",
  authDomain: "weaponlog-private.firebaseapp.com",
  projectId: "weaponlog-private",
  storageBucket: "weaponlog-private.firebasestorage.app",
  messagingSenderId: "601806962636",
  appId: "1:601806962636:web:23d9ad83dd203a848de769",
  measurementId: "G-J1TDB4CE21"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log('[Firebase] Configured');
