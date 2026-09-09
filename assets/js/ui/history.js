/* ============================================================
   history.js — İçe Aktarma Geçmişi (README §5 FR7).
   ============================================================ */
(function (global) {
  "use strict";

  const { escapeHtml } = global.Apron.util;
  const { Store } = global.Apron.DB;
  const Model = global.Apron.model;
  const KAYNAKLAR = global.Apron.mapping.KAYNAKLAR;

  async function render(root, isActive = () => true) {
    const [imports, customKaynaklar] = await Promise.all([Store.getAll("imports"), Model.getCustomKaynaklar()]);
    imports.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
    if (!isActive()) return; // kullanıcı bu sırada başka bir sekmeye geçti

    const ozelAdlar = {};
    customKaynaklar.forEach((k) => (ozelAdlar[k.id] = k.ad));

    root.innerHTML = `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">İçe Aktarma Geçmişi</h1>
        </div>

        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>Tarih</th><th>Kaynak</th><th>Dosya</th><th>Toplam Satır</th><th>Eklenen</th><th>Güncellenen</th><th>Atlanan</th></tr>
            </thead>
            <tbody>
              ${
                imports.length
                  ? imports.map((imp) => rowHtml(imp, ozelAdlar)).join("")
                  : `<tr><td colspan="7"><div class="table-empty">Henüz içe aktarma yapılmadı.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function rowHtml(imp, ozelAdlar) {
    const tarih = new Date(imp.tarih);
    const tarihStr = `${pad(tarih.getDate())}.${pad(tarih.getMonth() + 1)}.${tarih.getFullYear()} ${pad(tarih.getHours())}:${pad(tarih.getMinutes())}`;
    const kaynakAdi = (KAYNAKLAR[imp.kaynak] || {}).etiket || ozelAdlar[imp.kaynak] || imp.kaynak;
    return `
      <tr>
        <td class="mono">${tarihStr}</td>
        <td>${escapeHtml(kaynakAdi)}</td>
        <td>${escapeHtml(imp.dosya_adi)}</td>
        <td class="mono">${imp.toplam_satir ?? "—"}</td>
        <td class="mono">${imp.eklenen ?? "—"}</td>
        <td class="mono">${imp.guncellenen ?? "—"}</td>
        <td class="mono">${imp.atlanan ?? 0}</td>
      </tr>
    `;
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  global.Apron = global.Apron || {};
  global.Apron.history = { render };
})(window);
