// Swing Rage — all art drawn in code (crisp at any DPR).
export const FONT = '"SF Pro Rounded","Arial Rounded MT Bold",ui-rounded,"Nunito","Baloo 2","Trebuchet MS",system-ui,sans-serif';

export function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function leaf(c, x, y, len, wid, ang, fill, rib = 'rgba(0,0,0,.25)') {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0);
  c.quadraticCurveTo(len * 0.45, -wid, len, 0);
  c.quadraticCurveTo(len * 0.45, wid, 0, 0);
  c.fillStyle = fill; c.fill();
  if (rib) { c.beginPath(); c.moveTo(0, 0); c.lineTo(len * 0.92, 0); c.strokeStyle = rib; c.lineWidth = Math.max(0.6, wid * 0.12); c.stroke(); }
  c.restore();
}

// big tropical frond: leaflets along a curved stem
export function frond(c, x, y, len, ang, color, dark, r, leaflets = 9) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.strokeStyle = dark; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -len * 0.18, len, len * 0.05); c.stroke();
  for (let i = 1; i <= leaflets; i++) {
    const t = i / (leaflets + 1); const px = len * t, py = -len * 0.18 * 4 * t * (1 - t) * 0.9;
    const l = len * (0.42 - 0.25 * t) * (0.85 + r() * 0.3);
    leaf(c, px, py, l, l * 0.22, -1.05 + r() * 0.2, i % 2 ? color : dark);
    leaf(c, px, py, l, l * 0.22, 1.05 - r() * 0.2, i % 2 ? dark : color);
  }
  c.restore();
}

export function broadLeaf(c, x, y, len, ang, fill, rib) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0);
  c.bezierCurveTo(len * 0.2, -len * 0.42, len * 0.8, -len * 0.38, len, 0);
  c.bezierCurveTo(len * 0.8, len * 0.38, len * 0.2, len * 0.42, 0, 0);
  c.fillStyle = fill; c.fill();
  c.strokeStyle = rib; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(len * 0.95, 0); c.stroke();
  c.lineWidth = 1;
  for (let i = 1; i < 6; i++) { const t = i / 6; c.beginPath(); c.moveTo(len * t, 0); c.lineTo(len * (t + 0.12), -len * 0.22 * Math.sin(Math.PI * t)); c.moveTo(len * t, 0); c.lineTo(len * (t + 0.12), len * 0.22 * Math.sin(Math.PI * t)); c.stroke(); }
  c.restore();
}

function blob(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = col; c.fill(); }

