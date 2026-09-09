/* ============================================================
   import-view.js — "Excel Yükle" ekranı (README §5 FR1/FR2/FR8).
   Her kaynak için ayrı bir yükleme kartı; otomatik/klasör bazlı
   senkronizasyon yok, yükleme her zaman manuel. Sabit 4 kaynağın
   yanında, kullanıcının "Yeni Excel Türü Ekle" ile tanımladığı
   özel kaynaklar da burada kendi kartlarıyla listelenir.
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml, qs, qsa } = global.Apron.util;
  const icon = global.Apron.icon;
  const Importer = global.Apron.importer;
  const Model = global.Apron.model;
  const KAYNAKLAR = global.Apron.mapping.KAYNAKLAR;

  const KAYNAK_SIRASI = ["AHL", "IGA_AO", "HEAS", "PERSONEL"];

  async function render(root, isActive = () => true) {
    const customKaynaklar = await Model.getCustomKaynaklar();
    if (!isActive()) return; // kullanıcı bu sırada başka bir sekmeye geçti

    root.innerHTML = `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">Excel Yükle</h1>
        </div>

        <div class="card-grid">
          ${KAYNAK_SIRASI.map((k) => uploadCard(k, KAYNAKLAR[k].etiket, k === "PERSONEL" ? "users" : "building")).join("")}
          ${customKaynaklar.map((k) => uploadCard(k.id, k.ad, "badge", true)).join("")}
          ${addSourceCard()}
        </div>
      </div>
    `;

    KAYNAK_SIRASI.forEach((k) => wireCard(root, k));
    customKaynaklar.forEach((k) => wireCard(root, k.id, k));

    qs(root, "#add-source-card").addEventListener("click", () => {
      global.Apron.customSource.openWizard(() => render(root, isActive));
    });
    qsa(root, "[data-manage]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        location.hash = "settings";
      });
    });
  }

  function uploadCard(kaynak, etiket, cardIcon, removable) {
    return `
      <div class="upload-card" data-card="${kaynak}">
        <div class="upload-card__title">
          ${icon(cardIcon, { size: 18 })}${escapeHtml(etiket)}
          ${removable ? `<button type="button" class="upload-card__manage" data-manage="${kaynak}" title="Ayarlar'dan yönet">${icon("settings", { size: 14 })}</button>` : ""}
        </div>

        <label class="dropzone" data-dropzone="${kaynak}">
          ${icon("upload", { size: 24, className: "empty-state__icon" })}
          <div class="dropzone__title">Sürükleyin veya seçin</div>
          <div class="card__meta">.xlsx / .xls</div>
          <input type="file" accept=".xlsx,.xls" data-input="${kaynak}" style="display:none" />
        </label>

        <div data-status="${kaynak}"></div>
      </div>
    `;
  }

  function addSourceCard() {
    return `
      <button type="button" class="upload-card upload-card--add" id="add-source-card">
        ${icon("plus", { size: 22 })}
        <span class="upload-card__title" style="margin:0">Yeni Excel Türü Ekle</span>
        <p class="card__meta">Sistemde henüz tanımlı olmayan bir Excel'i sütunlarını eşleyerek ekleyin.</p>
      </button>
    `;
  }

  function wireCard(root, kaynak, customKaynakDef) {
    const card = qs(root, `[data-card="${kaynak}"]`);
    const dropzone = qs(card, `[data-dropzone="${kaynak}"]`);
    const input = qs(card, `[data-input="${kaynak}"]`);
    const status = qs(card, `[data-status="${kaynak}"]`);

    input.addEventListener("change", () => {
      if (input.files && input.files[0]) handleFile(input.files[0], kaynak, status, customKaynakDef);
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
      if (file) handleFile(file, kaynak, status, customKaynakDef);
    });
  }

  async function handleFile(file, kaynak, statusEl, customKaynakDef) {
    statusEl.innerHTML = `<p class="card__meta">İçe aktarılıyor…</p>`;
    const etiket = customKaynakDef ? customKaynakDef.ad : KAYNAKLAR[kaynak].etiket;
    try {
      const sonuc = customKaynakDef ? await Importer.importCustomFile(file, customKaynakDef) : await Importer.importFile(file, kaynak);
      // Yükleme sürerken kullanıcı başka bir sekmeye geçmiş olabilir —
      // bu durumda statusEl artık DOM'a bağlı değildir, yazma denemesi atlanır.
      if (!statusEl.isConnected) return;
      statusEl.innerHTML = renderSonuc(sonuc);
      global.Apron.toast.show(`${etiket}: ${sonuc.eklenen} yeni, ${sonuc.guncellenen} güncellenen kayıt.`, {
        tone: "positive",
      });
    } catch (err) {
      if (!statusEl.isConnected) return;
      statusEl.innerHTML = `<p class="card__meta" style="color:var(--red)">${escapeHtml(err.message || String(err))}</p>`;
      global.Apron.toast.show(`İçe aktarma başarısız: ${err.message || err}`);
    }
  }

  function renderSonuc(sonuc) {
    const hataOzet = sonuc.hatalar && sonuc.hatalar.length
      ? `<details style="margin-top:8px"><summary class="card__meta" style="cursor:pointer">${sonuc.hatalar.length} satırda not var</summary>
          <ul style="margin:8px 0 0;padding-left:18px;font-size:12px;color:var(--muted)">
            ${sonuc.hatalar.slice(0, 20).map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
          </ul>
        </details>`
      : "";
    return `
      <div class="label-list">
        ${row("Dosya", sonuc.dosya_adi)}
        ${row("Toplam Satır", sonuc.toplam_satir)}
        ${row("Eklenen", sonuc.eklenen)}
        ${row("Güncellenen", sonuc.guncellenen)}
        ${row("Atlanan", sonuc.atlanan)}
      </div>
      ${hataOzet}
    `;
  }

  function row(k, v) {
    return `<div class="label-list__row"><span class="label-list__key">${escapeHtml(k)}</span><span class="label-list__val">${escapeHtml(v)}</span></div>`;
  }

  global.Apron = global.Apron || {};
  global.Apron.importView = { render };
})(window);
