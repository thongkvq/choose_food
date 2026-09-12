import { whereAmI } from './_lib.js';
export default async function handler(req, res) {
  try {
    const w = await whereAmI();
    res.setHeader('cache-control', 's-maxage=1800, stale-while-revalidate=86400');
    res.status(200).json(w);
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
}
