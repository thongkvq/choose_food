import { reverseGeocode } from './_lib.js';
export default async function handler(req, res) {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: 'thiếu lat/lng' });
  try {
    const g = await reverseGeocode(lat, lng);
    res.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json(g);
  } catch (e) {
    res.status(200).json({ error: String((e && e.message) || e) });
  }
}
