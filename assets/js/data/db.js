/* ============================================================
   db.js — IndexedDB tabanlı "veritabanı" katmanı.
   localStorage'dan buraya geçildi: localStorage tarayıcı başına
   ~5-10 MB ile sınırlı ve gerçek ölçekli bir şirket verisinde
   (binlerce personel × birden fazla havalimanı × ek sütunlar)
   hızla doluyordu. IndexedDB'nin kotası disk alanına göre değişir,
   genelde yüzlerce MB - birkaç GB mertebesindedir.

   index.html yine sadece çift tıklanıp (file://) açılır — IndexedDB
   de localStorage gibi tamamen tarayıcı içi çalışır, sunucu/ağ
   isteği gerekmez, veri yine yalnızca o bilgisayarda kalır (bkz.
   README.md §4). Hedeflenen tarayıcı (Microsoft Edge) file://
   altında IndexedDB'yi güvenilir çalıştırıyor.

   Store API'si öncekiyle (localStorage sürümü) birebir aynı — tüm
   işlemler Promise döner — ki model.js/import.js hiç değişmeden
   çalışsın.
   ============================================================ */
(function (global) {
  "use strict";

  const DB_NAME = "apron_takip";
  const DB_VERSION = 1;

  // Her mağazanın birincil anahtar alanı.
  const STORE_CONFIG = {
    personel: { keyPath: "tc_kimlik_no" },
    apron_kartlari: { keyPath: "id" },
    egitim_kayitlari: { keyPath: "id" },
    imports: { keyPath: "id", autoIncrement: true },
    settings: { keyPath: "key" },
    mapping_profiles: { keyPath: "kaynak" },
    // Kullanıcının "Yeni Excel Türü Ekle" ile tanımladığı özel kaynaklar.
    custom_kaynaklar: { keyPath: "id" },
    custom_veriler: { keyPath: "id" },
  };

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        Object.keys(STORE_CONFIG).forEach((name) => {
          if (db.objectStoreNames.contains(name)) return;
          const cfg = STORE_CONFIG[name];
          db.createObjectStore(name, { keyPath: cfg.keyPath, autoIncrement: !!cfg.autoIncrement });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(friendlyError(req.error));
    });
    return dbPromise;
  }

  /** Depolama alanı dolduğunda (kota aşımı) kullanıcıya anlamlı bir mesaj göster. */
  function friendlyError(err) {
    if (err && err.name === "QuotaExceededError") {
      return new Error(
        "Tarayıcı yerel depolama alanı dolu görünüyor, kayıt tamamlanamadı. " +
          "Gereksiz verileri (örn. Ayarlar > Tüm Verileri Sıfırla) temizleyip tekrar deneyin."
      );
    }
    return err;
  }

  async function objectStore(storeName, mode) {
    const db = await openDb();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function wrapRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(friendlyError(request.error));
    });
  }

  /** Bir transaction'ın tüm istekleri tamamlanıp kalıcı olana kadar bekler
      (birden fazla put() çağrısının hepsini tek transaction'da yapan
      putMany/setAll için). */
  function txDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(friendlyError(transaction.error));
      transaction.onabort = () => reject(friendlyError(transaction.error));
    });
  }

  const Store = {
    /** Tek kayıt oku */
    async get(storeName, key) {
      const store = await objectStore(storeName, "readonly");
      return wrapRequest(store.get(key));
    },
    /** Tüm kayıtları oku */
    async getAll(storeName) {
      const store = await objectStore(storeName, "readonly");
      return wrapRequest(store.getAll());
    },
    /** Basit alan eşleşmesiyle oku — gerçek bir IDB index yerine bellek içinde
        filtrelenir (ayrı index şeması/versiyon yönetimi gerektirmez; bu
        boyuttaki mağazalarda sorunsuz çalışır). */
    async getAllByIndex(storeName, indexName, value) {
      const all = await Store.getAll(storeName);
      return all.filter((it) => it[indexName] === value);
    },
    /** Ekle/güncelle (upsert) — anahtarı (autoIncrement ise otomatik üretilmiş halini) döner */
    async put(storeName, value) {
      const store = await objectStore(storeName, "readwrite");
      return wrapRequest(store.put(value));
    },
    /** Toplu upsert — tek transaction'da art arda put() (bkz. import.js performans notu). */
    async putMany(storeName, values) {
      const store = await objectStore(storeName, "readwrite");
      values.forEach((value) => store.put(value));
      return txDone(store.transaction);
    },
    /** Mağazanın tamamını doğrudan değiştirir (önce temizler, sonra tek
        transaction'da yeniden yazar) — çağıran taraf zaten TAM ve güncel
        içeriği elinde tutuyorsa (bkz. model.js createImportBatch/persistImportBatch) kullanılır. */
    async setAll(storeName, items) {
      const store = await objectStore(storeName, "readwrite");
      store.clear();
      items.forEach((value) => store.put(value));
      return txDone(store.transaction);
    },
    async delete(storeName, key) {
      const store = await objectStore(storeName, "readwrite");
      return wrapRequest(store.delete(key));
    },
    async clear(storeName) {
      const store = await objectStore(storeName, "readwrite");
      return wrapRequest(store.clear());
    },
    async count(storeName) {
      const store = await objectStore(storeName, "readonly");
      return wrapRequest(store.count());
    },
  };

  /** Tüm mağazaları temizler — "Tüm Verileri Sıfırla" için. Kaynak TANIMLARI
      (mapping_profiles, custom_kaynaklar) kasıtlı olarak silinmez — yalnızca
      içe aktarılmış VERİLER temizlenir. */
  async function wipeAll() {
    const names = ["personel", "apron_kartlari", "egitim_kayitlari", "imports", "custom_veriler"];
    await Promise.all(names.map((n) => Store.clear(n)));
  }

  global.Apron = global.Apron || {};
  global.Apron.DB = { openDb, Store, wipeAll };
})(window);
