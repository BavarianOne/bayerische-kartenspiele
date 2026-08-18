export function open(name, version, upgradeCallback) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      upgradeCallback(db, e.oldVersion, req.result.transaction);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function transactionPromise(db, storeNames, mode) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    resolve(tx);
    tx.onerror = () => reject(tx.error);
  });
}

export function objectStorePromise(tx, storeName) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore(storeName);
    resolve(store);
  });
}

// Higher-level helpers
export function idbPut(db, storeName, value) {
  return transactionPromise(db, storeName, 'readwrite').then(tx => {
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(storeName).put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export function idbGet(db, storeName, key) {
  return transactionPromise(db, storeName, 'readonly').then(tx => {
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

export function idbGetAll(db, storeName) {
  return transactionPromise(db, storeName, 'readonly').then(tx => {
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

export function idbDelete(db, storeName, key) {
  return transactionPromise(db, storeName, 'readwrite').then(tx => {
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export function idbClear(db, storeName) {
  return transactionPromise(db, storeName, 'readwrite').then(tx => {
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}