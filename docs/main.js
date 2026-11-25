import { createSim, step, release, vineAngle, difficulty } from './sim.js';
import * as A from './art.js';
import { boot, haptic, isNative, nativeShare, PUBLIC_URL, noteGameOver, adDue, showDueAd, isShowingAd } from './native.js';

const cv = document.getElementById('c'); const c = cv.getContext('2d');
const W = 390; let H = 844, k = 1, layers = null, ST = 0; // ST = top safe-area inset in game units
const DT = 1 / 240;
const store = { get best() { return +(localStorage.getItem('letgo.best') || 0); }, set best(v) { localStorage.setItem('letgo.best', v); } };

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cw = window.innerWidth, ch = window.innerHeight;
  const sp = document.getElementById('safe'); const inset = sp ? sp.getBoundingClientRect().height : 0;
  ST = Math.max(0, inset * W / cw - 20);
  H = Math.max(600, Math.round(W * ch / cw));
  k = (cw / W) * dpr;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(H * k);
  layers = {
    far: A.makeLayer('far', W, H, k, 11), mid: A.makeLayer('mid', W, H, k, 23), canopy: A.makeLayer('canopy', W, H, k, 37),
    bank: A.makeLayer('bank', W, 140, k, 41), front: A.makeLayer('front', W, 220, k, 53),
  };
}
addEventListener('resize', resize); resize();

// ---------- audio (tiny synth) ----------
let ac = null;
function beep(type) {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime; o.connect(g); g.connect(ac.destination);
    const P = { release: ['triangle', 420, 760, 0.08, 0.12], grab: ['square', 180, 120, 0.06, 0.08], snap: ['sawtooth', 900, 120, 0.05, 0.18], splash: ['sine', 220, 40, 0.18, 0.5], best: ['triangle', 660, 990, 0.1, 0.3] }[type];
    o.type = P[0]; o.frequency.setValueAtTime(P[1], n); o.frequency.exponentialRampToValueAtTime(P[2], n + P[4]);
    g.gain.setValueAtTime(P[3], n); g.gain.exponentialRampToValueAtTime(0.0001, n + P[4]); o.start(n); o.stop(n + P[4] + 0.02);
  } catch (e) {}
}

// ---------- state ----------
let state = 'menu';    // menu | play | paused | dying | over | handoff
let mode = 'solo';     // solo | versus
let versus = null;     // { seed, scores: [] }
let sim = createSim(7), seed = 7;
let cam = { x: 0, y: 0 }, time = 0, acc = 0, trail = [], parts = [], dieT = 0, newBest = false, flash = 0;
const crocs = [{ x: 0, ph: 0 }, { x: 0, ph: 2 }, { x: 0, ph: 4 }];
let buttons = [];

function newRun(s) {
  seed = s ?? ((Math.random() * 1e9) | 0);
  sim = createSim(seed); trail = []; parts = []; newBest = false; dieT = 0;
  snapCam(); state = 'play';
}
function snapCam() { const t = camTarget(); cam.x = t.x; cam.y = t.y; placeCrocs(true); }
function camTarget() {
  const v = sim.vines[sim.cur];
  return { x: (state === 'menu' ? v.ax - W * 0.42 : sim.p.x - W * 0.36), y: Math.min(v.ay - H * 0.26, sim.waterY - H * 0.8) };
}
function placeCrocs(force) {
  crocs.forEach((cr, i) => { const tx = cam.x + W * (0.25 + i * 0.36); if (force || Math.abs(cr.x - tx) > W) cr.x = tx; });
}
function menuSim() { sim = createSim(3); sim.theta = -1.0; snapCam(); }
menuSim();

// ---------- input ----------
function tap(x, y) {
  if (isShowingAd()) return;
  for (const b of buttons) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) { b.fn(); return; }
  if (state === 'play') {
    if (release(sim)) { beep('release'); haptic('release'); }
  } else if (state === 'paused') state = 'play';
  else if (state === 'over' && dieT > 1.1) retry();
  else if (state === 'handoff') { newRun(versus.seed); }
  else if (state === 'menu') startSolo();
}
function retry() { if (mode === 'versus') startVersus(); else newRun(); }
function startSolo() { mode = 'solo'; versus = null; newRun(); }
function startVersus() { mode = 'versus'; versus = { seed: (Math.random() * 1e9) | 0, scores: [] }; state = 'handoff'; }
cv.addEventListener('pointerdown', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); tap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); }, { passive: false });
addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); tap(-99, -99); } if (e.code === 'KeyP' || e.code === 'Escape') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') state = 'paused'; });
function togglePause() { if (state === 'play') state = 'paused'; else if (state === 'paused') state = 'play'; }

