/* ============================================================
   detail.js — Tekil personel profili (Katman/Modal içinde).
   Tüm havalimanı kartları, eğitim geçmişi ve taşeron "Bilgi"
   butonu (README §5 FR9) burada gösterilir.
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml } = global.Apron.util;
  const N = global.Apron.normalize;
  const Model = global.Apron.model;
  const icon = global.Apron.icon;

  function openPersonelDetail(row) {
    global.Apron.modal.open({
      title: escapeHtml(row.ad_soyad),
      wide: true,
      bodyHtml: bodyHtml(row),
      onRender: (bodyEl) => wire(bodyEl, row),
    });
  }

  function bodyHtml(row) {
    return `
      <div class="stack">
        <div class="label-list card">
          ${labelRow("T.C. Kimlik No", row.tc_kimlik_no || "—")}
          ${labelRow("Unvan", row.unvan || "—")}
          ${labelRow("Başkanlık", row.baskanlik || "—")}
          ${row.sicil ? labelRow("Sicil", row.sicil) : ""}
        </div>

        <div>
          <h3 class="section-title">Havalimanı Kartları</h3>
          <div class="card-grid" id="detail-kartlar">
            ${Model.HAVALIMANLARI.map((h) => havalimaniCard(h, row.kartlar[h])).join("")}
          </div>
        </div>

        <div>
          <h3 class="section-title">Güvenlik Bilinci Eğitimi</h3>
          ${egitimTable(row.egitim_kayitlari)}
        </div>
      </div>
    `;
  }

  function labelRow(k, v) {
    return `<div class="label-list__row"><span class="label-list__key">${escapeHtml(k)}</span><span class="label-list__val">${escapeHtml(v)}</span></div>`;
  }

  function havalimaniCard(h, kart) {
    const etiket = Model.HAVALIMANI_ETIKET[h];
    if (!kart) {
      return `
        <div class="card">
          <div class="card__row"><span class="card__title">${etiket}</span><span class="ind ind--yok">YOK</span></div>
          <p class="card__meta">Bu havalimanı için içe aktarılmış kart kaydı bulunmuyor.</p>
        </div>
      `;
    }
    const durumBadge = kart.aktif
      ? `<span class="ind ind--var"><span class="ind__dot"></span>VAR — Aktif</span>`
      : `<span class="ind ind--yok">YOK — ${escapeHtml(kart.kart_durumu_ham || "Pasif")}</span>`;

    const bilgiBtn = kart.taseron_firma
      ? `<button type="button" class="btn btn--sm" data-taseron="${escapeHtml(kart.taseron_firma)}" data-havalimani="${escapeHtml(etiket)}">${icon("info", { size: 14, className: "btn__icon" })}Bilgi</button>`
      : `<button type="button" class="btn btn--sm" disabled title="Bu havalimanı kaynağında taşeron firma bilgisi bulunmuyor">${icon("info", { size: 14, className: "btn__icon" })}Bilgi</button>`;

    return `
      <div class="card">
        <div class="card__row"><span class="card__title">${etiket}</span>${durumBadge}</div>
        <div class="label-list">
          ${labelRow("Kart No", kart.kart_no || "—")}
          ${labelRow("Başlangıç", kart.baslangic_tarihi ? N.formatDateTr(kart.baslangic_tarihi) : "—")}
          ${labelRow("Bitiş", kart.bitis_tarihi ? N.formatDateTr(kart.bitis_tarihi) : "—")}
          ${kart.pasif_aciklama ? labelRow("Pasif Açıklama", kart.pasif_aciklama) : ""}
          ${labelRow("Kaynak Dosya", kart.kaynak_dosya || "—")}
        </div>
        <div style="margin-top:12px">${bilgiBtn}</div>
      </div>
    `;
  }

  function egitimTable(kayitlar) {
    if (!kayitlar || !kayitlar.length) {
      return `<div class="empty-state">${icon("clock", { size: 24, className: "empty-state__icon" })}<p>Bu personel için eğitim tarihi kaydı bulunmuyor.</p></div>`;
    }
    const rows = kayitlar
      .slice()
      .sort((a, b) => (a.bitis_tarihi < b.bitis_tarihi ? 1 : -1))
      .map((k) => {
        const durum = Model.egitimDurumu(k, 60);
        const cls = { Aktif: "ind--aktif", "Yaklaşıyor": "ind--yaklasiyor", "Süresi Dolmuş": "ind--dolmus", "Bilgi Yok": "ind--bilgiyok" }[durum];
        return `
          <tr>
            <td>${Model.HAVALIMANI_ETIKET[k.kaynak] || k.kaynak}</td>
            <td>${N.formatDateTr(k.egitim_tarihi)}</td>
            <td>${k.gecerlilik_yili} yıl ${k.gecerlilik_kaynagi === "varsayilan" ? '<span class="data__muted">(varsayılan)</span>' : ""}</td>
            <td>${N.formatDateTr(k.bitis_tarihi)}</td>
            <td><span class="ind ${cls}">${escapeHtml(durum)}</span></td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Kaynak</th><th>Eğitim Tarihi</th><th>Geçerlilik</th><th>Bitiş</th><th>Durum</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function wire(bodyEl, row) {
    bodyEl.querySelectorAll("[data-taseron]").forEach((btn) => {
      btn.addEventListener("click", () => {
        global.Apron.toast.show(`${btn.dataset.havalimani} — Taşeron Firma: ${btn.dataset.taseron}`);
      });
    });
  }

  global.Apron = global.Apron || {};
  global.Apron.detail = { openPersonelDetail };
})(window);
