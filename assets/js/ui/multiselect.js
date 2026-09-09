/* ============================================================
   multiselect.js — Tasarım dilimize uygun özel açılır menü.
   Tarayıcının kendi <select> açılır listesi stillendirilemediği
   için (yalnızca kapalı hali özelleştirilebiliyor) özel olarak
   inşa edildi. İki modu var:
   - multiple:true  → Unvan/Başkanlık gibi uzun listeler: arama
     kutulu, onay kutulu, birden fazla seçilebilir.
   - multiple:false → Havalimanı/Eğitim Durumu gibi kısa, tekli
     seçim listeleri: arama kutusu yok, bir seçenek tıklanınca
     panel kapanır.
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml, qs, qsa, debounce } = global.Apron.util;
  const icon = global.Apron.icon;

  /** Aynı anda yalnızca bir panel açık kalsın diye paylaşılan durum. */
  let openInstance = null;

  function closeOpenInstance() {
    if (openInstance) openInstance.close();
  }

  document.addEventListener("click", (e) => {
    if (openInstance && !openInstance.wrap.contains(e.target)) closeOpenInstance();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openInstance) closeOpenInstance();
  });

  function normalizeOption(o) {
    return typeof o === "string" ? { value: o, label: o } : o;
  }

  /**
   * @param {object} opts
   * @param {string} [opts.placeholder] Hiçbir şey seçili değilken tetikleyicide görünen metin (örn. "Tümü").
   *   staticLabel:true iken bu metin seçim durumundan bağımsız her zaman sabit görünür (örn. "Sütun Ekle").
   * @param {string} [opts.searchPlaceholder]
   * @param {string} [opts.triggerId]
   * @param {string} [opts.triggerClassName] Verilirse tetikleyicinin görünümü ("input" yerine) bu sınıfları kullanır — örn. bir düğme gibi görünmesi için "btn btn--sm".
   * @param {"chevron"|"plus"} [opts.triggerIcon]
   * @param {boolean} [opts.staticLabel] true ise tetikleyici metni hep placeholder'da kalır (bir "ekle" düğmesi gibi davranır).
   * @param {boolean} [opts.multiple] false ise tekli seçim, arama kutusu ve toplu eylemler gizlenir.
   * @param {number} [opts.maxSelected] multiple:true iken en fazla kaç seçenek işaretlenebileceği.
   * @param {"left"|"right"} [opts.panelAlign] Panel tetikleyicinin sol mu sağ mı kenarına hizalansın (sağa yakın tetikleyicilerde ekran dışına taşmaması için "right").
   * @param {(selected: string[]|string) => void} opts.onChange multiple:true iken dizi, false iken tek değer döner.
   */
  function create({
    placeholder = "Tümü",
    searchPlaceholder = "Ara…",
    triggerId,
    triggerClassName,
    triggerIcon = "chevron",
    staticLabel = false,
    multiple = true,
    maxSelected = null,
    panelAlign = "left",
    onChange,
  }) {
    let options = []; // [{value, label}]
    let selected = new Set();
    let searchTerm = "";

    const triggerInner =
      triggerIcon === "plus"
        ? `${icon("plus", { size: 14, className: "btn__icon" })}<span class="multiselect__trigger-text">${escapeHtml(placeholder)}</span>`
        : `<span class="multiselect__trigger-text">${escapeHtml(placeholder)}</span>${icon("chevron", { size: 14, className: "multiselect__trigger-icon" })}`;

    const wrap = document.createElement("div");
    wrap.className = "multiselect" + (triggerClassName ? " multiselect--compact" : "");
    wrap.innerHTML = `
      <button type="button" class="multiselect__trigger ${triggerClassName || "input"}"${triggerId ? ` id="${escapeHtml(triggerId)}"` : ""}>
        ${triggerInner}
      </button>
      <div class="multiselect__panel${panelAlign === "right" ? " multiselect__panel--right" : ""}" hidden>
        ${
          multiple
            ? `<div class="multiselect__search">
                 ${icon("search", { size: 13, className: "multiselect__search-icon" })}
                 <input type="text" placeholder="${escapeHtml(searchPlaceholder)}" />
               </div>
               <div class="multiselect__actions">
                 <button type="button" data-action="all">Tümünü Seç</button>
                 <button type="button" data-action="none">Temizle</button>
               </div>`
            : ""
        }
        <div class="multiselect__list"></div>
        <p class="multiselect__empty" hidden>Sonuç bulunamadı.</p>
        ${maxSelected ? `<p class="multiselect__hint" hidden>En fazla ${maxSelected} sütun eklenebilir.</p>` : ""}
      </div>
    `;

    const trigger = qs(wrap, ".multiselect__trigger");
    const triggerText = qs(wrap, ".multiselect__trigger-text");
    const panel = qs(wrap, ".multiselect__panel");
    const searchInput = qs(wrap, ".multiselect__search input");
    const listEl = qs(wrap, ".multiselect__list");
    const emptyEl = qs(wrap, ".multiselect__empty");
    const hintEl = qs(wrap, ".multiselect__hint");

    function labelFor(value) {
      const o = options.find((x) => x.value === value);
      return o ? o.label : value;
    }

    function visibleOptions() {
      const term = searchTerm.trim().toLocaleLowerCase("tr-TR");
      if (!term) return options;
      return options.filter((o) => o.label.toLocaleLowerCase("tr-TR").includes(term));
    }

    function renderList() {
      const filtered = visibleOptions();
      emptyEl.hidden = filtered.length > 0;

      if (multiple) {
        const atMax = maxSelected != null && selected.size >= maxSelected;
        if (hintEl) hintEl.hidden = !atMax;
        listEl.innerHTML = filtered
          .map((o) => {
            const checked = selected.has(o.value);
            const disabled = atMax && !checked;
            return `
          <label class="multiselect__option${disabled ? " is-disabled" : ""}">
            <input type="checkbox" value="${escapeHtml(o.value)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
            <span>${escapeHtml(o.label)}</span>
          </label>
        `;
          })
          .join("");
        qsa(listEl, "input[type=checkbox]").forEach((cb) => {
          cb.addEventListener("change", () => {
            if (cb.checked) selected.add(cb.value);
            else selected.delete(cb.value);
            renderList();
            afterChange();
          });
        });
      } else {
        listEl.innerHTML = filtered
          .map(
            (o) => `
          <button type="button" class="multiselect__option multiselect__option--single${selected.has(o.value) ? " is-selected" : ""}" data-value="${escapeHtml(o.value)}">
            <span>${escapeHtml(o.label)}</span>
            ${selected.has(o.value) ? icon("check", { size: 13, className: "multiselect__option-check" }) : ""}
          </button>
        `
          )
          .join("");
        qsa(listEl, "[data-value]").forEach((btn) => {
          btn.addEventListener("click", () => {
            selected = new Set([btn.dataset.value]);
            afterChange();
            close();
          });
        });
      }
    }

    function updateTrigger() {
      if (staticLabel) triggerText.textContent = placeholder;
      else if (selected.size === 0) triggerText.textContent = placeholder;
      else if (selected.size === 1) triggerText.textContent = labelFor(Array.from(selected)[0]);
      else triggerText.textContent = `${selected.size} seçili`;
      trigger.classList.toggle("is-active", selected.size > 0 && !selected.has(""));
    }

    function afterChange() {
      updateTrigger();
      onChange(multiple ? Array.from(selected) : Array.from(selected)[0] || "");
    }

    function open() {
      closeOpenInstance();
      panel.hidden = false;
      wrap.classList.add("is-open");
      openInstance = { wrap, close };
      searchTerm = "";
      if (searchInput) searchInput.value = "";
      renderList();
      if (searchInput) searchInput.focus();
    }

    function close() {
      panel.hidden = true;
      wrap.classList.remove("is-open");
      if (openInstance && openInstance.wrap === wrap) openInstance = null;
    }

    trigger.addEventListener("click", () => (panel.hidden ? open() : close()));

    if (searchInput) {
      searchInput.addEventListener(
        "input",
        debounce((e) => {
          searchTerm = e.target.value;
          renderList();
        }, 80)
      );
    }

    if (multiple) {
      qs(wrap, '[data-action="all"]').addEventListener("click", () => {
        const remaining = maxSelected != null ? Math.max(0, maxSelected - selected.size) : Infinity;
        visibleOptions()
          .filter((o) => !selected.has(o.value))
          .slice(0, remaining)
          .forEach((o) => selected.add(o.value));
        renderList();
        afterChange();
      });
      qs(wrap, '[data-action="none"]').addEventListener("click", () => {
        selected.clear();
        renderList();
        afterChange();
      });
    }

    return {
      el: wrap,
      /** Seçenek listesini günceller. Dizi elemanları düz metin ya da {value,label} olabilir. */
      setOptions(nextOptions) {
        options = nextOptions.map(normalizeOption);
        const validValues = options.map((o) => o.value);
        const kept = Array.from(selected).filter((s) => validValues.includes(s));
        if (kept.length !== selected.size) selected = new Set(kept);
        updateTrigger();
        if (!panel.hidden) renderList();
      },
      /** Dışarıdan seçimi ayarlar — multiple:true iken dizi, false iken tek değer (string) verilir. */
      setSelected(values) {
        const arr = multiple ? values : [values].filter((v) => v !== "" && v != null);
        const validValues = options.map((o) => o.value);
        selected = new Set(arr.filter((v) => validValues.includes(v)));
        updateTrigger();
        if (!panel.hidden) renderList();
      },
      getSelected() {
        return multiple ? Array.from(selected) : Array.from(selected)[0] || "";
      },
      clear() {
        selected.clear();
        updateTrigger();
        if (!panel.hidden) renderList();
      },
    };
  }

  global.Apron = global.Apron || {};
  global.Apron.multiselect = { create };
})(window);
