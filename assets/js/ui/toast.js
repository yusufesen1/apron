/* ============================================================
   toast.js — Kısa bildirim mesajları (Katman bileşeninin hafif
   varyantı; TSS bileşen envanteriyle sınırlı kalmak için ayrı
   bir "Toast" bileşeni tanımlanmadı, Modal ailesinin küçük bir
   uzantısı olarak ele alınır).
   ============================================================ */
(function (global) {
  "use strict";

  let stack = null;

  function ensureStack() {
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }

  function show(message, { tone = "default", timeout = 4200 } = {}) {
    const el = document.createElement("div");
    el.className = "toast" + (tone === "positive" ? " toast--positive" : "");
    el.setAttribute("role", "status");
    el.textContent = message;
    ensureStack().appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    setTimeout(() => {
      el.classList.remove("is-visible");
      setTimeout(() => el.remove(), 260);
    }, timeout);
  }

  global.Apron = global.Apron || {};
  global.Apron.toast = { show };
})(window);
