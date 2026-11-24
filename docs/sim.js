// Let Go — pure game simulation (no rendering). Shared by the game and the balance bots.
export const W = 390;
export const G = 1800;           // gravity px/s^2
export const TARGET_AMP = 1.2;   // auto-swing amplitude (rad, ~69deg)

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Difficulty per vine index n (vines caught so far). Ramps hard toward 20, then keeps squeezing.
export function difficulty(n) {
  const a = Math.min(n / 20, 1);
  const b = Math.max(0, Math.min((n - 20) / 25, 1));
  const e = a * a * (3 - 2 * a); // smoothstep: gentle start, steep middle
  return {
    gap: 150 + 70 * e + 15 * b,     // horizontal distance between anchors
    dy: 20 + 25 * e,                // vertical jitter of anchors
    grabR: 34 - 22 * e - 3 * b,     // how close hands must pass to the vine
    fray: 3.6 - 1.3 * e - 0.4 * b,  // seconds before a vine snaps
    rise: 5 + 11 * e + 6 * b,       // water rise px/s
    idleAmp: 0.08 + 0.22 * e,       // how much empty vines sway
  };
}

function makeVine(rand, prev, n) {
  const d = difficulty(n);
  const len = 165 + rand() * 50;
  const ax = prev ? prev.ax + d.gap * (0.9 + rand() * 0.2) : 120;
  const ay = prev ? prev.ay + 2 + (rand() * 2 - 1) * d.dy * 0.6 : 0;
  return { ax, ay, len, amp: d.idleAmp, w: 1.6 + rand() * 0.8, phase: rand() * 6.283, snapped: false, fray: 0 };
}

export function vineAngle(v, t) { return v.amp * Math.sin(t * v.w + v.phase); }

export function createSim(seed = 1) {
  const rand = mulberry32(seed);
  const s = {
    rand, t: 0, mode: 'swing', score: 0, cur: 0, vines: [],
    theta: -0.9, omega: 0, len: 0, hang: 0,
    p: { x: 0, y: 0 }, v: { x: 0, y: 0 },
    waterY: 0, deathReason: '', events: [],
  };
  for (let i = 0; i < 6; i++) s.vines.push(makeVine(rand, s.vines[i - 1], i));
  const v0 = s.vines[0];
  s.len = v0.len; s.theta = -0.95; s.omega = 0;
  s.waterY = v0.ay + v0.len + 230;
  placeOnVine(s);
  return s;
}

function placeOnVine(s) {
  const v = s.vines[s.cur];
  s.p.x = v.ax + s.len * Math.sin(s.theta);
  s.p.y = v.ay + s.len * Math.cos(s.theta);
  s.v.x = s.len * s.omega * Math.cos(s.theta);
  s.v.y = -s.len * s.omega * Math.sin(s.theta);
}

function ensureVines(s) {
  if (!s.rand) return;
  while (s.vines.length < s.cur + 6) s.vines.push(makeVine(s.rand, s.vines[s.vines.length - 1], s.vines.length));
}

export function release(s) {
  if (s.mode !== 'swing') return false;
  s.mode = 'fly';
  s.events.push('release');
  return true;
}

function tryGrab(s, idx) {
  const v = s.vines[idx];
  if (!v || v.snapped) return false;
  const d = difficulty(s.score);
  const a = vineAngle(v, s.t);
  const dx = Math.sin(a), dy = Math.cos(a);
  const rx = s.p.x - v.ax, ry = s.p.y - v.ay;
  let along = rx * dx + ry * dy;
  if (along < v.len * 0.5) return false; // hands must hit the lower half
  along = Math.min(v.len, along);
  const cx = v.ax + dx * along, cy = v.ay + dy * along;
  const dist = Math.hypot(s.p.x - cx, s.p.y - cy);
  if (dist > d.grabR) return false;
  // grab
  s.cur = idx; s.score += 1; s.hang = 0;
  s.len = along;
  s.theta = Math.atan2(s.p.x - v.ax, s.p.y - v.ay);
  const tx = Math.cos(s.theta), ty = -Math.sin(s.theta);
  s.omega = (s.v.x * tx + s.v.y * ty) / s.len;
  s.mode = 'swing';
  ensureVines(s);
  s.events.push('grab');
  return true;
}

export function step(s, dt) {
  if (s.mode === 'dead') return;
  s.t += dt;
  const d = difficulty(s.score);
  // water always creeps up, and never lets you get too comfortable
  const v = s.vines[s.cur];
  s.waterY -= d.rise * dt;
  s.waterY = Math.min(s.waterY, v.ay + v.len + 260);
  const nv = s.vines[s.cur + 1];
  s.waterY = Math.max(s.waterY, Math.max(v.ay + v.len, nv.ay + nv.len) + 28);

  if (s.mode === 'swing') {
    // pendulum + gentle auto-pump toward target amplitude
    const acc = -(G / s.len) * Math.sin(s.theta);
    const E = 0.5 * s.omega * s.omega * s.len - G * Math.cos(s.theta);
    const Et = -G * Math.cos(TARGET_AMP);
    const pump = (Et - E) * 2.5 * Math.sign(s.omega || 1) / s.len;
    s.omega += (acc + pump) * dt;
    s.theta += s.omega * dt;
    placeOnVine(s);
    s.hang += dt;
    v.fray = Math.min(1, s.hang / d.fray);
    if (s.hang >= d.fray) {
      v.snapped = true; s.mode = 'fly'; s.events.push('snap'); s.snappedBy = true;
    }
  } else if (s.mode === 'fly') {
    s.v.y += G * dt;
    s.p.x += s.v.x * dt;
    s.p.y += s.v.y * dt;
    if (!s.snappedBy) { if (tryGrab(s, s.cur + 1)) return; }
    if (s.p.y > s.waterY - 6) {
      s.mode = 'dead';
      s.deathReason = s.snappedBy ? 'The vine snapped' : (s.p.x < s.vines[s.cur + 1].ax - 40 ? 'Too short' : 'Missed the vine');
      s.events.push('dead');
    }
  }
}

export function clone(s) {
  return {
    ...s, rand: null, p: { ...s.p }, v: { ...s.v }, events: [],
    vines: s.vines.map(v => ({ ...v })),
  };
}
