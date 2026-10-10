// Photo scans taken while offline, stored in IndexedDB and uploaded when back online.
import { meals } from './api';

const DB_NAME = 'calorize-offline';
const STORE = 'scanQueue';
const listeners = new Set();
let flushing = false;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(result?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

const notify = () => listeners.forEach((fn) => fn());

export function subscribeScanQueue(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function enqueueScan(blob, context = '') {
  await tx('readwrite', (s) => s.add({ blob, context, createdAt: Date.now() }));
  notify();
}

export async function getQueuedScans() {
  try { return (await tx('readonly', (s) => s.getAll())) || []; } catch { return []; }
}

async function removeScan(id) {
  await tx('readwrite', (s) => s.delete(id));
}

/**
 * Upload queued scans one by one. Stops on a network error (retried on the next
 * 'online' event) or when the server needs an updated weight first.
 */
export async function flushScanQueue({ onSynced, onNeedsWeight, onFailed } = {}) {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (const item of await getQueuedScans()) {
      const fd = new FormData();
      fd.append('photo', item.blob, 'meal.jpg');
      if (item.context) fd.append('context', item.context);
      try {
        const res = await meals.photo(fd);
        if (res.needs_weight) {
          onNeedsWeight?.();
          break;
        }
        await removeScan(item.id);
        onSynced?.(res.meal);
      } catch (err) {
        if (!err.status) break; // still offline / network trouble — keep it queued
        await removeScan(item.id); // the server rejected it (not food, AI error…) — don't retry forever
        onFailed?.(err);
      }
      notify();
    }
  } finally {
    flushing = false;
    notify();
  }
}
