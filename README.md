# APRON Kart Takip Sistemi

## 1. Proje Özeti

Havalimanı apron sahasında çalışabilmek için personelin sahip olması gereken **apron kartlarının** merkezi olarak takip edildiği bir sistem. Üç farklı havalimanı için (**AHL, İGA, HEAŞ/SAW**) ayrı ayrı yürütülen ve farklı formatlarda tutulan Excel kayıtları, tek bir dinamik arayüzde birleştirilecek. Sistem ayrıca apron kartına sahip olmanın ön koşulu olan **"Güvenlik Bilinci Eğitimi"**nin geçerlilik süresini (3 veya 5 yıl) izleyerek süresi dolan/dolmak üzere olan kayıtları görünür kılacak.

## 2. Amaç ve Kapsam

- Bir personelin SİCİL / TC Kimlik No üzerinden **birden fazla havalimanında** apron kartı olup olmadığının tek ekrandan görülmesi.
- Her havalimanının kendi formatındaki Excel'inin (sütun sayısı/isimleri farklı, zaman içinde değişebilir) sisteme **veri kaynağı** olarak eklenmesi ve gerekli alanların otomatik çekilmesi.
- UNVAN/BAŞKANLIK bilgisinin ayrı bir personel/insan kaynakları Excel'inden tamamlanması (apron Excel'lerinin hiçbirinde bu alan tam olarak yok).
- Güvenlik Bilinci Eğitimi tarihinin ve geçerlilik süresinin (3/5 yıl) takip edilip son kullanma tarihine göre durum (aktif / yaklaşıyor / süresi dolmuş) üretilmesi.
- Kapsam dışı (şimdilik): otomasyon/entegrasyon ile Excel'lerin canlı senkronizasyonu — ilk sürümde manuel/periyodik içe aktarma (import) yeterli kabul ediliyor.

## 3. Veri Kaynakları

### 3.1 Hedef ekran — "LAZIM OLAN" (referans format)

| SİCİL | AD SOYAD | UNVAN | BAŞKANLIK | AHL | İGA | HEAŞ | GÜV. BİL. SER. |
|---|---|---|---|---|---|---|---|
| *(personel no)* | *(ad soyad)* | *(farklı excel'den)* | *(farklı excel'den)* | VAR/YOK | VAR/YOK | VAR/YOK | *(tarih)* |

Bu tablo aslında bir **özet/pivot görünüm**dür: AHL/İGA/HEAŞ sütunları o havalimanında aktif kart olup olmadığını (VAR/YOK), GÜV. BİL. SER. sütunu ise güvenlik bilinci eğitim tarihini gösteriyor.

### 3.2 Kaynak Excel'ler ve sütunları

| Kaynak | Sütunlar |
|---|---|
| **AHL** | İşletme, Bölüm, AD, SOYAD, KARTNO, OPSIYON, TCKİMLİKNO |
| **İGA AO** | Form No, Müracaat Türü, Onay Durumu, Kurumu, Taşeron Firma, Adı, Soyadı, T.C. Kimlik No/Pasaport No, Bölüm, Unvan, Doküman Bitiş Tarihi, Kartın Durumu, Başlangıç Tarihi, Bitiş Tarihi, Kart Ücreti, Pasif Açıklama |
| **HEAŞ (SAW)** | Sıra No, TC-No, Ad, Soyad, Bölüm, Açık Bölüm, Görev, Kartın Cinsi, Müracaat Tipi, Müracaat Tarihi, Teslim Tarihi, Kart Durum, Eğitim Tarihi, Dönemi |
| **Personel/Unvan listesi** | SİCİL, TCKİMLİKNO, AD, SOYAD, UNVAN, BAŞKANLIK *(ayrı bir kaynak — HR tipi liste)* |

**Kritik gözlem:** Üç apron Excel'inin **hiçbirinde SİCİL numarası yok**. Ortak alan yalnızca **T.C. Kimlik No** (ve isim). Bu nedenle sistemin kişi eşleştirmesini TC Kimlik No üzerinden yapıp SİCİL/UNVAN/BAŞKANLIK bilgisini Personel listesinden tamamlaması gerekiyor. (Bkz. Açık Sorular.)

### 3.3 Alan eşleştirme (mapping) tablosu

