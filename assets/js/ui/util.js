/* ============================================================
   util.js — Küçük DOM/metin yardımcıları (tüm görünümler kullanır).
   ============================================================ */
(function (global) {
  "use strict";

  function escapeHtml(v) {
    if (v == null) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function qs(root, sel) {
    return (root || document).querySelector(sel);
  }
  function qsa(root, sel) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  global.Apron = global.Apron || {};
  global.Apron.util = { escapeHtml, el, qs, qsa, debounce };
})(window);
