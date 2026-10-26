/** Wrapper mínimo do IndexedDB: um banco, três stores, chave `playlistId` (ou `key` no kv). */
const DB_NAME = "reouvir";
const STORES = ["manifests", "state"] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      for (const s of STORES) req.result.createObjectStore(s, { keyPath: "playlistId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const idb = {
  get: <T>(store: StoreName, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key)),
  put: <T>(store: StoreName, value: T) => run(store, "readwrite", (s) => s.put(value)),
  del: (store: StoreName, key: string) => run(store, "readwrite", (s) => s.delete(key)),
  all: <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll()),
};
