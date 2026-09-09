/* ============================================================
   model.js — İş kuralları: kayıt birleştirme (upsert), eğitim
   durumu hesaplama, konsolide (pivot) görünüm üretimi.
   Bkz. README.md §4 (Hedef Veri Modeli) ve §5 (Fonksiyonel
   Gereksinimler).
   ============================================================ */
(function (global) {
  "use strict";

  const { Store } = global.Apron.DB;
  const N = global.Apron.normalize;

  const HAVALIMANLARI = ["AHL", "IGA_AO", "IGA_TTAS", "HEAS"];
  const HAVALIMANI_ETIKET = { AHL: "AHL", IGA_AO: "İGA", IGA_TTAS: "İGA TTAŞ", HEAS: "HEAŞ" };

  const DEFAULT_SETTINGS = {
    key: "genel",
    // Açık soru #3 (README §8): HEAŞ kendi "Dönemi" sütununu taşıdığı için
    // kayıt bazlı kullanılır. AHL ve İGA'da bu bilgi olmadığından, burada
    // havalimanı bazlı bir VARSAYILAN tanımlanır — Ayarlar ekranından
    // değiştirilebilir. Netleşene kadar geçici bir karardır.
    egitim_sureleri_varsayilan: { AHL: 5, IGA_AO: 5, IGA_TTAS: 5, HEAS: 5 },
    uyari_esik_gun: 60,
    // Kart/sertifika birim maliyetleri (₺) — Maliyet Tablosu panelinde kullanılır.
    // Başlangıç değerleri örnek/yer tutucudur, Ayarlar > Maliyet Ayarları'ndan
    // gerçek rakamlarla güncellenebilir.
    maliyetler: { AHL: 2000, IGA_AO: 2000, IGA_TTAS: 2000, HEAS: 2800, HEAS_eur: 50, GBS: 700 },
    // Genel Bakış tablosuna "Sütun Ekle" ile eklenen isteğe bağlı sütunlar
    // (anahtar listesi, eklenme sırasıyla — soldan sağa böyle dizilir).
    secili_sutunlar: [],
  };

  function getSettings() {
    return Store.get("settings", "genel").then((s) => Object.assign({}, DEFAULT_SETTINGS, s || {}));
  }

  function saveSettings(patch) {
    return getSettings().then((current) => {
      const next = Object.assign({}, current, patch, { key: "genel" });
      return Store.put("settings", next).then(() => next);
    });
  }

  function getMappingProfile(kaynak) {
    return Store.get("mapping_profiles", kaynak).then(
      (p) => p || global.Apron.mapping.DEFAULT_PROFILES[kaynak]
    );
  }

  function getAllMappingProfiles() {
    return Store.getAll("mapping_profiles").then((list) => {
      const byKey = {};
      list.forEach((p) => (byKey[p.kaynak] = p));
      const merged = {};
      Object.keys(global.Apron.mapping.DEFAULT_PROFILES).forEach((k) => {
        merged[k] = byKey[k] || global.Apron.mapping.DEFAULT_PROFILES[k];
      });
      return merged;
    });
  }

  function saveMappingProfile(profile) {
    return Store.put("mapping_profiles", profile);
  }

  function resetMappingProfile(kaynak) {
    return Store.delete("mapping_profiles", kaynak);
  }

  /**
   * Sabit kaynakların (AHL/İGA/HEAŞ/Personel) Ayarlar'dan eklenmiş "Ek Sütunlar"ı
   * ile sihirbazla oluşturulan özel kaynakları TEK bir listede birleştirir.
   * Dashboard "Sütun Ekle" paneli, kaynağın sabit ya da kullanıcı tanımlı olması
   * fark etmeksizin bu birleşik listeyi kullanır (bkz. dashboard.js buildCustomColumns).
   */
  async function getExtraFieldSources() {
    const [profiles, customKaynaklar] = await Promise.all([getAllMappingProfiles(), getCustomKaynaklar()]);
    const sabitKaynaklar = Object.keys(profiles)
      .filter((k) => profiles[k].ek_alanlar && profiles[k].ek_alanlar.length)
      .map((k) => ({
        id: k,
        ad: global.Apron.mapping.KAYNAKLAR[k].etiket,
        alanlar: profiles[k].ek_alanlar,
      }));
    return sabitKaynaklar.concat(customKaynaklar);
  }

  // ---------- Özel (kullanıcı tanımlı) kaynaklar ----------
  // "Yeni Excel Türü Ekle" ile oluşturulan, TC Kimlik No üzerinden kişilere
  // bağlanan, VAR/YOK veya maliyet anlamı taşımayan genel ek bilgi kaynakları.

  function getCustomKaynaklar() {
    return Store.getAll("custom_kaynaklar").then((list) => list.sort((a, b) => (a.olusturma_tarihi || "").localeCompare(b.olusturma_tarihi || "")));
  }

  function saveCustomKaynak(kaynak) {
    return Store.put("custom_kaynaklar", kaynak);
  }

  /** Kaynak tanımını ve o kaynağa ait tüm içe aktarılmış veriyi siler. */
  async function deleteCustomKaynak(kaynakId) {
    const veriler = await Store.getAll("custom_veriler");
    const kalanlar = veriler.filter((v) => v.kaynak_id !== kaynakId);
    await Store.clear("custom_veriler");
    if (kalanlar.length) await Store.putMany("custom_veriler", kalanlar);
    await Store.delete("custom_kaynaklar", kaynakId);
  }

  /**
   * İçe aktarma (import) sırasında kullanılan bellek-içi toplu işlem bağlamı.
   * Neden gerekli: Store.put satır başına TÜM mağazayı okuyup geri yazıyor;
   * binlerce personelde bu O(n²) davranışa (her satırda tüm listeyi
   * JSON.parse/stringify) yol açıp tarayıcı sekmesini dakikalarca kilitleyip
   * "Bu sayfa yanıt vermiyor" uyarısına neden olabiliyordu. Bunun yerine ilgili
   * mağazalar import başında TEK seferde belleğe alınır (bkz. createImportBatch),
   * döngü boyunca yalnızca bellekteki Map'ler güncellenir, import sonunda TEK
   * seferde geri yazılır (bkz. persistImportBatch).
   */
  async function createImportBatch() {
    const [personelList, kartList, egitimList, customList] = await Promise.all([
      Store.getAll("personel"),
      Store.getAll("apron_kartlari"),
      Store.getAll("egitim_kayitlari"),
      Store.getAll("custom_veriler"),
    ]);
    return {
      personel: new Map(personelList.map((p) => [p.tc_kimlik_no, p])),
      apron_kartlari: new Map(kartList.map((k) => [k.id, k])),
      egitim_kayitlari: new Map(egitimList.map((e) => [e.id, e])),
      custom_veriler: new Map(customList.map((c) => [c.id, c])),
    };
  }

  /** createImportBatch ile alınan bağlamı, güncellenmiş haliyle tek seferde geri yazar. */
  async function persistImportBatch(batch) {
    await Promise.all([
      Store.setAll("personel", Array.from(batch.personel.values())),
      Store.setAll("apron_kartlari", Array.from(batch.apron_kartlari.values())),
      Store.setAll("egitim_kayitlari", Array.from(batch.egitim_kayitlari.values())),
      Store.setAll("custom_veriler", Array.from(batch.custom_veriler.values())),
    ]);
  }

  /** Bir özel kaynak satırını batch üzerinde upsert eder — id = kaynak_id + tc_kimlik_no. */
  function upsertCustomVeri(batch, kaynakId, tcKimlikNo, alanlar, kaynakDosya, importId) {
    const id = `${kaynakId}__${tcKimlikNo}`;
    const kayit = {
      id,
      kaynak_id: kaynakId,
      tc_kimlik_no: tcKimlikNo,
      alanlar,
      kaynak_dosya: kaynakDosya,
      import_id: importId,
      guncelleme_tarihi: N.todayIso(),
    };
    batch.custom_veriler.set(id, kayit);
    return kayit;
  }

  /** tc_kimlik_no + havalimani -> deterministik apron_kartlari id */
  function kartId(tcKimlikNo, havalimani) {
    return `${tcKimlikNo}__${havalimani}`;
  }

  /**
   * Bir personel kaydını upsert eder. Personel/Unvan listesi kaynağı
   * SİCİL/UNVAN/BAŞKANLIK için tek doğru kaynaktır (öncelik = PERSONEL);
   * apron kaynaklarından gelen isim/unvan/bölüm sadece o alan boşsa
   * ve mevcut kayıt yoksa kullanılır (fallback).
   */
  function upsertPersonelFromRow(batch, row, kaynak, importId) {
    const existing = batch.personel.get(row.tc_kimlik_no) || {
      tc_kimlik_no: row.tc_kimlik_no,
      sicil: "",
      ad: "",
      soyad: "",
      unvan: "",
      unvan_kaynak: "",
      baskanlik: "",
      baskanlik_kaynak: "",
    };

    const isAuthoritative = kaynak === "PERSONEL";

    const next = Object.assign({}, existing);
    next.tc_kimlik_no = row.tc_kimlik_no;

    if (row.ad) next.ad = isAuthoritative || !existing.ad ? row.ad : existing.ad;
    if (row.soyad) next.soyad = isAuthoritative || !existing.soyad ? row.soyad : existing.soyad;

    if (isAuthoritative && row.sicil) next.sicil = row.sicil;

    if (row.unvan) {
      if (isAuthoritative || !existing.unvan) {
        next.unvan = row.unvan;
        next.unvan_kaynak = kaynak;
      }
    }
    if (row.baskanlik) {
      if (isAuthoritative || !existing.baskanlik) {
        next.baskanlik = row.baskanlik;
        next.baskanlik_kaynak = kaynak;
      }
    }

    next.guncelleme_tarihi = N.todayIso();
    next.son_import_id = importId;

    batch.personel.set(next.tc_kimlik_no, next);
    return next;
  }

  /** Bir havalimanı apron kart kaydını batch üzerinde upsert eder (tc_kimlik_no + havalimani anahtarlı). */
  function upsertApronKart(batch, row, kaynak, importId) {
    const id = kartId(row.tc_kimlik_no, kaynak);
    const existing = batch.apron_kartlari.get(id);

    // Kart Durumu sütunu boşsa (bugün için AHL'de olduğu gibi, bkz. README §3.3)
    // kayıt Excel'de listeleniyorsa aktif kabul edilir. Ayarlar'dan bu kaynağa
    // bir "Kart Durumu" sütunu eşlenip Excel'de değer gelmeye başlarsa, diğer
    // kaynaklarla aynı mantıkla (AKTİF/PASİF metnine göre) değerlendirilir.
    const aktifDegerlendirmesi = N.isDurumAktif(row.kart_durumu, { defaultWhenMissing: null });

    const kart = {
      id,
      tc_kimlik_no: row.tc_kimlik_no,
      havalimani: kaynak,
      kart_no: row.kart_no || (existing ? existing.kart_no : ""),
      kart_durumu_ham: row.kart_durumu || "",
      aktif: aktifDegerlendirmesi === null ? true : aktifDegerlendirmesi,
      baslangic_tarihi: row.baslangic_tarihi || (existing ? existing.baslangic_tarihi : null),
      bitis_tarihi: row.bitis_tarihi || (existing ? existing.bitis_tarihi : null),
      taseron_firma: row.taseron_firma || (existing ? existing.taseron_firma : ""),
      pasif_aciklama: row.pasif_aciklama || "",
      kart_cinsi: row.kart_cinsi || "",
      acik_bolum: row.acik_bolum || "",
      kaynak_dosya: row.__kaynak_dosya || (existing ? existing.kaynak_dosya : ""),
      import_id: importId,
      guncelleme_tarihi: N.todayIso(),
    };

    batch.apron_kartlari.set(id, kart);
    return kart;
  }

  /**
   * Güvenlik Bilinci Eğitimi kaydını batch üzerinde upsert eder. Kaynak başına
   * (İGA proxy, HEAŞ) tek güncel kayıt tutulur — id = tc_kimlik_no + kaynak.
   * Bitiş tarihi: HEAŞ'ta kayda özel "Dönemi" varsa o kullanılır, yoksa
   * havalimanı için Ayarlar'daki varsayılan süre kullanılır.
   */
  function upsertEgitimKaydi(batch, row, kaynak, importId, settings) {
    if (!row.egitim_tarihi) return null;

    const id = `${row.tc_kimlik_no}__${kaynak}`;
    const gecerlilikYili =
      row.gecerlilik_yili || (settings.egitim_sureleri_varsayilan && settings.egitim_sureleri_varsayilan[kaynak]) || 5;
    const bitisTarihi = N.addYearsIso(row.egitim_tarihi, gecerlilikYili);

    const kayit = {
      id,
      tc_kimlik_no: row.tc_kimlik_no,
      kaynak,
      egitim_tarihi: row.egitim_tarihi,
      gecerlilik_yili: gecerlilikYili,
      gecerlilik_kaynagi: row.gecerlilik_yili ? "excel" : "varsayilan",
      bitis_tarihi: bitisTarihi,
      import_id: importId,
      guncelleme_tarihi: N.todayIso(),
    };

    batch.egitim_kayitlari.set(id, kayit);
    return kayit;
  }

  /** En güncel (en ileri tarihli bitiş) eğitim kaydını seçer. */
  function enGuncelEgitim(kayitlar) {
    if (!kayitlar || !kayitlar.length) return null;
    return kayitlar.slice().sort((a, b) => (a.bitis_tarihi < b.bitis_tarihi ? 1 : -1))[0];
  }

  /** Eğitim durumu: Aktif / Yaklaşıyor / Süresi Dolmuş / Bilgi Yok */
  function egitimDurumu(kayit, esikGun) {
    if (!kayit || !kayit.bitis_tarihi) return "Bilgi Yok";
    const today = N.todayIso();
    const kalanGun = N.daysBetween(today, kayit.bitis_tarihi);
    if (kalanGun < 0) return "Süresi Dolmuş";
    if (kalanGun <= esikGun) return "Yaklaşıyor";
    return "Aktif";
  }

  /**
   * Konsolide (pivot) görünümü üretir: satır listesi yalnızca apron kart
   * (ve dolayısıyla eğitim) kayıtlarındaki TC Kimlik No'lardan oluşur.
   * Personel/Unvan listesi satır ÜRETMEZ — yalnızca zaten bir havalimanı
   * kartıyla eşleşen kişilerin sicil/unvan/başkanlık bilgisini tamamlar.
   * Unvan listesinde olup hiçbir apron kartı olmayan kişiler tabloda
   * görünmez (bkz. kullanıcı talebi: TC eşleşmesi olmayan kayıt dahil
   * edilmesin).
   */
  async function buildPivotRows() {
    const [personelList, kartlar, egitimler, ozelVeriler, settings] = await Promise.all([
      Store.getAll("personel"),
      Store.getAll("apron_kartlari"),
      Store.getAll("egitim_kayitlari"),
      Store.getAll("custom_veriler"),
      getSettings(),
    ]);

    const personelByTc = new Map(personelList.map((p) => [p.tc_kimlik_no, p]));
    const kartlarByTc = groupBy(kartlar, "tc_kimlik_no");
    const egitimlerByTc = groupBy(egitimler, "tc_kimlik_no");
    const ozelByTc = groupBy(ozelVeriler, "tc_kimlik_no");

    // Not: personelList kasıtlı olarak dahil edilmiyor — yalnızca en az bir
    // havalimanında apron kartı (veya ondan türeyen eğitim kaydı) olan
    // kişiler tabloda satır olarak görünür.
    const tumTc = new Set([...kartlar.map((k) => k.tc_kimlik_no), ...egitimler.map((e) => e.tc_kimlik_no)]);

    const rows = [];
    for (const tc of tumTc) {
      const p = personelByTc.get(tc);
      const kendiKartlari = kartlarByTc.get(tc) || [];
      const kendiEgitimleri = egitimlerByTc.get(tc) || [];
      const guncelEgitim = enGuncelEgitim(kendiEgitimleri);

      // Özel kaynaklardan gelen veri: { [kaynak_id]: { [alanKey]: değer, ... } }
      const kendiOzelVeri = ozelByTc.get(tc) || [];
      const ozel = {};
      kendiOzelVeri.forEach((v) => (ozel[v.kaynak_id] = v.alanlar));

      const kartByHavalimani = {};
      const havalimaniVar = {};
      HAVALIMANLARI.forEach((h) => {
        const kart = kendiKartlari.find((k) => k.havalimani === h) || null;
        kartByHavalimani[h] = kart;
        havalimaniVar[h] = !!(kart && kart.aktif);
      });

      // Ad/soyad ve unvan/başkanlık için fallback: personel yoksa apron kartlarından türet.
      const adSoyadFallback = kendiKartlari.length ? null : null;
      const ad = (p && p.ad) || firstNonEmpty(kendiKartlari.map((k) => k.__ad)) || "";
      const soyad = (p && p.soyad) || firstNonEmpty(kendiKartlari.map((k) => k.__soyad)) || "";

      rows.push({
        tc_kimlik_no: tc,
        sicil: (p && p.sicil) || "",
        ad,
        soyad,
        ad_soyad: `${ad} ${soyad}`.trim() || "(İsimsiz kayıt)",
        unvan: (p && p.unvan) || "",
        baskanlik: (p && p.baskanlik) || "",
        personel_kaydi_var: !!p,
        kartlar: kartByHavalimani,
        havalimani_var: havalimaniVar,
        egitim_kayitlari: kendiEgitimleri,
        guncel_egitim: guncelEgitim,
        egitim_durumu: egitimDurumu(guncelEgitim, settings.uyari_esik_gun),
        custom: ozel,
      });
    }

    rows.sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"));
    return rows;
  }

  function firstNonEmpty(arr) {
    return (arr || []).find((v) => v);
  }

  function groupBy(arr, key) {
    const map = new Map();
    arr.forEach((item) => {
      const k = item[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    });
    return map;
  }

  global.Apron = global.Apron || {};
  global.Apron.model = {
    HAVALIMANLARI,
    HAVALIMANI_ETIKET,
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings,
    getMappingProfile,
    getAllMappingProfiles,
    saveMappingProfile,
    resetMappingProfile,
    getExtraFieldSources,
    kartId,
    createImportBatch,
    persistImportBatch,
    upsertPersonelFromRow,
    upsertApronKart,
    upsertEgitimKaydi,
    enGuncelEgitim,
    egitimDurumu,
    buildPivotRows,
    getCustomKaynaklar,
    saveCustomKaynak,
    deleteCustomKaynak,
    upsertCustomVeri,
  };
})(window);
