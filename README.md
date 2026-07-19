# Block Runner Math ⛏

**Microlearning Kids App-unlocker** — a gamified microlearning web app that turns
screen time into something kids earn. Built for a 13-year-old on Google Family
Link: she completes short math challenges, gets a verifiable session code, and
the parent grants bonus screen time from the Family Link app.

Minecraft-inspired endless runner, original blocky pixel art, no copyrighted
assets, no backend, no tracking. Deploys to Vercel as a static site.

## How it works

1. **Play** — 20 adaptive multiplication & division questions across 4 ranks
   (Wood → Stone → Iron → Diamond), with streaks, combos, speed bonuses, and
   unlockable cosmetics.
2. **Pass** — score ≥80% to earn a **session code** bound to today's date and
   the exact results. Yesterday's screenshot won't work today.
3. **Share** — the results screen has a *Send to parent* button that opens the
   native share sheet (WhatsApp / Telegram / SMS) with a pre-filled message.
4. **Verify** — parent opens `/verify`, enters the code and stats, and the page
   confirms locally whether the code is genuine.
5. **Reward** — parent grants **Bonus time** via the Google Family Link app.

## Features

- Adaptive difficulty engine (harder after streaks, easier after mistakes)
- Immediate corrective feedback on wrong answers
  (e.g. *56 ÷ 8 = 7, because 7 × 8 = 56*)
- Anti-cheat session codes (deterministic hash of score + results + date)
- Parent verifier page (`/verify`) — no server, no accounts
- Web Share API with clipboard fallback
- Mobile-first, touch controls, respects `prefers-reduced-motion`
- English & Romanian built in (single-line config switch)
- Original pixel art — no third-party sprites or trademarks

## Configuration

All parent-facing settings live in one block at the top of `index.html`:

```js
const CONFIG = {
  QUESTIONS_PER_SESSION: 20,   // questions per run
  PASS_ACCURACY: 80,           // % correct needed to pass
  REWARD_MINUTES: 30,          // minutes shown on the pass screen
  MAX_TABLE: 12,               // highest multiplication table
  LANGUAGE: 'en',              // 'en' or 'ro'
  SPEED_BONUS_SECONDS: 5,      // answer faster than this = bonus points
};
```

> Note: the session-code hash function exists in both `index.html` and
> `verify.html`. If you ever change it, change it in **both** files.

## Deploy

Static site, zero build step:

1. Push this repo to GitHub
2. Import into [Vercel](https://vercel.com) (Framework preset: **Other**, no
   build command)
3. Done — bookmark `your-project.vercel.app` for the kid and
   `your-project.vercel.app/verify` for the parent

## Files

| File          | Purpose                                  |
| ------------- | ---------------------------------------- |
| `index.html`  | The game                                 |
| `verify.html` | The parent verifier                      |
| `vercel.json` | Enables the clean `/verify` URL          |

## Roadmap

- [x] Percentages module + automatic mixed mode (weighted subject mix)
- [ ] Per-question timer mode
- [ ] Persistent cosmetic unlocks across sessions
- [ ] New subject modules: fractions, vocabulary
- [ ] Sound on/off toggle
- [ ] Optional server-signed session codes (Vercel serverless function)

## Not affiliated with

Mojang, Microsoft, or Google. "Minecraft-inspired" refers to the visual
vernacular of blocky pixel worlds only; all art is original. Google Family
Link integration is a manual parent workflow, not an API integration.

## License

MIT
