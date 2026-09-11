/* ============================================================
   normalize.js — Excel hücrelerini temiz, karşılaştırılabilir
   değerlere çeviren yardımcı fonksiyonlar.
   ============================================================ */
(function (global) {
  "use strict";

  /** Türkçe kurallarına göre büyük harfe çevir (İ/I ayrımı doğru). */
  function turkishUpper(str) {
    if (str == null) return "";
    return String(str).trim().toLocaleUpperCase("tr-TR");
  }

  /**
   * Kaynak Excel'lerdeki TÜM BÜYÜK HARF isimleri ("YILMAZ") okunabilir
   * "İlk Harf Büyük" biçimine çevirir ("Yılmaz"), Türkçe İ/ı/i kurallarına
   * göre (tr-TR locale — düz .toUpperCase()/.toLowerCase() ile karıştırma).
   */
  function turkishTitleCase(str) {
    if (str == null) return "";
    return String(str)
      .trim()
      .toLocaleLowerCase("tr-TR")
      .split(/(\s+|-)/)
      .map((part) => (part.trim() && !/^-$/.test(part) ? part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1) : part))
      .join("");
  }

  function cleanText(v) {
    if (v == null) return "";
    return String(v).replace(/\s+/g, " ").trim();
  }

  /** TC Kimlik No / Sicil gibi sayısal kimlikleri metne, temiz biçime çevirir. */
  function cleanId(v) {
    if (v == null) return "";
    // Excel sayı olarak okuduysa (örn. 12345678901.0) ondalığı at.
    if (typeof v === "number") return String(Math.trunc(v));
    return String(v).replace(/\s+/g, "").replace(/[^\dA-Za-z]/g, "");
  }

  function isValidTcKimlikNo(v) {
    return /^\d{11}$/.test(v);
  }

  const TR_MONTHS = {
    "ocak": 1, "şubat": 2, "subat": 2, "mart": 3, "nisan": 4, "mayıs": 5, "mayis": 5,
    "haziran": 6, "temmuz": 7, "ağustos": 8, "agustos": 8, "eylül": 9, "eylul": 9,
    "ekim": 10, "kasım": 11, "kasim": 11, "aralık": 12, "aralik": 12,
  };

  /**
   * Excel'den gelen bir tarih değerini (JS Date, seri numarası veya metin)
   * ISO "YYYY-MM-DD" biçimine çevirir. Ayrıştırılamazsa null döner.
   */
  function parseExcelDate(v) {
    if (v == null || v === "") return null;

    if (v instanceof Date && !isNaN(v.getTime())) {
      return toIso(v);
    }

    if (typeof v === "number") {
      // Excel seri tarih numarası (1900 tarih sistemi, SheetJS yardımcı fonksiyonu)
      if (global.XLSX && global.XLSX.SSF && global.XLSX.SSF.parse_date_code) {
        const d = global.XLSX.SSF.parse_date_code(v);
        if (d) return `${pad4(d.y)}-${pad2(d.m)}-${pad2(d.d)}`;
      }
      return null;
    }

    const s = cleanText(v);
    if (!s) return null;

    // DD.MM.YYYY, DD/MM/YYYY veya DD-MM-YYYY (gün/ay her zaman 1-2 hane
    // olduğundan "YYYY-MM-DD" biçimiyle çakışmaz, aşağıdaki ayrı kural onu yakalar).
    let m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (m) {
      let [, d, mo, y] = m;
      if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
      return `${pad4(y)}-${pad2(mo)}-${pad2(d)}`;
    }

    // YYYY-MM-DD
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const [, y, mo, d] = m;
      return `${pad4(y)}-${pad2(mo)}-${pad2(d)}`;
    }

    // "12 Mart 2023" gibi metinsel tarih
    m = s.toLocaleLowerCase("tr-TR").match(/^(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})$/);
    if (m) {
      const [, d, monthName, y] = m;
      const mo = TR_MONTHS[monthName];
      if (mo) return `${pad4(y)}-${pad2(mo)}-${pad2(d)}`;
    }

    return null;
  }

  function pad2(n) { return String(n).padStart(2, "0"); }
  function pad4(n) { return String(n).padStart(4, "0"); }
  function toIso(d) { return `${pad4(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

  /** İki tarih arasındaki gün farkı (b - a), gün cinsinden tam sayı. */
  function daysBetween(isoA, isoB) {
    const a = new Date(isoA + "T00:00:00");
    const b = new Date(isoB + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }

  function todayIso() {
    return toIso(new Date());
  }

  /** ISO tarihe yıl ekler (eğitim geçerlilik bitişi hesaplama). */
  function addYearsIso(iso, years) {
    if (!iso || !years) return null;
    const d = new Date(iso + "T00:00:00");
    d.setFullYear(d.getFullYear() + Number(years));
    return toIso(d);
  }

  /** Ekranda göstermek için ISO tarihi GG.AA.YYYY biçimine çevirir. */
  function formatDateTr(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  /** "3 Yıl" / "5 yıl" / "3" / 5 gibi değerlerden 3 veya 5 tam sayısını çıkarır. */
  function parseGecerlilikYili(v) {
    if (v == null) return null;
    const s = cleanText(v);
    // Önceki hâli /[35]/ herhangi bir yerde geçen tek "3" ya da "5" karakterini
    // yakalıyordu — "13 Yıl" gibi bir metinde yanlışlıkla 3 dönüyordu. Şimdi
    // metindeki İLK tam sayı çıkarılıp yalnızca gerçekten 3 veya 5 ise kabul edilir.
    const m = s.match(/\d+/);
    if (!m) return null;
    const n = Number(m[0]);
    return n === 3 || n === 5 ? n : null;
  }

  /** Kart durumu metnini normalize eder ve "aktif mi?" sorusuna bool döner. */
  function isDurumAktif(rawDurum, { defaultWhenMissing = null } = {}) {
    const s = cleanText(rawDurum);
    if (!s) return defaultWhenMissing;
    const up = turkishUpper(s);
    // Kaynağa göre "aktif kart" farklı kelimelerle yazılabiliyor — İGA/AHL'de
    // "Aktif", HEAŞ'ta "Açık" (kullanıcı geri bildirimi: "Açık/Kapalı" yazıyor).
    return up === "AKTİF" || up === "AKTIF" || up === "AÇIK" || up === "ACIK";
  }

  /** "Var"/"Yok" gibi ikili bir durum metnini bool'a çevirir (örn. HEAŞ'ta
      "Eğitim / Kurs-1" — Var: eğitim geçerli, Yok: süresi dolmuş). */
  function isVarDurumu(rawDurum, { defaultWhenMissing = null } = {}) {
    const s = cleanText(rawDurum);
    if (!s) return defaultWhenMissing;
    const up = turkishUpper(s);
    if (up === "VAR") return true;
    if (up === "YOK") return false;
    return defaultWhenMissing;
  }

  function formatNumberTr(n) {
    return new Intl.NumberFormat("tr-TR").format(n);
  }

  /** Türk Lirası biçimi: binlik nokta, sembol başta — "₺2.000". */
  function formatTL(n) {
    return "₺" + new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n || 0);
  }

  /** Uyarı eşiğini (gün) Ayarlar'daki "1/2/3 Ay" seçimine uygun okunur biçime çevirir. */
  function formatEsikSuresi(gun) {
    if (gun && gun % 30 === 0) return `${gun / 30} Ay`;
    return `${gun} Gün`;
  }

  global.Apron = global.Apron || {};
  global.Apron.normalize = {
    turkishUpper,
    turkishTitleCase,
    cleanText,
    cleanId,
    isValidTcKimlikNo,
    parseExcelDate,
    daysBetween,
    todayIso,
    addYearsIso,
    formatDateTr,
    parseGecerlilikYili,
    isDurumAktif,
    isVarDurumu,
    formatNumberTr,
    formatTL,
    formatEsikSuresi,
  };
})(window);
