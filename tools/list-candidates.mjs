import { fileURLToPath } from 'node:url';
const DELAY = 1200;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let last = 0;
async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const w = Math.max(0, DELAY - (Date.now() - last)); if (w) await sleep(w); last = Date.now();
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(url, { headers: { 'user-agent': 'MonGiDayGacha/1.8 (food demo; node)' }, signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 429) { const ra = Number(r.headers.get('retry-after')) * 1000 || 5000 * 2 ** i; await sleep(ra); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); }
  }
}
async function search(q) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=' +
    encodeURIComponent('filetype:bitmap ' + q) + '&prop=imageinfo&iiprop=url|mime&iiurlwidth=960';
  const j = await getJSON(u);
  return Object.values((j.query && j.query.pages) || {}).map(p => {
    const ii = p.imageinfo && p.imageinfo[0];
    return ii ? decodeURIComponent(p.title) : null;
  }).filter(Boolean);
}
const queries = ['Miến trộn', 'Chả cốm', 'Chè Thái', 'Chè ba màu', 'Mì gà', 'Miến gà'];
for (const q of queries) {
  try {
    const r = await search(q);
    console.log('\n### ' + q);
    r.forEach(t => console.log('   ' + t));
  } catch (e) { console.log('\n### ' + q + ' ERR ' + e.message); }
}
