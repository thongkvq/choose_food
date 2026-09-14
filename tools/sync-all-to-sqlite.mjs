
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const dbPath = '/srv/test-ai/dev.sqlite';
const db = new DatabaseSync(dbPath);

const data = JSON.parse(fs.readFileSync('data/dishes.json', 'utf8'));
const dishes = data.dishes;

console.log('Total dishes to sync to SQLite:', dishes.length);

const stmt = db.prepare(`
  INSERT INTO dishes (
    id, name, emoji, region, meals, style, art, c1, c2, tags, descr,
    price, minutes, spicy, veg, weight, tier, image, imageVia, imageSource,
    rating, stars, review, calories, protein, proteinLabel, priceRange,
    fullness, bestFor, bestTime, origin, tip, intro, introSource,
    wikiUrl, wikiTitle, facts, detail, introEn, vung, dacSan, vungCo
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?
  )
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    emoji=excluded.emoji,
    region=excluded.region,
    meals=excluded.meals,
    style=excluded.style,
    art=excluded.art,
    c1=excluded.c1,
    c2=excluded.c2,
    tags=excluded.tags,
    descr=excluded.descr,
    price=excluded.price,
    minutes=excluded.minutes,
    spicy=excluded.spicy,
    veg=excluded.veg,
    weight=excluded.weight,
    tier=excluded.tier,
    image=excluded.image,
    imageVia=excluded.imageVia,
    imageSource=excluded.imageSource,
    rating=excluded.rating,
    stars=excluded.stars,
    review=excluded.review,
    calories=excluded.calories,
    protein=excluded.protein,
    proteinLabel=excluded.proteinLabel,
    priceRange=excluded.priceRange,
    fullness=excluded.fullness,
    bestFor=excluded.bestFor,
    bestTime=excluded.bestTime,
    origin=excluded.origin,
    tip=excluded.tip,
    intro=excluded.intro,
    introSource=excluded.introSource,
    wikiUrl=excluded.wikiUrl,
    wikiTitle=excluded.wikiTitle,
    facts=excluded.facts,
    detail=excluded.detail,
    introEn=excluded.introEn,
    vung=excluded.vung,
    dacSan=excluded.dacSan,
    vungCo=excluded.vungCo
`);

for (const d of dishes) {
  const mealsStr = Array.isArray(d.meals) ? d.meals.join('|') : (d.meals ?? '');
  const tagsStr = Array.isArray(d.tags) ? d.tags.join('|') : (d.tags ?? '');
  const bestForStr = Array.isArray(d.bestFor) ? d.bestFor.join(' | ') : (d.bestFor ?? '');
  const factsStr = d.facts ? JSON.stringify(d.facts) : null;
  const detailStr = d.detail ? JSON.stringify(d.detail) : null;
  const vungCoStr = JSON.stringify(d.vungCo || []);
  const dacSanInt = d.dacSan ? 1 : 0;

  stmt.run(
    d.id ?? null,
    d.name ?? null,
    d.emoji ?? null,
    d.region ?? null,
    mealsStr ?? null,
    d.style ?? null,
    d.art ?? null,
    d.c1 ?? null,
    d.c2 ?? null,
    tagsStr ?? null,
    d.descr ?? null,
    d.price ?? null,
    d.minutes ?? null,
    d.spicy ?? 0,
    d.veg ?? 0,
    d.weight ?? 50,
    d.tier ?? 1,
    d.image ?? null,
    d.imageVia ?? null,
    d.imageSource ?? null,
    d.rating ?? null,
    d.stars ?? null,
    d.review ?? null,
    d.calories ?? null,
    d.protein ?? null,
    d.proteinLabel ?? null,
    d.priceRange ?? null,
    d.fullness ?? null,
    bestForStr ?? null,
    d.bestTime ?? null,
    d.origin ?? null,
    d.tip ?? null,
    d.intro ?? null,
    d.introSource ?? null,
    d.wikiUrl ?? null,
    d.wikiTitle ?? null,
    factsStr,
    detailStr,
    d.introEn ?? null,
    d.vung ?? null,
    dacSanInt,
    vungCoStr
  );
}

const totalRow = db.prepare('SELECT count(*) as total FROM dishes').get();
console.log('SQLite dishes total rows after sync:', totalRow.total);
db.close();
