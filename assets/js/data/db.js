/* ============================================================
   db.js — localStorage tabanlı basit "veritabanı" katmanı.
   index.html doğrudan çift tıklanıp (file://) açılabilsin diye
   IndexedDB yerine localStorage kullanılıyor — IndexedDB bazı
   tarayıcılarda file:// altında güvenilir çalışmıyor, localStorage
   ise çalışıyor. Veri yine tamamen kullanıcının tarayıcısında
   kalır, hiçbir ağ isteği yapılmaz (bkz. README.md §4).

   API'si eskisiyle (IndexedDB sürümü) aynı — tüm işlemler Promise
   döner — ki model.js/import.js hiç değişmeden çalışsın. Gerçekte
   localStorage senkron olduğu için altyapı senkron çalışır, sadece
   dışa Promise olarak sarılır.
   ============================================================ */
(function (global) {
  "use strict";

  const PREFIX = "apron_takip:";

  // Her mağazanın birincil anahtar alanı (IndexedDB sürümündeki keyPath'lerle aynı).
  const STORE_CONFIG = {
    personel: { keyPath: "tc_kimlik_no" },
    apron_kartlari: { keyPath: "id" },
    egitim_kayitlari: { keyPath: "id" },
    imports: { keyPath: "id", autoIncrement: true },
    settings: { keyPath: "key" },
    mapping_profiles: { keyPath: "kaynak" },
  };

  function dataKey(storeName) {
    return PREFIX + storeName;
  }

  function readStore(storeName) {
    try {
      const raw = localStorage.getItem(dataKey(storeName));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("apron: localStorage okunamadı", storeName, e);
      return [];
    }
  }

  function writeStore(storeName, items) {
    try {
      localStorage.setItem(dataKey(storeName), JSON.stringify(items));
    } catch (e) {
      throw new Error(
        "Tarayıcı yerel depolama alanı dolu görünüyor, kayıt tamamlanamadı. " +
          "Gereksiz verileri (örn. Ayarlar > Tüm Verileri Sıfırla) temizleyip tekrar deneyin."
      );
    }
  }

  function nextId(storeName) {
    const counterKey = PREFIX + "counter:" + storeName;
    const next = Number(localStorage.getItem(counterKey) || "0") + 1;
    localStorage.setItem(counterKey, String(next));
    return next;
  }

  const Store = {
    /** Tek kayıt oku */
    get(storeName, key) {
      const cfg = STORE_CONFIG[storeName];
      const found = readStore(storeName).find((it) => it[cfg.keyPath] === key);
      return Promise.resolve(found);
    },
    /** Tüm kayıtları oku */
    getAll(storeName) {
      return Promise.resolve(readStore(storeName));
    },
    /** Basit alan eşleşmesiyle oku (IndexedDB indeksinin yerini tutar) */
    getAllByIndex(storeName, indexName, value) {
      return Promise.resolve(readStore(storeName).filter((it) => it[indexName] === value));
    },
    /** Ekle/güncelle (upsert) — anahtarı (autoIncrement ise otomatik üretilmiş halini) döner */
    put(storeName, value) {
      const cfg = STORE_CONFIG[storeName];
      const items = readStore(storeName);
      let key = value[cfg.keyPath];
      if ((key === undefined || key === null) && cfg.autoIncrement) {
        key = nextId(storeName);
        value = Object.assign({}, value, { [cfg.keyPath]: key });
      }
      const idx = items.findIndex((it) => it[cfg.keyPath] === key);
      if (idx >= 0) items[idx] = value;
      else items.push(value);
      writeStore(storeName, items);
      return Promise.resolve(key);
    },
    /** Toplu upsert */
    putMany(storeName, values) {
      const cfg = STORE_CONFIG[storeName];
      const items = readStore(storeName);
      values.forEach((value) => {
        let key = value[cfg.keyPath];
        if ((key === undefined || key === null) && cfg.autoIncrement) {
          key = nextId(storeName);
          value = Object.assign(value, { [cfg.keyPath]: key });
        }
        const idx = items.findIndex((it) => it[cfg.keyPath] === key);
        if (idx >= 0) items[idx] = value;
        else items.push(value);
      });
      writeStore(storeName, items);
      return Promise.resolve();
    },
    delete(storeName, key) {
      const cfg = STORE_CONFIG[storeName];
      writeStore(storeName, readStore(storeName).filter((it) => it[cfg.keyPath] !== key));
      return Promise.resolve();
    },
    clear(storeName) {
      writeStore(storeName, []);
      return Promise.resolve();
    },
    count(storeName) {
      return Promise.resolve(readStore(storeName).length);
    },
  };

  /** Tüm mağazaları temizler — "Tüm Verileri Sıfırla" için */
  function wipeAll() {
    ["personel", "apron_kartlari", "egitim_kayitlari", "imports"].forEach((n) => writeStore(n, []));
    return Promise.resolve();
  }

  /** Geriye dönük uyumluluk için var; localStorage senkron olduğundan gerçek bir "açma" adımı yok. */
  function openDb() {
    return Promise.resolve(true);
  }

  global.Apron = global.Apron || {};
  global.Apron.DB = { openDb, Store, wipeAll };
})(window);
