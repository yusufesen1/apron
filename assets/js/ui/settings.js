/* ============================================================
   settings.js — Ayarlar: Eşleştirme Profilleri (config-driven
   import, README §6), Eğitim Geçerlilik Süresi varsayılanları
   (açık soru #3), uyarı eşiği ve veri sıfırlama.
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml, qs, qsa } = global.Apron.util;
  const Model = global.Apron.model;
  const Mapping = global.Apron.mapping;

  async function render(root, isActive = () => true) {
    const [profiles, settings, customKaynaklar] = await Promise.all([
      Model.getAllMappingProfiles(),
      Model.getSettings(),
      Model.getCustomKaynaklar(),
    ]);
    if (!isActive()) return; // kullanıcı bu sırada başka bir sekmeye geçti

    root.innerHTML = `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">Ayarlar</h1>
        </div>

        <div class="stack">
          <div class="card card--loose">
            <h3 class="section-title">Güvenlik Bilinci Eğitimi — Geçerlilik Süresi</h3>
            <p class="card__meta" style="margin-bottom:16px">HEAŞ kaynağında kayıt bazlı "Dönemi" sütunu (3/5 Yıl) varsa o kullanılır; AHL ve İGA'da bu bilgi Excel'de yer almadığı için aşağıdaki havalimanı bazlı varsayılan geçerli olur.</p>
            <div class="toolbar" style="margin-bottom:0" id="egitim-sureleri">
              ${Model.HAVALIMANLARI.map(
                (h) => `
                <div class="field">
                  <label class="field__label" for="sure-${h}">${Model.HAVALIMANI_ETIKET[h]} Varsayılan Süre</label>
                  <select class="input" id="sure-${h}" data-havalimani="${h}">
                    <option value="3" ${settings.egitim_sureleri_varsayilan[h] === 3 ? "selected" : ""}>3 Yıl</option>
                    <option value="5" ${settings.egitim_sureleri_varsayilan[h] === 5 ? "selected" : ""}>5 Yıl</option>
                  </select>
                </div>
              `
              ).join("")}
              <div class="field">
                <label class="field__label" for="esik-gun">Uyarı Eşiği</label>
                <select class="input" id="esik-gun">
                  <option value="30" ${settings.uyari_esik_gun === 30 ? "selected" : ""}>1 Ay</option>
                  <option value="60" ${settings.uyari_esik_gun === 60 ? "selected" : ""}>2 Ay</option>
                  <option value="90" ${settings.uyari_esik_gun === 90 ? "selected" : ""}>3 Ay</option>
                </select>
              </div>
              <button type="button" class="btn btn--primary" id="save-egitim">Ayarları Kaydet</button>
            </div>
          </div>

          <div class="card card--loose">
            <h3 class="section-title">Kart Ücretleri</h3>
            <p class="card__meta" style="margin-bottom:16px">Genel Bakış'taki Maliyet Tablosu panelinde kullanılan havalimanı kart birim fiyatları. Aktif kart sayısıyla çarpılarak hesaplanır.</p>
            <div class="toolbar" style="margin-bottom:0" id="kart-ucretleri">
              <div class="field">
                <label class="field__label" for="maliyet-AHL">AHL Kart Ücreti (₺)</label>
                <input class="input" id="maliyet-AHL" type="number" min="0" step="1" value="${settings.maliyetler.AHL}" />
              </div>
              <div class="field">
                <label class="field__label" for="maliyet-IGA_AO">İGA Kart Ücreti (₺)</label>
                <input class="input" id="maliyet-IGA_AO" type="number" min="0" step="1" value="${settings.maliyetler.IGA_AO}" />
              </div>
              <div class="field">
                <label class="field__label" for="maliyet-IGA_TTAS">İGA TTAŞ Kart Ücreti (₺)</label>
                <input class="input" id="maliyet-IGA_TTAS" type="number" min="0" step="1" value="${settings.maliyetler.IGA_TTAS}" />
              </div>
              <div class="field">
                <label class="field__label" for="maliyet-HEAS">HEAŞ Kart Ücreti (₺)</label>
                <input class="input" id="maliyet-HEAS" type="number" min="0" step="1" value="${settings.maliyetler.HEAS}" />
              </div>
              <div class="field">
                <label class="field__label" for="maliyet-HEAS_eur">HEAŞ Ücreti (€ referans)</label>
                <input class="input" id="maliyet-HEAS_eur" type="number" min="0" step="1" value="${settings.maliyetler.HEAS_eur}" />
              </div>
              <button type="button" class="btn btn--primary" id="save-kart-ucretleri">Ayarları Kaydet</button>
            </div>
          </div>

          <div class="card card--loose">
            <h3 class="section-title">Eğitim Ücretleri</h3>
            <p class="card__meta" style="margin-bottom:16px">Güvenlik Bilinci Eğitimi (GBS) sertifikası başına birim fiyat. Genel Bakış'taki Maliyet Tablosu'nda "kart sahibi" sayısıyla çarpılarak hesaplanır.</p>
            <div class="toolbar" style="margin-bottom:0" id="egitim-ucretleri">
              <div class="field">
                <label class="field__label" for="maliyet-GBS">GBS Sertifika Ücreti (₺)</label>
                <input class="input" id="maliyet-GBS" type="number" min="0" step="1" value="${settings.maliyetler.GBS}" />
              </div>
              <button type="button" class="btn btn--primary" id="save-egitim-ucretleri">Ayarları Kaydet</button>
            </div>
          </div>

          <div class="card card--loose">
            <div class="row row--between" style="margin-bottom:8px">
              <h3 class="section-title" style="margin-bottom:0">Eşleştirme Profilleri</h3>
            </div>
            <p class="card__meta" style="margin-bottom:16px">Her kaynağın hangi Excel sütununu hangi alana eşlediğini gösterir. Sütun adı boş bırakılırsa o alan bu kaynaktan içe aktarılmaz.</p>
            <div class="stack" id="mapping-editors">
              ${Object.keys(Mapping.DEFAULT_PROFILES).map((k) => mappingEditor(profiles[k])).join("")}
            </div>
          </div>

          <div class="card card--loose">
            <h3 class="section-title">Özel Kaynaklar</h3>
            <p class="card__meta" style="margin-bottom:16px">Excel Yükle sayfasındaki "Yeni Excel Türü Ekle" ile oluşturduğunuz kaynaklar. Sütun adlarını ya da ekrandaki etiketlerini buradan güncelleyebilir, kaynağı tamamen silebilirsiniz.</p>
            <div class="stack" id="custom-kaynak-editors">
              ${
                customKaynaklar.length
                  ? customKaynaklar.map((k) => customKaynakEditor(k)).join("")
                  : `<p class="card__meta">Henüz özel kaynak eklenmedi.</p>`
              }
            </div>
          </div>

          <div class="card card--loose">
            <h3 class="section-title">Veri Yönetimi</h3>
            <p class="card__meta" style="margin-bottom:16px">Tüm içe aktarılan personel, kart ve eğitim kayıtlarını siler. Eşleştirme profilleri ve ayarlar etkilenmez. Bu işlem geri alınamaz.</p>
            <button type="button" class="btn" id="wipe-data" style="border-color:var(--red);color:var(--red)">${global.Apron.icon("trash", { size: 16, className: "btn__icon" })}Tüm Verileri Sıfırla</button>
          </div>
        </div>
      </div>
    `;

    wire(root, settings, customKaynaklar);
  }

  function customKaynakEditor(kaynak) {
    return `
      <details class="card" data-custom-kaynak="${kaynak.id}">
        <summary style="cursor:pointer;font-weight:700;color:var(--ink)">${escapeHtml(kaynak.ad)}</summary>
        <div class="stack stack--sm" style="margin-top:8px">
          <div class="row" style="gap:12px">
            <span style="min-width:220px;font-size:13px;color:var(--muted)">TC Kimlik No sütunu *</span>
            <input class="input" style="flex:1" data-tc-sutun value="${escapeHtml(kaynak.tc_sutun)}" placeholder="Excel sütun başlığı" />
          </div>
          <div class="row" style="gap:12px">
            <span style="min-width:220px;font-size:11px;color:var(--muted-2);text-transform:uppercase">Excel Sütunu</span>
            <span style="flex:1;font-size:11px;color:var(--muted-2);text-transform:uppercase">Ekrandaki Etiket</span>
          </div>
          ${kaynak.alanlar
            .map(
              (a) => `
            <div class="row" style="gap:12px">
              <input class="input" style="min-width:220px;flex:1" data-field-excel="${escapeHtml(a.key)}" value="${escapeHtml(a.excel_sutun)}" placeholder="Excel sütun başlığı" />
              <input class="input" style="flex:1" data-field-etiket="${escapeHtml(a.key)}" value="${escapeHtml(a.etiket)}" placeholder="Ekrandaki etiket" />
            </div>
          `
            )
            .join("")}
        </div>
        <div class="row" style="margin-top:16px;gap:8px">
          <button type="button" class="btn btn--primary btn--sm" data-save-custom="${kaynak.id}">Değişiklikleri Kaydet</button>
          <button type="button" class="btn btn--sm" data-delete-custom="${kaynak.id}" style="border-color:var(--red);color:var(--red)">Kaynağı Sil</button>
        </div>
      </details>
    `;
  }

  function mappingEditor(profile) {
    const etiket = Mapping.KAYNAKLAR[profile.kaynak].etiket;
    return `
      <details class="card" data-profile="${profile.kaynak}">
        <summary style="cursor:pointer;font-weight:700;color:var(--ink)">${escapeHtml(etiket)}</summary>
        <p class="card__meta" style="margin:8px 0 16px">${escapeHtml(profile.aciklama)}</p>
        <div class="stack stack--sm" data-ek-list="${profile.kaynak}">
          ${profile.alanlar
            .map(
              (a) => `
            <div class="row" style="gap:12px">
              <span style="min-width:220px;font-size:13px;color:var(--muted)">${escapeHtml(Mapping.ALAN_ETIKETLERI[a.hedef_alan] || a.hedef_alan)}${a.zorunlu ? " *" : ""}</span>
              <input class="input" style="flex:1" data-field="${a.hedef_alan}" value="${escapeHtml(a.excel_sutun)}" placeholder="Excel sütun başlığı" />
            </div>
          `
            )
            .join("")}
          ${(profile.ek_alanlar || []).map(ekRowHtml).join("")}
        </div>

        <div class="row" style="margin-top:16px;gap:8px">
          <button type="button" class="btn btn--primary btn--sm" data-save-profile="${profile.kaynak}">Eşlemeyi Kaydet</button>
          <button type="button" class="btn btn--sm" data-reset-profile="${profile.kaynak}">Varsayılana Döndür</button>
          <span class="spacer"></span>
          <button type="button" class="btn btn--ghost btn--sm" data-add-ek="${profile.kaynak}">+ Sütun Ekle</button>
        </div>
      </details>
    `;
  }

  /** Ek sütun satırı — sabit alan satırlarıyla AYNI görünümde (etiket solda düz
      metin gibi, tek input sağda); "opsiyonel" diye ayrı bir bölüm göstermez.
      Etiket yine de düzenlenebilir (ghost input), silme düğmesi satır üstüne
      gelince belirir. */
  function ekRowHtml(a) {
    return `
      <div class="row ek-row" style="gap:12px" data-ek-key="${escapeHtml(a.key || "")}">
        <input class="input input--ghost" style="min-width:220px" data-ek-etiket value="${escapeHtml(a.etiket || "")}" placeholder="Alan adı" />
        <input class="input" style="flex:1" data-ek-excel value="${escapeHtml(a.excel_sutun || "")}" placeholder="Excel sütun başlığı" />
        <button type="button" class="ek-row__remove" data-remove-ek title="Sütunu kaldır">${global.Apron.icon("close", { size: 12 })}</button>
      </div>
    `;
  }

  function wire(root, settings, customKaynaklar) {
    qs(root, "#save-egitim").addEventListener("click", async () => {
      const egitim_sureleri_varsayilan = {};
      Model.HAVALIMANLARI.forEach((h) => {
        egitim_sureleri_varsayilan[h] = Number(qs(root, `#sure-${h}`).value);
      });
      const uyari_esik_gun = Number(qs(root, "#esik-gun").value) || 60;
      await Model.saveSettings({ egitim_sureleri_varsayilan, uyari_esik_gun });
      global.Apron.toast.show("Eğitim süresi ayarları kaydedildi.", { tone: "positive" });
    });

    qs(root, "#save-kart-ucretleri").addEventListener("click", async () => {
      const guncel = (await Model.getSettings()).maliyetler;
      const maliyetler = {
        ...guncel,
        AHL: Number(qs(root, "#maliyet-AHL").value) || 0,
        IGA_AO: Number(qs(root, "#maliyet-IGA_AO").value) || 0,
        IGA_TTAS: Number(qs(root, "#maliyet-IGA_TTAS").value) || 0,
        HEAS: Number(qs(root, "#maliyet-HEAS").value) || 0,
        HEAS_eur: Number(qs(root, "#maliyet-HEAS_eur").value) || 0,
      };
      await Model.saveSettings({ maliyetler });
      global.Apron.toast.show("Kart ücretleri kaydedildi.", { tone: "positive" });
    });

    qs(root, "#save-egitim-ucretleri").addEventListener("click", async () => {
      const guncel = (await Model.getSettings()).maliyetler;
      const maliyetler = { ...guncel, GBS: Number(qs(root, "#maliyet-GBS").value) || 0 };
      await Model.saveSettings({ maliyetler });
      global.Apron.toast.show("Eğitim ücretleri kaydedildi.", { tone: "positive" });
    });

    qsa(root, "[data-add-ek]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const list = qs(root, `[data-ek-list="${btn.dataset.addEk}"]`);
        const wrap = document.createElement("div");
        wrap.innerHTML = ekRowHtml({ key: "", excel_sutun: "", etiket: "" }).trim();
        const rowEl = wrap.firstElementChild;
        list.appendChild(rowEl);
        wireEkRemove(rowEl);
        qs(rowEl, "[data-ek-excel]").focus();
      });
    });

    qsa(root, ".ek-row").forEach(wireEkRemove);

    function wireEkRemove(rowEl) {
      qs(rowEl, "[data-remove-ek]").addEventListener("click", () => rowEl.remove());
    }

    qsa(root, "[data-save-profile]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const kaynak = btn.dataset.saveProfile;
        const details = qs(root, `[data-profile="${kaynak}"]`);
        const current = await Model.getMappingProfile(kaynak);
        const next = JSON.parse(JSON.stringify(current));
        next.alanlar.forEach((a) => {
          const input = qs(details, `[data-field="${a.hedef_alan}"]`);
          if (input) a.excel_sutun = input.value.trim();
        });

        const ekAlanlar = [];
        const usedKeys = new Set();
        let ekHata = false;
        qsa(details, ".ek-row").forEach((rowEl) => {
          const excelSutun = qs(rowEl, "[data-ek-excel]").value.trim();
          const etiket = qs(rowEl, "[data-ek-etiket]").value.trim();
          if (!excelSutun && !etiket) return; // boş satır — atlanır
          if (!excelSutun || !etiket) {
            ekHata = true;
            return;
          }
          let key = rowEl.dataset.ekKey;
          if (!key) {
            key = global.Apron.customSource.slugify(etiket);
            let n = 2;
            while (usedKeys.has(key)) key = `${global.Apron.customSource.slugify(etiket)}_${n++}`;
          }
          usedKeys.add(key);
          ekAlanlar.push({ key, excel_sutun: excelSutun, etiket });
        });
        if (ekHata) {
          global.Apron.toast.show("Ek sütunlarda hem Excel sütun başlığı hem de ekrandaki etiket dolu olmalı — eksik satır kaydedilmedi.");
        }
        next.ek_alanlar = ekAlanlar;

        await Model.saveMappingProfile(next);
        global.Apron.toast.show(`${Mapping.KAYNAKLAR[kaynak].etiket} eşlemesi kaydedildi.`, { tone: "positive" });
        render(root);
      });
    });

    qsa(root, "[data-reset-profile]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const kaynak = btn.dataset.resetProfile;
        await Model.resetMappingProfile(kaynak);
        global.Apron.toast.show(`${Mapping.KAYNAKLAR[kaynak].etiket} eşlemesi varsayılana döndürüldü.`);
        render(root);
      });
    });

    qsa(root, "[data-save-custom]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const kaynakId = btn.dataset.saveCustom;
        const details = qs(root, `[data-custom-kaynak="${kaynakId}"]`);
        const kaynak = customKaynaklar.find((k) => k.id === kaynakId);
        if (!kaynak) return;
        const next = JSON.parse(JSON.stringify(kaynak));
        const tcInput = qs(details, "[data-tc-sutun]");
        if (tcInput) next.tc_sutun = tcInput.value.trim();
        next.alanlar.forEach((a) => {
          const excelInput = qs(details, `[data-field-excel="${a.key}"]`);
          const etiketInput = qs(details, `[data-field-etiket="${a.key}"]`);
          if (excelInput) a.excel_sutun = excelInput.value.trim();
          if (etiketInput) a.etiket = etiketInput.value.trim() || a.etiket;
        });
        await Model.saveCustomKaynak(next);
        global.Apron.toast.show(`"${next.ad}" güncellendi.`, { tone: "positive" });
      });
    });

    qsa(root, "[data-delete-custom]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const kaynakId = btn.dataset.deleteCustom;
        const kaynak = customKaynaklar.find((k) => k.id === kaynakId);
        if (!kaynak) return;
        if (!confirm(`"${kaynak.ad}" kaynağı ve içe aktarılmış tüm verisi silinecek. Bu işlem geri alınamaz. Emin misiniz?`)) return;
        await Model.deleteCustomKaynak(kaynakId);
        global.Apron.toast.show(`"${kaynak.ad}" silindi.`, { tone: "positive" });
        render(root);
      });
    });

    qs(root, "#wipe-data").addEventListener("click", async () => {
      if (!confirm("Tüm personel, kart ve eğitim kayıtları silinecek. Emin misiniz?")) return;
      await global.Apron.DB.wipeAll();
      global.Apron.toast.show("Tüm veriler sıfırlandı.", { tone: "positive" });
    });
  }

  global.Apron = global.Apron || {};
  global.Apron.settings = { render };
})(window);
