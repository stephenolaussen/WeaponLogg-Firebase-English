import { db } from './firebase-config.js';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let unsubscribers = {};

export async function setupRealtimeSync(onUpdate) {
  const collections_to_listen = ['members', 'weapons', 'loans', 'shooting_instructors', 'settings'];
  
  collections_to_listen.forEach(collName => {
    if (unsubscribers[collName]) unsubscribers[collName]();
    const q = query(collection(db, collName));
    unsubscribers[collName] = onSnapshot(q, (snapshot) => {
      console.log(`[Firebase] ${collName} synchronized`);
      onUpdate(collName, snapshot);
    }, (error) => {
      console.error(`[Firebase] Error:`, error);
    });
  });
}

export function stopRealtimeSync() {
  Object.keys(unsubscribers).forEach(key => {
    if (unsubscribers[key]) unsubscribers[key]();
  });
  unsubscribers = {};
  console.log('[Firebase] Sync stopped');
}

export async function getCollection(collName) {
  try {
    const snapshot = await getDocs(collection(db, collName));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`[Firebase] Error:`, error);
    return [];
  }
}

export async function setDocument(collName, docId, data) {
  try {
    await setDoc(doc(db, collName, docId), data);
  } catch (error) {
    console.error(`[Firebase] Error:`, error);
    throw error;
  }
}

export async function updateDocument(collName, docId, updates) {
  try {
    await updateDoc(doc(db, collName, docId), updates);
  } catch (error) {
    console.error(`[Firebase] Error:`, error);
    throw error;
  }
}

export async function deleteDocument(collName, docId) {
  try {
    await deleteDoc(doc(db, collName, docId));
  } catch (error) {
    console.error(`[Firebase] Error:`, error);
    throw error;
  }
}

export async function batchWrite(operations) {
  const batch = writeBatch(db);
  operations.forEach(op => {
    const docRef = doc(db, op.collection, op.id);
    if (op.type === 'set') batch.set(docRef, op.data);
    else if (op.type === 'update') batch.update(docRef, op.data);
    else if (op.type === 'delete') batch.delete(docRef);
  });
  try {
    await batch.commit();
  } catch (error) {
    console.error(`[Firebase] Error:`, error);
    throw error;
  }
}

export async function exportAllData() {
  const collections_list = ['medlemmer', 'vapen', 'utlaan', 'skyteledere', 'settings'];
  const result = {};
  for (const collName of collections_list) {
    result[collName] = await getCollection(collName);
  }
  return result;
}

export async function importData(data) {
  const operations = [];
  Object.keys(data).forEach(collName => {
    if (Array.isArray(data[collName])) {
      data[collName].forEach(docData => {
        operations.push({
          type: 'set',
          collection: collName,
          id: docData.id || docData.navn || 'unknown',
          data: docData
        });
      });
    }
  });
  
  if (operations.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < operations.length; i += chunkSize) {
      await batchWrite(operations.slice(i, i + chunkSize));
    }
  }
  console.log(`[Firebase] ${operations.length} dokumenter importert`);
}

export default {
  setupRealtimeSync,
  stopRealtimeSync,
  getCollection,
  setDocument,
  updateDocument,
  deleteDocument,
  batchWrite,
  exportAllData,
  importData
};
