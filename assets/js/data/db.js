/* ============================================================
   db.js — IndexedDB katmanı (sunucusuz, taşıyıcı-only mimari)
   Tüm veri kullanıcının tarayıcısında kalır; hiçbir ağ isteği
   yapılmaz. Bkz. README.md §4 (Hedef Veri Modeli).
   ============================================================ */
(function (global) {
  "use strict";

  const DB_NAME = "apron_takip_db";
  const DB_VERSION = 1;

  /** @type {IDBDatabase|null} */
  let dbInstance = null;

  function openDb() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (ev) => {
        const db = req.result;

        if (!db.objectStoreNames.contains("personel")) {
          const store = db.createObjectStore("personel", { keyPath: "tc_kimlik_no" });
          store.createIndex("sicil", "sicil", { unique: false });
        }

        if (!db.objectStoreNames.contains("apron_kartlari")) {
          const store = db.createObjectStore("apron_kartlari", { keyPath: "id" });
          store.createIndex("tc_kimlik_no", "tc_kimlik_no", { unique: false });
          store.createIndex("havalimani", "havalimani", { unique: false });
        }

        if (!db.objectStoreNames.contains("egitim_kayitlari")) {
          const store = db.createObjectStore("egitim_kayitlari", { keyPath: "id" });
          store.createIndex("tc_kimlik_no", "tc_kimlik_no", { unique: false });
        }

        if (!db.objectStoreNames.contains("imports")) {
          db.createObjectStore("imports", { keyPath: "id", autoIncrement: true });
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("mapping_profiles")) {
          db.createObjectStore("mapping_profiles", { keyPath: "kaynak" });
        }
      };

      req.onsuccess = () => {
        dbInstance = req.result;
        resolve(dbInstance);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Veritabanı başka bir sekmede açık kaldığı için güncellenemedi."));
    });
  }

  function tx(storeNames, mode) {
    return openDb().then((db) => db.transaction(storeNames, mode));
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const Store = {
    /** Tek kayıt oku */
    get(storeName, key) {
      return tx(storeName, "readonly").then((t) => reqToPromise(t.objectStore(storeName).get(key)));
    },
    /** Tüm kayıtları oku */
    getAll(storeName) {
      return tx(storeName, "readonly").then((t) => reqToPromise(t.objectStore(storeName).getAll()));
    },
    /** İndeks üzerinden oku */
    getAllByIndex(storeName, indexName, value) {
      return tx(storeName, "readonly").then((t) =>
        reqToPromise(t.objectStore(storeName).index(indexName).getAll(value))
      );
    },
    /** Ekle/güncelle (upsert) */
    put(storeName, value) {
      return tx(storeName, "readwrite").then((t) => reqToPromise(t.objectStore(storeName).put(value)));
    },
    /** Toplu upsert — tek transaction */
    putMany(storeName, values) {
      return tx(storeName, "readwrite").then(
        (t) =>
          new Promise((resolve, reject) => {
            const os = t.objectStore(storeName);
            values.forEach((v) => os.put(v));
            t.oncomplete = () => resolve();
            t.onerror = () => reject(t.error);
          })
      );
    },
    delete(storeName, key) {
      return tx(storeName, "readwrite").then((t) => reqToPromise(t.objectStore(storeName).delete(key)));
    },
    clear(storeName) {
      return tx(storeName, "readwrite").then((t) => reqToPromise(t.objectStore(storeName).clear()));
    },
    count(storeName) {
      return tx(storeName, "readonly").then((t) => reqToPromise(t.objectStore(storeName).count()));
    },
  };

  /** Tüm mağazaları temizler — "Tüm Verileri Sıfırla" için */
  function wipeAll() {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const names = ["personel", "apron_kartlari", "egitim_kayitlari", "imports"];
          const t = db.transaction(names, "readwrite");
          names.forEach((n) => t.objectStore(n).clear());
          t.oncomplete = () => resolve();
          t.onerror = () => reject(t.error);
        })
    );
  }

  global.Apron = global.Apron || {};
  global.Apron.DB = { openDb, Store, wipeAll };
})(window);
