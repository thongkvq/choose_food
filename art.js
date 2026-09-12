// art.js — SVG minh hoa mon an. Moi mon = template (art) + palette (c1,c2).

const hex2rgb = (h) => { const s = h.replace('#',''); return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)]; };
const rgb2hex = (a) => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,'0')).join('');
export const lighten = (h, amt) => rgb2hex(hex2rgb(h).map(v => v + (255 - v) * amt));
export const darken  = (h, amt) => rgb2hex(hex2rgb(h).map(v => v * (1 - amt)));
const mix = (a, b, t) => rgb2hex(hex2rgb(a).map((v,i) => v + (hex2rgb(b)[i] - v) * t));
const uid = (d) => 'g' + d.id.replace(/[^a-z0-9]/gi, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- primitives ----------
const steam = (x = 100, y = 60, n = 3, cls = 'st') => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * 14;
    s += '<path class="steam" style="animation-delay:' + (i * .28).toFixed(2) + 's" d="M' + (x + dx) + ' ' + y + ' c -6 -9 6 -14 0 -23 c -6 -9 6 -14 0 -23" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3.4" stroke-linecap="round"/>';
  }
  return s;
};
const dots = (arr) => arr.map(d => '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="' + (d[2] || 3) + '" fill="' + d[3] + '" opacity="' + (d[4] || 1) + '"/>').join('');
const shadow = (cx = 100, cy = 168, rx = 62, ry = 11) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="rgba(0,0,0,.28)"/>';
const bowlPath = (c1, c2, id, top = 108, bot = 162, rxT = 62, rxB = 30) =>
  '<path d="M' + (100 - rxT) + ' ' + top + ' Q100 ' + (top + 42) + ' ' + (100 - rxB) + ' ' + bot + ' L' + (100 + rxB) + ' ' + bot + ' Q100 ' + (top + 42) + ' ' + (100 + rxT) + ' ' + top + ' Z" fill="url(#b' + id + ')"/>' +
  '<ellipse cx="100" cy="' + top + '" rx="' + rxT + '" ry="13" fill="' + darken(c1, .12) + '"/>' +
  '<ellipse cx="100" cy="' + top + '" rx="' + (rxT - 7) + '" ry="9" fill="url(#s' + id + ')" opacity=".95"/>';
const plate = (c2, id, cy = 148, rx = 76, ry = 24) =>
  '<ellipse cx="100" cy="' + (cy + 6) + '" rx="' + rx + '" ry="' + ry + '" fill="' + darken(c2, .28) + '" opacity=".55"/>' +
  '<ellipse cx="100" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#p' + id + ')"/>' +
  '<ellipse cx="100" cy="' + cy + '" rx="' + (rx - 12) + '" ry="' + (ry - 5) + '" fill="none" stroke="' + lighten(c2, .25) + '" stroke-width="1.5" opacity=".7"/>';
const sticks = (x, y, rot) => '<g transform="rotate(' + rot + ' ' + x + ' ' + y + ')" opacity=".95"><rect x="' + x + '" y="' + y + '" width="6" height="118" rx="3" fill="#c98a2b"/><rect x="' + (x + 12) + '" y="' + (y + 6) + '" width="6" height="118" rx="3" fill="#a8701f"/></g>';
const spoon = (x, y, rot) => '<g transform="rotate(' + rot + ' ' + x + ' ' + y + ')"><ellipse cx="' + x + '" cy="' + y + '" rx="12" ry="8" fill="#dfe6ef"/><rect x="' + (x + 8) + '" y="' + (y - 3.5) + '" width="56" height="7" rx="3.5" fill="#c3ccd8"/></g>';
const greens = (c, cx = 100, cy = 118) => dots([
  [cx - 26, cy, 7, c, .95], [cx + 22, cy - 3, 6, lighten(c, .25), .9],
  [cx + 2, cy + 6, 5, darken(c, .1), .85], [cx - 8, cy - 10, 5, lighten(c, .4), .8],
]);

