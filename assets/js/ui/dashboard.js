/* ============================================================
   dashboard.js — Genel Bakış (README §3.1 "LAZIM OLAN").
   SİCİL | TC KİMLİK NO | AD SOYAD | UNVAN | BAŞKANLIK | AHL | İGA | HEAŞ |
   AHL Eğitimi | İGA Eğitimi | HEAŞ Eğitimi (her biri kendi durum+tarihiyle —
   bkz. model.js egitim_by_havalimani/egitim_durumu_by_havalimani; kasıtlı
   olarak TEK bir "en iyimser kazanır" sütuna indirgenmiyor).
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml, el, qs, qsa, debounce } = global.Apron.util;
  const Model = global.Apron.model;
  const N = global.Apron.normalize;
  const icon = global.Apron.icon;

  let allRows = [];
  let currentSettings = Model.DEFAULT_SETTINGS;

  // Sicil/TC Kimlik No/Ad Soyad/Unvan/Başkanlık sütunlarının hepsi aynı
  // şekilde filtrelenir: başlıktaki huniye tıklayınca aranabilir, çoklu
  // seçimli bir liste açılır (bkz. setupColumnFilters, filteredRows).
  const METIN_FILTRE_ALANLARI = ["sicil", "tc_kimlik_no", "ad_soyad", "unvan", "baskanlik"];
  const METIN_FILTRE_ARAMA_PLACEHOLDER = {
    sicil: "Sicil ara…",
    tc_kimlik_no: "TC Kimlik No ara…",
    ad_soyad: "Ad Soyad ara…",
    unvan: "Unvan ara…",
    baskanlik: "Başkanlık ara…",
  };

  /**
   * Hazır tek-tık filtre çipleri. Sütun huni filtreleri her zaman kendi
   * aralarında VE (AND) birleşir — bu yeterli olduğunda (örn. "3
   * havalimanında da kartı VAR" için üç huniyi VAR'a çekmek) ayrı bir çip
   * gerekmez. Çipler asıl, huni filtreleriyle İFADE EDİLEMEYEN "HERHANGİ
   * bir havalimanında X" (VEYA/OR) türü sorgular için var — bkz. kullanıcı
   * talebi. Birden çok çip aynı anda seçilebilir, aralarında yine VE
   * mantığıyla birleşir (bkz. filteredRows).
   */
  const QUICK_FILTER_CHIPS = [
    {
      key: "uc_havalimani_kart",
      label: "3 Havalimanında da Kartı Var",
      test: (r) => Model.HAVALIMANLARI.every((h) => r.havalimani_var[h]),
    },
    {
      key: "herhangi_egitim_dolmus",
      label: "Herhangi Bir Yerde Eğitim Süresi Dolmuş",
      test: (r) => Model.HAVALIMANLARI.some((h) => r.egitim_durumu_by_havalimani[h] === "Süresi Dolmuş"),
    },
    {
      key: "herhangi_egitim_yaklasiyor",
      label: "Yaklaşan Eğitimi Var",
      test: (r) => Model.HAVALIMANLARI.some((h) => r.egitim_durumu_by_havalimani[h] === "Yaklaşıyor"),
    },
    {
      key: "kart_var_egitim_sorunlu",
      label: "Kartı Var, Eğitimi Sorunlu (Dolmuş/Eksik)",
      test: (r) =>
        Model.HAVALIMANLARI.some(
          (h) => r.havalimani_var[h] && (r.egitim_durumu_by_havalimani[h] === "Süresi Dolmuş" || r.egitim_durumu_by_havalimani[h] === "Bilgi Yok")
        ),
    },
  ];

  /** Havalimanı başına "" | "VAR" | "YOK" tutan varsayılan filtre nesnesi üretir. */
  function defaultFilters() {
    const havalimaniDurum = {};
    const egitimDurumuByHavalimani = {};
    Model.HAVALIMANLARI.forEach((h) => {
      havalimaniDurum[h] = "";
      egitimDurumuByHavalimani[h] = "";
    });
    const f = { q: "", havalimaniDurum, egitimDurumuByHavalimani, chips: new Set() };
    METIN_FILTRE_ALANLARI.forEach((k) => (f[k] = []));
    return f;
  }

  let filters = defaultFilters();
  // Sütun başlıklarındaki huni filtreleri — her thead yeniden kurulduğunda
  // (renderTableHead) yeniden oluşturulur, anahtar = FILTERABLE_COLUMNS anahtarı.
  let columnFilterMs = {};
  let columnsMs = null;
  // Sekmeler arası geçişte de hatırlansın diye modül seviyesinde tutuluyor.
  let sortState = { key: null, dir: "asc" };
  // "Sütun Ekle" ile eklenen isteğe bağlı sütunların o anki (eklenme sıralı) anahtar listesi.
  // Kalıcı hali settings.secili_sutunlar'da tutulur, bu sadece render arası çalışma kopyası.
  let activeColumns = [];

  // Sayfalama: ~10.000 personel ölçeğinde filtrelenen satırların TAMAMINI tek
  // seferde DOM'a basmak (innerHTML) gözle görülür bir yavaşlığa yol açıyordu.
  // Filtre/arama her zaman TÜM listede çalışır (bkz. filteredRows) — sayfalama
  // yalnızca o sonucun kaç satırının aynı anda DOM'a yazılacağını sınırlar.
  const PAGE_SIZE = 100;
  let currentPage = 1;
  // Son hesaplanan (filtrelenmiş + sıralanmış) satır listesi — sayfa
  // ileri/geri ve "Sütun Ekle/Kaldır" gibi filtre sonucunu DEĞİŞTİRMEYEN
  // işlemlerde filteredRows()'u gereksiz yere tekrar çalıştırmamak için
  // önbelleğe alınır (bkz. refreshView).
  let lastFilteredRows = [];

  function totalPageCount(rowCount) {
    return Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  }

  // Güvenlik Bilinci Eğitimi artık TEK bir "en iyimser kazanır" sütun değil,
  // havalimanı başına AYRI bir sütun olarak gösteriliyor — bir kaynakta
  // süresi dolmuş bir eğitim artık başka bir kaynağın uzak tarihinin
  // arkasında gizlenmiyor (bkz. oturum notları / kullanıcı talebi: Yavuz
  // Kalafat örneği). Her sütunun anahtarı "egitim_<HAVALİMANI>".
  const EGITIM_SUTUNLARI = Model.HAVALIMANLARI.map((h) => ({
    key: `egitim_${h}`,
    havalimani: h,
    label: `${Model.HAVALIMANI_ETIKET[h]} Eğitimi`,
    filter: `egitim_${h}`,
    filterAlign: "right",
    dotClass: { AHL: "airport-dot--ahl", IGA_AO: "airport-dot--iga", HEAS: "airport-dot--heas" }[h],
  }));

  const SORT_COLUMNS = [
    { key: "sicil", label: "Sicil", filter: "sicil" },
    { key: "tc_kimlik_no", label: "TC Kimlik No", filter: "tc_kimlik_no" },
    { key: "ad_soyad", label: "Ad Soyad", filter: "ad_soyad" },
    { key: "unvan", label: "Unvan", filter: "unvan" },
    { key: "baskanlik", label: "Başkanlık", filter: "baskanlik", filterAlign: "left" },
    { key: "AHL", label: "AHL", filter: "AHL", filterAlign: "right" },
    { key: "IGA_AO", label: "İGA", filter: "IGA_AO", filterAlign: "right" },
    { key: "HEAS", label: "HEAŞ", filter: "HEAS", filterAlign: "right" },
    ...EGITIM_SUTUNLARI,
  ];

  const MAX_OPTIONAL_COLUMNS = 5;

  function kartAlan(r, havalimani, alan) {
    const k = r.kartlar[havalimani];
    return (k && k[alan]) || "";
  }

  function tarihGoster(iso) {
    return iso ? N.formatDateTr(iso) : "—";
  }

  // Kullanıcı talebi: Genel Bakış tablosunun İÇERİĞİ (isim soyisim, unvan,
  // başkanlık, eğitim durum yazıları vb.) ekranda büyük harfle gösterilsin.
  // Türkçe İ/ı ayrımı doğru olsun diye normalize.js'teki turkishUpper
  // kullanılır — düz .toUpperCase() "yıl" gibi kelimeleri "YıL" yapardı.
  // Yalnızca GÖRÜNÜM için uygulanır; satırın kendi verisi (sıralama, filtre
  // eşleştirmesi, dışa aktarım) orijinal (karışık) haliyle kalır.
  function up(v) {
    return N.turkishUpper(v);
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

  /** "Sütun Ekle" panelinde seçilebilecek, varsayılan tabloda gösterilmeyen sabit ek sütunlar. */
  const BUILTIN_OPTIONAL_COLUMNS = [
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

  // Sabit sütunlar + o an tanımlı özel kaynakların sütunları — her render()'da yeniden kurulur.
  let allOptionalColumns = BUILTIN_OPTIONAL_COLUMNS;

  function optionalColumnByKey(key) {
    return allOptionalColumns.find((c) => c.key === key);
  }

  /** Özel kaynakların her alanı için bir OPTIONAL_COLUMNS girdisi üretir. */
  function buildCustomColumns(customKaynaklar) {
    const cols = [];
    customKaynaklar.forEach((kaynak) => {
      kaynak.alanlar.forEach((alan) => {
        cols.push({
          key: `cust_${kaynak.id}__${alan.key}`,
          label: `${alan.etiket} (${kaynak.ad})`,
          get: (r) => (r.custom[kaynak.id] && r.custom[kaynak.id][alan.key]) || "—",
          sortVal: (r) => (r.custom[kaynak.id] && r.custom[kaynak.id][alan.key]) || "",
        });
      });
    });
    return cols;
  }

  async function render(root, isActive = () => true) {
    root.innerHTML = `
      <div class="page">
        <div class="stat-panels" id="dash-stats"></div>

        <div class="table-toolbar">
          <span class="table-toolbar__count" id="dash-count"></span>
          <div class="row" style="gap:8px">
            <div id="col-picker-mount"></div>
            <button type="button" class="btn btn--accent" id="dash-export">${icon("download", { size: 14, className: "btn__icon" })}Excel'e Aktar</button>
          </div>
        </div>

        <div class="filter-bar" id="dash-filters">
          <div class="field field--grow">
            <label class="field__label" for="f-q">Filtrele</label>
            <div class="search-field">
              ${icon("search", { size: 16, className: "search-field__icon" })}
              <input class="input" id="f-q" type="text" placeholder="TC Kimlik No, Ad Soyad, Unvan veya Başkanlık" />
              <button type="button" class="btn btn--ghost btn--sm search-field__clear" id="f-clear" hidden>${icon("close", { size: 12, className: "btn__icon" })}Filtreleri Temizle</button>
            </div>
          </div>
          <div class="quick-filters" role="group" aria-label="Hazır filtreler">
            ${QUICK_FILTER_CHIPS.map((c) => `<button type="button" class="quick-filter-chip" data-chip="${c.key}">${escapeHtml(c.label)}</button>`).join("")}
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
        <div id="dash-pagination"></div>
      </div>
    `;

    const [rows, settings, extraFieldSources] = await Promise.all([Model.buildPivotRows(), Model.getSettings(), Model.getExtraFieldSources()]);
    if (!isActive()) return; // kullanıcı bu sırada başka bir sekmeye geçti
    allRows = rows;
    currentSettings = settings;
    allOptionalColumns = BUILTIN_OPTIONAL_COLUMNS.concat(buildCustomColumns(extraFieldSources));
    activeColumns = (settings.secili_sutunlar || []).filter((k) => optionalColumnByKey(k));
    // Kullanıcı talebi: "Taşeron Firma" artık varsayılan görünümde YOK sayılsın
    // — daha önce "Sütun Ekle" ile eklenip kaydedilmiş olsa bile bir kerelik
    // otomatik kaldırılır. Kullanıcı isterse aynı panelden yine ekleyebilir.
    if (activeColumns.includes("opt_taseron")) {
      activeColumns = activeColumns.filter((k) => k !== "opt_taseron");
      Model.saveSettings({ secili_sutunlar: activeColumns });
    }
    setupColumnPicker(root, isActive);
    wireFilters(root, isActive);
    renderTableHead(root, isActive);
    // Sayfa numarası sekmeler arası geçişte de (filtreler/sıralama gibi)
    // korunur — yalnızca filtre/arama/sıralama DEĞİŞTİĞİNDE 1. sayfaya dönülür.
    refreshView(root, isActive, { resetPage: false });
  }

  /**
   * Filtre+sıralama sonucunu TEK seferde hesaplayıp (bkz. filteredRows)
   * hem istatistik panellerine hem tabloya aktarır — önceden ikisi ayrı
   * ayrı filteredRows() çağırıp aynı işi iki kez yapıyordu.
   */
  function refreshView(root, isActive, { resetPage = true } = {}) {
    if (!isActive()) return;
    if (resetPage) currentPage = 1;
    const rows = filteredRows();
    lastFilteredRows = rows;
    renderStats(root, rows);
    renderTable(root, rows, isActive);
  }

  function distinctValues(field) {
    return Array.from(new Set(allRows.map((r) => r[field]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  }

  /** Sütun başlığındaki huniye tıklayınca açılan, o sütuna özel filtre menüsünü kurar. */
  function setupColumnFilters(root, isActive) {
    const refresh = () => refreshView(root, isActive, { resetPage: true });

    columnFilterMs = {};

    qsa(root, "[data-filter-mount]").forEach((mount) => {
      const key = mount.dataset.filterMount;
      const align = mount.dataset.filterAlign || "left";
      let ms;

      if (METIN_FILTRE_ALANLARI.includes(key)) {
        ms = global.Apron.multiselect.create({
          triggerIcon: "filter",
          triggerClassName: "th-filter-trigger",
          searchPlaceholder: METIN_FILTRE_ARAMA_PLACEHOLDER[key],
          multiple: true,
          panelAlign: align,
          onChange: (values) => {
            filters[key] = values;
            refresh();
          },
        });
        ms.setOptions(distinctValues(key));
        ms.setSelected(filters[key]);
      } else if (key.indexOf("egitim_") === 0 && Model.HAVALIMANLARI.includes(key.slice("egitim_".length))) {
        const h = key.slice("egitim_".length);
        ms = global.Apron.multiselect.create({
          triggerIcon: "filter",
          triggerClassName: "th-filter-trigger",
          multiple: false,
          panelAlign: align,
          onChange: (value) => {
            filters.egitimDurumuByHavalimani[h] = value;
            refresh();
          },
        });
        ms.setOptions([
          { value: "", label: "Tümü" },
          { value: "Aktif", label: "Aktif" },
          { value: "Yaklaşıyor", label: "Yaklaşıyor" },
          { value: "Süresi Dolmuş", label: "Süresi Dolmuş" },
          { value: "Bilgi Yok", label: "Bilgi Yok" },
        ]);
        ms.setSelected(filters.egitimDurumuByHavalimani[h]);
      } else if (Model.HAVALIMANLARI.includes(key)) {
        ms = global.Apron.multiselect.create({
          triggerIcon: "filter",
          triggerClassName: "th-filter-trigger",
          multiple: false,
          panelAlign: align,
          onChange: (value) => {
            filters.havalimaniDurum[key] = value;
            refresh();
          },
        });
        ms.setOptions([
          { value: "", label: "Tümü" },
          { value: "VAR", label: "VAR" },
          { value: "YOK", label: "YOK" },
        ]);
        ms.setSelected(filters.havalimaniDurum[key]);
      }

      if (ms) {
        mount.appendChild(ms.el);
        columnFilterMs[key] = ms;
      }
    });
  }

  function anyFilterActive() {
    return !!(
      filters.q ||
      METIN_FILTRE_ALANLARI.some((k) => filters[k].length) ||
      Object.values(filters.havalimaniDurum).some(Boolean) ||
      Object.values(filters.egitimDurumuByHavalimani).some(Boolean) ||
      filters.chips.size
    );
  }

  function updateClearFiltersVisibility(root) {
    const btn = qs(root, "#f-clear");
    if (btn) btn.hidden = !anyFilterActive();
  }

  function setupColumnPicker(root, isActive) {
    columnsMs = global.Apron.multiselect.create({
      placeholder: "Sütun Ekle",
      searchPlaceholder: "Sütun ara…",
      triggerId: "col-picker",
      triggerClassName: "btn",
      triggerIcon: "plus",
      staticLabel: true,
      maxSelected: MAX_OPTIONAL_COLUMNS,
      panelAlign: "right",
      onChange: (keys) => {
        if (!isActive()) return;
        activeColumns = keys;
        Model.saveSettings({ secili_sutunlar: keys });
        renderTableHead(root, isActive);
        // Sütun ekleme/kaldırma filtre sonucunu değiştirmez — filteredRows()'u
        // tekrar hesaplamadan önbellekteki son sonuç yeniden çizilir.
        renderTable(root, lastFilteredRows, isActive);
      },
    });
    qs(root, "#col-picker-mount").appendChild(columnsMs.el);
    columnsMs.setOptions(allOptionalColumns.map((c) => ({ value: c.key, label: c.label })));
    columnsMs.setSelected(activeColumns);
  }

  function removeColumn(root, isActive, key) {
    activeColumns = activeColumns.filter((k) => k !== key);
    if (columnsMs) columnsMs.setSelected(activeColumns);
    Model.saveSettings({ secili_sutunlar: activeColumns });
    renderTableHead(root, isActive);
    renderTable(root, lastFilteredRows, isActive);
  }

  function wireFilters(root, isActive) {
    const refresh = () => refreshView(root, isActive, { resetPage: true });
    qs(root, "#f-q").value = filters.q;
    qs(root, "#f-q").addEventListener(
      "input",
      debounce((e) => {
        filters.q = e.target.value.trim().toLocaleLowerCase("tr-TR");
        refresh();
      }, 180)
    );
    qs(root, "#f-clear").addEventListener("click", () => {
      filters = defaultFilters();
      qs(root, "#f-q").value = "";
      Object.values(columnFilterMs).forEach((ms) => ms.clear());
      qsa(root, "[data-chip]").forEach((btn) => btn.classList.remove("is-active"));
      refresh();
      updateClearFiltersVisibility(root);
    });
    qs(root, "#dash-export").addEventListener("click", () => exportCurrentView(root));

    qsa(root, "[data-chip]").forEach((btn) => {
      btn.classList.toggle("is-active", filters.chips.has(btn.dataset.chip));
      btn.addEventListener("click", () => {
        const key = btn.dataset.chip;
        if (filters.chips.has(key)) filters.chips.delete(key);
        else filters.chips.add(key);
        btn.classList.toggle("is-active", filters.chips.has(key));
        refresh();
        updateClearFiltersVisibility(root);
      });
    });
  }

  function sortableTh(col, removable) {
    return `
      <th data-sort-key="${col.key}">
        <span class="th-sortable__inner">
          ${col.dotClass ? `<span class="airport-dot ${col.dotClass}"></span>` : ""}${escapeHtml(col.label)}
          <span class="th-sortable__icon"></span>
          ${col.filter ? `<span class="th-filter-mount" data-filter-mount="${col.filter}" data-filter-align="${col.filterAlign || "left"}"></span>` : ""}
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
    setupColumnFilters(root, isActive);
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
        refreshView(root, isActive, { resetPage: true });
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
    } else if (key.indexOf("egitim_") === 0 && Model.HAVALIMANLARI.includes(key.slice("egitim_".length))) {
      const h = key.slice("egitim_".length);
      const ka = a.egitim_by_havalimani[h];
      const kb = b.egitim_by_havalimani[h];
      const da = (ka && ka.bitis_tarihi) || "";
      const db = (kb && kb.bitis_tarihi) || "";
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
        const hay = `${r.sicil} ${r.ad_soyad} ${r.tc_kimlik_no} ${r.unvan} ${r.baskanlik}`.toLocaleLowerCase("tr-TR");
        if (!hay.includes(filters.q)) return false;
      }
      for (const k of METIN_FILTRE_ALANLARI) {
        if (filters[k].length && !filters[k].includes(r[k])) return false;
      }
      for (const h of Model.HAVALIMANLARI) {
        const durum = filters.havalimaniDurum[h];
        if (!durum) continue;
        const varMi = r.havalimani_var[h];
        if (durum === "VAR" && !varMi) return false;
        if (durum === "YOK" && varMi) return false;
      }
      for (const h of Model.HAVALIMANLARI) {
        const durum = filters.egitimDurumuByHavalimani[h];
        if (durum && r.egitim_durumu_by_havalimani[h] !== durum) return false;
      }
      for (const chip of QUICK_FILTER_CHIPS) {
        if (filters.chips.has(chip.key) && !chip.test(r)) return false;
      }
      return true;
    });
    if (sortState.key) rows.sort(compareRows);
    return rows;
  }

  function renderStats(root, rows) {
    const yaklasiyor = rows.filter((r) => r.egitim_durumu === "Yaklaşıyor").length;
    const dolmus = rows.filter((r) => r.egitim_durumu === "Süresi Dolmuş").length;
    const ahl = rows.filter((r) => r.havalimani_var.AHL).length;
    const iga = rows.filter((r) => r.havalimani_var.IGA_AO).length;
    const heas = rows.filter((r) => r.havalimani_var.HEAS).length;
    const esikGun = currentSettings.uyari_esik_gun;
    const filtreAktif = anyFilterActive();

    // Maliyet Tablosu, ana tablo ile aynı filtrelenmiş görünüme göre hesaplanır
    // (örn. Unvan filtresi uygulanırsa yalnızca o unvana ait maliyet gösterilir).
    const m = currentSettings.maliyetler;
    const gbsSayi = rows.filter((r) => r.guncel_egitim).length;
    const igaTutar = m.IGA_AO * iga;
    const ahlTutar = m.AHL * ahl;
    const heasTutar = m.HEAS * heas;
    const gbsTutar = m.GBS * gbsSayi;
    const kartTutarToplam = ahlTutar + igaTutar + heasTutar;
    const toplamGider = kartTutarToplam + gbsTutar;
    const maliyetEtiket = `${filtreAktif ? "Filtrelenen" : "Tüm Şirket"} (${N.formatNumberTr(rows.length)} Personel)`;

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
          <span class="stat-panel__tag">${maliyetEtiket}</span>
        </div>
        <div class="stat-panel__row stat-panel__row--cost">
          ${costItem("AHL", ahlTutar, `${N.formatTL(m.AHL)} × ${N.formatNumberTr(ahl)} Kart`, "blue")}
          ${costItem("İGA", igaTutar, `${N.formatTL(m.IGA_AO)} × ${N.formatNumberTr(iga)} Kart`, "teal")}
          ${costItem("HEAŞ (SAW)", heasTutar, `${N.formatTL(m.HEAS)} (${m.HEAS_eur}€) × ${N.formatNumberTr(heas)} Kart`, "neutral")}
          <span class="stat-panel__divider"></span>
          ${costItem("Kart Ücretleri Toplamı", kartTutarToplam, `${N.formatNumberTr(ahl + iga + heas)} Kart · 3 Havalimanı`, "amber")}
          ${costItem("Sertifika Giderleri", gbsTutar, `${N.formatTL(m.GBS)} × ${N.formatNumberTr(gbsSayi)} Kart Sahibi`, "red")}
          <div class="stat-panel__total">
            <span class="stat-panel__item-label">Toplam Gider</span>
            <span class="stat-panel__total-value">${N.formatTL(toplamGider)}</span>
            <span class="stat-panel__total-caption">${N.formatNumberTr(rows.length)} Personel (Kart+GBS)</span>
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

  /**
   * @param {object[]} rows - filteredRows() sonucu (TÜM filtrelenmiş+sıralanmış
   *   kayıtlar, sayfa başına bölünmeden önceki hali). Sayfalama SADECE burada,
   *   DOM'a yazılacak dilimi seçerken uygulanır — filtre/arama her zaman bu
   *   tam listeyi kapsar (bkz. filteredRows, refreshView).
   */
  function renderTable(root, rows, isActive) {
    const tbody = qs(root, "#dash-tbody");
    const optCols = activeColumns.map(optionalColumnByKey).filter(Boolean);
    qs(root, "#dash-count").textContent = `${N.formatNumberTr(rows.length)} kayıt`;
    updateClearFiltersVisibility(root);

    const pages = totalPageCount(rows.length);
    if (currentPage > pages) currentPage = pages;
    if (currentPage < 1) currentPage = 1;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${8 + EGITIM_SUTUNLARI.length + optCols.length}"><div class="table-empty">Filtrelere uyan kayıt bulunamadı.</div></td></tr>`;
      renderPagination(root, rows, isActive);
      return;
    }

    // Yalnızca o an görünen sayfadaki (en fazla PAGE_SIZE) satır DOM'a
    // yazılır — 10.000 kayıtlık bir filtre sonucunda bile innerHTML her
    // zaman en fazla PAGE_SIZE <tr> üretir.
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageRows
      .map(
        (r) => `
      <tr data-tc="${escapeHtml(r.tc_kimlik_no)}">
        <td class="mono">${escapeHtml(up(r.sicil || ""))}</td>
        <td class="mono">${escapeHtml(up(r.tc_kimlik_no || "—"))}</td>
        <td class="data__name">${escapeHtml(up(r.ad_soyad))}</td>
        <td>${escapeHtml(up(r.unvan || "—"))}</td>
        <td>${escapeHtml(up(r.baskanlik || "—"))}</td>
        <td>${varYokBadge(r.havalimani_var.AHL)}</td>
        <td>${varYokBadge(r.havalimani_var.IGA_AO)}</td>
        <td>${varYokBadge(r.havalimani_var.HEAS)}</td>
        ${EGITIM_SUTUNLARI.map((c) => `<td>${egitimHucresi(r.egitim_durumu_by_havalimani[c.havalimani], r.egitim_by_havalimani[c.havalimani])}</td>`).join("")}
        ${optCols.map((c) => `<td>${escapeHtml(up(c.get(r)))}</td>`).join("")}
      </tr>
    `
      )
      .join("");

    qsa(tbody, "tr[data-tc]").forEach((tr) => {
      tr.addEventListener("click", () => {
        const row = pageRows.find((r) => r.tc_kimlik_no === tr.dataset.tc);
        global.Apron.detail.openPersonelDetail(row, currentSettings.uyari_esik_gun);
      });
    });

    renderPagination(root, rows, isActive);
  }

  /** Tablonun altındaki "Önceki / Sonraki" sayfalama çubuğu. Sayfa değişimi
      filtre sonucunu YENİDEN HESAPLAMAZ — aynı `rows` dilimlenerek yeniden çizilir. */
  function renderPagination(root, rows, isActive) {
    const mount = qs(root, "#dash-pagination");
    if (!mount) return;

    if (rows.length <= PAGE_SIZE) {
      mount.innerHTML = "";
      return;
    }

    const pages = totalPageCount(rows.length);
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, rows.length);

    mount.innerHTML = `
      <div class="pagination">
        <span class="pagination__info">${N.formatNumberTr(start)}–${N.formatNumberTr(end)} / ${N.formatNumberTr(rows.length)} kayıt</span>
        <div class="pagination__nav">
          <button type="button" class="btn btn--ghost btn--sm" id="page-prev" ${currentPage <= 1 ? "disabled" : ""}>${icon("chevron", { size: 13, className: "btn__icon icon-flip" })}Önceki</button>
          <span class="pagination__page">Sayfa ${currentPage} / ${pages}</span>
          <button type="button" class="btn btn--ghost btn--sm" id="page-next" ${currentPage >= pages ? "disabled" : ""}>Sonraki${icon("chevron", { size: 13, className: "btn__icon" })}</button>
        </div>
      </div>
    `;

    qs(root, "#page-prev").addEventListener("click", () => {
      if (!isActive() || currentPage <= 1) return;
      currentPage -= 1;
      renderTable(root, rows, isActive);
    });
    qs(root, "#page-next").addEventListener("click", () => {
      if (!isActive() || currentPage >= pages) return;
      currentPage += 1;
      renderTable(root, rows, isActive);
    });
  }

  function varYokBadge(isVar) {
    return isVar
      ? `<span class="check-badge check-badge--yes" title="VAR">${icon("check", { size: 12 })}</span>`
      : `<span class="check-badge check-badge--no" title="YOK">–</span>`;
  }

  function egitimBadge(durum) {
    // cls eşlemesi ORİJİNAL (Türkçe karışık büyük/küçük) durum metnine göre
    // yapılır — görünen yazı ayrıca büyük harfe çevrilir (bkz. up()), ama
    // eşleme anahtarları bundan etkilenmemeli.
    const cls = { Aktif: "ind--aktif", "Yaklaşıyor": "ind--yaklasiyor", "Süresi Dolmuş": "ind--dolmus", "Bilgi Yok": "ind--bilgiyok" }[durum];
    return `<span class="ind ${cls}"><span class="ind__dot"></span>${escapeHtml(up(durum))}</span>`;
  }

  /** Bir havalimanının eğitim hücresi: durum rozeti + altında (belirgin) bitiş tarihi. */
  function egitimHucresi(durum, kayit) {
    const tarihVar = kayit && kayit.bitis_tarihi;
    const tarihHtml = tarihVar
      ? `<span class="airport-cell__date mono">${N.formatDateTr(kayit.bitis_tarihi)}</span>`
      : `<span class="airport-cell__date airport-cell__date--muted">—</span>`;
    return `<div class="airport-cell">${egitimBadge(durum)}${tarihHtml}</div>`;
  }

  function exportCurrentView(root) {
    // Sayfalamadan BAĞIMSIZ: o an ekrandaki sayfa ne olursa olsun, filtreye
    // uyan TÜM kayıtlar aktarılır (bkz. refreshView — lastFilteredRows her
    // filtre/sıralama değişiminde güncel tutulur, burada tekrar hesaplanmaz).
    const rows = lastFilteredRows;
    // Ekranda o an görünen isteğe bağlı sütunlar da dahil edilir (WYSIWYG).
    const optCols = activeColumns.map(optionalColumnByKey).filter(Boolean);
    const header = [
      "SİCİL", "TC KİMLİK NO", "AD SOYAD", "UNVAN", "BAŞKANLIK", "AHL", "İGA", "HEAŞ",
      ...EGITIM_SUTUNLARI.flatMap((c) => [`${N.turkishUpper(Model.HAVALIMANI_ETIKET[c.havalimani])} EĞİTİM DURUM`, `${N.turkishUpper(Model.HAVALIMANI_ETIKET[c.havalimani])} EĞİTİM BİTİŞ`]),
      ...optCols.map((c) => N.turkishUpper(c.label)),
    ];
    const data = rows.map((r) => [
      r.sicil,
      r.tc_kimlik_no,
      r.ad_soyad,
      r.unvan,
      r.baskanlik,
      r.havalimani_var.AHL ? "VAR" : "YOK",
      r.havalimani_var.IGA_AO ? "VAR" : "YOK",
      r.havalimani_var.HEAS ? "VAR" : "YOK",
      ...EGITIM_SUTUNLARI.flatMap((c) => {
        const k = r.egitim_by_havalimani[c.havalimani];
        return [r.egitim_durumu_by_havalimani[c.havalimani], k && k.bitis_tarihi ? N.formatDateTr(k.bitis_tarihi) : "—"];
      }),
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