// ---------- background layers (pre-rendered, tileable horizontally) ----------
export function makeLayer(kind, W, H, k, seed) {
  const TW = Math.round(W * 2);
  const cv = document.createElement('canvas'); cv.width = Math.round(TW * k); cv.height = Math.round(H * k);
  const c = cv.getContext('2d'); c.scale(k, k);
  const r = mulberry(seed);
  const wrap = (fn) => { for (const dx of [-TW, 0, TW]) { c.save(); c.translate(dx, 0); fn(); c.restore(); } };
  const items = [];
  if (kind === 'far') {
    for (let i = 0; i < 26; i++) items.push([r() * TW, H * (0.38 + r() * 0.2), 30 + r() * 50, r()]);
    wrap(() => {
      for (const [x, y, s, q] of items) {
        c.fillStyle = `rgba(${150 + q * 40},${150 + q * 20},${80 + q * 10},0.42)`;
        c.fillRect(x - 3, y, 6, H);
        for (let j = 0; j < 5; j++) blob(c, x + (j - 2) * s * 0.35, y - Math.sin(j) * s * 0.2, s * 0.45, `rgba(${120 + q * 50},${140 + q * 25},${70},0.38)`);
      }
      c.fillStyle = 'rgba(95,120,55,0.55)';
      c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= TW; x += 20) c.lineTo(x, H * 0.62 + Math.sin(x * 0.03) * 14 + Math.sin(x * 0.011) * 22);
      c.lineTo(TW, H); c.fill();
    });
  } else if (kind === 'mid') {
    for (let i = 0; i < 9; i++) items.push([r() * TW, 10 + r() * 18, r()]);
    const lianas = []; for (let i = 0; i < 14; i++) lianas.push([r() * TW, H * (0.25 + r() * 0.35), r() * 6]);
    wrap(() => {
      for (const [x, w, q] of items) {
        const g = c.createLinearGradient(x - w, 0, x + w, 0);
        g.addColorStop(0, '#203a1c'); g.addColorStop(0.6, '#3b5a2a'); g.addColorStop(1, '#2a4a22');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - w, H); c.bezierCurveTo(x - w * 0.6, H * 0.6, x - w * 1.2, H * 0.3, x - w * 0.5, 0); c.lineTo(x + w * 0.5, 0); c.bezierCurveTo(x + w * 1.1, H * 0.3, x + w * 0.5, H * 0.6, x + w, H); c.fill();
        // moss highlight on the sunny side
        c.strokeStyle = 'rgba(160,190,80,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + w * 0.4, 0); c.bezierCurveTo(x + w * 0.9, H * 0.3, x + w * 0.4, H * 0.6, x + w * 0.8, H); c.stroke();
        for (let j = 0; j < 7; j++) blob(c, x + (r() - 0.5) * 120, H * (0.05 + r() * 0.3), 22 + r() * 26, j % 2 ? 'rgba(40,80,32,0.9)' : 'rgba(58,100,40,0.9)');
      }
      for (const [x, len, ph] of lianas) {
        c.strokeStyle = 'rgba(40,55,25,0.75)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 0);
        c.bezierCurveTo(x + 14 * Math.sin(ph), len * 0.4, x - 10, len * 0.7, x + 6 * Math.cos(ph), len); c.stroke();
        for (let y = 20; y < len; y += 18) leaf(c, x + 4 * Math.sin(y * 0.05 + ph), y, 8, 3, (y / 18) % 2 ? 0.6 : 2.5, 'rgba(70,120,45,0.85)', null);
      }
    });
  } else if (kind === 'canopy') {
    const pts = []; for (let i = 0; i < 70; i++) pts.push([r() * TW, r() * H * 0.13, 28 + r() * 40, r() * 6.28, r()]);
    const hang = []; for (let i = 0; i < 10; i++) hang.push([r() * TW, H * (0.12 + r() * 0.12), r()]);
    wrap(() => {
      c.fillStyle = '#132e14'; c.fillRect(0, 0, TW, H * 0.05);
      for (const [x, y, s, a, q] of pts) broadLeaf(c, x, y, s, a * 0.3 + 1.0 + (q - 0.5), q > 0.5 ? '#1f4a1e' : '#2c5f25', 'rgba(10,30,10,0.5)');
      for (const [x, y, q] of hang) frond(c, x, 0, y + 40, 1.2 + q * 0.6, '#2f6a28', '#1d4a1c', r, 7);
    });
  } else if (kind === 'bank') {
    // rocks + ferns, drawn with water line at y = H*0.5 of a short layer
    const rocks = []; for (let i = 0; i < 14; i++) rocks.push([r() * TW, 20 + r() * 34, r()]);
    const ferns = []; for (let i = 0; i < 26; i++) ferns.push([r() * TW, r()]);
    const base = H * 0.55;
    wrap(() => {
      for (const [x, q] of ferns) frond(c, x, base - 8, 40 + q * 40, -2.2 + q * 1.4, '#3f7f2c', '#2a5a22', r, 6);
      for (const [x, s, q] of rocks) {
        const g = c.createLinearGradient(x, base - s, x, base + 6); g.addColorStop(0, '#5a5040'); g.addColorStop(1, '#2a2620');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, base, s * 1.3, s * 0.7, 0, Math.PI, 0); c.fill();
        c.fillStyle = 'rgba(120,150,60,0.5)'; c.beginPath(); c.ellipse(x - s * 0.3, base - s * 0.55, s * 0.6, s * 0.18, -0.2, 0, 7); c.fill();
      }
    });
  } else if (kind === 'front') {
    const l = []; for (let i = 0; i < 9; i++) l.push([r() * TW, r()]);
    wrap(() => {
      for (const [x, q] of l) {
        const y = H + 10;
        for (let j = 0; j < 4; j++) broadLeaf(c, x + j * 14, y, 110 + q * 60, -1.2 - j * 0.35 + q * 0.4, j % 2 ? '#0f2a12' : '#173a16', 'rgba(60,110,40,0.35)');
      }
    });
  }
  return { cv, TW };
}

