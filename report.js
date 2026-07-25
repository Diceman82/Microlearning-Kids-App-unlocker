/**
 * Vercel serverless proxy — hides the Home Assistant webhook URL.
 *
 * The real webhook URL lives in a Vercel environment variable
 * (Settings → Environment Variables → HA_WEBHOOK_URL), never in the repo.
 * The game calls this endpoint ('/api/report') instead.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const target = process.env.HA_WEBHOOK_URL;
  if (!target) {
    res.status(500).json({ error: 'HA_WEBHOOK_URL not configured' });
    return;
  }

  // Forward only the expected fields, nothing else.
  const allowed = ['player','score','correct','total','acc','tier','code','mins','ts'];
  const qs = new URLSearchParams();
  for (const k of allowed) {
    if (req.query[k] !== undefined) qs.set(k, String(req.query[k]).slice(0, 64));
  }

  try {
    await fetch(target + '?' + qs.toString(), { method: 'POST' });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: 'forward failed' });
  }
}
