/* ============================================================
   mapping-profiles.js — Kaynak bazlı, config-driven eşleştirme
   profilleri (bkz. README.md §3.3, §6 "Config-driven import").

   Her profil: hangi hedef alanın hangi Excel sütun BAŞLIĞINA
   karşılık geldiğini tanımlar. Sütun adı/sırası değişirse kod
   değişmeden, bu profil Ayarlar ekranından güncellenir.

   excel_sutun eşleştirmesi büyük/küçük harf ve boşluğa duyarsız
   yapılır (bkz. import.js -> normalizeHeader).
   ============================================================ */
(function (global) {
  "use strict";

  const KAYNAKLAR = {
    AHL: { key: "AHL", etiket: "AHL" },
    IGA_AO: { key: "IGA_AO", etiket: "İGA AO" },
    IGA_TTAS: { key: "IGA_TTAS", etiket: "İGA TTAŞ" },
    HEAS: { key: "HEAS", etiket: "HEAŞ (SAW)" },
    PERSONEL: { key: "PERSONEL", etiket: "Personel / Unvan Listesi" },
  };

  // hedef_alan: model.js'teki alan adları. zorunlu: import sırasında
  // bu alan boşsa satır atlanır ve hata olarak raporlanır.
  const DEFAULT_PROFILES = {
    AHL: {
      kaynak: "AHL",
      aciklama: "İşletme, Bölüm, AD, SOYAD, KARTNO, OPSIYON, TCKİMLİKNO sütunlarını içeren AHL apron Excel'i.",
      alanlar: [
        { hedef_alan: "tc_kimlik_no", excel_sutun: "TCKİMLİKNO", zorunlu: true },
        { hedef_alan: "ad", excel_sutun: "AD", zorunlu: true },
        { hedef_alan: "soyad", excel_sutun: "SOYAD", zorunlu: true },
        { hedef_alan: "baskanlik", excel_sutun: "Bölüm", zorunlu: false },
        { hedef_alan: "kart_no", excel_sutun: "KARTNO", zorunlu: false },
        { hedef_alan: "taseron_firma", excel_sutun: "İşletme", zorunlu: false },
        { hedef_alan: "opsiyon_ham", excel_sutun: "OPSIYON", zorunlu: false },
        // AHL kaynağında kart durumu / eğitim tarihi sütunu yok (bkz. README §3.3 açık not).
        { hedef_alan: "kart_durumu", excel_sutun: "", zorunlu: false },
        { hedef_alan: "baslangic_tarihi", excel_sutun: "", zorunlu: false },
        { hedef_alan: "bitis_tarihi", excel_sutun: "", zorunlu: false },
        { hedef_alan: "egitim_tarihi", excel_sutun: "", zorunlu: false },
        { hedef_alan: "gecerlilik_yili", excel_sutun: "", zorunlu: false },
      ],
      // Ayarlar > Eşleştirme Profilleri'nden eklenen, sabit şemada karşılığı
      // olmayan ek sütunlar (bkz. README §6). TC Kimlik No ile kişiye bağlanır.
      ek_alanlar: [],
    },

    IGA_AO: {
      kaynak: "IGA_AO",
      aciklama: "Form No, Müracaat Türü, Onay Durumu, Kurumu, Taşeron Firma, Adı, Soyadı, T.C. Kimlik No/Pasaport No, Bölüm, Unvan, Doküman Bitiş Tarihi, Kartın Durumu, Başlangıç Tarihi, Bitiş Tarihi, Kart Ücreti, Pasif Açıklama sütunlarını içeren İGA AO apron Excel'i.",
      alanlar: [
        { hedef_alan: "tc_kimlik_no", excel_sutun: "T.C. Kimlik No/Pasaport No", zorunlu: true },
        { hedef_alan: "ad", excel_sutun: "Adı", zorunlu: true },
        { hedef_alan: "soyad", excel_sutun: "Soyadı", zorunlu: true },
        { hedef_alan: "unvan", excel_sutun: "Unvan", zorunlu: false },
        { hedef_alan: "baskanlik", excel_sutun: "Bölüm", zorunlu: false },
        { hedef_alan: "kart_no", excel_sutun: "Form No", zorunlu: false },
        { hedef_alan: "kart_durumu", excel_sutun: "Kartın Durumu", zorunlu: false },
        { hedef_alan: "baslangic_tarihi", excel_sutun: "Başlangıç Tarihi", zorunlu: false },
        { hedef_alan: "bitis_tarihi", excel_sutun: "Bitiş Tarihi", zorunlu: false },
        { hedef_alan: "taseron_firma", excel_sutun: "Taşeron Firma", zorunlu: false },
        // Netleşen karar (README §3.3): İGA'da ayrı eğitim tarihi alanı yok,
        // "Bitiş Tarihi" vekil (proxy) alan olarak kullanılıyor.
        { hedef_alan: "egitim_tarihi", excel_sutun: "Bitiş Tarihi", zorunlu: false },
        { hedef_alan: "gecerlilik_yili", excel_sutun: "", zorunlu: false },
        { hedef_alan: "pasif_aciklama", excel_sutun: "Pasif Açıklama", zorunlu: false },
      ],
      ek_alanlar: [],
    },

    // İGA TTAŞ: ayrı bir dosya olarak yüklenen, İGA AO'dan bağımsız 4. kaynak —
    // ama Excel'i aynı taşeron/apron başvuru sistemi üzerinden geldiği için
    // sütun başlıkları İGA AO ile birebir aynı (kullanıcı isteği).
    IGA_TTAS: {
      kaynak: "IGA_TTAS",
      aciklama: "Form No, Müracaat Türü, Onay Durumu, Kurumu, Taşeron Firma, Adı, Soyadı, T.C. Kimlik No/Pasaport No, Bölüm, Unvan, Doküman Bitiş Tarihi, Kartın Durumu, Başlangıç Tarihi, Bitiş Tarihi, Kart Ücreti, Pasif Açıklama sütunlarını içeren İGA TTAŞ apron Excel'i (İGA AO ile aynı sütun yapısı, ayrı dosya).",
      alanlar: [
        { hedef_alan: "tc_kimlik_no", excel_sutun: "T.C. Kimlik No/Pasaport No", zorunlu: true },
        { hedef_alan: "ad", excel_sutun: "Adı", zorunlu: true },
        { hedef_alan: "soyad", excel_sutun: "Soyadı", zorunlu: true },
        { hedef_alan: "unvan", excel_sutun: "Unvan", zorunlu: false },
        { hedef_alan: "baskanlik", excel_sutun: "Bölüm", zorunlu: false },
        { hedef_alan: "kart_no", excel_sutun: "Form No", zorunlu: false },
        { hedef_alan: "kart_durumu", excel_sutun: "Kartın Durumu", zorunlu: false },
        { hedef_alan: "baslangic_tarihi", excel_sutun: "Başlangıç Tarihi", zorunlu: false },
        { hedef_alan: "bitis_tarihi", excel_sutun: "Bitiş Tarihi", zorunlu: false },
        { hedef_alan: "taseron_firma", excel_sutun: "Taşeron Firma", zorunlu: false },
        { hedef_alan: "egitim_tarihi", excel_sutun: "Bitiş Tarihi", zorunlu: false },
        { hedef_alan: "gecerlilik_yili", excel_sutun: "", zorunlu: false },
        { hedef_alan: "pasif_aciklama", excel_sutun: "Pasif Açıklama", zorunlu: false },
      ],
      ek_alanlar: [],
    },

    HEAS: {
      kaynak: "HEAS",
      aciklama:
        "Sıra No, TC-No, Ad, Soyad, Ad Soyad, Bölüm, Açık Bölüm, Görev, Kartın Cinsi, Müracaat Tipi, Müracaat Tarihi, Teslim Tarihi, İade Tarihi, Kayıp Bild. Tarihi, Son Tarih, Eğitim / Kurs-1, Mur Durum, Kart Durum, KAB Tarih, Randevu Tarihi, Eğitim Tarihi, Dönemi sütunlarını içeren HEAŞ (SAW) apron Excel'i.",
      alanlar: [
        { hedef_alan: "tc_kimlik_no", excel_sutun: "TC-No", zorunlu: true },
        { hedef_alan: "ad", excel_sutun: "Ad", zorunlu: true },
        { hedef_alan: "soyad", excel_sutun: "Soyad", zorunlu: true },
        { hedef_alan: "unvan", excel_sutun: "Görev", zorunlu: false },
        { hedef_alan: "baskanlik", excel_sutun: "Bölüm", zorunlu: false },
        { hedef_alan: "acik_bolum", excel_sutun: "Açık Bölüm", zorunlu: false },
        { hedef_alan: "kart_durumu", excel_sutun: "Kart Durum", zorunlu: false },
        { hedef_alan: "baslangic_tarihi", excel_sutun: "Müracaat Tarihi", zorunlu: false },
        { hedef_alan: "bitis_tarihi", excel_sutun: "", zorunlu: false },
        { hedef_alan: "egitim_tarihi", excel_sutun: "Eğitim Tarihi", zorunlu: false },
        { hedef_alan: "gecerlilik_yili", excel_sutun: "Dönemi", zorunlu: false },
        { hedef_alan: "kart_cinsi", excel_sutun: "Kartın Cinsi", zorunlu: false },
      ],
      // "Sıra No" (satır sırası, kişiye özgü anlamlı bilgi değil) ve "Ad Soyad"
      // (zaten Ad+Soyad'dan geliyor) kasıtlı olarak eşlenmedi; geri kalan yeni
      // sütunlar veri kaybolmasın diye Ek Sütun olarak eklendi — Ayarlar'dan
      // istenirse kaldırılabilir/etiketi değiştirilebilir (bkz. README §6).
      // Not: kaynak adı ("HEAŞ (SAW)") dashboard.js'te otomatik eklendiği için
      // etikete tekrar yazılmaz (bkz. buildCustomColumns).
      ek_alanlar: [
        { key: "muracaat_tipi", excel_sutun: "Müracaat Tipi", etiket: "Müracaat Tipi" },
        { key: "teslim_tarihi", excel_sutun: "Teslim Tarihi", etiket: "Teslim Tarihi" },
        { key: "iade_tarihi", excel_sutun: "İade Tarihi", etiket: "İade Tarihi" },
        { key: "kayip_bild_tarihi", excel_sutun: "Kayıp Bild. Tarihi", etiket: "Kayıp Bild. Tarihi" },
        { key: "son_tarih", excel_sutun: "Son Tarih", etiket: "Son Tarih" },
        { key: "egitim_kurs_1", excel_sutun: "Eğitim / Kurs-1", etiket: "Eğitim / Kurs-1" },
        { key: "mur_durum", excel_sutun: "Mur Durum", etiket: "Mur Durum" },
        { key: "kab_tarih", excel_sutun: "KAB Tarih", etiket: "KAB Tarih" },
        { key: "randevu_tarihi", excel_sutun: "Randevu Tarihi", etiket: "Randevu Tarihi" },
      ],
    },

    PERSONEL: {
      kaynak: "PERSONEL",
      aciklama: "SİCİL, TCKİMLİKNO, AD, SOYAD, UNVAN, BAŞKANLIK sütunlarını içeren, unvan/başkanlık bilgisinin tek doğru kaynağı olan personel listesi.",
      alanlar: [
        { hedef_alan: "sicil", excel_sutun: "SİCİL", zorunlu: true },
        { hedef_alan: "tc_kimlik_no", excel_sutun: "TCKİMLİKNO", zorunlu: true },
        { hedef_alan: "ad", excel_sutun: "AD", zorunlu: true },
        { hedef_alan: "soyad", excel_sutun: "SOYAD", zorunlu: true },
        { hedef_alan: "unvan", excel_sutun: "UNVAN", zorunlu: false },
        { hedef_alan: "baskanlik", excel_sutun: "BAŞKANLIK", zorunlu: false },
      ],
      ek_alanlar: [],
    },
  };

  // Hedef alanların insan-okunur etiketleri (Ayarlar ekranı mapping editöründe kullanılır).
  const ALAN_ETIKETLERI = {
    tc_kimlik_no: "T.C. Kimlik No",
    ad: "Ad",
    soyad: "Soyad",
    sicil: "Sicil",
    unvan: "Unvan",
    baskanlik: "Başkanlık / Bölüm",
    acik_bolum: "Açık Bölüm (detay)",
    kart_no: "Kart No",
    kart_durumu: "Kart Durumu",
    baslangic_tarihi: "Kart Başlangıç Tarihi",
    bitis_tarihi: "Kart Bitiş Tarihi",
    taseron_firma: "Taşeron Firma (Bilgi butonu)",
    opsiyon_ham: "Opsiyon (ham bilgi)",
    egitim_tarihi: "Güvenlik Bilinci Eğitim Tarihi",
    gecerlilik_yili: "Eğitim Geçerlilik Süresi (3/5 Yıl)",
    pasif_aciklama: "Pasif Açıklama",
    kart_cinsi: "Kartın Cinsi",
  };

  function cloneDefaultProfiles() {
    return JSON.parse(JSON.stringify(DEFAULT_PROFILES));
  }

  global.Apron = global.Apron || {};
  global.Apron.mapping = {
    KAYNAKLAR,
    DEFAULT_PROFILES,
    ALAN_ETIKETLERI,
    cloneDefaultProfiles,
  };
})(window);
