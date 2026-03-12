import { auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log('[Auth] Logged in:', result.user.email);
    return result.user;
  } catch (error) {
    console.error('[Auth] Error:', error);
    throw error;
  }
}

export async function logout() {
  try {
    await signOut(auth);
    console.log('[Auth] Logged out');
  } catch (error) {
    console.error('[Auth] Error:', error);
    throw error;
  }
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}
