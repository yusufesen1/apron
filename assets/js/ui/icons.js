/* ============================================================
   icons.js — Yerel, çevrimdışı ikon seti (SVG, çizgi kalınlığı
   1.75px, ölçüler yalnızca 16/20/24px). TSS kılavuzunda ayrı bir
   ikon dosyası verilmediği için Lucide çizgi diline benzer bir
   ikame set olarak işaretlenmiştir (bkz. README §7).
   ============================================================ */
(function (global) {
  "use strict";

  const PATHS = {
    upload: '<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 8h.01"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18h.01"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    download: '<path d="M12 4v12"/><path d="M6 10l6 6 6-6"/><path d="M4 20h16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M4.6 10.4a7.7 7.7 0 0 1 .5-1.3L3.8 7.4l1.8-3.1 2.1.9c.4-.3.8-.6 1.3-.8L9.4 2h3.2l.4 2.4c.5.2.9.5 1.3.8l2.1-.9 1.8 3.1-1.3 1.7c.2.4.4.9.5 1.3l2.3.6v3.2l-2.3.6a7.7 7.7 0 0 1-.5 1.3l1.3 1.7-1.8 3.1-2.1-.9c-.4.3-.8.6-1.3.8l-.4 2.4H9.4l-.4-2.4a7.7 7.7 0 0 1-1.3-.8l-2.1.9-1.8-3.1 1.3-1.7a7.7 7.7 0 0 1-.5-1.3L2.3 13v-3.2l2.3-.4z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="3"/><path d="M14.5 14a6 6 0 0 1 8 6"/>',
    refresh: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    badge: '<path d="M12 3l2.4 1.6 2.9-.2 1.1 2.6 2.5 1.4-.7 2.8.7 2.8-2.5 1.4-1.1 2.6-2.9-.2L12 20l-2.4-1.6-2.9.2-1.1-2.6-2.5-1.4.7-2.8-.7-2.8 2.5-1.4 1.1-2.6 2.9.2z"/><path d="M9.5 12l1.8 1.8L15 10"/>',
    building: '<path d="M4 21V4h10v17"/><path d="M14 9h6v12"/><path d="M8 8h.01"/><path d="M8 12h.01"/><path d="M8 16h.01"/>',
    sort: '<path d="M8 9l4-4 4 4"/><path d="M16 15l-4 4-4-4"/>',
    chevronUp: '<path d="M6 15l6-6 6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    filter: '<polygon points="21 4 3 4 10 12.46 10 19 14 21 14 12.46 21 4"/>',
    grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.4 4.4M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.4-1"/><path d="M9.5 9.5a3 3 0 0 0 4.2 4.2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  };

  function icon(name, { size = 16, className = "" } = {}) {
    const body = PATHS[name] || PATHS.info;
    return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  global.Apron = global.Apron || {};
  global.Apron.icon = icon;
})(window);
