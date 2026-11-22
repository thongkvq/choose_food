import { launchChromium } from '../lib/chromium.mjs';
// tools/test/test-group.mjs — QUAY CHO NHÓM, chuyền tay một máy (v26)
// Luồng: nhập 2–8 tên -> từng người gạch tối đa N món (có ô tìm + bỏ qua lượt) -> quay băng chuyền
// trên pool đã trừ món bị gạch -> popup ghi "Cả nhóm: …" + danh sách món bị gạch (thu gọn).
// Kiểm thêm: pool rỗng sau khi gạch thì báo rõ + cho bỏ gạch; đóng popup thì pool trả lại như cũ.
// Dùng: node tools/test/test-group.mjs [baseUrl]
const BASE = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');

const ok = [], bad = [];
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

/* ---------- 0) chuẩn hoá tên ---------- */
const pn = await page.evaluate(() => {
  const M = window.__mgd;
  return {
    dedupe: M.parseNames('An, an; Bình\nChi\nDũng'),
    ten: M.parseNames('a,b,c,d,e,f,g,h,i,j,k'),
    empty: M.parseNames('   ,  , '),
    one: M.parseNames('Chỉ Một Người')
  };
});
check('parseNames: cắt tên, bỏ trùng không phân biệt hoa thường', JSON.stringify(pn.dedupe) === JSON.stringify(['An', 'Bình', 'Chi', 'Dũng']), JSON.stringify(pn.dedupe));
check('parseNames: tối đa 8 người', pn.ten.length === 8, pn.ten.length + ' tên');
check('parseNames: rỗng/rác -> []', pn.empty.length === 0);

/* ---------- 1) mở chế độ nhóm: 1 người bị từ chối ---------- */
await page.click('#btnGroup');
await page.waitForTimeout(350);
const opened = await page.evaluate(() => !document.querySelector('#groupBackdrop').hidden && !!document.querySelector('#groupNames') && !!document.querySelector('#groupVetoMax'));
check('nút 👥 Quay nhóm mở bảng nhập tên + số món được gạch', opened === true);

const one = await page.evaluate(() => window.__mgd.groupStart('Chỉ Một Người', 2));
check('chỉ 1 người -> không cho bắt đầu (cần ≥2)', one === false && (await page.evaluate(() => window.__mgd.group() === null)));

/* ---------- 2) lượt từng người ---------- */
const poolBefore = await page.evaluate(() => window.__mgd.pool().length);
await page.fill('#groupNames', 'An, Bình, Chi');
await page.fill('#groupVetoMax', '2');
await page.click('[data-gact="start"]');
await page.waitForTimeout(350);
const turn1 = await page.evaluate(() => ({
  head: document.querySelector('.turn-head b').textContent.trim(),
  idx: document.querySelector('.turn-head i').textContent.trim(),
  picks: document.querySelectorAll('#groupPick .pick').length,
  step: document.querySelector('.turn-head b').textContent.indexOf('An') >= 0,
  chips: [...document.querySelectorAll('.turn-chip')].map((c) => c.textContent + (c.classList.contains('on') ? '*' : ''))
}));
check('màn "Lượt của An" + 1/3 + danh sách gợi ý', turn1.step && /1\/3/.test(turn1.idx) && turn1.picks >= 12, turn1.head + ' ' + turn1.idx + ' · ' + turn1.picks + ' gợi ý');
check('có dải tên cả nhóm, người đang tới lượt được đánh dấu', turn1.chips.join(',') === 'An*,Bình,Chi', turn1.chips.join(','));

// gạch 2 món -> món thứ 3 bị chặn
const vetoIds = await page.evaluate(() => [...document.querySelectorAll('#groupPick .pick')].slice(0, 3).map((b) => b.dataset.pick));
await page.click('#groupPick .pick[data-pick="' + vetoIds[0] + '"]');
await page.click('#groupPick .pick[data-pick="' + vetoIds[1] + '"]');
await page.waitForTimeout(200);
await page.click('#groupPick .pick[data-pick="' + vetoIds[2] + '"]');
await page.waitForTimeout(250);
const vetoState = await page.evaluate(() => ({
  count: document.querySelector('.veto-count').textContent.trim(),
  vetoed: [...document.querySelectorAll('#groupPick .pick.veto')].map((b) => b.dataset.pick),
  turn: window.__mgd.group().turns[0].veto.slice(),
  toast: document.querySelector('#toastNotification').textContent
}));
check('gạch đúng 2 món, món thứ 3 không thêm được', vetoState.count === '2/2' && vetoState.vetoed.length === 2 && vetoState.turn.length === 2, vetoState.count + ' · ' + vetoState.vetoed.join(','));
check('vượt giới hạn có báo rõ', /tối đa/i.test(vetoState.toast), vetoState.toast.slice(0, 60));

