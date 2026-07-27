# Block Runner Math & Quiz Wizard ⛏🧙

**Microlearning Kids App-unlocker** — a gamified microlearning platform that
turns screen time into something kids earn. Built for a 13-year-old on Google
Family Link: she completes short learning challenges, results are validated
server-side, and bonus screen time lands on her phone **automatically** through
Home Assistant.

Two learning experiences share one launcher and one reward chain:

- **⛏ Block Runner** — a Minecraft-inspired endless-runner math game
  (multiplication & division, fractions, percentages, order of operations)
- **🧙 Quiz Wizard** — a voice quiz agent (Geography, 6th grade): an
  LLM-powered virtual teacher asks open questions out loud, the student
  answers **with her voice**, and the agent evaluates the ideas, not the
  phrasing

No copyrighted assets, no tracking, no database. Static site + serverless
functions, deploys to Vercel.

## Architecture

```
                     ┌───────────── Vercel ─────────────┐
  Kid's phone ──────►│ index.html  (launcher + math game)│
                     │ quiz.html   (voice quiz client)   │
                     │ verify.html (manual verifier)     │
                     │ api/report.js (validates session  │
                     │   codes server-side, hides HA URL)│
                     │ api/quiz.js  (LLM quiz brain:     │
                     │   questions, grading, HMAC state) │
                     │ api/tts.js   (neural TTS proxy)   │
                     └───────┬──────────────────────────┘
                             │ webhook (verified results only)
                             ▼
                   Home Assistant (Raspberry Pi, Nabu Casa)
                             │ instant auto-grant automation
                             │ (max 2 bonuses/day counter)
                             ▼
                HAFamilyLink (HACS) → Google Family Link
                             ▼
                   +30 min screen time on kid's device
```

The reward chain is the stable contract: any future learning frontend just
needs to produce a validated result and call `/api/report`.

## How it works (kid's view)

1. Open the app → **choose your adventure**: Block Runner or Quiz Wizard
2. **Block Runner**: 20 adaptive questions across 4 ranks
   (Wood → Stone → Iron → Diamond), streaks, combos, unlockable cosmetics.
   Pass = ≥80%.
3. **Quiz Wizard**: 10 open questions read aloud by a neural voice; answer by
   speaking (speech recognition, with text fallback). Pass = 8/10.
4. On pass, the reward arrives on her phone automatically within seconds —
   the parent just gets an informational notification.

## Anti-cheat & trust model

- **Block Runner**: session codes are a deterministic hash of score + results +
  date; `api/report.js` recomputes and validates them **server-side**
  (Europe/Bucharest date) before anything reaches Home Assistant. Forged or
  replayed reports die at the proxy.
- **Quiz Wizard**: fully server-authoritative — questions, grading, scoring and
  the reward call all happen in `api/quiz.js`; session state travels as an
  HMAC-signed token the client cannot tamper with.
- **Home Assistant**: only accepts reports marked `verified=1`, and caps
  rewards at 2/day via a counter helper (reset at midnight).
- Manual fallback always works: a "Send to parent" share button + `/verify`
  page for human verification, should any cloud piece ever break.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Launcher + Block Runner math game (EN/RO) |
| `quiz.html` | Quiz Wizard voice client (STT + TTS, text fallback) |
| `verify.html` | Manual parent verifier (offline code check) |
| `api/report.js` | Session-code validation + HA webhook proxy |
| `api/quiz.js` | Quiz brain: LLM question generation & grading, HMAC state, reward call |
| `api/tts.js` | Neural TTS proxy (ElevenLabs / OpenAI, auto-detected) |
| `vercel.json` | Clean URLs (`/verify`, `/quiz`) |

## Configuration

**Game** — one block at the top of `index.html`:

```js
const CONFIG = {
  QUESTIONS_PER_SESSION: 20,
  PASS_ACCURACY: 80,
  REWARD_MINUTES: 30,
  MAX_TABLE: 12,
  LANGUAGE: 'ro',                 // 'en' or 'ro'
  SUBJECT_MIX: { arithmetic: 20, percent: 20, fractions: 30, ops: 30 },
  HA_WEBHOOK_URL: '/api/report',  // keep as-is; real URL lives in Vercel env
  PLAYER_NAME: 'Evelin',
};
```

**Quiz** — constants at the top of `api/quiz.js`: subject, syllabus (edit to
match the textbook), questions per quiz, pass threshold, reward minutes.

**Vercel environment variables** (Settings → Environment Variables; never in
the repo):

| Variable | Required for | Notes |
| --- | --- | --- |
| `HA_WEBHOOK_URL` | reward chain | full Nabu Casa webhook URL with a long random id |
| `ANTHROPIC_API_KEY` | Quiz Wizard | console.anthropic.com |
| `QUIZ_SECRET` | Quiz Wizard | any long random string (signs quiz state) |
| `ELEVENLABS_API_KEY` *or* `OPENAI_API_KEY` | neural voice (optional) | absent → browser voice fallback |
| `ELEVENLABS_VOICE_ID` | optional | custom ElevenLabs voice |

## Home Assistant side

- Integration: [HAFamilyLink](https://github.com/noiwid/HAFamilyLink) (HACS,
  unofficial — may break if Google changes internals; the manual flow remains
  as fallback)
- Automation: webhook trigger (`local_only: false`, long random `webhook_id`)
  → condition `verified == '1'` → daily counter check → press the device's
  `_30min` bonus button → informational notification
- A Lovelace dashboard (screen time, per-device bonus buttons, location, top
  apps) pairs well with the integration's sensors

## Deploy

1. Push this repo to GitHub (keep the `api/` folder structure)
2. Import into [Vercel](https://vercel.com) — framework preset **Other**, no
   build command
3. Add the environment variables above → Redeploy
4. On the kid's phone: open the live URL in Chrome → **Add to Home screen**
   (never share the game as a file — it must run from the live URL)

## Roadmap

- [x] Adaptive math game (multiplication/division, percentages, fractions, order of operations)
- [x] Server-side session-code validation
- [x] Home Assistant instant auto-grant (max 2/day)
- [x] Voice quiz agent (Geography) with LLM grading + neural TTS
- [x] Adventure launcher (game / quiz)
- [ ] Local AI box: Piper TTS + Whisper STT on a dedicated Pi 5 + AI HAT+ 2
- [ ] Adaptive quiz memory (spaced repetition on weak topics)
- [ ] More subjects: history, grammar, biology
- [ ] Session history / progress dashboard
- [ ] Multi-user support (V4 groundwork)

## Not affiliated with

Mojang, Microsoft, Google, Anthropic, ElevenLabs or OpenAI. "Minecraft-inspired"
refers to the visual vernacular of blocky pixel worlds only; all art is
original. Family Link integration relies on an unofficial community project —
use at your own risk.

## License

MIT
