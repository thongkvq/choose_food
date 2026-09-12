import { weather } from './_lib.js';
export default async function handler(req, res) {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: 'thiếu lat/lng' });
  try {
    const w = await weather(lat, lng);
    res.setHeader('cache-control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json(w);
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
}
