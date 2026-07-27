/**
 * Agent de quiz vocal — creierul server-side.
 *
 * Tot ce e de încredere se întâmplă AICI: generarea întrebărilor,
 * evaluarea răspunsurilor, scorul și acordarea recompensei.
 * Clientul (quiz.html) e doar microfon + difuzor.
 *
 * Starea sesiunii circulă client <-> server ca token semnat HMAC,
 * deci nu poate fi modificată de client (nu avem nevoie de bază de date).
 *
 * Variabile de mediu necesare (Vercel → Settings → Env Variables):
 *   ANTHROPIC_API_KEY  — cheia ta de la console.anthropic.com
 *   QUIZ_SECRET        — un șir lung aleator (semnează starea)
 *   HA_WEBHOOK_URL     — există deja (recompensa)
 */
import crypto from 'crypto';

const MODEL = 'claude-sonnet-4-6';
const QUESTIONS_PER_QUIZ = 10;
const PASS_CORRECT = 8;            // 8/10 = 80%
const REWARD_MINUTES = 30;
const PLAYER = 'Evelin';

/* Materia și programa — editează liber după manualul ei */
const SUBJECT = 'Geografie, clasa a VI-a (România)';
const SYLLABUS = `
Teme din programa de clasa a VI-a (ajustează după manual):
- Europa: așezare geografică, țărmuri, mări și oceane care o mărginesc
- Relieful Europei: munți (Alpi, Carpați, Pirinei, Ural), câmpii, podișuri
- Clima și vegetația Europei: zone climatice, păduri, stepă, tundră
- Apele Europei: fluvii mari (Dunărea, Volga, Rin), lacuri
- Populația și orașele Europei: capitale, densitate, migrații
- Uniunea Europeană: state membre, instituții pe scurt
- Vecinii României și locul României în Europa
`;

/* ---------- utilitare stare semnată ---------- */
function sign(data) {
  const json = JSON.stringify(data);
  const mac = crypto.createHmac('sha256', process.env.QUIZ_SECRET)
    .update(json).digest('base64url');
  return Buffer.from(json).toString('base64url') + '.' + mac;
}
function verify(token) {
  const [b64, mac] = String(token || '').split('.');
  if (!b64 || !mac) return null;
  const json = Buffer.from(b64, 'base64url').toString();
  const expect = crypto.createHmac('sha256', process.env.QUIZ_SECRET)
    .update(json).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  return JSON.parse(json);
}

/* ---------- apel Anthropic ---------- */
async function askClaude(system, user, maxTokens = 1500) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!r.ok) throw new Error('anthropic ' + r.status);
  const data = await r.json();
  const text = data.content.map(c => c.text || '').join('');
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

/* ---------- generare quiz ---------- */
async function generateQuestions() {
  const system =
`Ești un profesor de ${SUBJECT} care creează un quiz oral pentru o elevă de 13 ani.
Răspunzi DOAR cu JSON valid, fără niciun alt text, în formatul:
{"questions":[{"q":"...","ideal":"...","concepts":["...","..."]}]}
Reguli:
- exact ${QUESTIONS_PER_QUIZ} întrebări, în limba română, variate ca temă și dificultate
- întrebări cu răspuns deschis, potrivite pentru răspuns ORAL scurt (1-2 propoziții)
- fără întrebări cu variante de răspuns, fără da/nu
- "ideal" = răspunsul model scurt; "concepts" = 1-3 concepte-cheie care TREBUIE
  să apară (ca idee, nu ca formulare exactă) pentru a considera răspunsul corect`;
  const user = `Programa:\n${SYLLABUS}\nGenerează quiz-ul.`;
  const out = await askClaude(system, user, 2500);
  if (!out.questions || out.questions.length < QUESTIONS_PER_QUIZ) throw new Error('bad quiz');
  return out.questions.slice(0, QUESTIONS_PER_QUIZ);
}

/* ---------- evaluare răspuns ---------- */
async function evaluateAnswer(question, answer) {
  const system =
`Ești un profesor blând dar corect care evaluează răspunsul ORAL al unei eleve de 13 ani.
Răspunsul vine din recunoaștere vocală: iartă complet greșelile de transcriere,
dezacordurile și formulările colocviale. Contează IDEEA, nu forma.
Acceptă ca fiind corect orice răspuns care atinge conceptele-cheie, chiar parțial formulat.
Răspunzi DOAR cu JSON valid: {"correct":true/false,"feedback":"o propoziție scurtă,
caldă, în română — confirmă sau corectează cu răspunsul bun"}`;
  const user = JSON.stringify({
    intrebare: question.q, raspuns_model: question.ideal,
    concepte_cheie: question.concepts, raspunsul_elevei: answer,
  });
  return askClaude(system, user, 300);
}

/* ---------- recompensa (webhook HA, direct de pe server) ---------- */
async function grantReward(correct) {
  if (!process.env.HA_WEBHOOK_URL) return false;
  const acc = Math.round(100 * correct / QUESTIONS_PER_QUIZ);
  const qs = new URLSearchParams({
    player: PLAYER, score: String(correct * 100), correct: String(correct),
    total: String(QUESTIONS_PER_QUIZ), acc: String(acc),
    tier: 'GEOGRAFIE', tieridx: '3', code: 'VOICE-AGENT',
    mins: String(REWARD_MINUTES), ts: new Date().toISOString(),
    verified: '1',
  });
  try {
    await fetch(process.env.HA_WEBHOOK_URL + '?' + qs.toString(), { method: 'POST' });
    return true;
  } catch (e) { return false; }
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  if (!process.env.ANTHROPIC_API_KEY || !process.env.QUIZ_SECRET) {
    res.status(500).json({ error: 'missing env vars' }); return;
  }
  const body = req.body || {};
  try {
    if (body.action === 'start') {
      const questions = await generateQuestions();
      const state = { questions, idx: 0, correct: 0 };
      res.status(200).json({
        token: sign(state),
        question: questions[0].q, idx: 1, total: QUESTIONS_PER_QUIZ,
      });
      return;
    }

    if (body.action === 'answer') {
      const state = verify(body.token);
      if (!state || state.idx >= QUESTIONS_PER_QUIZ) { res.status(403).json({ error: 'bad state' }); return; }
      const q = state.questions[state.idx];
      const evalr = await evaluateAnswer(q, String(body.answer || '').slice(0, 500));
      if (evalr.correct) state.correct++;
      state.idx++;

      if (state.idx >= QUESTIONS_PER_QUIZ) {
        const passed = state.correct >= PASS_CORRECT;
        const granted = passed ? await grantReward(state.correct) : false;
        res.status(200).json({
          feedback: evalr.feedback, wasCorrect: !!evalr.correct, done: true,
          summary: { correct: state.correct, total: QUESTIONS_PER_QUIZ, passed, granted,
                     mins: REWARD_MINUTES, passNeeded: PASS_CORRECT },
        });
        return;
      }
      res.status(200).json({
        feedback: evalr.feedback, wasCorrect: !!evalr.correct, done: false,
        token: sign(state),
        question: state.questions[state.idx].q,
        idx: state.idx + 1, total: QUESTIONS_PER_QUIZ,
        correctSoFar: state.correct,
      });
      return;
    }

    res.status(400).json({ error: 'unknown action' });
  } catch (e) {
    res.status(502).json({ error: 'agent error' });
  }
}
