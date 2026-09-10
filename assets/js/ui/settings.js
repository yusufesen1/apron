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

    wire(root, settings, customKaynaklar, isActive);
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

  /**
   * Sabit alan (hedef_alan) ya da ek sütun (ek_alanlar) satırı — ikisi de
   * AYNI görünümde: sürükleme tutamacı, düzenlenebilir etiket, düzenlenebilir
   * Excel sütun adı, gizle/göster ve (yalnızca ek sütunlar için) sil düğmesi.
   * Zorunlu alanlarda (TC Kimlik No/Ad/Soyad/Sicil) gizle/sil yerine kilit
   * ikonu gösterilir — bunlar import için şart, kaldırılamaz.
   */
  function fieldRowHtml({ id, isEk, ekKey, etiket, excelSutun, zorunlu, gizli }) {
    const actionsHtml = zorunlu
      ? `<span class="map-row__lock" title="Zorunlu alan — gizlenemez/silinemez">${global.Apron.icon("lock", { size: 13 })}</span>`
      : `
        <button type="button" class="map-row__action" data-toggle-visibility title="${gizli ? "Göster" : "Gizle"}">${global.Apron.icon(gizli ? "eyeOff" : "eye", { size: 14 })}</button>
        ${isEk ? `<button type="button" class="map-row__action map-row__action--danger" data-remove-ek title="Sil">${global.Apron.icon("close", { size: 12 })}</button>` : ""}
      `;
    return `
      <div class="row map-row${gizli ? " is-hidden-field" : ""}" draggable="true"
           data-order-id="${escapeHtml(id)}" data-is-ek="${isEk ? "1" : "0"}"
           ${isEk ? `data-ek-key="${escapeHtml(ekKey || "")}"` : `data-hedef-alan="${escapeHtml(id)}"`}
           data-gizli="${gizli ? "1" : "0"}">
        <span class="map-row__handle" title="Sürükleyerek sırala">${global.Apron.icon("grip", { size: 14 })}</span>
        <input class="input input--ghost" style="min-width:200px" data-row-etiket value="${escapeHtml(etiket || "")}" placeholder="Alan adı" />
        <input class="input" style="flex:1" data-row-excel value="${escapeHtml(excelSutun || "")}" placeholder="Excel sütun başlığı" />
        <div class="row" style="gap:4px">${actionsHtml}</div>
      </div>
    `;
  }

  /**
   * Sabit alanlar (alanlar) ile ek sütunları (ek_alanlar) TEK bir listede,
   * profile.siralama'da belirtilen sırayla gösterir — "ek:<key>" öneki ek
   * sütunu, düz "<hedef_alan>" sabit alanı işaret eder. Sıra sürükle-bırak
   * ile değiştirilebilir, gizli alanlar soluk gösterilir (silinmez).
   * siralama'da adı geçmeyen bir alan varsa (yeni eklenmiş bir hedef alan,
   * ya da henüz sıraya hiç girmemiş bir ek sütun) kaybolmasın diye sona eklenir.
   */
  function mappingEditor(profile) {
    const etiket = Mapping.KAYNAKLAR[profile.kaynak].etiket;
    const alanByHedef = new Map(profile.alanlar.map((a) => [a.hedef_alan, a]));
    const ekByKey = new Map((profile.ek_alanlar || []).map((a) => [a.key, a]));
    const gosterilenHedef = new Set();
    const gosterilenEk = new Set();

    function alanRow(a) {
      gosterilenHedef.add(a.hedef_alan);
      return fieldRowHtml({
        id: a.hedef_alan,
        isEk: false,
        etiket: a.etiket || Mapping.ALAN_ETIKETLERI[a.hedef_alan] || a.hedef_alan,
        excelSutun: a.excel_sutun,
        zorunlu: a.zorunlu,
        gizli: !!a.gizli,
      });
    }
    function ekRow(a) {
      gosterilenEk.add(a.key);
      return fieldRowHtml({ id: `ek:${a.key}`, isEk: true, ekKey: a.key, etiket: a.etiket, excelSutun: a.excel_sutun, zorunlu: false, gizli: !!a.gizli });
    }

    const rows = [];
    (profile.siralama || []).forEach((id) => {
      if (id.startsWith("ek:")) {
        const a = ekByKey.get(id.slice(3));
        if (a) rows.push(ekRow(a));
      } else {
        const a = alanByHedef.get(id);
        if (a) rows.push(alanRow(a));
      }
    });
    profile.alanlar.forEach((a) => { if (!gosterilenHedef.has(a.hedef_alan)) rows.push(alanRow(a)); });
    (profile.ek_alanlar || []).forEach((a) => { if (!gosterilenEk.has(a.key)) rows.push(ekRow(a)); });

    return `
      <details class="card" data-profile="${profile.kaynak}">
        <summary style="cursor:pointer;font-weight:700;color:var(--ink)">${escapeHtml(etiket)}</summary>
        <p class="card__meta" style="margin:8px 0 16px">${escapeHtml(profile.aciklama)}</p>
        <div class="stack stack--sm map-row-list" data-ek-list="${profile.kaynak}">
          ${rows.join("")}
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

  function wire(root, settings, customKaynaklar, isActive) {
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

    function wireRowActions(rowEl) {
      const toggleBtn = qs(rowEl, "[data-toggle-visibility]");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          const gizliOlacak = rowEl.dataset.gizli !== "1";
          rowEl.dataset.gizli = gizliOlacak ? "1" : "0";
          rowEl.classList.toggle("is-hidden-field", gizliOlacak);
          toggleBtn.title = gizliOlacak ? "Göster" : "Gizle";
          toggleBtn.innerHTML = global.Apron.icon(gizliOlacak ? "eyeOff" : "eye", { size: 14 });
        });
      }
      const removeBtn = qs(rowEl, "[data-remove-ek]");
      if (removeBtn) removeBtn.addEventListener("click", () => rowEl.remove());
    }

    qsa(root, ".map-row").forEach(wireRowActions);

    /** Bir profil listesinde satırları sürükleyerek yeniden sıralamayı sağlar
        (yerel HTML5 drag&drop — kütüphane gerekmez). Yeni eklenen satırlar da
        aynı listenin (delegate edilmiş) olay dinleyicilerinden otomatik yararlanır. */
    function wireDragReorder(listEl) {
      let draggingEl = null;
      listEl.addEventListener("dragstart", (e) => {
        const row = e.target.closest(".map-row");
        if (!row) return;
        draggingEl = row;
        setTimeout(() => row.classList.add("is-dragging"), 0);
      });
      listEl.addEventListener("dragend", (e) => {
        const row = e.target.closest(".map-row");
        if (row) row.classList.remove("is-dragging");
        draggingEl = null;
      });
      listEl.addEventListener("dragover", (e) => {
        if (!draggingEl) return;
        e.preventDefault();
        const row = e.target.closest(".map-row");
        if (!row || row === draggingEl) return;
        const rect = row.getBoundingClientRect();
        const oncesine = e.clientY - rect.top < rect.height / 2;
        listEl.insertBefore(draggingEl, oncesine ? row : row.nextSibling);
      });
    }

    qsa(root, ".map-row-list").forEach(wireDragReorder);

    qsa(root, "[data-add-ek]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const list = qs(root, `[data-ek-list="${btn.dataset.addEk}"]`);
        const wrap = document.createElement("div");
        wrap.innerHTML = fieldRowHtml({ id: "ek:", isEk: true, ekKey: "", etiket: "", excelSutun: "", zorunlu: false, gizli: false }).trim();
        const rowEl = wrap.firstElementChild;
        list.appendChild(rowEl);
        wireRowActions(rowEl);
        qs(rowEl, "[data-row-excel]").focus();
      });
    });

    qsa(root, "[data-save-profile]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const kaynak = btn.dataset.saveProfile;
        const details = qs(root, `[data-profile="${kaynak}"]`);
        const current = await Model.getMappingProfile(kaynak);
        const next = JSON.parse(JSON.stringify(current));
        const alanByHedef = new Map(next.alanlar.map((a) => [a.hedef_alan, a]));

        const ekAlanlar = [];
        const usedEkKeys = new Set();
        const siralama = [];
        let ekHata = false;

        qsa(details, ".map-row").forEach((rowEl) => {
          const etiket = qs(rowEl, "[data-row-etiket]").value.trim();
          const excelSutun = qs(rowEl, "[data-row-excel]").value.trim();
          const gizli = rowEl.dataset.gizli === "1";

          if (rowEl.dataset.isEk === "1") {
            if (!excelSutun && !etiket) return; // boş (kullanılmamış yeni) satır — atlanır
            if (!excelSutun || !etiket) {
              ekHata = true;
              return;
            }
            let key = rowEl.dataset.ekKey;
            if (!key) {
              key = global.Apron.customSource.slugify(etiket);
              let n = 2;
              while (usedEkKeys.has(key)) key = `${global.Apron.customSource.slugify(etiket)}_${n++}`;
            }
            usedEkKeys.add(key);
            ekAlanlar.push({ key, excel_sutun: excelSutun, etiket, gizli });
            siralama.push(`ek:${key}`);
          } else {
            const a = alanByHedef.get(rowEl.dataset.hedefAlan);
            if (!a) return;
            a.excel_sutun = excelSutun;
            a.etiket = etiket;
            if (!a.zorunlu) a.gizli = gizli;
            siralama.push(a.hedef_alan);
          }
        });

        if (ekHata) {
          global.Apron.toast.show("Ek sütunlarda hem Excel sütun başlığı hem de ekrandaki etiket dolu olmalı — eksik satır kaydedilmedi.");
        }
        next.ek_alanlar = ekAlanlar;
        next.siralama = siralama;

        await Model.saveMappingProfile(next);
        global.Apron.toast.show(`${Mapping.KAYNAKLAR[kaynak].etiket} eşlemesi kaydedildi.`, { tone: "positive" });
        render(root, isActive);
      });
    });

    qsa(root, "[data-reset-profile]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const kaynak = btn.dataset.resetProfile;
        await Model.resetMappingProfile(kaynak);
        global.Apron.toast.show(`${Mapping.KAYNAKLAR[kaynak].etiket} eşlemesi varsayılana döndürüldü.`);
        render(root, isActive);
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
        render(root, isActive);
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
