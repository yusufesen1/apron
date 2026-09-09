/* ============================================================
   app.js — Uygulama kabuğu: üst bar, sekme yönlendirme, başlangıç.
   ============================================================ */
(function (global) {
  "use strict";

  const TABS = [
    { id: "dashboard", label: "Genel Bakış", render: (isActive) => global.Apron.dashboard.render(viewRoot(), isActive) },
    { id: "import", label: "Excel Yükle", render: (isActive) => global.Apron.importView.render(viewRoot(), isActive) },
    // "alerts" (Eğitim Takibi) sekmesi kullanıcı isteğiyle header'dan kaldırıldı —
    // alerts.js dosyası duruyor, geri eklemek için bu satır + index.html'deki
    // <script> etiketi yeniden açılabilir.
    { id: "history", label: "İçe Aktarma Geçmişi", render: (isActive) => global.Apron.history.render(viewRoot(), isActive) },
    { id: "settings", label: "Ayarlar", render: (isActive) => global.Apron.settings.render(viewRoot(), isActive) },
  ];

  // Sekmeler arası hızlı geçişte, önceki sekmenin gecikmeli (async) render'ının
  // artık DOM'da olmayan elemanlara yazmasını önlemek için basit bir "nesil" (token)
  // mekanizması: her showTab çağrısı kendi token'ını alır, yalnızca en güncel
  // token'a sahip render DOM'a yazabilir.
  let activeToken = 0;

  function viewRoot() {
    return document.getElementById("view-root");
  }

  function currentTabFromHash() {
    const h = (location.hash || "").replace("#", "");
    return TABS.some((t) => t.id === h) ? h : "dashboard";
  }

  async function showTab(id) {
    const tab = TABS.find((t) => t.id === id) || TABS[0];
    const myToken = ++activeToken;
    const isActive = () => myToken === activeToken;

    document.querySelectorAll(".tab").forEach((btn) => {
      btn.setAttribute("aria-selected", String(btn.dataset.tab === tab.id));
    });
    // Hash zaten bu sekmedeyse tekrar atamayı atla — gereksiz hashchange/render döngüsünü önler.
    if (location.hash.replace("#", "") !== tab.id) location.hash = tab.id;
    await tab.render(isActive);
  }

  function buildShell() {
    document.getElementById("app").innerHTML = `
      <div class="brand-strip" aria-hidden="true"></div>
      <div class="topbar">
        <div class="brand">
          <img class="brand__logo" src="assets/img/tss-logo-siyah.png" alt="Turkish Support Services" />
          <span class="brand__divider" aria-hidden="true"></span>
          <span class="brand__name">Apron Kart Takip Sistemi</span>
        </div>
      </div>
      <nav class="tabs" role="tablist" aria-label="Bölümler">
        ${TABS.map((t) => `<button type="button" class="tab" role="tab" data-tab="${t.id}" aria-selected="false">${t.label}</button>`).join("")}
      </nav>
      <main id="view-root"></main>
    `;

    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => showTab(btn.dataset.tab));
    });
  }

  async function init() {
    document.documentElement.lang = "tr";
    buildShell();
    await global.Apron.DB.openDb();
    await showTab(currentTabFromHash());
    window.addEventListener("hashchange", () => showTab(currentTabFromHash()));
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
