import { geocode } from './_lib.js';
export default async function handler(req, res) {
  const q = String(req.query.q || '').slice(0, 120);
  if (q.length < 3) return res.status(400).json({ error: 'thiếu địa chỉ' });
  try {
    const g = await geocode(q);
    res.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json(g);
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
}
