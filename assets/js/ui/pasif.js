/* ============================================================
   pasif.js — Pasif Kartlar ekranı: kaynağın "Kart Durumu" sütununda
   AKTİF dışı bir değer taşıyan (bkz. model.js upsertApronKart) kartları
   havalimanı bazında listeler. AHL kaynağında bugün bu sütun tanımlı
   değildir (README §3.3); Ayarlar > Eşleştirme Profilleri'nden bir
   "Kart Durumu" sütunu eşlenirse buradaki AHL bölümü de dolmaya başlar.
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml, qsa } = global.Apron.util;
  const Model = global.Apron.model;
  const N = global.Apron.normalize;

  function pasifKartlar(rows, havalimani) {
    return rows
      .filter((r) => r.kartlar[havalimani] && r.kartlar[havalimani].aktif === false)
      .sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"));
  }

  async function render(root, isActive = () => true) {
    const rows = await Model.buildPivotRows();
    if (!isActive()) return; // kullanıcı bu sırada başka bir sekmeye geçti

    const gruplar = Model.HAVALIMANLARI.map((h) => ({
      havalimani: h,
      etiket: Model.HAVALIMANI_ETIKET[h],
      kayitlar: pasifKartlar(rows, h),
    }));
    const toplam = gruplar.reduce((sum, g) => sum + g.kayitlar.length, 0);

    root.innerHTML = `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">Pasif Kartlar</h1>
        </div>

        ${gruplar.map((g) => pasifSection(g)).join("")}

        ${toplam === 0 ? `<div class="card"><p class="card__meta">Hiçbir kaynakta pasif işaretli kart yok.</p></div>` : ""}
      </div>
    `;

    qsa(root, "tr[data-tc]").forEach((tr) => {
      tr.addEventListener("click", () => {
        const row = rows.find((r) => r.tc_kimlik_no === tr.dataset.tc);
        global.Apron.detail.openPersonelDetail(row);
      });
    });
  }

  function pasifSection(g) {
    const kartDurumuTanimliDegil = g.havalimani === "AHL" && !g.kayitlar.length;
    return `
      <div style="margin-bottom:32px">
        <h3 class="section-title"><span class="ind ind--dolmus" style="margin-right:8px">${g.kayitlar.length}</span>${escapeHtml(g.etiket)}</h3>
        ${
          g.kayitlar.length
            ? `<div class="table-wrap">
                <table class="data">
                  <thead>
                    <tr><th>TC Kimlik No</th><th>Ad Soyad</th><th>Başkanlık</th><th>Kart No</th><th>Durum</th><th>Açıklama</th><th>Bitiş Tarihi</th></tr>
                  </thead>
                  <tbody>
                    ${g.kayitlar.map((r) => pasifRow(r, g.havalimani)).join("")}
                  </tbody>
                </table>
              </div>`
            : `<div class="card"><p class="card__meta">${
                kartDurumuTanimliDegil
                  ? "AHL kaynağında \"Kart Durumu\" sütunu henüz eşlenmedi — Ayarlar &gt; Eşleştirme Profilleri'nden eşlerseniz pasif kartlar burada görünür."
                  : "Bu kaynakta pasif işaretli kart yok."
              }</p></div>`
        }
      </div>
    `;
  }

  function pasifRow(r, havalimani) {
    const k = r.kartlar[havalimani];
    return `
      <tr data-tc="${escapeHtml(r.tc_kimlik_no)}">
        <td class="mono">${escapeHtml(r.tc_kimlik_no || "—")}</td>
        <td class="data__name">${escapeHtml(r.ad_soyad)}</td>
        <td>${escapeHtml(r.baskanlik || "—")}</td>
        <td>${escapeHtml(k.kart_no || "—")}</td>
        <td>${escapeHtml(k.kart_durumu_ham || "—")}</td>
        <td>${escapeHtml(k.pasif_aciklama || "—")}</td>
        <td>${k.bitis_tarihi ? N.formatDateTr(k.bitis_tarihi) : "—"}</td>
      </tr>
    `;
  }

  global.Apron = global.Apron || {};
  global.Apron.pasif = { render };
})(window);