// ---------- update ----------
function update(dt) {
  time += dt;
  if (state === 'play' || state === 'menu' || state === 'dying' || state === 'over') {
    acc += Math.min(dt, 0.05);
    while (acc >= DT) {
      acc -= DT;
      if (state === 'menu') { sim.hang = 0; }
      if (state === 'play' || state === 'menu') {
        const before = sim.score; step(sim, DT);
        if (sim.score > before) onGrab();
      }
    }
    for (const ev of sim.events.splice(0)) {
      if (ev === 'snap') { beep('snap'); haptic('snap'); burst(sim.p.x, sim.p.y - 20, 14, 'fiber'); flash = 0.25; }
      if (ev === 'dead') onDead();
    }
  }
  if (state === 'dying' || state === 'over') {
    dieT += dt;
    // sink toward the croc
    sim.p.y += 40 * dt; if (dieT > 0.9 && state === 'dying') toOver();
    // interstitial: only on the game-over screen, before retry is possible (retry opens at dieT > 1.1)
    if (state === 'over' && dieT > 0.7 && dieT < 1.1 && adDue()) showDueAd();
  }
  // trail
  if (state === 'play' && sim.mode === 'fly') trail.push({ x: sim.p.x, y: sim.p.y + 30, t: time });
  trail = trail.filter(p => time - p.t < 0.7);
  // camera
  const t = camTarget(); const f = 1 - Math.pow(0.0015, dt);
  cam.x += (t.x - cam.x) * f; cam.y += (t.y - cam.y) * f * 0.6;
  placeCrocs(false);
  for (const cr of crocs) cr.x += Math.sin(time * 0.4 + cr.ph) * 6 * dt;
  parts = parts.filter(p => (p.life -= dt) > 0);
  for (const p of parts) { p.vy += 500 * dt * (p.kind === 'leaf' ? 0.25 : 1); p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
  flash = Math.max(0, flash - dt);
}
function onGrab() { beep('grab'); haptic('grab'); burst(sim.p.x, sim.p.y, 7, 'leaf'); trail = []; }
function onDead() {
  beep('splash'); state = 'dying'; dieT = 0;
  burst(sim.p.x, sim.waterY, 18, 'drop');
  // nearest croc lunges
  let best = crocs[0]; for (const cr of crocs) if (Math.abs(cr.x - sim.p.x) < Math.abs(best.x - sim.p.x)) best = cr; best.lunge = { from: best.x, t: time };
  haptic('dead');
}
function toOver() {
  state = 'over';
  if (sim.score > store.best) { newBest = sim.score > 0; store.best = sim.score; if (newBest) { beep('best'); haptic('best'); } }
  noteGameOver();
  if (mode === 'versus') { versus.scores.push(sim.score); if (versus.scores.length < 2) state = 'handoff'; }
}
function burst(x, y, n, kind) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 260 - 40, life: 0.7 + Math.random() * 0.6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, kind });
}

