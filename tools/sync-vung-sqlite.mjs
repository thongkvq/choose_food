import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/dishes.json', import.meta.url), 'utf8'));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const sql = raw.dishes.map((d) =>
  "UPDATE dishes SET dacSan=" + (d.dacSan ? 1 : 0) + ", vungCo=" + q(JSON.stringify(d.vungCo || [])) + " WHERE id=" + q(d.id) + ";"
).join('\n');
process.stdout.write(sql + '\n');
