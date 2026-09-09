/* ============================================================
   dashboard.js — Genel Bakış (README §3.1 "LAZIM OLAN").
   TC KİMLİK NO | AD SOYAD | UNVAN | BAŞKANLIK | AHL | İGA | HEAŞ | GÜV. BİL. SER.
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml, el, qs, qsa, debounce } = global.Apron.util;
  const Model = global.Apron.model;
  const N = global.Apron.normalize;
  const icon = global.Apron.icon;

  let allRows = [];
  let currentSettings = Model.DEFAULT_SETTINGS;
  let filters = { q: "", baskanlik: [], unvan: [], havalimani: "", egitimDurumu: "" };
  // Her render()'da yeniden kurulan özel açılır menü bileşenleri.
  let baskanlikMs = null;
  let unvanMs = null;
  let havalimaniMs = null;
  let egitimMs = null;
  let columnsMs = null;
  // Sekmeler arası geçişte de hatırlansın diye modül seviyesinde tutuluyor.
  let sortState = { key: null, dir: "asc" };
  // "Sütun Ekle" ile eklenen isteğe bağlı sütunların o anki (eklenme sıralı) anahtar listesi.
  // Kalıcı hali settings.secili_sutunlar'da tutulur, bu sadece render arası çalışma kopyası.
  let activeColumns = [];

  const SORT_COLUMNS = [
    { key: "tc_kimlik_no", label: "TC Kimlik No" },
    { key: "ad_soyad", label: "Ad Soyad" },
    { key: "unvan", label: "Unvan" },
    { key: "baskanlik", label: "Başkanlık" },
    { key: "AHL", label: "AHL" },
    { key: "IGA_AO", label: "İGA" },
    { key: "HEAS", label: "HEAŞ" },
    { key: "egitim", label: "Güv. Bil. Eğitimi" },
    { key: "egitim", label: "Tarih" },
  ];

  const MAX_OPTIONAL_COLUMNS = 5;

  function kartAlan(r, havalimani, alan) {
    const k = r.kartlar[havalimani];
    return (k && k[alan]) || "";
  }

  function tarihGoster(iso) {
    return iso ? N.formatDateTr(iso) : "—";
  }

  function taseronValue(r) {
    return kartAlan(r, "AHL", "taseron_firma") || kartAlan(r, "IGA_AO", "taseron_firma");
  }

  function kaynakDosyaValue(r) {
    const files = new Set();
    Model.HAVALIMANLARI.forEach((h) => {
      const v = kartAlan(r, h, "kaynak_dosya");
      if (v) files.add(v);
    });
    return Array.from(files).join(", ");
  }

  /** "Sütun Ekle" panelinde seçilebilecek, varsayılan tabloda gösterilmeyen ek sütunlar. */
  const OPTIONAL_COLUMNS = [
    { key: "opt_sicil", label: "Sicil", get: (r) => r.sicil || "—", sortVal: (r) => r.sicil || "" },
    { key: "opt_ahl_kartno", label: "AHL Kart No", get: (r) => kartAlan(r, "AHL", "kart_no") || "—", sortVal: (r) => kartAlan(r, "AHL", "kart_no") },
    { key: "opt_iga_kartno", label: "İGA Kart No", get: (r) => kartAlan(r, "IGA_AO", "kart_no") || "—", sortVal: (r) => kartAlan(r, "IGA_AO", "kart_no") },
    { key: "opt_heas_kartno", label: "HEAŞ Kart No", get: (r) => kartAlan(r, "HEAS", "kart_no") || "—", sortVal: (r) => kartAlan(r, "HEAS", "kart_no") },
    { key: "opt_ahl_baslangic", label: "AHL Kart Başlangıç", get: (r) => tarihGoster(kartAlan(r, "AHL", "baslangic_tarihi")), sortVal: (r) => kartAlan(r, "AHL", "baslangic_tarihi") },
    { key: "opt_iga_baslangic", label: "İGA Kart Başlangıç", get: (r) => tarihGoster(kartAlan(r, "IGA_AO", "baslangic_tarihi")), sortVal: (r) => kartAlan(r, "IGA_AO", "baslangic_tarihi") },
    { key: "opt_heas_baslangic", label: "HEAŞ Kart Başlangıç", get: (r) => tarihGoster(kartAlan(r, "HEAS", "baslangic_tarihi")), sortVal: (r) => kartAlan(r, "HEAS", "baslangic_tarihi") },
    { key: "opt_ahl_bitis", label: "AHL Kart Bitiş", get: (r) => tarihGoster(kartAlan(r, "AHL", "bitis_tarihi")), sortVal: (r) => kartAlan(r, "AHL", "bitis_tarihi") },
    { key: "opt_iga_bitis", label: "İGA Kart Bitiş", get: (r) => tarihGoster(kartAlan(r, "IGA_AO", "bitis_tarihi")), sortVal: (r) => kartAlan(r, "IGA_AO", "bitis_tarihi") },
    { key: "opt_heas_bitis", label: "HEAŞ Kart Bitiş", get: (r) => tarihGoster(kartAlan(r, "HEAS", "bitis_tarihi")), sortVal: (r) => kartAlan(r, "HEAS", "bitis_tarihi") },
    { key: "opt_taseron", label: "Taşeron Firma", get: (r) => taseronValue(r) || "—", sortVal: (r) => taseronValue(r) },
    {
      key: "opt_gecerlilik",
      label: "Eğitim Geçerlilik Süresi",
      get: (r) => (r.guncel_egitim ? `${r.guncel_egitim.gecerlilik_yili} Yıl` : "—"),
      sortVal: (r) => (r.guncel_egitim ? String(r.guncel_egitim.gecerlilik_yili) : ""),
    },
    { key: "opt_kaynak_dosya", label: "Kaynak Dosya", get: (r) => kaynakDosyaValue(r) || "—", sortVal: (r) => kaynakDosyaValue(r) },
  ];

  function optionalColumnByKey(key) {
    return OPTIONAL_COLUMNS.find((c) => c.key === key);
  }

  async function render(root, isActive = () => true) {
    root.innerHTML = `
      <div class="page">
        <div class="stat-panels" id="dash-stats"></div>

        <div class="filter-bar" id="dash-filters">
          <div class="field field--grow">
            <label class="field__label" for="f-q">Ara</label>
            <div class="search-field">
              ${icon("search", { size: 16, className: "search-field__icon" })}
              <input class="input" id="f-q" type="text" placeholder="TC Kimlik No veya Ad Soyad" />
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="f-unvan">Unvan</label>
            <div id="f-unvan-mount"></div>
          </div>
          <div class="field">
            <label class="field__label" for="f-baskanlik">Başkanlık</label>
            <div id="f-baskanlik-mount"></div>
          </div>
          <div class="field">
            <label class="field__label" for="f-havalimani">Havalimanı</label>
            <div id="f-havalimani-mount"></div>
          </div>
          <div class="field">
            <label class="field__label" for="f-egitim">Eğitim Durumu</label>
            <div id="f-egitim-mount"></div>
          </div>
          <button type="button" class="btn btn--ghost btn--sm" id="f-clear">Temizle</button>
        </div>

        <div class="table-toolbar">
          <span class="table-toolbar__count" id="dash-count"></span>
          <div class="row" style="gap:8px">
            <div id="col-picker-mount"></div>
            <button type="button" class="btn btn--sm" id="dash-export">${icon("download", { size: 14, className: "btn__icon" })}Excel'e Aktar</button>
          </div>
        </div>

        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr id="dash-thead-row"></tr>
            </thead>
            <tbody id="dash-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    const [rows, settings] = await Promise.all([Model.buildPivotRows(), Model.getSettings()]);
    if (!isActive()) return; // kullanıcı bu sırada başka bir sekmeye geçti
    allRows = rows;
    currentSettings = settings;
    activeColumns = (settings.secili_sutunlar || []).filter((k) => optionalColumnByKey(k));
    setupFilterMultiselects(root);
    setupColumnPicker(root, isActive);
    wireFilters(root, isActive);
    renderTableHead(root, isActive);
    renderStats(root);
    renderTable(root);
  }

  function distinctValues(field) {
    return Array.from(new Set(allRows.map((r) => r[field]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));
  }

  function setupFilterMultiselects(root) {
    const refresh = () => {
      renderStats(root);
      renderTable(root);
    };

    baskanlikMs = global.Apron.multiselect.create({
      placeholder: "Tümü",
      searchPlaceholder: "Başkanlık ara…",
      triggerId: "f-baskanlik",
      onChange: (values) => {
        filters.baskanlik = values;
        refresh();
      },
    });
    qs(root, "#f-baskanlik-mount").appendChild(baskanlikMs.el);
    baskanlikMs.setOptions(distinctValues("baskanlik"));
    baskanlikMs.setSelected(filters.baskanlik);

    unvanMs = global.Apron.multiselect.create({
      placeholder: "Tümü",
      searchPlaceholder: "Unvan ara…",
      triggerId: "f-unvan",
      onChange: (values) => {
        filters.unvan = values;
        refresh();
      },
    });
    qs(root, "#f-unvan-mount").appendChild(unvanMs.el);
    unvanMs.setOptions(distinctValues("unvan"));
    unvanMs.setSelected(filters.unvan);

    havalimaniMs = global.Apron.multiselect.create({
      placeholder: "Tümü",
      triggerId: "f-havalimani",
      multiple: false,
      onChange: (value) => {
        filters.havalimani = value;
        refresh();
      },
    });
    qs(root, "#f-havalimani-mount").appendChild(havalimaniMs.el);
    havalimaniMs.setOptions([
      { value: "", label: "Tümü" },
      { value: "AHL", label: "AHL" },
      { value: "IGA_AO", label: "İGA" },
      { value: "HEAS", label: "HEAŞ" },
    ]);
    havalimaniMs.setSelected(filters.havalimani);

    egitimMs = global.Apron.multiselect.create({
      placeholder: "Tümü",
      triggerId: "f-egitim",
      multiple: false,
      onChange: (value) => {
        filters.egitimDurumu = value;
        refresh();
      },
    });
    qs(root, "#f-egitim-mount").appendChild(egitimMs.el);
    egitimMs.setOptions([
      { value: "", label: "Tümü" },
      { value: "Aktif", label: "Aktif" },
      { value: "Yaklaşıyor", label: "Yaklaşıyor" },
      { value: "Süresi Dolmuş", label: "Süresi Dolmuş" },
      { value: "Bilgi Yok", label: "Bilgi Yok" },
    ]);
    egitimMs.setSelected(filters.egitimDurumu);
  }

  function setupColumnPicker(root, isActive) {
    columnsMs = global.Apron.multiselect.create({
      placeholder: "Sütun Ekle",
      searchPlaceholder: "Sütun ara…",
      triggerId: "col-picker",
      triggerClassName: "btn btn--sm",
      triggerIcon: "plus",
      staticLabel: true,
      maxSelected: MAX_OPTIONAL_COLUMNS,
      panelAlign: "right",
      onChange: (keys) => {
        if (!isActive()) return;
        activeColumns = keys;
        Model.saveSettings({ secili_sutunlar: keys });
        renderTableHead(root, isActive);
        renderTable(root);
      },
    });
    qs(root, "#col-picker-mount").appendChild(columnsMs.el);
    columnsMs.setOptions(OPTIONAL_COLUMNS.map((c) => ({ value: c.key, label: c.label })));
    columnsMs.setSelected(activeColumns);
  }

  function removeColumn(root, isActive, key) {
    activeColumns = activeColumns.filter((k) => k !== key);
    if (columnsMs) columnsMs.setSelected(activeColumns);
    Model.saveSettings({ secili_sutunlar: activeColumns });
    renderTableHead(root, isActive);
    renderTable(root);
  }

  function wireFilters(root, isActive) {
    const refresh = () => {
      if (!isActive()) return;
      renderStats(root);
      renderTable(root);
    };
    qs(root, "#f-q").value = filters.q;
    qs(root, "#f-q").addEventListener(
      "input",
      debounce((e) => {
        filters.q = e.target.value.trim().toLocaleLowerCase("tr-TR");
        refresh();
      }, 180)
    );
    qs(root, "#f-clear").addEventListener("click", () => {
      filters = { q: "", baskanlik: [], unvan: [], havalimani: "", egitimDurumu: "" };
      qs(root, "#f-q").value = "";
      baskanlikMs.clear();
      unvanMs.clear();
      havalimaniMs.clear();
      egitimMs.clear();
      refresh();
    });
    qs(root, "#dash-export").addEventListener("click", () => exportCurrentView(root));
  }

  function sortableTh(col, removable) {
    return `
      <th data-sort-key="${col.key}">
        <span class="th-sortable__inner">
          ${escapeHtml(col.label)}
          <span class="th-sortable__icon"></span>
          ${removable ? `<button type="button" class="th-remove" data-remove-col="${col.key}" title="Sütunu kaldır">${icon("close", { size: 11 })}</button>` : ""}
        </span>
      </th>
    `;
  }

  /** Sabit + o an ekli isteğe bağlı sütunlarla başlık satırını (yeniden) kurar. */
  function renderTableHead(root, isActive) {
    const optCols = activeColumns.map(optionalColumnByKey).filter(Boolean);
    qs(root, "#dash-thead-row").innerHTML =
      SORT_COLUMNS.map((c) => sortableTh(c)).join("") + optCols.map((c) => sortableTh(c, true)).join("");
    wireSorting(root, isActive);
  }

  function wireSorting(root, isActive) {
    qsa(root, "[data-sort-key]").forEach((th) => {
      th.addEventListener("click", () => {
        if (!isActive()) return;
        const key = th.dataset.sortKey;
        if (sortState.key === key) {
          sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
        } else {
          sortState.key = key;
          sortState.dir = "asc";
        }
        updateSortIndicators(root);
        renderTable(root);
      });
    });
    qsa(root, "[data-remove-col]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isActive()) return;
        removeColumn(root, isActive, btn.dataset.removeCol);
      });
    });
    updateSortIndicators(root);
  }

  function updateSortIndicators(root) {
    qsa(root, "[data-sort-key]").forEach((th) => {
      const active = th.dataset.sortKey === sortState.key;
      th.classList.toggle("is-active", active);
      qs(th, ".th-sortable__icon").innerHTML = active
        ? icon(sortState.dir === "asc" ? "chevronUp" : "chevronDown", { size: 13 })
        : icon("sort", { size: 13 });
    });
  }

  /** Havalimanı sütunları VAR/YOK metnine, eğitim sütunu güncel bitiş tarihine göre sıralanır. */
  function compareRows(a, b) {
    const { key, dir } = sortState;
    const mul = dir === "desc" ? -1 : 1;
    let va, vb;

    const optCol = optionalColumnByKey(key);
    if (optCol) {
      va = optCol.sortVal(a) || "";
      vb = optCol.sortVal(b) || "";
    } else if (key === "AHL" || key === "IGA_AO" || key === "HEAS") {
      va = a.havalimani_var[key] ? "VAR" : "YOK";
      vb = b.havalimani_var[key] ? "VAR" : "YOK";
    } else if (key === "egitim") {
      const da = (a.guncel_egitim && a.guncel_egitim.bitis_tarihi) || "";
      const db = (b.guncel_egitim && b.guncel_egitim.bitis_tarihi) || "";
      // Eğitim tarihi olmayan (Bilgi Yok) kayıtlar yöne bakılmaksızın en sona düşer.
      if (!da && db) return 1;
      if (da && !db) return -1;
      if (!da && !db) return 0;
      va = da;
      vb = db;
    } else {
      va = a[key] || "";
      vb = b[key] || "";
    }

    return mul * String(va).localeCompare(String(vb), "tr", { numeric: true });
  }

  function filteredRows() {
    const rows = allRows.filter((r) => {
      if (filters.q) {
        const hay = `${r.sicil} ${r.ad_soyad} ${r.tc_kimlik_no}`.toLocaleLowerCase("tr-TR");
        if (!hay.includes(filters.q)) return false;
      }
      if (filters.baskanlik.length && !filters.baskanlik.includes(r.baskanlik)) return false;
      if (filters.unvan.length && !filters.unvan.includes(r.unvan)) return false;
      if (filters.havalimani && !r.havalimani_var[filters.havalimani]) return false;
      if (filters.egitimDurumu && r.egitim_durumu !== filters.egitimDurumu) return false;
      return true;
    });
    if (sortState.key) rows.sort(compareRows);
    return rows;
  }

  function renderStats(root) {
    const rows = filteredRows();
    const yaklasiyor = rows.filter((r) => r.egitim_durumu === "Yaklaşıyor").length;
    const dolmus = rows.filter((r) => r.egitim_durumu === "Süresi Dolmuş").length;
    const ahl = rows.filter((r) => r.havalimani_var.AHL).length;
    const iga = rows.filter((r) => r.havalimani_var.IGA_AO).length;
    const heas = rows.filter((r) => r.havalimani_var.HEAS).length;
    const esikGun = currentSettings.uyari_esik_gun;

    // Maliyet Tablosu her zaman şirket geneli — mevcut filtrelerden etkilenmez.
    const m = currentSettings.maliyetler;
    const ahlSayi = allRows.filter((r) => r.havalimani_var.AHL).length;
    const igaSayi = allRows.filter((r) => r.havalimani_var.IGA_AO).length;
    const heasSayi = allRows.filter((r) => r.havalimani_var.HEAS).length;
    const gbsSayi = allRows.filter((r) => r.guncel_egitim).length;
    const igaTutar = m.IGA_AO * igaSayi;
    const ahlTutar = m.AHL * ahlSayi;
    const heasTutar = m.HEAS * heasSayi;
    const gbsTutar = m.GBS * gbsSayi;
    const kartTutarToplam = ahlTutar + igaTutar + heasTutar;
    const toplamGider = kartTutarToplam + gbsTutar;

    qs(root, "#dash-stats").innerHTML = `
      <div class="stat-panel">
        <div class="stat-panel__head">
          <span class="stat-panel__label"><span class="stat-panel__dot"></span>Apron Giriş Kartları</span>
          <span class="stat-panel__tag">Aktif Kartlar</span>
        </div>
        <div class="stat-panel__row stat-panel__row--chips">
          ${statItem("Filtrelenen Personel", N.formatNumberTr(rows.length))}
          <div class="stat-chip-row">
            ${airportChip("AHL", N.formatNumberTr(ahl), "blue")}
            ${airportChip("İGA", N.formatNumberTr(iga), "teal")}
            ${airportChip("HEAŞ", N.formatNumberTr(heas), "neutral")}
          </div>
        </div>
      </div>

      <div class="stat-panel stat-panel--alert">
        <div class="stat-panel__head">
          <span class="stat-panel__label"><span class="stat-panel__dot"></span>Güvenlik Bilinci Eğitimi (GBS)</span>
          <span class="stat-panel__tag">Geçerlilik Takibi</span>
        </div>
        <div class="stat-panel__row">
          ${statItem(`Yaklaşan (${N.formatEsikSuresi(esikGun)})`, N.formatNumberTr(yaklasiyor), { icon: "clock", chip: "amber" })}
          ${statItem("Süresi Dolan", N.formatNumberTr(dolmus), { icon: "alert", chip: "red", alert: true })}
        </div>
      </div>

      <div class="stat-panel stat-panel--full">
        <div class="stat-panel__head">
          <span class="stat-panel__label"><span class="stat-panel__dot"></span>Maliyet Tablosu</span>
          <span class="stat-panel__tag">Tüm Şirket (${N.formatNumberTr(allRows.length)} Personel)</span>
        </div>
        <div class="stat-panel__row stat-panel__row--cost">
          ${costItem("AHL", ahlTutar, `${N.formatTL(m.AHL)} × ${N.formatNumberTr(ahlSayi)} Kart`, "blue")}
          ${costItem("İGA", igaTutar, `${N.formatTL(m.IGA_AO)} × ${N.formatNumberTr(igaSayi)} Kart`, "teal")}
          ${costItem("HEAŞ (SAW)", heasTutar, `${N.formatTL(m.HEAS)} (${m.HEAS_eur}€) × ${N.formatNumberTr(heasSayi)} Kart`, "neutral")}
          <span class="stat-panel__divider"></span>
          ${costItem("Kart Ücretleri Toplamı", kartTutarToplam, `${N.formatNumberTr(ahlSayi + igaSayi + heasSayi)} Kart · 3 Havalimanı`, "amber")}
          ${costItem("Sertifika Giderleri", gbsTutar, `${N.formatTL(m.GBS)} × ${N.formatNumberTr(gbsSayi)} Kart Sahibi`, "red")}
          <div class="stat-panel__total">
            <span class="stat-panel__item-label">Toplam Gider</span>
            <span class="stat-panel__total-value">${N.formatTL(toplamGider)}</span>
            <span class="stat-panel__total-caption">${N.formatNumberTr(allRows.length)} Personel (Kart+GBS)</span>
          </div>
        </div>
      </div>
    `;
  }

  function statItem(label, value, opts = {}) {
    const badgeClass = opts.badgeColor ? ` stat-panel__badge--${opts.badgeColor}` : "";
    return `
      <div class="stat-panel__item">
        <span class="stat-panel__item-label">
          ${opts.icon ? (opts.chip ? `<span class="icon-chip icon-chip--${opts.chip}">${icon(opts.icon, { size: 13 })}</span>` : icon(opts.icon, { size: 14 })) : ""}${escapeHtml(label)}
          ${opts.badge ? `<span class="stat-panel__badge${badgeClass}">${escapeHtml(opts.badge)}</span>` : ""}
        </span>
        <span class="stat-panel__item-value${opts.alert ? " stat-panel__item-value--alert" : ""}">${value}</span>
      </div>
    `;
  }

  function airportChip(label, value, colorKey) {
    return `
      <div class="stat-chip stat-chip--${colorKey}">
        <span class="stat-chip__label">${escapeHtml(label)}</span>
        <span class="stat-chip__value">${value}</span>
      </div>
    `;
  }

  function costItem(label, tutar, caption, colorKey) {
    return `
      <div class="stat-chip stat-chip--${colorKey}">
        <span class="stat-chip__label">${escapeHtml(label)}</span>
        <span class="stat-chip__value">${N.formatTL(tutar)}</span>
        <span class="stat-chip__caption">${escapeHtml(caption)}</span>
      </div>
    `;
  }

  function renderTable(root) {
    const rows = filteredRows();
    const tbody = qs(root, "#dash-tbody");
    const optCols = activeColumns.map(optionalColumnByKey).filter(Boolean);
    qs(root, "#dash-count").textContent = `${N.formatNumberTr(rows.length)} kayıt`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${9 + optCols.length}"><div class="table-empty">Filtrelere uyan kayıt bulunamadı.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr data-tc="${escapeHtml(r.tc_kimlik_no)}">
        <td class="mono">${escapeHtml(r.tc_kimlik_no || "—")}</td>
        <td class="data__name">${escapeHtml(r.ad_soyad)}</td>
        <td>${escapeHtml(r.unvan || "—")}</td>
        <td>${escapeHtml(r.baskanlik || "—")}</td>
        <td>${varYokBadge(r.havalimani_var.AHL)}</td>
        <td>${varYokBadge(r.havalimani_var.IGA_AO)}</td>
        <td>${varYokBadge(r.havalimani_var.HEAS)}</td>
        <td>${egitimBadge(r.egitim_durumu)}</td>
        <td>${egitimTarihHucresi(r.guncel_egitim)}</td>
        ${optCols.map((c) => `<td>${escapeHtml(c.get(r))}</td>`).join("")}
      </tr>
    `
      )
      .join("");

    qsa(tbody, "tr[data-tc]").forEach((tr) => {
      tr.addEventListener("click", () => {
        const row = rows.find((r) => r.tc_kimlik_no === tr.dataset.tc);
        global.Apron.detail.openPersonelDetail(row);
      });
    });
  }

  function varYokBadge(isVar) {
    return isVar
      ? `<span class="check-badge check-badge--yes" title="VAR">${icon("check", { size: 12 })}</span>`
      : `<span class="check-badge check-badge--no" title="YOK">–</span>`;
  }

  function egitimBadge(durum) {
    const cls = { Aktif: "ind--aktif", "Yaklaşıyor": "ind--yaklasiyor", "Süresi Dolmuş": "ind--dolmus", "Bilgi Yok": "ind--bilgiyok" }[durum];
    return `<span class="ind ${cls}"><span class="ind__dot"></span>${escapeHtml(durum)}</span>`;
  }

  function egitimTarihHucresi(kayit) {
    return kayit && kayit.bitis_tarihi
      ? `<span class="data__muted mono">${N.formatDateTr(kayit.bitis_tarihi)}</span>`
      : `<span class="data__muted">—</span>`;
  }

  function exportCurrentView(root) {
    const rows = filteredRows();
    // Ekranda o an görünen isteğe bağlı sütunlar da dahil edilir (WYSIWYG).
    const optCols = activeColumns.map(optionalColumnByKey).filter(Boolean);
    const header = [
      "TC KİMLİK NO", "AD SOYAD", "UNVAN", "BAŞKANLIK", "AHL", "İGA", "HEAŞ", "GÜV. BİL. DURUM", "GÜV. BİL. BİTİŞ",
      ...optCols.map((c) => N.turkishUpper(c.label)),
    ];
    const data = rows.map((r) => [
      r.tc_kimlik_no,
      r.ad_soyad,
      r.unvan,
      r.baskanlik,
      r.havalimani_var.AHL ? "VAR" : "YOK",
      r.havalimani_var.IGA_AO ? "VAR" : "YOK",
      r.havalimani_var.HEAS ? "VAR" : "YOK",
      r.egitim_durumu,
      r.guncel_egitim ? N.formatDateTr(r.guncel_egitim.bitis_tarihi) : "—",
      ...optCols.map((c) => c.get(r)),
    ]);
    const ws = global.XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = global.XLSX.utils.book_new();
    global.XLSX.utils.book_append_sheet(wb, ws, "Genel Bakış");
    global.XLSX.writeFile(wb, `apron_genel_bakis_${N.todayIso()}.xlsx`);
    global.Apron.toast.show(`${rows.length} kayıt Excel'e aktarıldı.`, { tone: "positive" });
  }

  global.Apron = global.Apron || {};
  global.Apron.dashboard = { render };
})(window);