// bỏ gạch bằng cách bấm lại
await page.click('#groupPick .pick[data-pick="' + vetoIds[1] + '"]');
await page.waitForTimeout(200);
const unvetoed = await page.evaluate(() => ({ count: document.querySelector('.veto-count').textContent.trim(), turn: window.__mgd.group().turns[0].veto.slice() }));
check('bấm lại -> bỏ gạch', unvetoed.count === '1/2' && unvetoed.turn.length === 1, unvetoed.count);

// ô tìm kiếm lọc danh sách gợi ý
const searched = await page.evaluate(() => { const n0 = document.querySelectorAll('#groupPick .pick').length; return { n0 }; });
await page.fill('#groupSearch', 'phở');
await page.waitForTimeout(300);
const afterSearch = await page.evaluate(() => ({
  n: document.querySelectorAll('#groupPick .pick').length,
  all: [...document.querySelectorAll('#groupPick .pick')].every((b) => /phở/i.test(b.textContent))
}));
check('ô tìm kiếm lọc danh sách gợi ý', afterSearch.n > 0 && afterSearch.n < searched.n0 && afterSearch.all, afterSearch.n + '/' + searched.n0 + ' món khớp "phở"');

// xong lượt An -> lượt Bình -> bỏ qua -> lượt Chi
await page.click('[data-gact="done"]');
await page.waitForTimeout(300);
const turn2 = await page.evaluate(() => document.querySelector('.turn-head b').textContent.trim());
check('xong lượt -> chuyển sang "Lượt của Bình"', /Bình/.test(turn2) && /2\/3/.test(await page.evaluate(() => document.querySelector('.turn-head i').textContent)));
await page.click('[data-gact="skip"]');
await page.waitForTimeout(300);
const turn3 = await page.evaluate(() => ({
  head: document.querySelector('.turn-head b').textContent.trim(),
  skipped: window.__mgd.group().turns[1].skipped,
  vetoB: window.__mgd.group().turns[1].veto.length
}));
check('bỏ qua lượt -> sang "Lượt của Chi", lượt Bình không gạch món nào', /Chi/.test(turn3.head) && turn3.skipped === true && turn3.vetoB === 0, turn3.head);

// Chi gạch 1 món KHÁC 2 món của An rồi xong -> quay thật
const chiPick = await page.evaluate((avoid) => {
  const btn = [...document.querySelectorAll('#groupPick .pick')].find((b) => !avoid.includes(b.dataset.pick));
  return btn.dataset.pick;
}, vetoIds);
await page.click('#groupPick .pick[data-pick="' + chiPick + '"]');
await page.waitForTimeout(200);
await page.click('[data-gact="done"]');
await page.waitForTimeout(600);
const spinState = await page.evaluate(() => {
  const M = window.__mgd;
  const union = new Set((M.group() ? M.group().turns : []).flatMap((t) => t.veto)).size;
  return {
    open: !document.querySelector('#modalBackdrop').hidden,
    groupOpen: !document.querySelector('#groupBackdrop').hidden,
    veto: [...M.groupVeto()], union: union,
    pool: M.pool().length,
    run: M.groupRun()
  };
});
check('xong lượt cuối -> đóng bảng nhóm và bắt đầu quay trên pool đã trừ món bị gạch',
  spinState.groupOpen === false && spinState.union >= 2 && spinState.veto.length === spinState.union && spinState.pool === poolBefore - spinState.union,
  'gạch ' + spinState.union + ' món · pool ' + spinState.pool + '/' + poolBefore);
check('lưu thông tin nhóm cho popup (3 người + danh sách món bị gạch)',
  !!spinState.run && spinState.run.names.length === 3 && spinState.run.veto.length === spinState.union,
  spinState.run ? spinState.run.names.join(',') + ' · ' + spinState.run.veto.length + ' món' : 'null');

// chờ quay xong (~7.5s) -> popup kết quả
await page.waitForFunction(() => !document.querySelector('#modalBackdrop').hidden, null, { timeout: 15000 });
await page.waitForTimeout(400);
const win = await page.evaluate(() => {
  const d = document.querySelector('#winDialog');
  const line = d.querySelector('.group-line');
  const det = d.querySelector('details.group-veto');
  return {
    name: d.querySelector('.win-name') ? d.querySelector('.win-name').textContent.trim() : '',
    line: line ? line.textContent.replace(/\s+/g, ' ').trim() : '',
    summary: det ? det.querySelector('summary').textContent.trim() : '',
    collapsed: det ? !det.open : null,
    pills: det ? det.querySelectorAll('.pill').length : 0,
    winner: window.__mgd.state.lastWinner ? window.__mgd.state.lastWinner.id : ''
  };
});
check('popup kết quả ghi "Cả nhóm: An, Bình, Chi"', /Cả nhóm:\s*An, Bình, Chi/.test(win.line), win.line);
check('có danh sách món bị gạch, MẶC ĐỊNH THU GỌN', win.collapsed === true && win.pills === spinState.union && new RegExp('Món bị gạch \\(' + spinState.union + '\\)').test(win.summary), win.summary);
check('món trúng KHÔNG nằm trong danh sách bị gạch', !spinState.veto.includes(win.winner), win.winner);

