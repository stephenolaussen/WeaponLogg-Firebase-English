import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Firebase configuration - PUT IN YOUR CONFIG HERE!
const firebaseConfig = {
  apiKey: "AIzaSyBVIHNdnmY_39KXY3PKlaJ88DotXS_D934",
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