// ---------- draw ----------
function draw() {
  c.setTransform(k, 0, 0, k, 0, 0);
  buttons = [];
  A.sky(c, W, H, time);
  const py = -cam.y * 0.02;
  A.drawLayer(c, layers.far, cam.x, 0.12, py, H);
  A.drawLayer(c, layers.mid, cam.x, 0.32, py * 2, H);
  // motes
  c.fillStyle = 'rgba(255,240,170,0.6)';
  for (let i = 0; i < 18; i++) { const x = ((i * 97 - cam.x * 0.4 + Math.sin(time * 0.5 + i) * 20) % W + W) % W; const y = (i * 53 + Math.sin(time * 0.7 + i * 2) * 14) % (H * 0.7) + H * 0.12; c.globalAlpha = 0.3 + 0.3 * Math.sin(time * 2 + i); c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill(); }
  c.globalAlpha = 1;
  const wy = sim.waterY - cam.y;
  A.drawLayer(c, layers.bank, cam.x, 0.7, wy - 140 * 0.55, 140);
  A.drawLayer(c, layers.canopy, cam.x, 0.55, Math.min(0, py * 3), H);

  c.save(); c.translate(-cam.x, -cam.y);
  drawVines();
  c.restore();

  A.water(c, W, H, wy, time, cam.x);
  // crocs
  for (const [i, cr] of crocs.entries()) {
    let x = cr.x - cam.x, jaw = 0.5 + 0.5 * Math.sin(time * 2.3 + cr.ph);
    let face = (sim.p.x - cam.x) < x ? -1 : 1;
    let yy = wy + 8 + Math.sin(time * 1.6 + cr.ph) * 3;
    if (cr.lunge && (state === 'dying' || state === 'over')) {
      const lt = Math.min(1, (time - cr.lunge.t) / 0.35); x = (cr.lunge.from + (sim.p.x - cr.lunge.from) * lt) - cam.x - face * 30;
      jaw = lt < 1 ? 1 : (time - cr.lunge.t < 0.55 ? 1 - (time - cr.lunge.t - 0.35) * 5 : 0.15); yy -= 10 * lt;
    } else if (sim.mode === 'fly' && sim.p.y > sim.waterY - 160) jaw = 1;
    const look = Math.max(-2, Math.min(2, (sim.p.x - cam.x - x) * 0.02 * face));
    A.croc(c, x, yy, 1.05 - i * 0.08, face, jaw, time, look);
  }
  A.waterFront(c, W, wy, time, cam.x);
  for (const cr of crocs) A.splash(c, cr.x - cam.x, wy + 12, time, 0.7);
  // particles
  c.save(); c.translate(-cam.x, -cam.y);
  for (const p of parts) {
    c.globalAlpha = Math.min(1, p.life * 2);
    if (p.kind === 'leaf') A.leaf(c, p.x, p.y, 9, 3, p.r, '#6aa83c');
    else if (p.kind === 'fiber') { c.strokeStyle = '#efe2a8'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(p.r) * 7, p.y + Math.sin(p.r) * 7); c.stroke(); }
    else { c.fillStyle = '#e9fbf4'; c.beginPath(); c.arc(p.x, p.y, 2.6, 0, 7); c.fill(); }
  }
  c.globalAlpha = 1; c.restore();
  A.drawLayer(c, layers.front, cam.x, 1.25, H - 200, 220);
  if (flash > 0) { c.fillStyle = `rgba(255,240,200,${flash})`; c.fillRect(0, 0, W, H); }
  drawUI();
}

