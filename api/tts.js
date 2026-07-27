/**
 * TTS neural pentru Quiz Wizard — proxy server-side.
 *
 * Auto-detectează furnizorul după variabilele de mediu din Vercel:
 *   ELEVENLABS_API_KEY  → ElevenLabs (cea mai naturală voce, ro inclus)
 *     + opțional ELEVENLABS_VOICE_ID (implicit: o voce feminină caldă)
 *   OPENAI_API_KEY      → OpenAI gpt-4o-mini-tts (foarte bun raport calitate/preț)
 *
 * Dacă niciuna nu e setată → 404, iar quiz.html cade elegant pe
 * vocea locală din browser (comportamentul de până acum).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  const text = String((req.body || {}).text || '').slice(0, 800);
  if (!text) { res.status(400).json({ error: 'no text' }); return; }

  try {
    /* --- ElevenLabs --- */
    if (process.env.ELEVENLABS_API_KEY) {
      const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.68, similarity_boost: 0.8 },
          }),
        }
      );
      if (!r.ok) throw new Error('elevenlabs ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', 'audio/mpeg');
      res.status(200).send(buf);
      return;
    }

    /* --- OpenAI --- */
    if (process.env.OPENAI_API_KEY) {
      const r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice: 'coral',
          input: text,
          instructions: 'Vorbește în română, ca o profesoară caldă și prietenoasă care încurajează o elevă de 13 ani. Ton natural, ritm lejer.',
          response_format: 'mp3',
        }),
      });
      if (!r.ok) throw new Error('openai ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', 'audio/mpeg');
      res.status(200).send(buf);
      return;
    }

    res.status(404).json({ error: 'no tts provider configured' });
  } catch (e) {
    res.status(502).json({ error: 'tts failed' });
  }
}
