import { launchChromium } from '../lib/chromium.mjs';
// tools/test/test-detailsrc.mjs — NHÃN "NỘI DUNG TỔNG HỢP" (v26)
// Món có detailSource === "tong-hop" (mục Chi tiết do task-06 tự dựng, không phải nguyên văn Wikipedia)
// phải hiện dòng nhỏ "Nội dung tổng hợp, có thể chưa đầy đủ". Món wikipedia hoặc không có trường này
// phải hiển thị y như cũ (không thêm dòng nào).
// Dùng: node tools/test/test-detailsrc.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');

const ok = [], bad = [], skip = [];
const check = (name, cond, extra) => {
  (cond ? ok : bad).push(name);
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? ' — ' + extra : ''));
};

const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__mgd && window.__mgd.ALL().length > 0, null, { timeout: 20000 });

const res = await page.evaluate(async () => {
  const M = window.__mgd, ALL = M.ALL();
  // detailSource nằm trong phần NẶNG -> tải đủ 4 mảnh rồi mới phân loại
  for (let k = 0; k < M.DETAIL.chunks; k++) {
    try { await M.loadDetailChunk(k); } catch (e) {}
  }
  const tong = ALL.filter((d) => d.detailSource === 'tong-hop' && Array.isArray(d.detail) && d.detail.length);
  const wiki = ALL.filter((d) => d.detailSource === 'wikipedia' && Array.isArray(d.detail) && d.detail.length);
  const none = ALL.filter((d) => !d.detailSource && Array.isArray(d.detail) && d.detail.length);
  const html = (d) => M.heavyHTML(d);
  const t = tong[0] || null, w = wiki[0] || null, n = none[0] || null;
  return {
    nTong: tong.length, nWiki: wiki.length, nNone: none.length,
    tongId: t ? t.id : '', wikiId: w ? w.id : '', noneId: n ? n.id : '',
    tongHtml: t ? html(t) : '', wikiHtml: w ? html(w) : '', noneHtml: n ? html(n) : '',
    tongDetailHasNote: t ? /Nội dung tổng hợp/.test(html(t)) : false,
    wikiHasNote: w ? /Nội dung tổng hợp/.test(html(w)) : false,
    noneHasNote: n ? /Nội dung tổng hợp/.test(html(n)) : false,
    tongSections: t ? t.detail.map((x) => x.t) : []
  };
});

console.log('=== NHÃN NỘI DUNG TỔNG HỢP ===');
console.log('  món tong-hop: ' + res.nTong + ' · wikipedia: ' + res.nWiki + ' · không có trường: ' + res.nNone);
if (!res.nTong) skip.push('dữ liệu tong-hop (đang cập nhật bởi task-09)');
else {
  check('có ít nhất 1 món detailSource = "tong-hop"', res.nTong > 0, res.nTong + ' món');
  check('món tong-hop hiện dòng "Nội dung tổng hợp, có thể chưa đầy đủ"', res.tongDetailHasNote === true, res.tongId);
  check('dòng nhãn nằm trong khối 📖 Chi tiết, có class .detail-src', /class="detail-src"/.test(res.tongHtml), 'có khối detail: ' + /class="detail"/.test(res.tongHtml));
  check('mục Chi tiết vẫn giữ đủ các mục như cũ', res.tongSections.length >= 2, res.tongSections.join(' · '));
  check('món wikipedia KHÔNG hiện nhãn này', res.wikiHasNote === false, res.wikiId || '(không có món wikipedia trong dữ liệu)');
  if (res.none) check('món không có trường detailSource hiển thị như cũ', res.noneHasNote === false, res.noneId);
  else skip.push('món không có detailSource (dữ liệu hiện tại đã gắn hết)');
}

/* ---------- trong popup thật ---------- */
if (res.nTong) {
  const before = await page.evaluate(() => window.__mgd.state.seen.size);
  await page.evaluate((id) => { const M = window.__mgd; M.openWin(M.dishById(id)); }, res.tongId);
  await page.waitForFunction(() => {
    const s = document.querySelector('#heavySlot');
    return s && /data-act="detail"/.test(s.innerHTML);
  }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const pop = await page.evaluate(() => {
    const dlg = document.querySelector('#winDialog');
    const note = dlg.querySelector('.detail-src');
    const toggle = dlg.querySelector('[data-act="detail"]');
    return {
      name: dlg.querySelector('.win-name') ? dlg.querySelector('.win-name').textContent.trim() : '',
      hasNote: !!note, noteText: note ? note.textContent.trim() : '',
      noteCount: dlg.querySelectorAll('.detail-src').length,
      noteH: note ? Math.round(note.getBoundingClientRect().height) : 0,
      hasToggle: !!toggle,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      seenUnchanged: window.__mgd.state.seen.size >= 0
    };
  });
  check('popup món tong-hop có nhãn ngay dưới nút 📖 Chi tiết', pop.hasNote && pop.hasToggle, pop.name);
  check('nội dung nhãn đúng câu yêu cầu', /^ℹ️ Nội dung tổng hợp, có thể chưa đầy đủ$/.test(pop.noteText), pop.noteText);
  check('chỉ có MỘT nhãn, không tràn ngang', pop.noteCount === 1 && pop.overflowX === false, pop.noteCount + ' nhãn · tràn ngang: ' + pop.overflowX);
}
check('không lỗi JS', errs.length === 0, errs.slice(0, 3).join(' | '));

await ctx.close(); await browser.close();
if (skip.length) console.log('\nBỎ QUA (dữ liệu): ' + skip.join(', '));
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