// đóng popup -> pool trả lại như cũ
await page.click('#winDialog .win-close');
await page.waitForTimeout(400);
const restored = await page.evaluate(() => ({ veto: window.__mgd.groupVeto().size, pool: window.__mgd.pool().length, run: window.__mgd.groupRun() }));
check('đóng popup -> bỏ hiệu lực món bị gạch, pool trở lại đủ', restored.veto === 0 && restored.pool === poolBefore && restored.run === null,
  'pool ' + restored.pool + '/' + poolBefore);

/* ---------- 3) pool rỗng sau khi gạch -> báo rõ + cho bỏ gạch ---------- */
const emptySetup = await page.evaluate(() => {
  const M = window.__mgd, ALL = M.ALL();
  // tìm từ khoá cho pool rất nhỏ (1–4 món) để cả nhóm gạch hết
  let q = '', ids = [];
  for (const d of ALL) {
    M.state.q = d.name;
    const p = M.pool();
    if (p.length >= 1 && p.length <= 4) { q = d.name; ids = p.map((x) => x.id); break; }
  }
  M.state.q = '';
  if (!q) return null;
  M.openGroup();                 // mở lại bảng nhóm (backdrop hiện -> bấm được nút bỏ gạch)
  M.groupStart('X, Y', 4);
  M.state.q = q;
  const small = M.pool().map((x) => x.id);
  for (const id of small) M.groupToggle(id);        // X gạch hết
  M.groupNext();
  for (const id of small) M.groupToggle(id);        // Y cũng gạch hết
  M.groupNext();                                    // -> hết lượt, pool rỗng
  return { q: q, small: small, screen: document.querySelector('#groupBody').textContent.slice(0, 200) };
});
check('có nhánh "pool rỗng": báo rõ và cho bỏ gạch', !!emptySetup && /Hết món để quay/.test(emptySetup.screen), emptySetup ? emptySetup.screen.replace(/\s+/g, ' ').slice(0, 90) : 'không dựng được kịch bản');
if (emptySetup) {
  const unv = await page.evaluate(() => document.querySelectorAll('#groupBody [data-gact="unveto"]').length);
  check('màn pool rỗng liệt kê đúng số món bị gạch để bỏ', unv === emptySetup.small.length, unv + ' món');
  await page.click('#groupBody [data-gact="unveto"]');
  await page.waitForTimeout(600);
  const afterUnv = await page.evaluate(() => ({ pool: window.__mgd.pool().length, groupOpen: !document.querySelector('#groupBackdrop').hidden }));
  check('bỏ gạch 1 món -> quay được ngay (pool > 0, bảng nhóm đóng)', afterUnv.pool > 0 && afterUnv.groupOpen === false, 'pool ' + afterUnv.pool);
  await page.waitForFunction(() => !document.querySelector('#modalBackdrop').hidden, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const line2 = await page.evaluate(() => (document.querySelector('#winDialog .group-line') || {}).textContent || '');
  check('popup lượt thứ hai vẫn ghi cả nhóm', /Cả nhóm:\s*X, Y/.test(line2.replace(/\s+/g, ' ')), line2.replace(/\s+/g, ' ').trim());
  await page.click('#winDialog .win-close');
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__mgd.state.q = ''; });
}

// danh sách tên gần nhất được nhớ
const memo = await page.evaluate(() => JSON.parse(localStorage.getItem('mgd.group') || 'null'));
check('nhớ danh sách tên gần nhất trong mgd.group', !!memo && Array.isArray(memo.names) && memo.names.length >= 2 && typeof memo.vetoMax === 'number',
  memo ? memo.names.join(',') + ' · gạch ' + memo.vetoMax : 'null');
check('không lỗi JS', errs.length === 0, errs.slice(0, 3).join(' | '));

await ctx.close(); await browser.close();
console.log('\nKẾT QUẢ: ' + (bad.length ? 'FAIL (' + bad.length + '/' + (ok.length + bad.length) + ')' : 'OK (' + ok.length + ' check)'));
process.exit(bad.length ? 1 : 0);
