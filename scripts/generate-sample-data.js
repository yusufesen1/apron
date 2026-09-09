#!/usr/bin/env node
/* ============================================================
   generate-sample-data.js — README §"Ekler" bölümünde sözü
   edilen 5 örnek (sahte) Excel dosyasını üretir. Tüm kişiler,
   sicil numaraları ve T.C. Kimlik No'lar TAMAMEN UYDURMADIR;
   gerçek hiçbir kişiyi temsil etmez. Amaç: çoklu havalimanı,
   taşeron, pasif kart ve eğitim süresi (3/5 yıl) senaryolarını
   test edebilmek.

   Çalıştırma: npm run generate-sample-data
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require(path.join(__dirname, "..", "assets", "js", "vendor", "xlsx.full.min.js"));

const OUT_DIR = path.join(__dirname, "..", "sample-data");

function d(isoStr) {
  const [y, m, day] = isoStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function writeSheet(fileName, header, rows) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sayfa1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellDates: true });
  const fullPath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(fullPath, buf);
  console.log("Yazıldı:", fullPath);
}

// ---------------------------------------------------------------
// AHL — İşletme, Bölüm, AD, SOYAD, KARTNO, OPSIYON, TCKİMLİKNO
// ---------------------------------------------------------------
writeSheet(
  "AHL_apron_sahte.xlsx",
  ["İşletme", "Bölüm", "AD", "SOYAD", "KARTNO", "OPSIYON", "TCKİMLİKNO"],
  [
    ["TSS", "Yer Hizmetleri", "AHMET", "YILMAZ", "AHL-2024-0101", "1", "10000000010"],
    ["TSS", "Ramp Operasyon", "ELİF", "DEMİR", "AHL-2024-0102", "1", "10000000021"],
    ["Kartal Yer Hizmetleri A.Ş.", "Yer Hizmetleri", "ZEYNEP", "ŞAHİN", "AHL-2023-0087", "2", "10000000043"],
    ["TSS", "Ramp Operasyon", "AYŞE", "ÇELİK", "AHL-2024-0110", "1", "10000000065"],
    ["TSS", "Yer Hizmetleri", "FATMA", "KOÇ", "AHL-2024-0115", "1", "10000000098"],
    ["TSS", "Ramp Operasyon", "SERKAN", "BULUT", "AHL-2022-0056", "1", "10000000121"],
    ["TSS", "Yakıt Operasyonları", "GÖKHAN", "ER", "AHL-2024-0130", "1", "10000000143"],
    ["TSS", "Yer Hizmetleri", "EMRE", "DOĞAN", "AHL-2024-0140", "1", "10000000154"],
  ]
);

// ---------------------------------------------------------------
// İGA AO — Form No, Müracaat Türü, Onay Durumu, Kurumu, Taşeron
// Firma, Adı, Soyadı, T.C. Kimlik No/Pasaport No, Bölüm, Unvan,
// Doküman Bitiş Tarihi, Kartın Durumu, Başlangıç Tarihi, Bitiş
// Tarihi, Kart Ücreti, Pasif Açıklama
// ---------------------------------------------------------------
writeSheet(
  "IGA_AO_apron_sahte.xlsx",
  [
    "Form No", "Müracaat Türü", "Onay Durumu", "Kurumu", "Taşeron Firma", "Adı", "Soyadı",
    "T.C. Kimlik No/Pasaport No", "Bölüm", "Unvan", "Doküman Bitiş Tarihi", "Kartın Durumu",
    "Başlangıç Tarihi", "Bitiş Tarihi", "Kart Ücreti", "Pasif Açıklama",
  ],
  [
    ["IGA-8801", "Yeni", "Onaylandı", "TSS", "", "AHMET", "YILMAZ", "10000000010", "Yer Hizmetleri", "Apron Kontrol Uzmanı", d("2027-03-01"), "Aktif", d("2024-03-01"), d("2024-03-01"), 350, ""],
    ["IGA-8802", "Yeni", "Onaylandı", "Taşeron", "Nova Güvenlik Hizmetleri Ltd. Şti.", "MEHMET", "KAYA", "10000000032", "Güvenlik", "Güvenlik Görevlisi", d("2025-01-10"), "Aktif", d("2020-01-10"), d("2020-01-10"), 350, ""],
    ["IGA-8803", "Yenileme", "Onaylandı", "TSS", "", "AYŞE", "ÇELİK", "10000000065", "Ramp Operasyon", "Operasyon Şefi", d("2022-05-01"), "Pasif", d("2022-05-01"), d("2022-05-01"), 350, "Görevden ayrıldı"],
    ["IGA-8804", "Yeni", "Onaylandı", "TSS", "", "BURAK", "AYDIN", "10000000076", "Kargo Operasyonları", "Kargo Sorumlusu", d("2026-10-15"), "Aktif", d("2021-10-15"), d("2021-10-15"), 350, ""],
    ["IGA-8805", "Yeni", "Onaylandı", "TSS", "", "FATMA", "KOÇ", "10000000098", "Yer Hizmetleri", "Apron Kontrol Uzmanı", d("2030-01-01"), "Aktif", d("2025-01-01"), d("2025-01-01"), 350, ""],
    ["IGA-8806", "Yeni", "Onaylandı", "TSS", "", "GÖKHAN", "ER", "10000000143", "Yakıt Operasyonları", "Yakıt İkmal Sorumlusu", d("2028-06-01"), "Aktif", d("2023-06-01"), d("2023-06-01"), 350, ""],
    ["IGA-8807", "Yeni", "Onaylandı", "Taşeron", "Baltic Ground Services", "OLGA", "PETROVA", "PP1234567", "Yer Hizmetleri", "Yer Hizmetleri Uzmanı", d("2029-02-01"), "Aktif", d("2024-02-01"), d("2024-02-01"), 350, ""],
  ]
);

// ---------------------------------------------------------------
// İGA TTAŞ — İGA AO ile BİREBİR AYNI sütun yapısı, ayrı dosya/kaynak
// (bkz. mapping-profiles.js IGA_TTAS). Bazı kişiler İGA AO ile ortak
// (VAR/YOK'un havalimanı bazında bağımsız çalıştığını göstermek için),
// bazıları yalnızca İGA TTAŞ'ta.
// ---------------------------------------------------------------
writeSheet(
  "IGA_TTAS_apron_sahte.xlsx",
  [
    "Form No", "Müracaat Türü", "Onay Durumu", "Kurumu", "Taşeron Firma", "Adı", "Soyadı",
    "T.C. Kimlik No/Pasaport No", "Bölüm", "Unvan", "Doküman Bitiş Tarihi", "Kartın Durumu",
    "Başlangıç Tarihi", "Bitiş Tarihi", "Kart Ücreti", "Pasif Açıklama",
  ],
  [
    ["TTAS-201", "Yeni", "Onaylandı", "Taşeron", "Kartal Yer Hizmetleri A.Ş.", "AHMET", "YILMAZ", "10000000010", "Yer Hizmetleri", "Apron Kontrol Uzmanı", d("2027-04-01"), "Aktif", d("2024-04-01"), d("2024-04-01"), 350, ""],
    ["TTAS-202", "Yeni", "Onaylandı", "Taşeron", "Nova Güvenlik Hizmetleri Ltd. Şti.", "MEHMET", "KAYA", "10000000032", "Güvenlik", "Güvenlik Görevlisi", d("2025-02-10"), "Aktif", d("2020-02-10"), d("2020-02-10"), 350, ""],
    ["TTAS-203", "Yeni", "Onaylandı", "Taşeron", "Baltic Ground Services", "SERKAN", "BULUT", "10000000121", "Ramp Operasyon", "Ramp Sorumlusu", d("2026-07-01"), "Aktif", d("2023-07-01"), d("2023-07-01"), 350, ""],
    ["TTAS-204", "Yenileme", "Onaylandı", "Taşeron", "Nova Güvenlik Hizmetleri Ltd. Şti.", "NUR", "AKSOY", "10000000132", "İnsan Kaynakları", "İnsan Kaynakları Uzmanı", d("2021-09-01"), "Pasif", d("2021-09-01"), d("2021-09-01"), 350, "Sözleşme feshedildi"],
  ]
);

// ---------------------------------------------------------------
// HEAŞ (SAW) — Sıra No, TC-No, Ad, Soyad, Bölüm, Açık Bölüm,
// Görev, Kartın Cinsi, Müracaat Tipi, Müracaat Tarihi, Teslim
// Tarihi, Kart Durum, Eğitim Tarihi, Dönemi
// ---------------------------------------------------------------
writeSheet(
  "HEAS_apron_sahte.xlsx",
  [
    "Sıra No", "TC-No", "Ad", "Soyad", "Bölüm", "Açık Bölüm", "Görev", "Kartın Cinsi",
    "Müracaat Tipi", "Müracaat Tarihi", "Teslim Tarihi", "Kart Durum", "Eğitim Tarihi", "Dönemi",
  ],
  [
    [1, "10000000010", "Ahmet", "Yılmaz", "Yer Hizmetleri", "Apron Kontrol", "Apron Kontrol Uzmanı", "Apron Kart", "Yeni", d("2024-01-15"), d("2024-01-20"), "Aktif", d("2024-01-15"), "5 Yıl"],
    [2, "10000000021", "Elif", "Demir", "Ramp Operasyon", "Ramp", "Ramp Sorumlusu", "Apron Kart", "Yenileme", d("2023-11-01"), d("2023-11-05"), "Aktif", d("2023-11-01"), "3 Yıl"],
    [3, "10000000054", "Can", "Öztürk", "Kalite ve Denetim", "Denetim", "Apron Denetçisi", "Apron Kart", "Yeni", d("2020-05-15"), d("2020-05-20"), "Aktif", d("2020-05-20"), "5 Yıl"],
    [4, "10000000087", "Deniz", "Arslan", "Yer Hizmetleri", "Ekipman", "Ekipman Operatörü", "Apron Kart", "Yeni", d("2023-08-01"), d("2023-08-05"), "Aktif", d("2023-08-01"), "3 Yıl"],
    [5, "10000000098", "Fatma", "Koç", "Yer Hizmetleri", "Apron Kontrol", "Apron Kontrol Uzmanı", "Apron Kart", "Yeni", d("2025-02-01"), d("2025-02-05"), "Aktif", d("2025-02-01"), "5 Yıl"],
    [6, "10000000121", "Serkan", "Bulut", "Ramp Operasyon", "Ramp", "Ramp Sorumlusu", "Apron Kart", "Yenileme", d("2022-03-01"), d("2022-03-05"), "Pasif", d("2022-03-01"), "5 Yıl"],
  ]
);

// ---------------------------------------------------------------
// Personel / Unvan Listesi — SİCİL, TCKİMLİKNO, AD, SOYAD, UNVAN,
// BAŞKANLIK (Emre Doğan ve Olga Petrova bilinçli olarak bu
// listede YOK — apron kaynağından ad/unvan/başkanlık türetme
// (fallback) senaryosunu test etmek için.)
// ---------------------------------------------------------------
writeSheet(
  "PERSONEL_UNVAN_LISTESI_sahte.xlsx",
  ["SİCİL", "TCKİMLİKNO", "AD", "SOYAD", "UNVAN", "BAŞKANLIK"],
  [
    ["100245", "10000000010", "AHMET", "YILMAZ", "Apron Kontrol Uzmanı", "Yer Hizmetleri Başkanlığı"],
    ["100246", "10000000021", "ELİF", "DEMİR", "Ramp Sorumlusu", "Ramp Operasyonları Başkanlığı"],
    ["100247", "10000000032", "MEHMET", "KAYA", "Güvenlik Görevlisi", "Havalimanı Güvenlik Başkanlığı"],
    ["100248", "10000000043", "ZEYNEP", "ŞAHİN", "Bagaj Hizmetleri Sorumlusu", "Yer Hizmetleri Başkanlığı"],
    ["100249", "10000000054", "CAN", "ÖZTÜRK", "Apron Denetçisi", "Kalite ve Denetim Başkanlığı"],
    ["100250", "10000000065", "AYŞE", "ÇELİK", "Operasyon Şefi", "Ramp Operasyonları Başkanlığı"],
    ["100251", "10000000076", "BURAK", "AYDIN", "Kargo Sorumlusu", "Kargo Operasyonları Başkanlığı"],
    ["100252", "10000000087", "DENİZ", "ARSLAN", "Ekipman Operatörü", "Yer Hizmetleri Başkanlığı"],
    ["100253", "10000000098", "FATMA", "KOÇ", "Apron Kontrol Uzmanı", "Yer Hizmetleri Başkanlığı"],
    ["100254", "10000000121", "SERKAN", "BULUT", "Ramp Sorumlusu", "Ramp Operasyonları Başkanlığı"],
    ["100255", "10000000132", "NUR", "AKSOY", "İnsan Kaynakları Uzmanı", "İnsan Kaynakları Başkanlığı"],
    ["100256", "10000000143", "GÖKHAN", "ER", "Yakıt İkmal Sorumlusu", "Yakıt Operasyonları Başkanlığı"],
  ]
);

console.log("\n5 sahte örnek Excel dosyası sample-data/ klasörüne yazıldı.");
