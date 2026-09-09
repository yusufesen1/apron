/* ============================================================
   modal.js — Genel amaçlı Katman (Modal) bileşeni.
   ============================================================ */
(function (global) {
  "use strict";

  let current = null;

  function open({ title, bodyHtml, wide = false, onRender } = {}) {
    close();

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal ${wide ? "modal--wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeAttr(title || "")}">
        <div class="modal__header">
          <h2 class="page__title" style="font-size:18px">${title || ""}</h2>
          <button type="button" class="modal__close" aria-label="Kapat">${global.Apron.icon("close", { size: 16 })}</button>
        </div>
        <div class="modal__body">${bodyHtml || ""}</div>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    current = backdrop;

    requestAnimationFrame(() => backdrop.classList.add("is-open"));

    backdrop.querySelector(".modal__close").addEventListener("click", close);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    const escHandler = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", escHandler);
    backdrop.__escHandler = escHandler;

    if (onRender) onRender(backdrop.querySelector(".modal__body"), close);

    return close;
  }

  function close() {
    if (!current) return;
    const el = current;
    current = null;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", el.__escHandler);
    el.classList.remove("is-open");
    setTimeout(() => el.remove(), 240);
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  global.Apron = global.Apron || {};
  global.Apron.modal = { open, close };
})(window);