function drawVines() {
  const top = cam.y - 20;
  for (let i = Math.max(0, sim.cur - 2); i < sim.vines.length; i++) {
    const v = sim.vines[i]; if (v.ax < cam.x - 120 || v.ax > cam.x + W + 140) continue;
    const held = i === sim.cur && sim.mode === 'swing';
    // the vine continues up into the canopy
    A.rope(c, v.ax + 6, top, v.ax, v.ay, { seed: i * 3 + 2, t: time, leaves: true, sag: 3 });
    if (v.snapped) {
      A.rope(c, v.ax, v.ay, v.ax + 4, v.ay + 22, { seed: i * 3 + 1, fray: 1, frayAt: 0, t: time, leaves: false });
      if (i === sim.cur && sim.mode !== 'dead') { // broken piece still in his hands
        A.rope(c, sim.p.x - 8, sim.p.y - 55, sim.p.x, sim.p.y + 2, { seed: i * 3 + 1, fray: 0.8, frayAt: 0, t: time });
      }
      continue;
    }
    let a = held ? sim.theta : vineAngle(v, sim.t);
    if (i === sim.cur && sim.mode !== 'swing') a = vineAngle(v, sim.t) * 0.5;
    const ex = v.ax + Math.sin(a) * v.len, ey = v.ay + Math.cos(a) * v.len;
    const fray = v.fray || 0;
    // grab-zone glow on the next vine
    if (i === sim.cur + 1 && state !== 'menu') {
      const d = difficulty(sim.score), mx = v.ax + Math.sin(a) * v.len * 0.5, my = v.ay + Math.cos(a) * v.len * 0.5;
      c.strokeStyle = `rgba(255,230,140,${0.18 + 0.08 * Math.sin(time * 6)})`; c.lineWidth = d.grabR * 0.9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(mx, my); c.lineTo(ex, ey); c.stroke();
    }
    A.rope(c, v.ax, v.ay, ex, ey, { seed: i * 3 + 1, fray: held || i === sim.cur ? fray : 0, t: time });
    A.knot(c, ex, ey, -a);
    c.fillStyle = '#2b1a0c'; c.beginPath(); c.arc(v.ax, v.ay, 4, 0, 7); c.fill();
    A.leaf(c, v.ax, v.ay, 14, 5, -0.4, '#5d9a33'); A.leaf(c, v.ax, v.ay, 12, 4, 3.6, '#78b443');
  }
  // dotted swing trail
  for (let j = 0; j < trail.length; j += 2) {
    const p = trail[j], al = 1 - (time - p.t) / 0.7;
    c.fillStyle = `rgba(255,255,255,${al * 0.9})`; c.beginPath(); c.arc(p.x - 14, p.y, 2.2, 0, 7); c.fill();
  }
  // the boy
  const fray = sim.vines[sim.cur]?.fray || 0;
  let rot, mood = 'happy', fly = 0, kick = Math.sin(time * 5) * 0.3;
  if (sim.mode === 'swing') { rot = -sim.theta * 0.85; kick = -sim.omega * 0.12; if (fray > 0.6) mood = 'worried'; }
  else { rot = Math.max(-0.6, Math.min(0.6, -sim.v.x * 0.0004 + sim.v.y * 0.0006)); fly = 1; if (sim.v.y > 300 || sim.snappedBy) mood = 'worried'; }
  if (state === 'dying' || state === 'over') { mood = 'dead'; rot = 0.4; }
  if (state === 'over' && dieT > 0.6) return; // eaten
  A.boy(c, sim.p.x, sim.p.y, rot, { t: time, mood, fly, kick, s: 1.45 });
}

