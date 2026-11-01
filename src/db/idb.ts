const DB_NAME = "workout-planner";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("videos")) db.createObjectStore("videos");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const value = await requestToPromise(db.transaction("kv", "readonly").objectStore("kv").get(key));
  db.close();
  return value as T | undefined;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction("kv", "readwrite").objectStore("kv").put(value, key));
  db.close();
}

export async function videoGet(path: string): Promise<Blob | undefined> {
  const db = await openDb();
  const value = await requestToPromise(db.transaction("videos", "readonly").objectStore("videos").get(path));
  db.close();
  return value as Blob | undefined;
}

export async function videoSet(path: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction("videos", "readwrite").objectStore("videos").put(blob, path));
  db.close();
}

export async function videoKeys(): Promise<string[]> {
  const db = await openDb();
  const keys = await requestToPromise(db.transaction("videos", "readonly").objectStore("videos").getAllKeys());
  db.close();
  return keys.map(String);
}

export async function videoClear(): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction("videos", "readwrite").objectStore("videos").clear());
  db.close();
}
