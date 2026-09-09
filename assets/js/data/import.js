/* ============================================================
   import.js — Excel dosyasını okuma, mapping profiline göre
   satırları hedef alanlara çevirme ve modele yazma.
   Bkz. README.md §5 FR1/FR2/FR7 ve §6 "Config-driven import".
   ============================================================ */
(function (global) {
  "use strict";

  const N = global.Apron.normalize;
  const { Store } = global.Apron.DB;
  const Model = global.Apron.model;

  const DATE_FIELDS = new Set(["baslangic_tarihi", "bitis_tarihi", "egitim_tarihi"]);

  function normalizeHeader(h) {
    return N.cleanText(h).toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
  }

  /** Workbook'u okuyup ilk sayfayı satır dizisine (header -> value obje) çevirir. */
  function readWorkbook(arrayBuffer) {
    const wb = global.XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = global.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
    return { sheetName, rows, sheetNames: wb.SheetNames };
  }

  /** Bir ham Excel satırını, mapping profiline göre hedef alan objesine çevirir. */
  function mapRow(rawRow, profile) {
    const headerIndex = {};
    Object.keys(rawRow).forEach((h) => (headerIndex[normalizeHeader(h)] = h));

    const out = {};
    const eksikZorunlu = [];

    profile.alanlar.forEach((alan) => {
      if (!alan.excel_sutun) return; // bu kaynakta bu alan yok (bilinçli boş bırakılmış)
      const key = headerIndex[normalizeHeader(alan.excel_sutun)];
      let value = key !== undefined ? rawRow[key] : undefined;

      if (alan.hedef_alan === "tc_kimlik_no" || alan.hedef_alan === "sicil") {
        value = value === undefined ? "" : N.cleanId(value);
      } else if (alan.hedef_alan === "gecerlilik_yili") {
        value = N.parseGecerlilikYili(value);
      } else if (DATE_FIELDS.has(alan.hedef_alan)) {
        value = N.parseExcelDate(value);
      } else if (alan.hedef_alan === "ad" || alan.hedef_alan === "soyad" || alan.hedef_alan === "unvan") {
        // Kaynak Excel'ler genelde TÜM BÜYÜK HARF tutuyor; okunabilirlik için
        // Türkçe kurallarına göre "İlk Harf Büyük" biçime çevrilir.
        value = value === undefined ? "" : N.turkishTitleCase(value);
      } else {
        value = value === undefined ? "" : N.cleanText(value);
      }

      out[alan.hedef_alan] = value;
      if (alan.zorunlu && !value) eksikZorunlu.push(alan.hedef_alan);
    });

    // Ayarlar > Eşleştirme Profilleri'nden eklenen, sabit şemada karşılığı
    // olmayan ek sütunlar — "Yeni Excel Türü Ekle" ile aynı mantıkla, TC
    // Kimlik No üzerinden kişiye bağlanacak ayrı bir obje olarak toplanır.
    if (profile.ek_alanlar && profile.ek_alanlar.length) {
      const ek = {};
      profile.ek_alanlar.forEach((alan) => {
        if (!alan.excel_sutun) return;
        const key = headerIndex[normalizeHeader(alan.excel_sutun)];
        ek[alan.key] = key !== undefined ? N.cleanText(rawRow[key]) : "";
      });
      out.__ek = ek;
    }

    return { out, eksikZorunlu };
  }

  /**
   * Bir Excel dosyasını verilen kaynak için içe aktarır.
   * @param {File} file
   * @param {"AHL"|"IGA_AO"|"HEAS"|"PERSONEL"} kaynak
   * @returns {Promise<object>} import özeti
   */
  async function importFile(file, kaynak) {
    const buf = await file.arrayBuffer();
    const { rows, sheetName } = readWorkbook(buf);
    const profile = await Model.getMappingProfile(kaynak);
    const settings = await Model.getSettings();

    if (!rows.length) {
      throw new Error(`"${file.name}" içinde okunabilir satır bulunamadı (sayfa: ${sheetName}).`);
    }

    // Beklenen sütunların en az bir kısmı dosyada var mı? (yanlış dosya seçimini yakalamak için)
    const headerIndex = new Set(Object.keys(rows[0]).map(normalizeHeader));
    const beklenenSutunlar = profile.alanlar.filter((a) => a.excel_sutun).map((a) => normalizeHeader(a.excel_sutun));
    const eslesenSutunSayisi = beklenenSutunlar.filter((s) => headerIndex.has(s)).length;
    if (eslesenSutunSayisi === 0) {
      throw new Error(
        `"${file.name}" dosyasındaki sütun başlıkları "${global.Apron.mapping.KAYNAKLAR[kaynak].etiket}" eşleştirme profiliyle uyuşmuyor. ` +
          `Ayarlar > Eşleştirme Profilleri ekranından sütun adlarını güncelleyebilirsiniz.`
      );
    }

    let eklenen = 0;
    let guncellenen = 0;
    let atlanan = 0;
    const hatalar = [];

    const importRecordDraft = {
      kaynak,
      dosya_adi: file.name,
      tarih: new Date().toISOString(),
      toplam_satir: rows.length,
    };
    const importId = await Store.put("imports", importRecordDraft);

    // Tüm ilgili mağazalar TEK seferde belleğe alınır; döngü boyunca localStorage'a
    // dokunulmaz (bkz. model.js createImportBatch — büyük dosyalarda tarayıcının
    // kilitlenmesini/"yanıt vermiyor" uyarısını önlemek için).
    const batch = await Model.createImportBatch();

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const isRowEmpty = Object.values(raw).every((v) => v === "" || v == null);
      if (isRowEmpty) continue;

      const { out, eksikZorunlu } = mapRow(raw, profile);

      if (eksikZorunlu.length) {
        atlanan++;
        hatalar.push(
          `Satır ${i + 2}: zorunlu alan(lar) boş veya okunamadı (${eksikZorunlu
            .map((f) => global.Apron.mapping.ALAN_ETIKETLERI[f] || f)
            .join(", ")}).`
        );
        continue;
      }

      if (!N.isValidTcKimlikNo(out.tc_kimlik_no) && kaynak !== "PERSONEL") {
        // Pasaport no ile gelen İGA kayıtları (T.C. olmayan) 11 haneli olmayabilir;
        // yine de kaydı reddetmiyoruz, sadece uyarı düşüyoruz — kimlik anahtarı olarak kullanılabilir.
        hatalar.push(`Satır ${i + 2}: "${out.tc_kimlik_no}" standart 11 haneli T.C. Kimlik No biçiminde değil (pasaport olabilir).`);
      }

      out.__kaynak_dosya = file.name;

      const existingKart = kaynak !== "PERSONEL" ? batch.apron_kartlari.get(Model.kartId(out.tc_kimlik_no, kaynak)) : null;
      const existingPersonel = batch.personel.get(out.tc_kimlik_no);

      Model.upsertPersonelFromRow(batch, out, kaynak, importId);

      if (kaynak !== "PERSONEL") {
        Model.upsertApronKart(batch, out, kaynak, importId);
        Model.upsertEgitimKaydi(batch, out, kaynak, importId, settings);
      }

      if (out.__ek && Object.keys(out.__ek).length) {
        Model.upsertCustomVeri(batch, kaynak, out.tc_kimlik_no, out.__ek, file.name, importId);
      }

      const isNew = kaynak === "PERSONEL" ? !existingPersonel : !existingKart;
      if (isNew) eklenen++;
      else guncellenen++;
    }

    await Model.persistImportBatch(batch);

    const importRecord = Object.assign({}, importRecordDraft, {
      id: importId,
      eklenen,
      guncellenen,
      atlanan,
      hatalar,
    });
    await Store.put("imports", importRecord);

    return importRecord;
  }

  /**
   * "Yeni Excel Türü Ekle" ile tanımlanmış özel bir kaynağı içe aktarır.
   * Sabit 4 kaynaktan farkı: hedef şema yok, kullanıcının seçtiği sütunlar
   * olduğu gibi (metin olarak) alınır; tek zorunlu alan TC Kimlik No'dur.
   * @param {File} file
   * @param {{id:string, ad:string, tc_sutun:string, alanlar:{excel_sutun:string,etiket:string,key:string}[]}} kaynakDef
   */
  async function importCustomFile(file, kaynakDef) {
    const buf = await file.arrayBuffer();
    const { rows, sheetName } = readWorkbook(buf);

    if (!rows.length) {
      throw new Error(`"${file.name}" içinde okunabilir satır bulunamadı (sayfa: ${sheetName}).`);
    }

    let eklenen = 0;
    let guncellenen = 0;
    let atlanan = 0;
    const hatalar = [];

    const importRecordDraft = {
      kaynak: kaynakDef.id,
      dosya_adi: file.name,
      tarih: new Date().toISOString(),
      toplam_satir: rows.length,
    };
    const importId = await Store.put("imports", importRecordDraft);
    const batch = await Model.createImportBatch();

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const isRowEmpty = Object.values(raw).every((v) => v === "" || v == null);
      if (isRowEmpty) continue;

      const headerIndex = {};
      Object.keys(raw).forEach((h) => (headerIndex[normalizeHeader(h)] = h));

      const tcKey = headerIndex[normalizeHeader(kaynakDef.tc_sutun)];
      const tcKimlikNo = tcKey !== undefined ? N.cleanId(raw[tcKey]) : "";

      if (!tcKimlikNo) {
        atlanan++;
        hatalar.push(`Satır ${i + 2}: TC Kimlik No okunamadı, satır atlandı.`);
        continue;
      }

      const alanlar = {};
      kaynakDef.alanlar.forEach((alan) => {
        const key = headerIndex[normalizeHeader(alan.excel_sutun)];
        alanlar[alan.key] = key !== undefined ? N.cleanText(raw[key]) : "";
      });

      const existing = batch.custom_veriler.get(`${kaynakDef.id}__${tcKimlikNo}`);
      Model.upsertCustomVeri(batch, kaynakDef.id, tcKimlikNo, alanlar, file.name, importId);
      if (existing) guncellenen++;
      else eklenen++;
    }

    await Model.persistImportBatch(batch);

    const importRecord = Object.assign({}, importRecordDraft, { id: importId, eklenen, guncellenen, atlanan, hatalar });
    await Store.put("imports", importRecord);
    return importRecord;
  }

  global.Apron = global.Apron || {};
  global.Apron.importer = { importFile, importCustomFile, readWorkbook, mapRow, normalizeHeader };
})(window);
