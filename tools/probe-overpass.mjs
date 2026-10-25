// tools/probe-overpass.mjs — hỏi thẳng Overpass (POST như server.js + GET như bản tĩnh) để biết vì sao "quán có tiếng" trắng
import { overpassQuery } from '../lib/nearby-core.js';
const lat = Number(process.argv[2] || 10.7725), lng = Number(process.argv[3] || 106.698), rad = Number(process.argv[4] || 2500);
const ONLY = process.argv[5] || '';
const UA_SERVER = 'MonGiDay/2.4 (personal LAN food app)';
const UA_BROWSER = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const q = overpassQuery(lat, lng, rad);
const eps = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.osm.ch/api/interpreter'];
const tries = [
  ['POST server-UA ', (ep) => [ep, { method: 'POST', headers: { 'user-agent': UA_SERVER, accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }]],
  ['GET  browser-UA', (ep) => [ep + '?data=' + encodeURIComponent(q), { headers: { 'user-agent': UA_BROWSER, accept: 'application/json', origin: 'https://example.com' } }]]
];
for (const [label, build] of tries) {
  for (const ep of eps) {
    if (ONLY && !ep.includes(ONLY)) continue;
    const [url, opts] = build(ep);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    const t = Date.now();
    try {
      const r = await fetch(url, Object.assign({ signal: ctl.signal }, opts));
      const txt = await r.text();
      let n = null, note = '';
      try { const j = JSON.parse(txt); n = (j.elements || []).length; } catch (e) { note = txt.slice(0, 80).replace(/\s+/g, ' '); }
      console.log(label + ' ' + ep.replace('https://', '').padEnd(46) + ' -> ' + r.status + ' | ' + (Date.now() - t) + 'ms | elements=' + n + ' ' + note);
    } catch (e) { console.log(label + ' ' + ep.replace('https://', '').padEnd(46) + ' -> LỖI ' + String(e.message).slice(0, 60) + ' | ' + (Date.now() - t) + 'ms'); }
    finally { clearTimeout(timer); }
  }
}