| Hedef alan | AHL | İGA AO | HEAŞ | Personel Listesi |
|---|---|---|---|---|
| TC Kimlik No *(anahtar)* | TCKİMLİKNO | T.C. Kimlik No/Pasaport No | TC-No | TCKİMLİKNO |
| Ad | AD | Adı | Ad | AD |
| Soyad | SOYAD | Soyadı | Soyad | SOYAD |
| Sicil | — | — | — | SİCİL |
| Unvan | — | Unvan | Görev | UNVAN |
| Başkanlık/Bölüm | Bölüm | Bölüm | Bölüm / Açık Bölüm | BAŞKANLIK |
| Kart No | KARTNO | Form No | — | — |
| Kart Durumu | — | Kartın Durumu | Kart Durum | — |
| Kart Başlangıç | — | Başlangıç Tarihi | Müracaat Tarihi | — |
| Kart Bitiş | — | Bitiş Tarihi | — | — |
| Güvenlik Bilinci Eğitim Tarihi | *(bilgi yok — kapsam dışı)* | Bitiş Tarihi *(vekil/proxy alan)* | Eğitim Tarihi | — |
| Eğitim Geçerlilik Süresi | — | — | Dönemi (3/5 Yıl) | — |

> **Netleşti:** AHL için şu an eğitim tarihi bilgisi yok, kapsam dışı bırakıldı. İGA'da ayrı bir eğitim tarihi alanı olmadığı için **"Bitiş Tarihi"** bu amaçla vekil olarak kullanılacak. HEAŞ zaten kendi "Eğitim Tarihi" alanına sahip. 3/5 yıllık geçerlilik süresinin hangi kritere göre atandığı henüz netleşmedi (bkz. Açık Sorular #3).

## 4. Hedef Veri Modeli (öneri)

Excel'lerin format farklılığına dayanıklı olması için tek bir düz tablo yerine normalize bir yapı öneriliyor:

```
Personel
├─ sicil (PK)
├─ tc_kimlik_no (unique)
├─ ad_soyad
├─ unvan
├─ baskanlik
└─ apron_kartlari (1 - N)
     ├─ havalimani (AHL | İGA | HEAŞ)
     ├─ kart_no
     ├─ kart_durumu
     ├─ baslangic_tarihi
     ├─ bitis_tarihi
     └─ kaynak_dosya / import_tarihi

GuvenlikBilinciEgitimi (1 personel - N eğitim kaydı, en güncel kayıt "aktif" kabul edilir)
├─ personel_id (FK)
├─ egitim_tarihi
├─ gecerlilik_suresi (3 yıl | 5 yıl)
├─ bitis_tarihi  (= egitim_tarihi + gecerlilik_suresi, hesaplanır)
└─ durum  (Aktif | Yaklaşıyor | Süresi Dolmuş)
```

Ekrandaki "LAZIM OLAN" görünümü, bu modelin üzerine kurulu bir **pivot/rapor sorgusu**dur (personel × havalimanı VAR/YOK + en güncel eğitim tarihi).

## 5. Fonksiyonel Gereksinimler

1. **Dinamik Excel içe aktarma:** Kullanıcı, ilgili havalimanının Excel dosyasını yükler; sistem önceden tanımlı bir **eşleştirme (mapping) profiline** göre gerekli sütunları çeker. Sütun adı/sırası değiştiğinde kod değişmeden, mapping profili güncellenerek uyum sağlanır.
2. **Personel/Unvan Excel'i:** Ayrı bir kaynak olarak yüklenir, TC Kimlik No üzerinden apron kayıtlarıyla eşleştirilir.
3. **Konsolide görünüm:** SİCİL / AD SOYAD bazında; AHL, İGA, HEAŞ sütunlarında VAR/YOK, güvenlik eğitimi durumu ve bitiş tarihi. **VAR yalnızca "Aktif" durumdaki kartı ifade eder** — pasif/süresi dolmuş kayıtlar YOK sayılır.
4. **Arama & filtreleme:** Sicil, ad-soyad, başkanlık, havalimanı, kart durumu, eğitim durumuna göre.
5. **Uyarılar:** Eğitim geçerliliği bitmiş veya yaklaşan (örn. 60 gün kala) personel listesi.
6. **Çoklu havalimanı desteği:** Bir kişi 1 veya daha fazla havalimanında kayıtlı olabilir; tekil profil sayfasında tüm kartları görünür.
7. **İçe aktarma geçmişi:** Hangi dosyanın ne zaman yüklendiği, kaç kayıt eklendiği/güncellendiği izlenebilir olmalı.
8. **Manuel Excel yükleme:** Her kaynak için ayrı bir **"Excel Yükle"** butonu; otomatik/klasör bazlı senkronizasyon yok.
9. **Taşeron bilgi butonu:** Kaynak dosyada (AHL/İGA) TSS dışı bir firma görünen kayıtlarda, kayıt satırında bir **"Bilgi"** butonu bulunur ve tıklanınca taşeron firma adını gösterir. TSS personeli ile taşeron personeli arasında listeleme açısından ayrım yapılmaz — hepsi aynı listede yer alır.