export function drawLayer(c, layer, camX, factor, y = 0, H) {
  const TW = layer.TW; let ox = -((camX * factor) % TW); if (ox > 0) ox -= TW;
  for (let x = ox; x < 390; x += TW) c.drawImage(layer.cv, x, y, TW, H);
}

export function sky(c, W, H, t) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1e3a1e'); g.addColorStop(0.22, '#4f6a2c'); g.addColorStop(0.4, '#d9893a'); g.addColorStop(0.52, '#f7b85a'); g.addColorStop(0.66, '#e7a24a'); g.addColorStop(0.82, '#6d7a36'); g.addColorStop(1, '#2c4a26');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const sx = W * 0.74, sy = H * 0.43;
  const rg = c.createRadialGradient(sx, sy, 4, sx, sy, W * 0.85);
  rg.addColorStop(0, 'rgba(255,240,190,1)'); rg.addColorStop(0.08, 'rgba(255,214,130,0.9)'); rg.addColorStop(0.35, 'rgba(250,160,70,0.35)'); rg.addColorStop(1, 'rgba(250,150,60,0)');
  c.fillStyle = rg; c.fillRect(0, 0, W, H);
  const lg = c.createLinearGradient(0, 0, W * 0.7, 0); lg.addColorStop(0, 'rgba(14,40,16,0.75)'); lg.addColorStop(1, 'rgba(14,40,16,0)');
  c.fillStyle = lg; c.fillRect(0, 0, W, H);
  // god rays
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const a = -2.2 + i * 0.22 + Math.sin(t * 0.2 + i) * 0.02;
    c.fillStyle = `rgba(255,200,120,${0.05 + (i % 2) * 0.03})`;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * 900, sy + Math.sin(a) * 900); c.lineTo(sx + Math.cos(a + 0.07) * 900, sy + Math.sin(a + 0.07) * 900); c.fill();
  }
  c.restore();
}