// ---------- templates ----------
const T = {};
T['bowl-noodle'] = (d) => {
  const id = uid(d), c1 = d.c1, c2 = d.c2, nood = lighten(c2, .55), meat = darken(c1, .1);
  return shadow() + bowlPath(c1, c2, id) +
    steam(100, 74, 3) +
    '<path d="M56 104 q14 -10 26 0 q12 10 26 0 q12 -10 24 0" fill="none" stroke="' + nood + '" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M60 112 q14 -8 24 0 q12 8 24 0 q10 -8 22 0" fill="none" stroke="' + darken(nood,.12) + '" stroke-width="6" stroke-linecap="round"/>' +
    '<ellipse cx="80" cy="100" rx="15" ry="7" fill="' + meat + '" transform="rotate(-12 80 100)"/>' +
    '<ellipse cx="112" cy="99" rx="15" ry="7" fill="' + darken(meat,.15) + '" transform="rotate(10 112 99)"/>' +
    greens('#5aa832') + dots([[72, 92, 3, '#e74c3c'], [126, 104, 3, '#f1c40f']]) +
    sticks(126, 30, 8);
};
T['bowl-soup'] = (d) => {
  const id = uid(d), c1 = d.c1, soup = lighten(d.c2, .18);
  return shadow() + bowlPath(c1, d.c2, id) +
    '<ellipse cx="100" cy="108" rx="52" ry="9" fill="' + soup + '"/>' +
    '<path d="M52 108 q12 6 24 0 q12 -6 24 0 q12 6 24 0" fill="none" stroke="' + lighten(soup,.25) + '" stroke-width="3" opacity=".8"/>' +
    steam(100, 72, 3) +
    dots([[84, 104, 8, darken(c1,.05), .9], [112, 107, 7, lighten(c1,.2), .9], [98, 112, 5, '#5aa832', .95], [120, 100, 4, '#f1c40f', .9]]) +
    spoon(150, 132, -22);
};
T['noodle-dry'] = (d) => {
  const id = uid(d), nood = lighten(d.c2, .5);
  return shadow(100, 158, 70, 10) + plate(d.c2, id, 132, 72, 22) +
    '<ellipse cx="100" cy="124" rx="54" ry="18" fill="' + nood + '"/>' +
    '<path d="M56 122 q16 -9 30 0 q14 9 30 0 q10 -6 22 0" fill="none" stroke="' + darken(nood,.15) + '" stroke-width="5"/>' +
    '<path d="M60 132 q16 -8 28 0 q14 8 30 0" fill="none" stroke="' + lighten(nood,.25) + '" stroke-width="4"/>' +
    dots([[80, 116, 8, darken(d.c1,.08)], [116, 118, 7, d.c1], [100, 108, 5, '#5aa832'], [92, 130, 4, '#e8b04b']]) +
    greens('#4f9e2a', 100, 110) + sticks(130, 28, 10);
};
T['plate-rice'] = (d) => {
  const id = uid(d), rice = '#f7f3e6';
  return shadow(100, 160, 72, 10) + plate(d.c2, id, 136, 74, 23) +
    '<path d="M62 128 q-6 -30 38 -30 q44 0 38 30 z" fill="' + rice + '"/>' +
    '<path d="M70 122 q30 -8 60 0" fill="none" stroke="' + darken(rice,.12) + '" stroke-width="3"/>' +
    '<ellipse cx="78" cy="106" rx="16" ry="8" fill="' + darken(d.c1,.08) + '" transform="rotate(-8 78 106)"/>' +
    '<ellipse cx="118" cy="104" rx="15" ry="7" fill="' + d.c1 + '" transform="rotate(9 118 104)"/>' +
    '<ellipse cx="100" cy="94" rx="12" ry="6" fill="' + lighten(d.c1,.2) + '"/>' +
    greens('#4f9e2a', 100, 128) + dots([[66, 118, 4, '#e74c3c'], [134, 116, 4, '#f1c40f']]);
};
T['banhmi'] = (d) => {
  const id = uid(d), crust = lighten(d.c2, .3), crumb = '#f6e6c4';
  return '<g transform="rotate(-24 100 110)">' + shadow(100, 168, 66, 8) +
    '<rect x="34" y="60" width="132" height="76" rx="38" fill="url(#p' + id + ')"/>' +
    '<path d="M40 96 h120 q6 22 -12 30 h-96 q-18 -8 -12 -30 z" fill="' + d.c1 + '"/>' +
    '<path d="M46 100 q30 8 60 0 q26 -6 52 0" fill="none" stroke="' + lighten(d.c1,.3) + '" stroke-width="5"/>' +
    '<path d="M52 116 q28 7 56 0 q24 -6 44 0" fill="none" stroke="' + darken(d.c1,.12) + '" stroke-width="5"/>' +
    '<rect x="34" y="60" width="132" height="20" rx="10" fill="' + crust + '"/>' +
    dots([[62, 66, 2.4, '#fff8e0', .8], [86, 64, 2.4, '#fff8e0', .8], [116, 66, 2.4, '#fff8e0', .8], [140, 64, 2.4, '#fff8e0', .8]]) +
    greens('#4f9e2a', 100, 96) + '</g>';
};
T['pizza'] = (d) => {
  const id = uid(d), cheese = '#f2c14e';
  return '<g transform="rotate(8 100 110)">' + shadow(100, 166, 62, 9) +
    '<path d="M100 34 L164 132 Q100 158 36 132 Z" fill="url(#p' + id + ')"/>' +
    '<path d="M100 48 L150 126 Q100 146 50 126 Z" fill="' + cheese + '"/>' +
    dots([[100, 78, 13, d.c1], [76, 108, 12, d.c1], [124, 108, 12, darken(d.c1,.1)], [100, 126, 10, d.c1]]) +
    dots([[86, 74, 3, darken(d.c1,.3)], [118, 92, 3, darken(d.c1,.3)], [92, 114, 3, darken(d.c1,.3)]]) +
    '<path d="M96 146 q4 10 11 4" fill="none" stroke="' + cheese + '" stroke-width="5" stroke-linecap="round"/>' +
    greens('#3f8f22', 100, 100) + '</g>';
};
T['flatcake'] = (d) => {
  const id = uid(d);
  return shadow(100, 160, 70, 10) +
    '<ellipse cx="100" cy="132" rx="70" ry="26" fill="url(#p' + id + ')"/>' +
    '<path d="M38 132 a62 22 0 0 1 124 0 z" fill="' + d.c1 + '"/>' +
    '<path d="M46 130 a54 17 0 0 1 108 0" fill="none" stroke="' + lighten(d.c1,.28) + '" stroke-width="4"/>' +
    '<ellipse cx="100" cy="126" rx="46" ry="14" fill="' + lighten(d.c1,.1) + '"/>' +
    dots([[80, 122, 7, '#e74c3c'], [116, 124, 6, '#f1c40f'], [100, 118, 5, '#5aa832'], [64, 128, 5, '#e8b04b'], [132, 128, 5, '#5aa832']]) +
    steam(100, 92, 2);
};
T['dumpling'] = (d) => {
  const id = uid(d), skin = lighten(d.c2, .55), idk = d.c1;
  const one = (x, y, s, fill) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
    '<path d="M-30 8 q4 -26 30 -26 q26 0 30 26 q-30 12 -60 0 z" fill="' + fill + '"/>' +
    '<path d="M-22 -6 q10 -8 20 0 q10 -8 22 0" fill="none" stroke="' + darken(fill,.18) + '" stroke-width="2.4"/>' +
    '<path d="M-18 2 q10 -7 20 0 q10 -7 20 0" fill="none" stroke="' + darken(fill,.12) + '" stroke-width="2.2"/></g>';
  return shadow(100, 158, 62, 10) +
    '<ellipse cx="100" cy="150" rx="62" ry="14" fill="url(#p' + id + ')" opacity=".9"/>' +
    one(72, 116, 1, skin) + one(130, 118, .95, lighten(skin,.06)) + one(100, 96, 1.05, lighten(skin,.12)) +
    dots([[100, 92, 4, idk, .8], [72, 112, 3.4, idk, .65]]) + steam(100, 66, 2);
};
T['roll'] = (d) => {
  const id = uid(d), wrap = lighten(d.c2, .5), fill = d.c1;
  const roll = (x, y, rot) => '<g transform="rotate(' + rot + ' ' + x + ' ' + y + ')">' +
    '<rect x="' + (x - 22) + '" y="' + (y - 15) + '" width="76" height="30" rx="15" fill="' + wrap + '"/>' +
    '<circle cx="' + (x + 48) + '" cy="' + y + '" r="15" fill="' + lighten(wrap, .3) + '"/>' +
    '<circle cx="' + (x + 48) + '" cy="' + y + '" r="10" fill="' + fill + '"/>' +
    '<circle cx="' + (x + 45) + '" cy="' + (y - 4) + '" r="3.4" fill="#5aa832"/>' +
    '<circle cx="' + (x + 52) + '" cy="' + (y + 3) + '" r="3" fill="#e8b04b"/></g>';
  return shadow(100, 160, 66, 10) +
    '<ellipse cx="100" cy="152" rx="66" ry="16" fill="url(#p' + id + ')"/>' +
    roll(30, 104, -6) + roll(38, 132, 4) + roll(34, 122, -1) +
    greens('#4f9e2a', 132, 140);
};
T['salad'] = (d) => {
  const id = uid(d), green = '#4f9e2a';
  return shadow() + bowlPath(d.c2, d.c1, id, 104, 160, 66, 32) +
    '<ellipse cx="100" cy="104" rx="56" ry="11" fill="' + darken(green, .25) + '"/>' +
    dots([[74, 96, 15, green], [100, 92, 17, lighten(green, .16)], [126, 97, 14, green], [88, 108, 12, lighten(green, .3)], [114, 109, 12, darken(green, .08)]]) +
    dots([[80, 104, 6, '#e74c3c'], [122, 104, 6, '#e74c3c'], [100, 112, 4, '#f1c40f'], [92, 88, 3.4, '#f7e0a0'], [112, 88, 3.4, '#f7e0a0']]) +
    '<path d="M100 118 q10 -14 22 -18" fill="none" stroke="' + darken(d.c1,.1) + '" stroke-width="4" stroke-linecap="round"/>';
};
T['hotpot'] = (d) => {
  const id = uid(d), metal = '#cfd8e3';
  return shadow(100, 170, 74, 10) +
    '<path d="M150 118 h22" stroke="' + metal + '" stroke-width="9" stroke-linecap="round"/>' +
    '<path d="M28 116 h24" stroke="' + metal + '" stroke-width="9" stroke-linecap="round"/>' +
    '<path d="M40 116 q-6 46 60 46 q66 0 60 -46 z" fill="' + darken(metal, .18) + '"/>' +
    '<ellipse cx="100" cy="116" rx="60" ry="16" fill="' + d.c1 + '"/>' +
    '<ellipse cx="100" cy="116" rx="52" ry="12" fill="' + lighten(d.c1, .28) + '"/>' +
    dots([[78, 112, 5, '#5aa832'], [120, 116, 4.4, '#e8b04b'], [100, 106, 4, '#e74c3c'], [132, 108, 3.6, '#5aa832'], [66, 106, 3.4, '#f1c40f']]) +
    steam(100, 72, 3) +
    '<path d="M100 172 q-12 14 2 20 q12 5 0 14" fill="none" stroke="' + d.c2 + '" stroke-width="5" stroke-linecap="round" opacity=".85"/>';
};
T['fried-noodle'] = (d) => {
  const id = uid(d), nood = '#e8b04b';
  return shadow(100, 158, 70, 10) + plate(d.c2, id, 132, 74, 22) +
    '<ellipse cx="100" cy="122" rx="56" ry="20" fill="' + nood + '"/>' +
    '<path d="M50 120 q18 -10 32 0 q14 10 32 0 q12 -8 26 0" fill="none" stroke="' + darken(nood,.16) + '" stroke-width="5"/>' +
    '<path d="M54 132 q18 -8 30 0 q16 8 32 0" fill="none" stroke="' + lighten(nood,.25) + '" stroke-width="4"/>' +
    dots([[78, 114, 9, darken(d.c1,.06)], [120, 112, 8, d.c1], [100, 104, 6, '#5aa832'], [66, 130, 5, '#e74c3c']]) + steam(100, 78, 2);
};
T['fries'] = (d) => {
  const id = uid(d), fry = lighten(d.c2, .35);
  const stick = (x, y, h, rot) => '<rect x="' + x + '" y="' + y + '" width="9" height="' + h + '" rx="4" fill="' + fry + '" transform="rotate(' + rot + ' ' + (x + 4) + ' ' + (y + h / 2) + ')"/>';
  return shadow(100, 166, 58, 9) +
    '<path d="M56 88 h88 l-10 74 h-68 z" fill="' + d.c1 + '"/>' +
    '<path d="M56 88 h88 l-3 22 h-82 z" fill="' + lighten(d.c1, .22) + '"/>' +
    stick(70, 40, 56, -12) + stick(84, 32, 62, -4) + stick(98, 30, 64, 3) + stick(112, 36, 60, 10) + stick(126, 44, 52, 16) +
    '<path d="M64 148 q36 10 72 0" fill="none" stroke="' + darken(d.c1,.2) + '" stroke-width="3"/>' +
    dots([[100, 108, 3.4, '#fff8e0', .6], [86, 122, 3, '#fff8e0', .5]]);
};
T['fried-plate'] = (d) => {
  const id = uid(d), gold = lighten(d.c1, .28);
  const piece = (x, y, r, f) => '<g transform="translate(' + x + ' ' + y + ')"><ellipse rx="' + r + '" ry="' + (r * .78) + '" fill="' + f + '"/><path d="M' + (-r * .6) + ' 0 q' + (r * .6) + ' -' + (r * .5) + ' ' + (r * 1.2) + ' 0" fill="none" stroke="' + darken(f,.18) + '" stroke-width="2.4"/></g>';
  return shadow(100, 160, 70, 10) + plate(d.c2, id, 134, 72, 23) +
    piece(78, 120, 24, gold) + piece(124, 124, 21, lighten(gold, .12)) + piece(102, 100, 20, darken(gold, .1)) +
    '<ellipse cx="146" cy="152" rx="18" ry="7" fill="#f7f0dd" opacity=".9"/>' +
    greens('#4f9e2a', 74, 106) + dots([[100, 116, 3, '#e74c3c'], [116, 104, 2.6, '#5aa832']]);
};
T['skewer'] = (d) => {
  const c1 = d.c1, cube = (x, y, f) => '<rect x="' + x + '" y="' + y + '" width="22" height="22" rx="6" fill="' + f + '"/><path d="M' + (x + 4) + ' ' + (y + 7) + ' h14 M' + (x + 4) + ' ' + (y + 13) + ' h14" stroke="' + darken(f,.2) + '" stroke-width="2" stroke-linecap="round"/>';
  const sk = (x, rot) => '<g transform="rotate(' + rot + ' ' + x + ' 100)"><rect x="' + (x - 3) + '" y="34" width="6" height="140" rx="3" fill="#d9b47a"/>' + cube(x - 11, 56, c1) + cube(x - 11, 82, lighten(c1, .18)) + cube(x - 11, 108, darken(c1, .08)) + '</g>';
  return '<ellipse cx="100" cy="172" rx="66" ry="12" fill="rgba(0,0,0,.25)"/>' + sk(66, -12) + sk(100, 2) + sk(134, 14) + steam(100, 40, 2);
};
T['grill-plate'] = (d) => {
  const id = uid(d), c1 = d.c1, iron = '#3a3f47';
  return shadow(100, 164, 72, 10) +
    '<ellipse cx="100" cy="140" rx="72" ry="24" fill="' + iron + '"/>' +
    '<ellipse cx="100" cy="136" rx="64" ry="20" fill="' + lighten(iron, .12) + '"/>' +
    '<path d="M44 136 h112 M50 144 h100" stroke="' + darken(iron, .2) + '" stroke-width="3"/>' +
    '<ellipse cx="82" cy="128" rx="22" ry="10" fill="' + c1 + '" transform="rotate(-8 82 128)"/>' +
    '<ellipse cx="126" cy="132" rx="20" ry="9" fill="' + darken(c1, .12) + '" transform="rotate(7 126 132)"/>' +
    '<ellipse cx="104" cy="114" rx="18" ry="8" fill="' + lighten(c1, .18) + '"/>' +
    dots([[82, 124, 2.6, darken(c1,.35)], [126, 129, 2.4, darken(c1,.35)], [104, 111, 2.2, darken(c1,.35)]]) +
    steam(100, 66, 3);
};
T['curry'] = (d) => {
  const id = uid(d), cur = d.c1, rice = '#f7f3e6';
  return shadow(100, 160, 70, 10) + plate(d.c2, id, 138, 74, 23) +
    '<path d="M34 130 q-6 -26 30 -26 q34 0 30 26 z" fill="' + rice + '"/>' +
    bowlPath(cur, lighten(cur, .2), id, 100, 148, 44, 24) +
    '<ellipse cx="100" cy="100" rx="36" ry="8" fill="' + lighten(cur, .3) + '"/>' +
    '<path d="M76 96 q14 8 26 0 q12 -8 24 0" fill="none" stroke="#f7f0dd" stroke-width="3.4" opacity=".85"/>' +
    dots([[90, 108, 8, darken(cur,.18)], [112, 110, 7, lighten(cur,.12)]]) + steam(100, 70, 2);
};
T['egg-pan'] = (d) => {
  const id = uid(d), pan = '#2f343c', white = '#fdf8ec';
  return '<g transform="rotate(-6 100 110)">' + shadow(100, 162, 70, 9) +
    '<rect x="146" y="126" width="52" height="12" rx="6" fill="#6b7280"/>' +
    '<ellipse cx="100" cy="126" rx="72" ry="30" fill="' + pan + '"/>' +
    '<ellipse cx="100" cy="124" rx="64" ry="25" fill="' + lighten(pan, .14) + '"/>' +
    '<path d="M56 124 q6 -20 34 -18 q26 2 34 16 q8 14 -14 18 q-30 6 -48 -2 q-10 -4 -6 -14 z" fill="' + white + '"/>' +
    '<circle cx="102" cy="118" r="14" fill="' + d.c2 + '"/>' +
    '<circle cx="98" cy="114" r="5" fill="' + lighten(d.c2, .45) + '" opacity=".8"/>' +
    greens('#4f9e2a', 74, 116) + dots([[122, 112, 3, darken(d.c2,.3)]]) + steam(100, 76, 2) + '</g>';
};
T['taco'] = (d) => {
  const id = uid(d), shell = lighten(d.c2, .22);
  return shadow(100, 158, 64, 9) +
    '<path d="M40 148 a60 60 0 0 1 120 0 z" fill="url(#p' + id + ')"/>' +
    '<path d="M50 146 a50 50 0 0 1 100 0 z" fill="' + shell + '"/>' +
    dots([[76, 122, 12, darken(d.c1,.05)], [104, 116, 13, d.c1], [128, 124, 11, darken(d.c1,.12)]]) +
    '<path d="M56 132 q22 10 44 2 q22 -8 44 2" fill="none" stroke="#4f9e2a" stroke-width="6" stroke-linecap="round"/>' +
    dots([[92, 104, 4, '#e74c3c'], [116, 110, 3.6, '#f1c40f']]) +
    '<circle cx="152" cy="146" r="14" fill="#8fc93a"/><path d="M152 132 a14 14 0 0 0 0 28" fill="#c9e88a"/>';
};
T['pastry'] = (d) => {
  const id = uid(d), crust = lighten(d.c1, .3);
  return shadow(100, 158, 60, 9) +
    '<ellipse cx="100" cy="140" rx="60" ry="20" fill="url(#p' + id + ')"/>' +
    '<path d="M46 132 q6 -44 54 -44 q48 0 54 44 q-54 14 -108 0 z" fill="' + crust + '"/>' +
    '<path d="M60 118 q40 -14 80 0 M64 104 q36 -12 72 0" fill="none" stroke="' + darken(crust,.14) + '" stroke-width="4"/>' +
    dots([[74, 96, 3, '#fff8e0', .7], [100, 88, 3, '#fff8e0', .7], [124, 96, 3, '#fff8e0', .7]]) +
    dots([[70, 148, 3, darken(crust,.2), .6], [132, 150, 2.6, darken(crust,.2), .5]]) +
    steam(100, 66, 2);
};
T['dessert'] = (d) => {
  const c1 = d.c1, c2 = d.c2, glass = 'rgba(255,255,255,.35)';
  return shadow(100, 166, 46, 9) +
    '<path d="M62 66 h76 l-10 96 h-56 z" fill="' + glass + '" stroke="rgba(255,255,255,.65)" stroke-width="2"/>' +
    '<path d="M66 106 h68 l-8 54 h-52 z" fill="' + c1 + '"/>' +
    '<path d="M64 84 h72 l-2 22 h-68 z" fill="' + lighten(c2, .35) + '"/>' +
    '<ellipse cx="100" cy="66" rx="38" ry="10" fill="' + lighten(c2, .55) + '"/>' +
    dots([[88, 64, 8, '#e74c3c'], [112, 66, 7, darken('#e74c3c', .15)], [100, 58, 6, '#f7f0dd']]) +
    '<rect x="122" y="16" width="7" height="96" rx="3.5" fill="#dfe6ef" transform="rotate(14 122 16)"/>' +
    '<ellipse cx="146" cy="26" rx="12" ry="8" fill="#dfe6ef" transform="rotate(14 146 26)"/>';
};
T['drink'] = (d) => {
  const c1 = d.c1, c2 = d.c2;
  const ice = (x, y, r) => '<rect x="' + x + '" y="' + y + '" width="' + r + '" height="' + r + '" rx="4" fill="rgba(255,255,255,.45)" transform="rotate(18 ' + (x + r / 2) + ' ' + (y + r / 2) + ')"/>';
  return shadow(100, 170, 44, 9) +
    '<path d="M66 52 h68 l-8 112 h-52 z" fill="rgba(255,255,255,.28)" stroke="rgba(255,255,255,.6)" stroke-width="2"/>' +
    '<path d="M69 78 h62 l-7 84 h-48 z" fill="' + c1 + '"/>' +
    '<path d="M69 78 h62 l-1.6 18 h-58.8 z" fill="' + lighten(c1, .3) + '"/>' +
    ice(80, 92, 20) + ice(104, 104, 18) + ice(88, 118, 16) +
    '<ellipse cx="100" cy="52" rx="34" ry="9" fill="' + lighten(c2, .4) + '"/>' +
    '<rect x="118" y="8" width="8" height="70" rx="4" fill="' + c2 + '" transform="rotate(12 118 8)"/>' +
    dots([[86, 156, 3.2, 'rgba(255,255,255,.6)'], [112, 148, 2.8, 'rgba(255,255,255,.5)']]);
};
T['pancake'] = (d) => {
  const c1 = d.c1, cake = lighten(c1, .35);
  const disc = (y, r, f) => '<ellipse cx="100" cy="' + y + '" rx="' + r + '" ry="' + (r * .34) + '" fill="' + f + '"/><path d="M' + (100 - r) + ' ' + y + ' v10 a' + r + ' 13 0 0 0 ' + (2 * r) + ' 0 v-10 z" fill="' + darken(f, .12) + '"/>';
  return shadow(100, 164, 62, 9) +
    disc(146, 56, darken(cake, .14)) + disc(128, 54, cake) + disc(110, 50, lighten(cake, .08)) +
    '<path d="M62 96 q18 22 38 4 q18 -16 38 4" fill="none" stroke="' + c1 + '" stroke-width="6" stroke-linecap="round"/>' +
    '<circle cx="80" cy="94" r="7" fill="#e74c3c"/><circle cx="120" cy="92" r="7" fill="#8e5aa8"/>' +
    '<rect x="98" y="96" width="5" height="5" rx="2" fill="#f1c40f"/>' + steam(100, 68, 2);
};

export function renderArt(d) {
  const id = uid(d);
  const fn = T[d.art] || T['plate-rice'];
  return '<svg class="art" viewBox="0 0 200 200" role="img" aria-label="' + esc(d.name) + '">' +
    '<defs>' +
      '<linearGradient id="b' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + lighten(d.c1, .18) + '"/><stop offset="1" stop-color="' + darken(d.c1, .18) + '"/></linearGradient>' +
      '<linearGradient id="p' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + lighten(d.c2, .55) + '"/><stop offset="1" stop-color="' + lighten(d.c2, .12) + '"/></linearGradient>' +
      '<radialGradient id="s' + id + '" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="' + lighten(d.c1, .45) + '"/><stop offset="1" stop-color="' + d.c1 + '"/></radialGradient>' +
    '</defs>' + fn(d) + '</svg>';
}
export const ART_TEMPLATES = Object.keys(T);
export { mix };