## 6. Teknik Yaklaşım (öneri)

- **Config-driven import:** Her havalimanı için bir "mapping profili" (JSON/DB kaydı) — hangi Excel sütununun hangi hedef alana karşılık geldiğini tanımlar. Yeni bir sütun değişikliğinde kod değil, bu profil güncellenir.
- **Eşleştirme anahtarı:** TC Kimlik No birincil, Ad+Soyad ikincil doğrulama (yazım farklarını yakalamak için).
- **Frontend:** Design System bağlantınızdaki bileşen kütüphanesi ile (bkz. aşağıdaki not) tablo, filtre, detay paneli ve dosya yükleme ekranları.
- **Backend/veri katmanı:** Excel parse (örn. openpyxl/pandas benzeri), normalize model, pivot sorgu servisi.

## 7. Tasarım Sistemi — TSS Dijital Tasarım Sistemi (alındı, sonradan gevşetildi)

Kaynak: TSS Dijital Tasarım Sistemi kılavuzu (paragraf + görsel olarak iletildi). Font dosyaları (FF Mark OTF) sonraki promptta gelecek.

> **Not (uygulama sürümü):** Kılavuzdaki katı kurallar (gölge yasağı, tek renk, 8px/5px yarıçap) birebir uygulandığında çıktı kullanıcıya "fazla düz/kurumsal" geldi. Kullanıcının açık isteğiyle marka kırmızısı ve logo korunarak; yumuşak gölgeler, havalimanı başına renk kodlama (AHL mavi, İGA turkuaz, HEAŞ amber), daha yuvarlak köşeler (8/14/20px) ve amber tonuyla üç kademeli bir "trafik ışığı" durumu (aktif=yeşil, yaklaşıyor=amber, süresi dolmuş=kırmızı) eklendi. Aşağıdaki kılavuz metni orijinal haliyle referans olarak duruyor; fiili değerler `assets/css/styles.css`'teki `:root` değişkenlerinde.

**Renk:** Tek marka rengi kırmızı `#C90C0F`; basılı/koyu hali `#A90003`; basamaklar `kırmızı-30 #EFB6B7`, `kırmızı-10 #FAE7E7`. Bordo yok. Kırmızı yalnızca logo, marka şeridi, birincil eylem, bağlantı, odak halkası, kicker etiketi ve **olumsuz** durum işaretinde kullanılır — gövde metninde asla. Nötrler: mürekkep `#1A1A1A`, metin `#333333`, sessiz `#595959`, çizgi `#D9D9D9`, yumuşak `#F2F2F2`. Durum: olumlu yeşil `#18733A`; olumsuzun ayrı rengi yok, marka kırmızısının kendisi — her zaman hedef + dönem etiketiyle birlikte gösterilir.

**Zemin:** Tam beyaz. Koyu zemin (`#1A1A1A`) yalnızca istisna, bir belgede payı 1/5'i geçmez.

**Tipografi:** FF Mark (Mark Pro) — yalnızca 400/500/700/900 ağırlıkları (Light/Extra Light yasak). Bir ekranda en fazla 3 ölçek kademesi, satır uzunluğu 60–75 karakter. Ölçek: Hero 900, Bölüm 900, Alt başlık 700, Kart başlığı 700, Gövde 400, Etiket 500, Dipnot 400. Font dosyaları gelene kadar zincir sistem fontlarına (Avenir, system-ui) düşer.

**Boşluk:** 4-8-12-16-24-32-48-64 merdiveni, ara değer yok. 12 kolon grid, 8px kolon arası. Kart dolgusu: rahat 24px (sunum/kapak) veya kompakt 16px (panel/tablo) — bir çıktıda tek kademe.

