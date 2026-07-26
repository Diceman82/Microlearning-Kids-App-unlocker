/**
 * Vercel serverless proxy — hides the HA webhook URL AND validates
 * the session code server-side before forwarding.
 *
 * The code is recomputed from score/correct/total/tier + today's date
 * (Europe/Bucharest). Forged or replayed reports are rejected here
 * and never reach Home Assistant.
 *
 * Env var required: HA_WEBHOOK_URL (Vercel → Settings → Env Variables)
 */

// Must match sessionCode() in index.html exactly.
function computeCode(score, correct, total, tierIdx, day) {
  let h = (day ^ Math.imul(score + 7, 2654435761)) >>> 0;
  h = (h ^ correct * 97 ^ total * 31 ^ (tierIdx + 1) * 7) >>> 0;
  return 'BR-' + h.toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

function todayInBucharest() {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Bucharest' })
  );
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

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

  // --- server-side session-code validation ---
  const score   = parseInt(req.query.score, 10);
  const correct = parseInt(req.query.correct, 10);
  const total   = parseInt(req.query.total, 10);
  const tierIdx = parseInt(req.query.tieridx, 10);
  const code    = String(req.query.code || '').toUpperCase();

  if ([score, correct, total, tierIdx].some(Number.isNaN) || !code) {
    res.status(400).json({ error: 'missing fields' });
    return;
  }
  const expected = computeCode(score, correct, total, tierIdx, todayInBucharest());
  if (code !== expected) {
    res.status(403).json({ error: 'invalid session code' });
    return;
  }

  // --- forward only expected fields, marked as verified ---
  const allowed = ['player','score','correct','total','acc','tier','tieridx','code','mins','ts'];
  const qs = new URLSearchParams();
  for (const k of allowed) {
    if (req.query[k] !== undefined) qs.set(k, String(req.query[k]).slice(0, 64));
  }
  qs.set('verified', '1');

  try {
    await fetch(target + '?' + qs.toString(), { method: 'POST' });
    res.status(200).json({ ok: true, verified: true });
  } catch (e) {
    res.status(502).json({ error: 'forward failed' });
  }
}
