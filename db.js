// db.js
// This is the local/offline database layer for Pashmina Flow.
// The browser stores one JSON document in IndexedDB and a small backup in localStorage.
// A real server can be added later without changing the screens.

const DB_NAME = 'pashmina-flow-local';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
const STATE_KEY = 'main-state';
const BACKUP_KEY = 'pashmina-flow-state-backup';
const DEVICE_KEY = 'pashmina-flow-device-id';

let databasePromise = null;

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (!('indexedDB' in window)) return Promise.resolve(null);

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
}

function readFromIndexedDb(database, key) {
  return new Promise((resolve, reject) => {
    if (!database) {
      resolve(null);
      return;
    }
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function writeToIndexedDb(database, key, value) {
  return new Promise((resolve, reject) => {
    if (!database) {
      resolve();
      return;
    }
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function deleteFromIndexedDb(database, key) {
  return new Promise((resolve, reject) => {
    if (!database) {
      resolve();
      return;
    }
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function loadState() {
  try {
    const database = await openDatabase();
    const indexedValue = await readFromIndexedDb(database, STATE_KEY);
    if (indexedValue) return indexedValue;
  } catch (error) {
    console.warn('IndexedDB could not be read; using the localStorage backup.', error);
  }

  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    return backup ? JSON.parse(backup) : null;
  } catch (error) {
    console.warn('The local backup could not be read.', error);
    return null;
  }
}

export async function saveState(state) {
  const snapshot = copy(state);
  snapshot.meta = snapshot.meta || {};
  snapshot.meta.updatedAt = new Date().toISOString();
  snapshot.meta.localOnly = true;

  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('The localStorage backup could not be written.', error);
  }

  try {
    const database = await openDatabase();
    await writeToIndexedDb(database, STATE_KEY, snapshot);
  } catch (error) {
    console.warn('IndexedDB could not be written; the localStorage backup is still available.', error);
  }

  return snapshot;
}

export async function clearLocalState() {
  try {
    const database = await openDatabase();
    await deleteFromIndexedDb(database, STATE_KEY);
  } catch (error) {
    console.warn('IndexedDB could not be cleared.', error);
  }
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch (error) {
    console.warn('The localStorage backup could not be cleared.', error);
  }
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (error) {
    return 'device-unknown';
  }
}

export function serializeState(state) {
  return JSON.stringify(state, null, 2);
}

export function parseState(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.batches)) {
    throw new Error('This file does not look like a Pashmina Flow backup.');
  }
  return parsed;
}

export function downloadState(state, filename = 'pashmina-flow-backup.json') {
  const blob = new Blob([serializeState(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
