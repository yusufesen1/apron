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
    HEAS: { key: "HEAS", etiket: "HEAŞ (SAW)" },
    PERSONEL: { key: "PERSONEL", etiket: "Personel / Unvan Listesi" },
  };

  // hedef_alan: model.js'teki alan adları. zorunlu: import sırasında
  // bu alan boşsa satır atlanır ve hata olarak raporlanır.
  const DEFAULT_PROFILES = {
    AHL: {
      kaynak: "AHL",
      aciklama: "İşletme, Bölüm, AD, SOYAD, KARTNO, TCKİMLİKNO, KURS-1 sütunlarını içeren AHL apron Excel'i.",
      alanlar: [
        { hedef_alan: "tc_kimlik_no", excel_sutun: "TCKİMLİKNO", zorunlu: true },
        { hedef_alan: "ad", excel_sutun: "AD", zorunlu: true },
        { hedef_alan: "soyad", excel_sutun: "SOYAD", zorunlu: true },
        // DÜZELTME (kullanıcı geri bildirimi, gerçek Excel örneğiyle): AHL'de
        // "Bölüm" aslında UNVAN taşıyor (Uzman, Stajyer, Uzman Yardımcısı...),
        // Başkanlık diye ayrı bir sütun yok — bkz. model.js ESKI_HATALI_ESLEMELER
        // (kayıtlı eski profillerde de otomatik düzeltilir).
        // DÜZELTME 2 (kullanıcı geri bildirimi, 11.09.2026): "KARTNO" sütunu
        // Sicil No değil, apron KART NO'sunun kendisiymiş — önceki düzeltmede
        // bu ters eşleniyordu (KARTNO→sicil). AHL'de ayrı bir sicil bilgisi yok.
        { hedef_alan: "unvan", excel_sutun: "Bölüm", zorunlu: false },
        { hedef_alan: "sicil", excel_sutun: "", zorunlu: false, gizli: true },
        { hedef_alan: "baskanlik", excel_sutun: "", zorunlu: false, gizli: true },
        { hedef_alan: "kart_no", excel_sutun: "KARTNO", zorunlu: false },
        { hedef_alan: "taseron_firma", excel_sutun: "İşletme", zorunlu: false },
        { hedef_alan: "opsiyon_ham", excel_sutun: "OPSIYON", zorunlu: false, gizli: true },
        { hedef_alan: "kart_durumu", excel_sutun: "", zorunlu: false, gizli: true },
        { hedef_alan: "baslangic_tarihi", excel_sutun: "", zorunlu: false, gizli: true },
        { hedef_alan: "bitis_tarihi", excel_sutun: "", zorunlu: false, gizli: true },
        { hedef_alan: "egitim_tarihi", excel_sutun: "", zorunlu: false, gizli: true },
        // "KURS-1" aslında Güvenlik Bilinci Eğitimi'nin doğrudan bitiş tarihi
        // (İGA AO'daki "Doküman Bitiş Tarihi" ile aynı mantık).
        { hedef_alan: "egitim_bitis_tarihi_dogrudan", excel_sutun: "KURS-1", zorunlu: false },
        { hedef_alan: "gecerlilik_yili", excel_sutun: "", zorunlu: false, gizli: true },
      ],
      // Ayarlar > Eşleştirme Profilleri'nden eklenen, sabit şemada karşılığı
      // olmayan ek sütunlar (bkz. README §6). TC Kimlik No ile kişiye bağlanır.
      ek_alanlar: [],
      // Ayarlar > Eşleştirme Profilleri ekranında satırların gösterim sırası
      // (sürükle-bırak ile kullanıcı tarafından değiştirilebilir). "ek:<key>"
      // ek sütunu, düz "<hedef_alan>" sabit alanı işaret eder. gizli:true olan
      // alanlar (opsiyon_ham, kart_durumu vb.) kaybolmaz — soluk/gizli olarak
      // listenin sonunda görünür, göz ikonuyla tekrar açılabilir (bkz. settings.js).
      siralama: ["taseron_firma", "unvan", "ad", "soyad", "kart_no", "tc_kimlik_no", "egitim_bitis_tarihi_dogrudan"],
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
        // DÜZELTME (kullanıcı geri bildirimi): İGA'da ayrı bir eğitim BAŞLANGIÇ
        // tarihi yok, ama "Doküman Bitiş Tarihi" kartın/eğitimin GERÇEKTEN ne
        // zaman süresi dolacağını gösteriyor — daha önce yanlışlıkla "Bitiş
        // Tarihi" sütunu (kişiye özgü olmayan, sabit bir idari tarih) eğitim
        // BAŞLANGICI sayılıp üstüne bir de geçerlilik yılı ekleniyordu; süresi
        // dolmuş eğitimler yıllarca "Aktif" görünüyordu. Artık bu doğrudan
        // bitiş tarihi olarak kullanılıyor (bkz. model.js upsertEgitimKaydi).
        { hedef_alan: "egitim_bitis_tarihi_dogrudan", excel_sutun: "Doküman Bitiş Tarihi", zorunlu: false },
        { hedef_alan: "egitim_tarihi", excel_sutun: "", zorunlu: false },
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
        { hedef_alan: "bitis_tarihi", excel_sutun: "", zorunlu: false, gizli: true },
        { hedef_alan: "egitim_tarihi", excel_sutun: "Eğitim Tarihi", zorunlu: false },
        { hedef_alan: "gecerlilik_yili", excel_sutun: "Dönemi", zorunlu: false, gizli: true },
        { hedef_alan: "kart_cinsi", excel_sutun: "Kartın Cinsi", zorunlu: false },
        // DÜZELTME (kullanıcı geri bildirimi): "Eğitim / Kurs-1" aslında genel
        // bir metin değil, Güvenlik Bilinci Eğitimi'nin GEÇERLİ olup olmadığını
        // gösteren "Var"/"Yok" durumu — "Yok" ise eğitim kesin süresi dolmuş
        // sayılır (tarih hesabı ne derse desin), "Var" ise normal tarih +
        // Dönemi hesabına göre Aktif/Yaklaşıyor değerlendirilir (bkz. model.js
        // upsertEgitimKaydi). Önceden anlamsız bir Ek Sütun olarak duruyordu.
        { hedef_alan: "egitim_gecerlilik_ham", excel_sutun: "Eğitim / Kurs-1", zorunlu: false },
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
        { key: "mur_durum", excel_sutun: "Mur Durum", etiket: "Mur Durum" },
        { key: "kab_tarih", excel_sutun: "KAB Tarih", etiket: "KAB Tarih" },
        { key: "randevu_tarihi", excel_sutun: "Randevu Tarihi", etiket: "Randevu Tarihi" },
      ],
      // Ayarlar > Eşleştirme Profilleri ekranında satırların gösterim sırası
      // (sürükle-bırak ile kullanıcı tarafından değiştirilebilir). gizli:true
      // olan alanlar (bitis_tarihi, gecerlilik_yili "Dönemi") kaybolmaz —
      // soluk/gizli olarak listenin sonunda görünür (bkz. settings.js).
      siralama: [
        "tc_kimlik_no", "ad", "soyad", "unvan", "baskanlik", "acik_bolum", "egitim_tarihi", "kart_cinsi",
        "ek:muracaat_tipi", "baslangic_tarihi", "ek:teslim_tarihi", "ek:iade_tarihi", "ek:kayip_bild_tarihi",
        "ek:son_tarih", "egitim_gecerlilik_ham", "ek:mur_durum", "kart_durumu", "ek:kab_tarih", "ek:randevu_tarihi",
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
    egitim_bitis_tarihi_dogrudan: "Eğitim/Kart Süresi Bitiş Tarihi (doğrudan)",
    egitim_gecerlilik_ham: "Eğitim Geçerlilik Durumu (Var/Yok)",
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
