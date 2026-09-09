/* ============================================================
   custom-source.js — "Yeni Excel Türü Ekle" sihirbazı.
   Sistemde tanımlı olmayan bir Excel'i: (1) dosyayı okur, sütun
   başlıklarını otomatik bulur, (2) kullanıcıya hangi sütunun TC
   Kimlik No olduğunu ve diğer sütunların ekranda ne adla
   görüneceğini sorar, (3) tanımı kaydedip dosyayı hemen içe
   aktarır. Sonradan oluşan sütunlar Genel Bakış'taki "Sütun Ekle"
   panelinde görünür (bkz. dashboard.js).
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml, qs, qsa } = global.Apron.util;
  const icon = global.Apron.icon;
  const N = global.Apron.normalize;
  const Model = global.Apron.model;
  const Importer = global.Apron.importer;

  function foldTr(str) {
    return String(str)
      .toLocaleLowerCase("tr-TR")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ü/g, "u")
      .replace(/\s+/g, "");
  }

  function slugify(str) {
    const s = foldTr(str).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return s || "alan";
  }

  function guessTcColumn(headers) {
    return (
      headers.find((h) => {
        const f = foldTr(h);
        return f.includes("tckimlik") || f.includes("kimlikno") || f.includes("tcno") || f === "tc";
      }) || headers[0]
    );
  }

  function openWizard(onDone) {
    let selectedFile = null;
    let headers = [];

    global.Apron.modal.open({
      title: "Yeni Excel Türü Ekle",
      wide: true,
      bodyHtml: stepOneHtml(),
      onRender: (bodyEl) => wireStepOne(bodyEl),
    });

    function stepOneHtml() {
      return `
        <p class="card__meta" style="margin-bottom:16px">Sisteme henüz tanımlı olmayan bir Excel dosyası seçin; sütun başlıklarını okuyup ekranda nasıl görünmesini istediğinizi bir sonraki adımda soracağız.</p>
        <label class="dropzone" id="wiz-dropzone" style="min-height:140px">
          ${icon("upload", { size: 24, className: "empty-state__icon" })}
          <div class="dropzone__title">Sürükleyin veya seçin</div>
          <div class="card__meta">.xlsx / .xls</div>
          <input type="file" accept=".xlsx,.xls" id="wiz-file-input" style="display:none" />
        </label>
        <p class="card__meta" id="wiz-error" style="color:var(--red);margin-top:12px" hidden></p>
      `;
    }

    function wireStepOne(bodyEl) {
      const dropzone = qs(bodyEl, "#wiz-dropzone");
      const input = qs(bodyEl, "#wiz-file-input");
      input.addEventListener("change", () => {
        if (input.files && input.files[0]) handleFile(bodyEl, input.files[0]);
        input.value = "";
      });
      ["dragenter", "dragover"].forEach((ev) =>
        dropzone.addEventListener(ev, (e) => {
          e.preventDefault();
          dropzone.classList.add("is-drag");
        })
      );
      ["dragleave", "drop"].forEach((ev) =>
        dropzone.addEventListener(ev, (e) => {
          e.preventDefault();
          dropzone.classList.remove("is-drag");
        })
      );
      dropzone.addEventListener("drop", (e) => {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFile(bodyEl, file);
      });
    }

    async function handleFile(bodyEl, file) {
      const errEl = qs(bodyEl, "#wiz-error");
      errEl.hidden = true;
      try {
        const buf = await file.arrayBuffer();
        const { rows, sheetName } = Importer.readWorkbook(buf);
        if (!rows.length) throw new Error(`"${file.name}" içinde okunabilir satır bulunamadı (sayfa: ${sheetName}).`);
        selectedFile = file;
        headers = Object.keys(rows[0]);
        renderStepTwo(bodyEl);
      } catch (err) {
        errEl.textContent = err.message || String(err);
        errEl.hidden = false;
      }
    }

    function renderStepTwo(bodyEl) {
      const guessedTc = guessTcColumn(headers);
      bodyEl.innerHTML = `
        <div class="field" style="margin-bottom:16px">
          <label class="field__label" for="wiz-ad">Kaynak Adı</label>
          <input class="input" id="wiz-ad" type="text" placeholder="Örn. Araç Kartı Listesi" />
        </div>
        <p class="card__meta" style="margin-bottom:8px">"${escapeHtml(selectedFile.name)}" içinde ${headers.length} sütun bulundu. Kişilere bağlamak için tam olarak bir sütunu <strong>TC Kimlik No</strong> olarak işaretleyin; ekranda görmek istediğiniz diğer sütunları seçip istediğiniz adı yazın.</p>
        <div class="table-wrap" style="max-height:320px; overflow-y:auto">
          <table class="data">
            <thead>
              <tr><th style="width:110px">TC Kimlik No</th><th style="width:70px">Kullan</th><th>Excel Sütunu</th><th>Ekrandaki Etiket</th></tr>
            </thead>
            <tbody>
              ${headers
                .map(
                  (h, i) => `
                <tr>
                  <td><input type="radio" name="wiz-tc" value="col-${i}" ${h === guessedTc ? "checked" : ""} /></td>
                  <td><input type="checkbox" class="wiz-use" value="col-${i}" ${h === guessedTc ? "disabled" : "checked"} /></td>
                  <td class="data__muted">${escapeHtml(h)}</td>
                  <td><input class="input" type="text" data-label="col-${i}" value="${escapeHtml(h)}" /></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <p class="card__meta" id="wiz-error" style="color:var(--red);margin-top:12px" hidden></p>
        <div class="row" style="margin-top:16px;gap:8px">
          <button type="button" class="btn" id="wiz-back">Geri</button>
          <button type="button" class="btn btn--primary" id="wiz-save">Kaydet ve İçe Aktar</button>
        </div>
      `;
      wireStepTwo(bodyEl);
    }

    function wireStepTwo(bodyEl) {
      qsa(bodyEl, 'input[name="wiz-tc"]').forEach((radio) => {
        radio.addEventListener("change", () => {
          qsa(bodyEl, ".wiz-use").forEach((cb) => {
            const isTc = cb.value === radio.value;
            cb.disabled = isTc;
            if (isTc) cb.checked = false;
          });
        });
      });
      qs(bodyEl, "#wiz-back").addEventListener("click", () => {
        selectedFile = null;
        bodyEl.innerHTML = stepOneHtml();
        wireStepOne(bodyEl);
      });
      qs(bodyEl, "#wiz-save").addEventListener("click", () => save(bodyEl));
    }

    async function save(bodyEl) {
      const errEl = qs(bodyEl, "#wiz-error");
      errEl.hidden = true;

      const ad = qs(bodyEl, "#wiz-ad").value.trim();
      const tcRadio = qs(bodyEl, 'input[name="wiz-tc"]:checked');

      if (!ad) return showError("Lütfen kaynağa bir ad verin.");
      if (!tcRadio) return showError("Lütfen TC Kimlik No sütununu işaretleyin.");

      const tcCol = tcRadio.value;
      const tcSutunBaslik = headerFor(bodyEl, tcCol);

      const alanlar = [];
      const usedKeys = new Set();
      qsa(bodyEl, ".wiz-use:checked").forEach((cb) => {
        const col = cb.value;
        const excelSutun = headerFor(bodyEl, col);
        const etiketInput = qs(bodyEl, `[data-label="${col}"]`);
        const etiket = (etiketInput.value || excelSutun).trim() || excelSutun;
        let key = slugify(etiket);
        let n = 2;
        while (usedKeys.has(key)) key = `${slugify(etiket)}_${n++}`;
        usedKeys.add(key);
        alanlar.push({ excel_sutun: excelSutun, etiket, key });
      });

      if (!alanlar.length) return showError("En az bir sütun seçmelisiniz.");

      const saveBtn = qs(bodyEl, "#wiz-save");
      saveBtn.disabled = true;
      saveBtn.textContent = "İçe aktarılıyor…";

      const kaynakId = `custom_${slugify(ad)}_${Date.now().toString(36)}`;
      const kaynakDef = { id: kaynakId, ad, tc_sutun: tcSutunBaslik, alanlar, olusturma_tarihi: N.todayIso() };

      try {
        await Model.saveCustomKaynak(kaynakDef);
        const sonuc = await Importer.importCustomFile(selectedFile, kaynakDef);
        renderStepThree(bodyEl, kaynakDef, sonuc);
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Kaydet ve İçe Aktar";
        showError(err.message || String(err));
      }

      function showError(msg) {
        errEl.textContent = msg;
        errEl.hidden = false;
      }
    }

    function headerFor(bodyEl, col) {
      // Sütun başlığı, o satırdaki (etiket kutusunun ilk değeri değil) orijinal Excel başlığıdır;
      // veri-index eşlemesini korumak için satırdaki .data__muted hücresinden okunur.
      const row = qs(bodyEl, `[data-label="${col}"]`).closest("tr");
      return qs(row, ".data__muted").textContent;
    }

    function renderStepThree(bodyEl, kaynakDef, sonuc) {
      bodyEl.innerHTML = `
        <div class="label-list">
          <div class="label-list__row"><span class="label-list__key">Kaynak</span><span class="label-list__val">${escapeHtml(kaynakDef.ad)}</span></div>
          <div class="label-list__row"><span class="label-list__key">Dosya</span><span class="label-list__val">${escapeHtml(sonuc.dosya_adi)}</span></div>
          <div class="label-list__row"><span class="label-list__key">Toplam Satır</span><span class="label-list__val">${sonuc.toplam_satir}</span></div>
          <div class="label-list__row"><span class="label-list__key">Eklenen</span><span class="label-list__val">${sonuc.eklenen}</span></div>
          <div class="label-list__row"><span class="label-list__key">Güncellenen</span><span class="label-list__val">${sonuc.guncellenen}</span></div>
          <div class="label-list__row"><span class="label-list__key">Atlanan</span><span class="label-list__val">${sonuc.atlanan}</span></div>
        </div>
        <p class="card__meta" style="margin-top:16px">"${escapeHtml(kaynakDef.ad)}" artık kalıcı bir kaynak — Excel Yükle sayfasında kendi kartı var, sütunları Genel Bakış'taki "Sütun Ekle" panelinde seçilebilir.</p>
        <div class="row" style="margin-top:16px">
          <button type="button" class="btn btn--primary" id="wiz-done">Kapat</button>
        </div>
      `;
      qs(bodyEl, "#wiz-done").addEventListener("click", () => {
        global.Apron.modal.close();
        if (onDone) onDone();
      });
      global.Apron.toast.show(`"${kaynakDef.ad}" eklendi: ${sonuc.eklenen} yeni, ${sonuc.guncellenen} güncellenen kayıt.`, { tone: "positive" });
    }
  }

  global.Apron = global.Apron || {};
  global.Apron.customSource = { openWizard, slugify };
})(window);