**Köşe/kenarlık/gölge:** Tek yarıçap 8px (kart/panel), 5px (düğme). İnce 1px sınır ayraç olarak. **Gölge tamamen yasak** — yükselti hissi `translateY(-2px)` + sınırın kırmızıya dönmesiyle verilir. Dekoratif gradyan yok.

**Hareket:** Tek eğri `cubic-bezier(.2,.8,.2,1)`; yalnızca 200ms (üzerine gelme/sınır/renk), 220ms (ölçü), 240ms (katman), 420ms (görsel odak). Zıplama/ease yok. Odak halkası **zorunlu**: 2px kırmızı, 3px boşluk (`outline:none` yazılmaz).

**Bileşen envanteri (kılavuzla sınırlı — fazlası eklenmeyecek):** Button, Card, Table, Indicator, Modal (Katman), ComparisonBlock (Kıyas kalıbı).

**İçerik kuralları:** Kanıtsız süperlatif yok, emoji hiç yok. Düğme etiketi fiil olur ("Raporu Aç", "Kararı Kaydet" — "Tamam"/"Gönder" yasak). Sayı biçimi: binlik nokta, ondalık virgül (`4.567`, `%25`, `15,2`). Dört sabit başlık birbirinin yerine kullanılmaz: **Veriye Dayalı Bulgular / Sübjektif Değerlendirme / Önerilen Aksiyon / Yöntem ve Varsayımlar**. Başlıklar kategori değil karar cümlesi olmalı ("beş saniye testi"). `lang="tr"` her zaman yazılır.

**İkon:** Ayrı ikon dosyası verilmedi; gerekirse aynı çizgi kalınlığında bir CDN seti (örn. Lucide) **ikame olarak işaretlenerek** kullanılabilir. Ölçüler yalnızca 16/20/24px.

**Logo:** ~~Resmi SVG verilmedi; marka adı düz tipografiyle gösterilecek, gerçek logo geldiğinde değiştirilir.~~ Güncelleme: PNG logo teslim edildi ve header'a eklendi (`assets/img/tss-logo-siyah.png`, beyaz zemin varyantı `tss-logo-beyaz.png` de mevcut). Gelecekte vektörel (SVG) sürüm sağlanırsa değiştirilebilir.

Font dosyalarının kaynağı doğrulanamadı (dfonts.org — lisanssız); bu dosyalar projeye gömülmeyecek. Arayüz çalışmasına tanımlı yedek zincirle (**Avenir, system-ui**) devam edilecek. Lisanslı FF Mark dosyaları ileride sağlanırsa değiştirilir.

## 8. Açık Sorular / Varsayımlar

**Yanıtlanan:**

1. ~~SİCİL eşlemesi~~ → **TC Kimlik No** birincil eşleştirme anahtarı.
2. ~~Güvenlik eğitimi tarihi kaynağı~~ → AHL: şu an bilgi yok (kapsam dışı). İGA: **"Bitiş Tarihi"** vekil alan olarak kullanılacak. HEAŞ: kendi **"Eğitim Tarihi"**.
4. ~~VAR/YOK tanımı~~ → Yalnızca **Aktif** durumdaki kart VAR sayılır.
5. ~~Yükleme yöntemi~~ → Manuel, kaynak başına **"Excel Yükle"** butonu.
6. ~~Taşeron personeli~~ → Listedeki **tüm personel** çekilir (TSS/taşeron ayrımı listelemede yapılmaz); taşeron kayıtlarında firma adını gösteren ayrı bir **"Bilgi"** butonu bulunur.
7. ~~Taşeron bilgi butonu kaynak alanı~~ → AHL: "İşletme". İGA: **"Taşeron Firma"** (varsayım — "Kurumu" değil, doğrudan taşeron adını taşıyan alan olduğu için seçildi). **HEAŞ: bu bilgiye karşılık gelen bir sütun yok, buton boş/pasif kalır.**

**Hâlâ açık:**

3. Eğitim geçerlilik süresinin (3 yıl / 5 yıl) hangi kritere göre atandığı — sistemi tasarlatan kişiden netleşecek.

## 9. Sonraki Adımlar