// ---------- vine ----------
export function rope(c, x1, y1, x2, y2, o = {}) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const fray = o.fray || 0, t = o.t || 0, seed = o.seed || 1;
  const shake = fray > 0.6 ? (fray - 0.6) * 5 * Math.sin(t * 55) : 0;
  const pt = (s, off) => { const sag = Math.sin(Math.PI * s / L) * (o.sag || 0); return [x1 + ux * s + nx * (off + sag + shake * Math.sin(Math.PI * s / L)), y1 + uy * s + ny * (off + sag + shake * Math.sin(Math.PI * s / L))]; };
  const fz0 = o.frayAt ?? 10, fz1 = fz0 + 46;
  const widthAt = (s) => (s > fz0 && s < fz1 ? 1 - fray * 0.6 * Math.sin(Math.PI * (s - fz0) / (fz1 - fz0)) : 1);
  // dark outline + two twisted strands
  for (const pass of [0, 1, 2]) {
    c.beginPath();
    for (let s = 0; s <= L; s += 3) {
      const w = widthAt(s); const off = pass === 0 ? 0 : (pass === 1 ? 1 : -1) * 1.6 * w * Math.sin(s * 0.32 + seed);
      const [px, py] = pt(s, off); s === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (pass === 0) { c.strokeStyle = '#2b1a0c'; c.lineWidth = 7.5; }
    else { c.strokeStyle = pass === 1 ? '#6e4a24' : '#8f6532'; c.lineWidth = 3.4; }
    c.stroke();
  }
  // thinned / frayed zone drawn over
  if (fray > 0.02) {
    const r = mulberry(seed * 97 | 0);
    const n = Math.floor(5 + fray * 22);
    c.lineWidth = 1.1; c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = fz0 + r() * (fz1 - fz0); const side = r() > 0.5 ? 1 : -1;
      const [px, py] = pt(s, 0); const len = (5 + r() * 12) * (0.4 + fray);
      const wig = Math.sin(t * (6 + r() * 6) + i) * 0.4 * fray;
      const ang = Math.atan2(uy, ux) + side * (0.9 + r() * 0.8) + wig;
      c.strokeStyle = r() > 0.4 ? '#efe2a8' : '#c9a860';
      c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + Math.cos(ang) * len * 0.6 + ux * 3, py + Math.sin(ang) * len * 0.6 + uy * 3, px + Math.cos(ang) * len + ux * 6, py + Math.sin(ang) * len + uy * 6); c.stroke();
    }
    // pale exposed fibers
    c.strokeStyle = `rgba(240,225,160,${0.35 + fray * 0.5})`; c.lineWidth = 2.6 * (1 - fray * 0.5);
    c.beginPath(); const [ax, ay] = pt(fz0 + 6, 0); const [bx, by] = pt(fz1 - 6, 0); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
  }
  // leaves
  if (o.leaves !== false) {
    const r = mulberry(seed * 31 | 0);
    for (let s = 16; s < L - 6; s += 13 + r() * 6) {
      if (s > fz0 - 4 && s < fz1 + 4 && fray > 0.3) continue;
      const side = r() > 0.5 ? 1 : -1; const [px, py] = pt(s, 0);
      const ang = Math.atan2(uy, ux) + side * (0.7 + r() * 0.5) + Math.sin(t * 2 + s) * 0.08;
      leaf(c, px, py, 9 + r() * 6, 3.2, ang, r() > 0.5 ? '#5d9a33' : '#78b443', 'rgba(20,60,10,.5)');
    }
  }
}

export function knot(c, x, y, ang) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const g = c.createLinearGradient(-13, 0, 13, 0); g.addColorStop(0, '#4a2e14'); g.addColorStop(0.5, '#8a5f30'); g.addColorStop(1, '#3a2410');
  c.fillStyle = g; c.strokeStyle = '#24150a'; c.lineWidth = 2;
  c.beginPath(); c.roundRect(-13, -2, 26, 15, 6); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(30,18,8,.7)'; c.lineWidth = 1.3;
  for (const xx of [-6, 0, 6]) { c.beginPath(); c.moveTo(xx, -1); c.lineTo(xx, 12); c.stroke(); }
  leaf(c, 8, 0, 10, 3.5, -0.6, '#6aa83c'); leaf(c, -8, 1, 9, 3, -2.5, '#5d9a33');
  c.restore();
}

