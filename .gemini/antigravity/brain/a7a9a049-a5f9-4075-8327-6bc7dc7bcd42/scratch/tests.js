const fs = require('fs');
const assert = require('assert');

// 1. Mock ortamı hazırla
const window = {
  Apron: {
    DB: { Store: {} }
  },
  XLSX: {
    SSF: { parse_date_code: (v) => ({ y: 2023, m: 10, d: 25 }) } // mock
  }
};

const normalizeContent = fs.readFileSync('c:/Users/yusuf/Desktop/apron/assets/js/data/normalize.js', 'utf8');
const modelContent = fs.readFileSync('c:/Users/yusuf/Desktop/apron/assets/js/data/model.js', 'utf8');
const mappingContent = fs.readFileSync('c:/Users/yusuf/Desktop/apron/assets/js/data/mapping-profiles.js', 'utf8');
const importContent = fs.readFileSync('c:/Users/yusuf/Desktop/apron/assets/js/data/import.js', 'utf8');

// Dosyaları eval ederek window nesnesine yükle
eval(normalizeContent);
eval(mappingContent);
eval(modelContent);
eval(importContent);

const N = window.Apron.normalize;
const Model = window.Apron.model;
const Mapping = window.Apron.mapping;
const Importer = window.Apron.importer;

try {
  console.log("=== NORMALIZE.JS TESTLERİ ===");
  // TC Kimlik Temizleme
  assert.strictEqual(N.cleanId(" 123 456 789 01 "), "12345678901", "Boşluklu TC temizlenmeli");
  assert.strictEqual(N.cleanId(12345678901.0), "12345678901", "Sayısal TC metne çevrilmeli");
  
  // Tarih Parse
  assert.strictEqual(N.parseExcelDate("12.05.2023"), "2023-05-12", "DD.MM.YYYY parse");
  assert.strictEqual(N.parseExcelDate("2023-11-20"), "2023-11-20", "YYYY-MM-DD parse");
  assert.strictEqual(N.parseExcelDate("12 Mart 2023"), "2023-03-12", "Metinsel tarih parse");
  
  // İsim Formatı
  assert.strictEqual(N.turkishTitleCase("YILMAZ"), "Yılmaz", "Büyük harf kelime düzeltme");
  assert.strictEqual(N.turkishTitleCase("ELİF"), "Elif", "Türkçe karakterli kelime düzeltme");
  assert.strictEqual(N.turkishTitleCase("AHMET YILMAZ"), "Ahmet Yılmaz", "Birden fazla kelime düzeltme");
  console.log("-> Normalize testleri başarılı.");

  console.log("=== MODEL.JS TESTLERİ ===");
  // Eğitim Durumu Hesaplama
  assert.strictEqual(Model.egitimDurumu(null, 60), "Bilgi Yok");
  assert.strictEqual(Model.egitimDurumu({ bitis_tarihi: "2020-01-01" }, 60), "Süresi Dolmuş");
  // Bugünün tarihine göre dinamik test
  const today = new Date();
  today.setDate(today.getDate() + 30);
  const futureIso = N.toIso ? N.toIso(today) : today.toISOString().split('T')[0]; 
  assert.strictEqual(Model.egitimDurumu({ bitis_tarihi: futureIso }, 60), "Yaklaşıyor", "60 gün altına yaklaşıyor dönmeli");
  
  // VAR/YOK Mantığı (Aktif değerlendirmesi)
  assert.strictEqual(N.isDurumAktif("Aktif"), true);
  assert.strictEqual(N.isDurumAktif("Pasif"), false);
  assert.strictEqual(N.isDurumAktif(null, { defaultWhenMissing: true }), true);
  console.log("-> Model testleri başarılı.");

  console.log("=== MAPPING-PROFILES.JS TESTLERİ ===");
  assert.ok(Mapping.KAYNAKLAR.AHL, "AHL kaynağı bulunmalı");
  assert.ok(Mapping.DEFAULT_PROFILES.AHL, "AHL profili bulunmalı");
  assert.strictEqual(Mapping.DEFAULT_PROFILES.IGA_AO.alanlar.find(a => a.hedef_alan === "tc_kimlik_no").zorunlu, true, "TC zorunlu olmalı");
  console.log("-> Mapping profilleri testleri başarılı.");

  console.log("=== IMPORT.JS TESTLERİ ===");
  const rawRow = {
    "T.C. Kimlik No/Pasaport No": " 12345678901 ",
    "Adı": " AHMET ",
    "Soyadı": " YILMAZ ",
    "Başlangıç Tarihi": "15.01.2023"
  };
  const profile = Mapping.DEFAULT_PROFILES.IGA_AO;
  const result = Importer.mapRow(rawRow, profile);
  assert.strictEqual(result.out.tc_kimlik_no, "12345678901", "Mapped TC kimlik no");
  assert.strictEqual(result.out.ad, "Ahmet", "Mapped ad title case");
  assert.strictEqual(result.out.soyad, "Yılmaz", "Mapped soyad title case");
  assert.strictEqual(result.out.baslangic_tarihi, "2023-01-15", "Mapped date");
  assert.strictEqual(result.eksikZorunlu.length, 0, "Zorunlu alan eksik olmamalı");
  console.log("-> Import veri dönüşüm testleri başarılı.");

  console.log("\n*** TÜM TESTLER BAŞARIYLA TAMAMLANDI ***");
} catch(err) {
  console.error("Test hatası:", err);
  process.exit(1);
}
