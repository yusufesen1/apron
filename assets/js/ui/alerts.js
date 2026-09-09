/* ============================================================
   alerts.js — Eğitim Takibi ekranı (README §5 FR5): eğitim
   geçerliliği bitmiş veya yaklaşan (Ayarlar'daki eşik gün) personel
   listesi.
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml, qs, qsa } = global.Apron.util;
  const Model = global.Apron.model;
  const N = global.Apron.normalize;
  const icon = global.Apron.icon;

  async function render(root, isActive = () => true) {
    const [rows, settings] = await Promise.all([Model.buildPivotRows(), Model.getSettings()]);
    if (!isActive()) return; // kullanıcı bu sırada başka bir sekmeye geçti
    const dolmus = rows.filter((r) => r.egitim_durumu === "Süresi Dolmuş");
    const yaklasiyor = rows.filter((r) => r.egitim_durumu === "Yaklaşıyor");
    const bilgiYok = rows.filter((r) => r.egitim_durumu === "Bilgi Yok" && Object.values(r.havalimani_var).some(Boolean));

    root.innerHTML = `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">Eğitim Takibi</h1>
        </div>

        ${alertSection("Süresi Dolmuş", dolmus, "ind--dolmus")}
        ${alertSection(`Yaklaşıyor (${N.formatEsikSuresi(settings.uyari_esik_gun)})`, yaklasiyor, "ind--yaklasiyor")}
        ${alertSection("Eğitim Bilgisi Eksik (aktif kartı olup eğitim tarihi bulunmayan)", bilgiYok, "ind--bilgiyok")}
      </div>
    `;

    qsa(root, "tr[data-tc]").forEach((tr) => {
      tr.addEventListener("click", () => {
        const row = rows.find((r) => r.tc_kimlik_no === tr.dataset.tc);
        global.Apron.detail.openPersonelDetail(row);
      });
    });
  }

  function alertSection(title, rows, cls) {
    return `
      <div style="margin-bottom:32px">
        <h3 class="section-title"><span class="ind ${cls}" style="margin-right:8px">${rows.length}</span>${escapeHtml(title)}</h3>
        ${
          rows.length
            ? `<div class="table-wrap">
                <table class="data">
                  <thead><tr><th>TC Kimlik No</th><th>Ad Soyad</th><th>Başkanlık</th><th>Havalimanları</th><th>Eğitim Bitiş</th></tr></thead>
                  <tbody>
                    ${rows
                      .map(
                        (r) => `
                      <tr data-tc="${escapeHtml(r.tc_kimlik_no)}">
                        <td class="mono">${escapeHtml(r.tc_kimlik_no || "—")}</td>
                        <td class="data__name">${escapeHtml(r.ad_soyad)}</td>
                        <td>${escapeHtml(r.baskanlik || "—")}</td>
                        <td>${havalimaniListesi(r.havalimani_var)}</td>
                        <td>${r.guncel_egitim ? N.formatDateTr(r.guncel_egitim.bitis_tarihi) : "—"}</td>
                      </tr>
                    `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
            : `<div class="card"><p class="card__meta">Bu kategoride kayıt yok.</p></div>`
        }
      </div>
    `;
  }

  function havalimaniListesi(v) {
    return Object.entries(v)
      .filter(([, val]) => val)
      .map(([k]) => Model.HAVALIMANI_ETIKET[k])
      .join(", ") || "—";
  }

  global.Apron = global.Apron || {};
  global.Apron.alerts = { render };
})(window);