// ---------- the boy ----------
export function boy(c, x, y, rot, o = {}) {
  const t = o.t || 0, kick = o.kick || 0, mood = o.mood || 'happy', fly = o.fly || 0;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(o.s || 1.4, o.s || 1.4);
  const skin = '#f2b88e', skinD = '#d98f63', line = '#5a2e18';
  c.lineJoin = 'round'; c.lineCap = 'round';
  // legs (behind)
  const legA = 0.5 + kick * 0.5 + fly * 0.6, legB = 0.2 - kick * 0.4 + fly * 0.4;
  const legs = [[-4, 60, legA, 1.2 + fly * 0.3], [5, 60, legB, 0.9 + fly * 0.5]];
  for (const [hx, hy, a, bend] of legs) {
    const kx = hx - Math.sin(a) * 13, ky = hy + Math.cos(a) * 13;
    const fx = kx - Math.sin(a - bend) * 13, fy = ky + Math.cos(a - bend) * 13;
    c.strokeStyle = line; c.lineWidth = 8.5; c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
    c.strokeStyle = skin; c.lineWidth = 6; c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
    c.fillStyle = skin; c.strokeStyle = line; c.lineWidth = 1.4; c.beginPath(); c.ellipse(fx - 2, fy + 1, 5, 3, a - bend + 1.4, 0, 7); c.fill(); c.stroke();
  }
  // torso
  c.fillStyle = skin; c.strokeStyle = line; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(-9, 26); c.quadraticCurveTo(-13, 44, -8, 58); c.lineTo(9, 58); c.quadraticCurveTo(13, 42, 9, 26); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = skinD; c.globalAlpha = 0.35; c.beginPath(); c.ellipse(-5, 44, 3, 9, 0, 0, 7); c.fill(); c.globalAlpha = 1;
  // leaf skirt
  const lc = ['#3c8a2c', '#5aae3a', '#2f7424', '#68bb45'];
  for (let i = 0; i < 8; i++) {
    const a = 1.35 + (i - 3.5) * 0.17 + Math.sin(t * 6 + i) * 0.05 * (1 + fly);
    leaf(c, -11 + i * 3.1, 53, 14 + (i % 3) * 2, 4.2, a, lc[i % 4], 'rgba(10,50,10,.6)');
  }
  c.fillStyle = '#2f6a22'; c.beginPath(); c.roundRect(-10, 51, 20, 4.5, 2); c.fill();
  // arms up to the hands (hands at 0,0)
  for (const [sx, hx] of [[-7, -3], [7, 3]]) {
    c.strokeStyle = line; c.lineWidth = 8; c.beginPath(); c.moveTo(sx, 29); c.quadraticCurveTo(sx * 1.6, 14, hx, 2); c.stroke();
    c.strokeStyle = skin; c.lineWidth = 5.6; c.beginPath(); c.moveTo(sx, 29); c.quadraticCurveTo(sx * 1.6, 14, hx, 2); c.stroke();
  }
  c.fillStyle = skin; c.strokeStyle = line; c.lineWidth = 1.4;
  for (const hx of [-3, 3]) { c.beginPath(); c.arc(hx, 1, 3.8, 0, 7); c.fill(); c.stroke(); }
  // head (to the side, looking forward/right)
  c.save(); c.translate(11, 22); c.rotate(-rot * 0.5);
  c.fillStyle = skin; c.strokeStyle = line; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(-11, 2, 3.5, 5, 0, 0, 7); c.fill(); c.stroke(); // ear
  c.beginPath(); c.ellipse(0, 0, 13, 12.5, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = 'rgba(240,120,110,.45)'; c.beginPath(); c.ellipse(7, 5, 3.2, 2.2, 0, 0, 7); c.fill();
  // eyes
  const ey = -1, lx = 2, rx = 9;
  if (mood === 'dead') {
    c.strokeStyle = '#1c120c'; c.lineWidth = 1.8;
    for (const ex of [lx, rx]) { c.beginPath(); c.moveTo(ex - 2.5, ey - 2.5); c.lineTo(ex + 2.5, ey + 2.5); c.moveTo(ex + 2.5, ey - 2.5); c.lineTo(ex - 2.5, ey + 2.5); c.stroke(); }
  } else {
    for (const ex of [lx, rx]) {
      c.fillStyle = '#fff'; c.strokeStyle = '#2a1810'; c.lineWidth = 1; c.beginPath(); c.ellipse(ex, ey, 3.2, 4.2, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#6b3a1a'; c.beginPath(); c.arc(ex + 0.9, ey + 0.4, 2.4, 0, 7); c.fill();
      c.fillStyle = '#120a06'; c.beginPath(); c.arc(ex + 1.1, ey + 0.5, 1.3, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + 1.7, ey - 0.8, 0.8, 0, 7); c.fill();
    }
  }
  c.strokeStyle = '#2a1810'; c.lineWidth = 1.3;
  const worried = mood === 'worried';
  c.beginPath(); c.moveTo(lx - 3, ey - 6 + (worried ? -1 : 0)); c.lineTo(lx + 2, ey - 6.5 + (worried ? 1 : 0)); c.moveTo(rx - 2, ey - 6.5 + (worried ? 1 : 0)); c.lineTo(rx + 3, ey - 6 + (worried ? -1 : 0)); c.stroke();
  // mouth
  if (worried || mood === 'dead') {
    c.fillStyle = '#7a1f1f'; c.beginPath(); c.ellipse(6, 7.5, 2.6, 3.2, 0, 0, 7); c.fill();
    if (worried) { c.fillStyle = '#9fdcff'; c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(-9, -3, -6, -2); c.quadraticCurveTo(-3, -3, -6, -8); c.fill(); }
  } else {
    c.fillStyle = '#8a2222'; c.strokeStyle = '#4a1010'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(1, 5); c.quadraticCurveTo(6, 6, 11, 4.5); c.quadraticCurveTo(7.5, 13, 2.5, 7.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ff8a8a'; c.beginPath(); c.ellipse(6, 9, 2.4, 1.4, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.fillRect(3, 5, 6, 1.3);
  }
  // spiky hair
  c.fillStyle = '#1d1510'; c.beginPath();
  const spikes = [[-14, 4], [-19, -3], [-15, -6], [-20, -13], [-12, -12], [-13, -21], [-5, -15], [-1, -24], [3, -15], [10, -21], [9, -13], [17, -14], [13, -7], [16, -4], [9, -8], [4, -6], [0, -9], [-4, -6], [-8, -3], [-11, 0]];
  c.moveTo(-13, 6); for (const [hx, hy] of spikes) c.lineTo(hx + Math.sin(t * 5 + hx) * 0.4 * (1 + fly), hy); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(120,100,90,.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, -12); c.quadraticCurveTo(0, -16, 6, -12); c.stroke();
  c.restore();
  c.restore();
}

// ---------- crocodile ----------
export function croc(c, x, y, s, face, jaw, t, look = 0) {
  c.save(); c.translate(x, y); c.scale(s * face, s);
  const g1 = '#5f9a3a', g2 = '#3d6e27', belly = '#d8cf86', line = '#1f3a14';
  c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = line;
  // back + scutes (mostly submerged body)
  c.fillStyle = g2; c.beginPath(); c.ellipse(-36, 6, 46, 15, 0, Math.PI, 0); c.fill(); c.stroke();
  c.fillStyle = '#4c8030'; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-74 + i * 12, -2 - Math.sin(i * 0.6) * 4); c.lineTo(-68 + i * 12, -11 - Math.sin(i * 0.6) * 4); c.lineTo(-62 + i * 12, -2 - Math.sin(i * 0.6) * 4); c.fill(); c.stroke(); }
  // front arm
  c.fillStyle = g1; c.beginPath(); c.ellipse(-6, 6, 8, 12, 0.5, 0, 7); c.fill(); c.stroke();
  const open = 0.18 + jaw * 0.62;
  // head base / neck
  c.save(); c.translate(0, -6); c.rotate(-0.35);
  // lower jaw
  c.save(); c.rotate(0.15 + open * 0.25);
  c.fillStyle = belly; c.beginPath(); c.moveTo(-6, 0); c.lineTo(52, 4); c.quadraticCurveTo(58, 8, 50, 12); c.lineTo(-4, 14); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(8 + i * 7, 4); c.lineTo(11 + i * 7, -3); c.lineTo(14 + i * 7, 4.5); c.fill(); }
  c.restore();
  // mouth inside
  c.fillStyle = '#b5242a'; c.beginPath(); c.moveTo(-2, 2); c.lineTo(52 * Math.cos(open * 0.9), -52 * Math.sin(open * 0.9) + 2); c.lineTo(52 * Math.cos(-0.15 - open * 0.25), 52 * Math.sin(0.15 + open * 0.25) + 4); c.closePath(); c.fill();
  c.fillStyle = '#e86a6a'; c.beginPath(); c.ellipse(16, 4 + open * 4, 14, 4 + open * 3, 0.1, 0, 7); c.fill();
  // upper jaw
  c.save(); c.rotate(-open * 0.9);
  c.fillStyle = '#fff'; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(6 + i * 7, -1); c.lineTo(9 + i * 7, 7); c.lineTo(12 + i * 7, -1); c.fill(); }
  const ug = c.createLinearGradient(0, -20, 0, 0); ug.addColorStop(0, g1); ug.addColorStop(1, g2);
  c.fillStyle = ug; c.beginPath(); c.moveTo(-10, -18); c.quadraticCurveTo(20, -18, 54, -8); c.quadraticCurveTo(64, -6, 60, 0); c.lineTo(-8, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = g2; c.beginPath(); c.arc(56, -7, 3.2, 0, 7); c.fill(); c.stroke(); // nostril bump
  c.fillStyle = 'rgba(30,60,20,.5)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(16 + i * 9, -12 + i * 1.5, 1.6, 0, 7); c.fill(); }
  // eye
  c.fillStyle = g1; c.beginPath(); c.ellipse(-2, -20, 10, 9, 0, Math.PI * 1.05, Math.PI * 2.0); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, -18, 7, 6.5, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#d9a514'; c.beginPath(); c.arc(1.5 + look, -17.5, 3.8, 0, 7); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.ellipse(1.8 + look, -17.5, 1.3, 3.2, 0, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(3 + look, -19.5, 1.2, 0, 7); c.fill();
  c.strokeStyle = line; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-8, -26); c.quadraticCurveTo(0, -29, 7, -25); c.stroke(); // brow
  c.restore();
  c.restore();
  c.restore();
}