function txt(s, x, y, size, color = '#fff', o = {}) {
  c.font = `${o.weight || 900} ${size}px ${A.FONT}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
  if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.sw || size * 0.16; c.strokeStyle = o.stroke; c.strokeText(s, x, y); }
  if (o.shadow !== false) { c.fillStyle = o.shadowColor || 'rgba(0,0,0,0.35)'; c.fillText(s, x + (o.sx ?? 0), y + (o.sy ?? size * 0.05)); }
  c.fillStyle = color; c.fillText(s, x, y);
}
function button(label, x, y, w, h, fn, style = 'gold') {
  const pressed = false;
  c.save();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.roundRect(x, y + 5, w, h, h / 2); c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h);
  if (style === 'gold') { g.addColorStop(0, '#ffd36b'); g.addColorStop(1, '#f39a2b'); } else { g.addColorStop(0, '#fff8e8'); g.addColorStop(1, '#e9dcc0'); }
  c.fillStyle = g; c.strokeStyle = '#3a2410'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.roundRect(x + 10, y + 5, w - 20, h * 0.3, h * 0.15); c.fill();
  A.leaf(c, x + 8, y + 6, 18, 6, -2.4, '#4f9a2e'); A.leaf(c, x + w - 8, y + 6, 18, 6, -0.7, '#3c8a2c');
  c.restore();
  txt(label, x + w / 2, y + h / 2 + 1, h * 0.36, '#3a2410', { shadow: false });
  buttons.push({ x, y, w, h, fn });
}
function pauseIcon() {
  const x = W - 42, y = 50 + ST;
  c.fillStyle = 'rgba(10,28,12,0.55)'; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(x, y, 23, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.roundRect(x - 8, y - 10, 5.5, 20, 2); c.roundRect(x + 2.5, y - 10, 5.5, 20, 2); c.fill();
  buttons.push({ x: x - 30, y: y - 30, w: 60, h: 60, fn: togglePause });
}
function card(y0, h) {
  const x = 22, w = W - 44;
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.roundRect(x, y0 + 6, w, h, 26); c.fill();
  const g = c.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, 'rgba(26,52,24,0.96)'); g.addColorStop(1, 'rgba(12,30,16,0.96)');
  c.fillStyle = g; c.strokeStyle = '#e8b04a'; c.lineWidth = 2.5; c.beginPath(); c.roundRect(x, y0, w, h, 26); c.fill(); c.stroke();
  for (const [lx, a] of [[x + 14, -2.3], [x + w - 14, -0.8]]) { A.leaf(c, lx, y0 + 4, 30, 9, a, '#3c8a2c'); A.leaf(c, lx, y0 + 4, 24, 7, a + (a < -1.5 ? 0.6 : -0.6), '#5aae3a'); }
}

function drawUI() {
  const best = store.best;
  if (state === 'menu') {
    c.fillStyle = 'rgba(10,25,10,0.18)'; c.fillRect(0, 0, W, H);
    txt('LET GO', W / 2, H * 0.14 + ST * 0.5, 86, '#fff', { stroke: '#2a4a18', sw: 14, shadowColor: '#f39a2b', sy: 6 });
    txt('Tap to let go of the vine.', W / 2, H * 0.14 + ST * 0.5 + 62, 19, '#fff6e0', { weight: 800 });
    txt('Catch the next one — or feed the crocs.', W / 2, H * 0.14 + ST * 0.5 + 88, 17, '#fff6e0', { weight: 800 });
    button('SOLO RUN', 60, H * 0.6, W - 120, 62, startSolo, 'gold');
    button('PASS THE PHONE', 60, H * 0.6 + 80, W - 120, 62, startVersus, 'cream');
    txt(best ? `BEST ${best}` : 'No best yet — the river is patient', W / 2, H - 70, 18, '#fff', { weight: 800 });
    return;
  }
  // score
  txt(String(sim.score), W / 2, 78 + ST, 96, '#fff', { shadowColor: 'rgba(20,30,10,0.45)', sy: 5 });
  txt(`BEST ${Math.max(best, state === 'play' ? 0 : 0)}`, W / 2, 140 + ST, 26, '#fff', { weight: 800, shadowColor: 'rgba(20,30,10,0.5)', sy: 2 });
  if (mode === 'versus' && versus) txt(`PLAYER ${versus.scores.length + (state === 'over' ? 0 : 1)}`, 64, 50 + ST, 15, '#ffe2a0', { weight: 900 });
  pauseIcon();
  if (state === 'play' && sim.score < 2 && sim.t < 9) {
    txt(sim.score === 0 ? 'Tap to let go on the forward swing' : 'Hands must hit the lower half', W / 2, H * 0.6, 19, '#fff', { weight: 800, shadowColor: 'rgba(0,0,0,.55)' });
  }
  if (state === 'paused') {
    c.fillStyle = 'rgba(8,20,10,0.55)'; c.fillRect(0, 0, W, H);
    txt('PAUSED', W / 2, H * 0.42, 56, '#fff', { stroke: '#2a4a18', sw: 10 });
    button('RESUME', 80, H * 0.52, W - 160, 58, () => (state = 'play'), 'gold');
    button('MENU', 80, H * 0.52 + 74, W - 160, 58, toMenu, 'cream');
  }
  if (state === 'handoff') {
    c.fillStyle = 'rgba(8,20,10,0.6)'; c.fillRect(0, 0, W, H);
    card(H * 0.26, 330);
    const n = versus.scores.length + 1;
    txt('PASS THE PHONE', W / 2, H * 0.26 + 50, 28, '#ffd36b');
    if (n === 2) txt(`Player 1 made it ${versus.scores[0]} vines`, W / 2, H * 0.26 + 100, 20, '#fff', { weight: 800 });
    txt(`PLAYER ${n}`, W / 2, H * 0.26 + 170, 54, '#fff');
    txt('Same jungle. Same vines.', W / 2, H * 0.26 + 220, 17, '#cfe8b8', { weight: 800 });
    txt('Tap when ready', W / 2, H * 0.26 + 290, 18, '#fff', { weight: 800 });
  }
  if (state === 'over' && dieT > 0.25) {
    const a = Math.min(1, (dieT - 0.25) * 4);
    c.globalAlpha = a; c.fillStyle = 'rgba(8,20,10,0.45)'; c.fillRect(0, 0, W, H);
    const y0 = H * 0.3; card(y0, 400);
    if (mode === 'versus' && versus.scores.length === 2) {
      const [s1, s2] = versus.scores;
      txt(s1 === s2 ? 'DEAD EVEN' : `PLAYER ${s1 > s2 ? 1 : 2} WINS`, W / 2, y0 + 56, 34, '#ffd36b');
      txt(`P1  ${s1}   vs   ${s2}  P2`, W / 2, y0 + 150, 40, '#fff');
      txt('vines', W / 2, y0 + 196, 18, '#cfe8b8', { weight: 800 });
      button('REMATCH', 46, y0 + 260, 140, 54, startVersus, 'gold');
    } else {
      if (newBest) txt('NEW BEST', W / 2, y0 + 40, 22, '#ffd36b');
      txt(sim.deathReason || 'Splash', W / 2, y0 + (newBest ? 72 : 52), 18, '#ffc7b0', { weight: 800 });
      txt('I made it', W / 2, y0 + 118, 22, '#fff', { weight: 800 });
      txt(String(sim.score), W / 2, y0 + 185, 92, '#ffd36b', { shadowColor: 'rgba(0,0,0,.5)' });
      txt(sim.score === 1 ? 'vine' : 'vines', W / 2, y0 + 240, 22, '#fff', { weight: 800 });
      button('SHARE', 46, y0 + 276, 140, 54, share, 'gold');
    }
    button('MENU', W - 186, y0 + (mode === 'versus' && versus.scores.length === 2 ? 260 : 276), 140, 54, toMenu, 'cream');
    txt(`Tap to retry${best ? '  ·  BEST ' + best : ''}`, W / 2, y0 + 370, 16, '#fff', { weight: 800, shadow: false });
    c.globalAlpha = 1;
  }
}
function toMenu() { state = 'menu'; mode = 'solo'; versus = null; menuSim(); }

async function share() {
  const n = sim.score;
  const text = `I made it ${n} ${n === 1 ? 'vine' : 'vines'} in LET GO before the crocs got me. Beat that 🐊🌴`;
  const url = isNative ? PUBLIC_URL : location.href.split('?')[0];
  try {
    const sc = document.createElement('canvas'); sc.width = 1080; sc.height = 1350; const s = sc.getContext('2d');
    s.drawImage(cv, 0, 0, cv.width, cv.width * 1.25, 0, 0, 1080, 1350);
    s.fillStyle = 'rgba(8,20,10,0.55)'; s.fillRect(0, 0, 1080, 1350);
    s.textAlign = 'center'; s.fillStyle = '#fff'; s.font = `900 120px ${A.FONT}`; s.fillText('LET GO', 540, 230);
    s.font = `800 64px ${A.FONT}`; s.fillText('I made it', 540, 520);
    s.fillStyle = '#ffd36b'; s.font = `900 330px ${A.FONT}`; s.fillText(String(n), 540, 860);
    s.fillStyle = '#fff'; s.font = `800 72px ${A.FONT}`; s.fillText(n === 1 ? 'vine' : 'vines', 540, 980);
    s.font = `800 44px ${A.FONT}`; s.fillText(url.replace(/^https?:\/\//, ''), 540, 1250);
    const blob = await new Promise(r => sc.toBlob(r, 'image/png'));
    const file = new File([blob], 'let-go.png', { type: 'image/png' });
    if (isNative) return await nativeShare(text + ' ' + url, blob);
    if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text, url });
    if (navigator.share) return await navigator.share({ text, url });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'let-go.png'; a.click();
  } catch (e) { try { await navigator.clipboard.writeText(text + ' ' + url); } catch (_) {} }
}

boot();
let last = performance.now();
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

// hooks for screenshot automation
window.__letgo = {
  get sim() { return sim; }, get state() { return state; },
  play(s) { startSolo(); if (s) newRun(s); }, release: () => release(sim),
  advance(sec) { const n = Math.round(sec / DT); for (let i = 0; i < n; i++) { const b = sim.score; step(sim, DT); if (sim.score > b) onGrab(); if (state === 'play' && sim.mode === 'fly') trail.push({ x: sim.p.x, y: sim.p.y + 30, t: time }); } snapCam(); },
  setTime(t) { time = t; },
};