1. Kalan açık soruların (#3, #7) netleştirilmesi.
2. FF Mark (Mark Pro) font dosyalarının (OTF) alınması.
3. Onay sonrası: veri modeli + mapping profilleri + örnek arayüzün (bu README, tasarım sistemi ve ekteki sahte verilerle) prototiplenmesi.

## Ekler

Bu README ile birlikte, gerçek verilerin yapısını birebir yansıtan ama **tamamen uydurma (sahte) kişilerle** doldurulmuş 4 örnek Excel dosyası hazırlandı:

- `AHL_apron_sahte.xlsx`
- `IGA_AO_apron_sahte.xlsx`
- `HEAS_apron_sahte.xlsx`
- `PERSONEL_UNVAN_LISTESI_sahte.xlsx` (unvan/başkanlık kaynağı)
- `ARAC_KARTI_LISTESI_sahte.xlsx` — "Yeni Excel Türü Ekle" sihirbazını denemek için örnek özel kaynak (TC Kimlik No, Plaka, Araç Modeli)

Bazı kişiler kasıtlı olarak birden fazla dosyada (farklı havalimanlarında) tekrar ediyor — çoklu havalimanı senaryosunu test edebilmeniz için.

## 10. Uygulama — Gerçekleşen Sürüm (v1)

### 10.1 Barındırma kararı

Konuşulup netleşti: sistem **tamamen tarayıcı içinde, sunucusuz** çalışıyor. Hiçbir Excel/kişi verisi ağa çıkmaz; hepsi tarayıcının **localStorage**'ında, yalnızca o bilgisayarda saklanır. SheetJS (Excel okuma/yazma) kütüphanesi de `assets/js/vendor/` altına gömülü — npm'deki eski/güvenlik açıklı sürüm yerine SheetJS'in resmi CDN'inden alınan güncel (0.20.3) sürüm kullanıldı, internet bağlantısı gerekmez.

### 10.2 Çalıştırma

`index.html` dosyasına çift tıklamanız yeterli — tarayıcıda doğrudan açılır, kurulum ya da sunucu gerekmez. (Önceki sürümde bir Node sunucusu vardı; IndexedDB `file://` altında bazı tarayıcılarda güvenilir çalışmadığı için gerekiyordu. Depolama katmanı localStorage'a geçirildi — o dosya://'da sorunsuz çalışıyor — ve sunucu tamamen kaldırıldı.)

Örnek (sahte) Excel dosyalarını yeniden üretmek isterseniz: `npm run generate-sample-data` → `sample-data/` klasörüne 4 dosya yazar (yalnızca bu adım Node gerektirir).

> **Not:** localStorage tarayıcı başına ~5-10 MB ile sınırlıdır (IndexedDB'den çok daha küçük). Birkaç bin personel + kart + eğitim kaydı için yeterlidir; çok daha büyük ölçekte (on binlerce kayıt) dolabilir — o noktada Ayarlar'daki "Tüm Verileri Sıfırla" ile temizlenip yeniden içe aktarılması ya da depolamanın tekrar IndexedDB'ye çevrilmesi gerekebilir.

### 10.3 Dosya yapısı

```
index.html                      Uygulama kabuğu
assets/css/styles.css           TSS Dijital Tasarım Sistemi (bkz. §7)
assets/js/vendor/                SheetJS (xlsx.full.min.js) — gömülü, offline
assets/js/data/
  db.js                          localStorage katmanı (personel, apron_kartlari,
                                 egitim_kayitlari, imports, settings, mapping_profiles)
  normalize.js                   Excel hücre temizleme (tarih, TC no, Türkçe metin)
  mapping-profiles.js             Kaynak başına varsayılan sütun eşlemeleri (§3.3)
  model.js                        İş kuralları: upsert, eğitim durumu, pivot üretimi
  import.js                       Excel okuma + mapping uygulama + modele yazma
assets/js/ui/                    Ekranlar (dashboard, import-view, alerts, history,
                                 settings) + modal/toast/icon/multiselect/util yardımcıları
scripts/generate-sample-data.js  4 sahte örnek Excel'i üretir (yalnızca bunun için Node gerekir)
sample-data/                     Üretilen sahte Excel dosyaları
```

### 10.4 Fonksiyonel gereksinimlerin karşılanma durumu (§5)

| # | Gereksinim | Durum |
|---|---|---|
| 1 | Dinamik/config-driven Excel içe aktarma | Tamamlandı — Ayarlar > Eşleştirme Profilleri'nden sütun adları kod değişmeden güncellenebilir |
| 2 | Personel/Unvan Excel'i ayrı kaynak | Tamamlandı — 4. yükleme kartı, TC Kimlik No ile eşleştirilir |
| 3 | Konsolide görünüm (VAR/YOK + eğitim durumu) | Tamamlandı — Genel Bakış sekmesi |
| 4 | Arama & filtreleme | Tamamlandı — TC Kimlik No/ad, başkanlık, havalimanı, eğitim durumu |
| 5 | Uyarılar (yaklaşan/dolmuş) | Tamamlandı — Eğitim Takibi sekmesi, eşik günü Ayarlar'dan değişir (varsayılan 60) |
| 6 | Çoklu havalimanı desteği | Tamamlandı — profil detayında tüm kartlar bir arada |
| 7 | İçe aktarma geçmişi | Tamamlandı — İçe Aktarma Geçmişi sekmesi |
| 8 | Manuel "Excel Yükle" butonları | Tamamlandı — otomatik senkronizasyon yok |
| 9 | Taşeron "Bilgi" butonu | Tamamlandı — AHL: İşletme, İGA: Taşeron Firma; HEAŞ'ta alan yok, buton pasif |

Ek olarak (orijinal kapsamın ötesinde, kullanım sırasında eklenen): "Excel'e Aktar" (konsolide görünümü dışa aktarma), isimlerin Türkçe kurallarına göre okunabilir biçime (İlk Harf Büyük) çevrilmesi, sekmeler arası hızlı geçişte oluşabilecek yarış durumlarına karşı koruma, sütun bazlı sıralama, aranabilir/çoklu seçimli filtre menüleri, Genel Bakış tablosuna isteğe bağlı sütun ekleme ("Sütun Ekle", en fazla 5, kalıcı), Maliyet Tablosu paneli, **"Yeni Excel Türü Ekle"** — sistemde tanımlı olmayan bir Excel'i (TC Kimlik No + istediğiniz sütunları eşleyerek) kalıcı bir kaynak olarak tanımlayabilme; sonradan Ayarlar > Özel Kaynaklar'dan düzenlenebilir/silinebilir, sütunları da "Sütun Ekle" panelinde belirir; ve sabit 4 kaynağın (AHL/İGA/HEAŞ/Personel) Ayarlar > Eşleştirme Profilleri ekranına eklenen **"Ek Sütunlar"** — bu kaynakların Excel'ine sonradan eklenen, sabit şemada karşılığı olmayan sütunları kod değişikliği olmadan tanımlayabilme (aynı "Sütun Ekle" panelinde belirir). (Ayrıca kart durumuna göre aktif/pasif hesaplaması AHL için de forward-compatible hale getirildi — bkz. model.js upsertApronKart; bir "Pasif Kartlar" görünümü denenmiş ama şimdilik kaldırılmıştır, kodu assets/js/ui/pasif.js içinde kullanılmadan duruyor.)

### 10.5 Açık soru #3 nasıl ele alındı

Eğitim geçerlilik süresinin (3/5 yıl) hangi kritere göre atandığı hâlâ netleşmedi. Bu yüzden HEAŞ'ta kayıt bazlı "Dönemi" sütunu olduğu gibi kullanılıyor; AHL ve İGA'da bu bilgi Excel'de yer almadığından, Ayarlar ekranında havalimanı bazlı bir varsayılan (şu an ikisi için de 5 yıl) tanımlandı ve istendiğinde değiştirilebiliyor. Kriter netleştiğinde (örn. personel tipine göre değişiyorsa) model.js içindeki upsertEgitimKaydi fonksiyonu güncellenir.

### 10.6 Test durumu

Uygulama, 4 örnek (sahte) Excel dosyasıyla uçtan uca otomatik olarak (Playwright ile) test edildi: içe aktarma, konsolide görünüm hesaplamaları (VAR/YOK, çoklu havalimanı sayısı, eğitim durumları), filtreleme, personel detay modalı, taşeron bilgi butonu, uyarılar, içe aktarma geçmişi, ayarlar ve sayfa yenilendikten sonra verinin kalıcı kalması (localStorage) doğrulandı. Konsol hatası yok.

Sırada: Gerçek AHL/İGA/HEAŞ ve personel Excel dosyalarıyla deneme (sütun adları örnektekiyle birebir aynı değilse Ayarlar'dan eşleştirme güncellenir), açık soru #3'ün netleştirilmesi, ve talep gelirse lisanslı FF Mark font dosyalarının eklenmesi.