// ---------- water ----------
export function water(c, W, H, wy, t, camX) {
  if (wy > H) return;
  const g = c.createLinearGradient(0, wy, 0, H);
  g.addColorStop(0, '#5aa07a'); g.addColorStop(0.08, '#2f7a5e'); g.addColorStop(0.5, '#1b5246'); g.addColorStop(1, '#0c2a24');
  c.fillStyle = g; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 6) c.lineTo(x, wy + Math.sin((x + camX) * 0.045 + t * 2.2) * 3 + Math.sin((x + camX) * 0.11 - t * 3) * 1.5);
  c.lineTo(W, H); c.fill();
  // sunset reflection
  const rg = c.createRadialGradient(W * 0.74, wy + 10, 2, W * 0.74, wy + 10, 140);
  rg.addColorStop(0, 'rgba(255,200,120,.45)'); rg.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = rg; c.fillRect(0, wy, W, 160);
  // foam lines
  c.lineCap = 'round';
  for (let row = 0; row < 7; row++) {
    const yy = wy + 6 + row * row * 9 + row * 6; if (yy > H) break;
    c.strokeStyle = `rgba(230,250,240,${0.55 - row * 0.06})`; c.lineWidth = 2.2 - row * 0.15;
    for (let x = -40; x < W + 40; x += 34 + row * 8) {
      const xx = x - ((camX * (0.6 + row * 0.1) + t * (18 + row * 6)) % (34 + row * 8));
      c.beginPath(); c.moveTo(xx, yy + Math.sin(xx * 0.05 + t * 2) * 2); c.quadraticCurveTo(xx + 8, yy - 3, xx + 16 + row, yy + Math.sin(xx * 0.05 + t * 2) * 2); c.stroke();
    }
  }
}

export function waterFront(c, W, wy, t, camX) {
  c.fillStyle = 'rgba(40,110,85,0.82)'; c.beginPath(); c.moveTo(0, wy + 40);
  for (let x = 0; x <= W; x += 6) c.lineTo(x, wy + 9 + Math.sin((x + camX) * 0.05 + t * 2.6) * 3);
  c.lineTo(W, wy + 40); c.fill();
  c.strokeStyle = 'rgba(235,252,245,0.8)'; c.lineWidth = 2.2; c.beginPath();
  for (let x = 0; x <= W; x += 6) { const yy = wy + 9 + Math.sin((x + camX) * 0.05 + t * 2.6) * 3; x ? c.lineTo(x, yy) : c.moveTo(x, yy); }
  c.stroke();
}

export function splash(c, x, y, t, s = 1) {
  c.fillStyle = 'rgba(240,252,248,0.85)';
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.35; const d = (8 + i % 3 * 5) * s * (1 + Math.sin(t * 6 + i) * 0.15); c.beginPath(); c.arc(x + Math.cos(a) * d * 1.4, y + Math.sin(a) * d * 0.6, (2.5 + (i % 2)) * s, 0, 7); c.fill(); }
}
