// Timing bots: each bot finds the real release window for every vine, then taps with a human-like timing error.
import { createSim, step, release, clone } from '../src/sim.js';
const DT = 1 / 240;

function wouldCatch(s) {
  const c = clone(s); release(c);
  const start = c.score;
  for (let i = 0; i < 240 * 2; i++) { step(c, DT); if (c.score > start) return true; if (c.mode === 'dead') return false; }
  return false;
}
// returns [startStep, endStep] of the widest catchable window ahead, scanning one hang
function findWindow(s) {
  const c = clone(s); let best = null, curStart = -1;
  for (let i = 0; i < 240 * 4 && c.mode === 'swing'; i++) {
    const ok = c.omega > 0 && wouldCatch(c);
    if (ok && curStart < 0) curStart = i;
    if ((!ok || i === 240 * 4 - 1) && curStart >= 0) {
      if (!best || i - curStart > best[1] - best[0]) best = [curStart, i];
      curStart = -1;
    }
    step(c, DT);
  }
  return best;
}
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.283 * r()); }

function run(seed, jitterMs, maxVines = 80) {
  const s = createSim(seed); let rr = seed * 7919 + 1;
  const r = () => { rr = (rr * 16807) % 2147483647; return rr / 2147483647; };
  const windows = [];
  while (s.mode !== 'dead' && s.score < maxVines) {
    if (s.mode === 'swing') {
      const w = findWindow(s);
      if (!w) { while (s.mode !== 'dead') step(s, DT); break; }
      windows.push({ n: s.score, ms: (w[1] - w[0]) * DT * 1000 });
      let target = Math.round((w[0] + w[1]) / 2 + gauss(r) * jitterMs / 1000 / DT);
      target = Math.max(0, target);
      for (let i = 0; i < target && s.mode === 'swing'; i++) step(s, DT);
      release(s);
    }
    step(s, DT);
  }
  return { score: s.score, windows, reason: s.deathReason };
}

const bots = [['perfect', 0], ['pro (20ms)', 20], ['good (40ms)', 40], ['casual (70ms)', 70], ['sloppy (110ms)', 110]];
const N = 60;
console.log('Jungle Drop balance — ' + N + ' seeded runs per bot\n');
const allW = [];
for (const [name, j] of bots) {
  const scores = [];
  for (let k = 1; k <= N; k++) { const r = run(k, j); scores.push(r.score); if (j === 0 && process.env.DBG) console.log(k, r.score, r.reason); if (j === 0) allW.push(...r.windows); }
  scores.sort((a, b) => a - b);
  const avg = scores.reduce((a, b) => a + b, 0) / N;
  console.log(`${name.padEnd(16)} median ${String(scores[N >> 1]).padStart(3)}  avg ${avg.toFixed(1).padStart(5)}  best ${scores[N - 1]}`);
}
const bucket = {};
for (const w of allW) { const b = Math.min(40, Math.floor(w.n / 5) * 5); (bucket[b] ||= []).push(w.ms); }
console.log('\nRelease window (ms) by vine number:');
for (const b of Object.keys(bucket).map(Number).sort((a, b) => a - b)) {
  const a = bucket[b]; console.log(`  vines ${String(b).padStart(2)}-${b + 4}: ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(0)} ms`);
}
