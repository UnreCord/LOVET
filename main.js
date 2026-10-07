// LOVET - interacciones de la pagina
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WA_NUMBER = '51900000000';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = v => clamp(v, 0, 1);
const easeOut = t => 1 - (1 - t) ** 3;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const follow = (rate, dt) => 1 - Math.pow(1 - rate, dt / 16.7);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const decimal = n => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

// numeros aleatorios con semilla: los dibujos salen iguales en cada carga
function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function sizeCanvas(canvas, w, h, maxDpr) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}

function offscreen(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [c, g];
}

/* =========================================================
   GRANULOS DE ARENA
   Perlas mate e irregulares, con textura calcarea, como la
   arena real que se ve en la foto de la bolsa.
   ========================================================= */
const SPR = 96, SPR_R = 30;

function smoothPath(pts) {
  const p = new Path2D(), n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[0], pts[1]);
  p.moveTo(start[0], start[1]);
  for (let i = 1; i <= n; i++) {
    const c = pts[i % n], m = mid(c, pts[(i + 1) % n]);
    p.quadraticCurveTo(c[0], c[1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

// forma redondeada pero imperfecta (perla de arcilla)
function blobPath(R, rnd, wobble) {
  const waves = [];
  for (let k = 2; k <= 7; k++) waves.push({ k, a: (wobble * (0.4 + rnd() * 0.6)) / (k - 1), p: rnd() * Math.PI * 2 });
  const pts = [];
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    let r = 1 + (rnd() - 0.5) * wobble * 0.5;
    waves.forEach(w => { r += w.a * Math.sin(w.k * t + w.p); });
    pts.push([Math.cos(t) * R * r, Math.sin(t) * R * r]);
  }
  return smoothPath(pts);
}

// forma angulosa (arena comun de piedritas)
function rockPath(R, rnd) {
  const n = 6 + Math.floor(rnd() * 3), p = new Path2D();
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + rnd() * 0.5, r = R * (0.72 + rnd() * 0.4);
    if (i) p.lineTo(Math.cos(t) * r, Math.sin(t) * r);
    else p.moveTo(Math.cos(t) * r, Math.sin(t) * r);
  }
  p.closePath();
  return p;
}

function granuleSprite(rnd, tone, kind, shade) {
  const c = document.createElement('canvas');
  c.width = c.height = SPR;
  const g = c.getContext('2d');
  g.translate(SPR / 2, SPR / 2);
  const path = kind === 'grain' ? rockPath(SPR_R, rnd) : blobPath(SPR_R, rnd, kind === 'wet' ? 0.2 : 0.17);

  // sombra de contacto con las perlas de alrededor
  g.save();
  g.shadowColor = 'rgba(28,18,8,0.55)';
  g.shadowBlur = 9;
  g.shadowOffsetX = 2;
  g.shadowOffsetY = 4;
  g.fillStyle = tone;
  g.fill(path);
  g.restore();

  g.save();
  g.clip(path);
  // luz suave desde arriba a la izquierda, sin brillo de perla de mar
  const light = g.createLinearGradient(-SPR_R, -SPR_R, SPR_R, SPR_R);
  light.addColorStop(0, 'rgba(255,252,244,0.24)');
  light.addColorStop(0.45, 'rgba(255,252,244,0)');
  light.addColorStop(1, 'rgba(40,28,14,0.5)');
  g.fillStyle = light;
  g.fillRect(-SPR_R * 1.4, -SPR_R * 1.4, SPR_R * 2.8, SPR_R * 2.8);
  g.lineWidth = SPR_R * 0.22;
  g.strokeStyle = 'rgba(55,40,24,0.22)';
  g.stroke(path);
  // textura calcarea: grumitos claros y oscuros muy finos
  for (let i = 0; i < 320; i++) {
    const x = (rnd() - 0.5) * SPR_R * 2.2, y = (rnd() - 0.5) * SPR_R * 2.2, s = 0.7 + rnd() * 1.5;
    g.fillStyle = rnd() < 0.5 ? `rgba(255,255,248,${0.06 + rnd() * 0.12})` : `rgba(75,56,36,${0.05 + rnd() * 0.1})`;
    g.fillRect(x, y, s, s);
  }
  if (kind === 'wet') { // la arcilla mojada brilla un poco
    const sh = g.createRadialGradient(-SPR_R * 0.35, -SPR_R * 0.4, 0, -SPR_R * 0.35, -SPR_R * 0.4, SPR_R * 0.6);
    sh.addColorStop(0, 'rgba(255,255,255,0.22)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    g.fillRect(-SPR_R, -SPR_R, SPR_R * 2, SPR_R * 2);
  }
  if (shade) { // version oscura para las capas de abajo
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(30,22,12,${shade})`;
    g.fillRect(-SPR_R * 1.5, -SPR_R * 1.5, SPR_R * 3, SPR_R * 3);
  }
  g.restore();
  return c;
}

const rndSprites = seeded(7);
const PEARL_TONES = ['#efe6d5', '#e8dcc8', '#e0d2bb', '#d7c8ae', '#ebe2d1', '#d0c0a4', '#e4d9c5', '#dacbb2'];
const PEARLS = PEARL_TONES.flatMap(t => [granuleSprite(rndSprites, t, 'pearl'), granuleSprite(rndSprites, t, 'pearl')]);
const PEARLS_DEEP = PEARL_TONES.map(t => granuleSprite(rndSprites, t, 'pearl', 0.42));
const WET = ['#9b8873', '#8e7a63', '#a39079', '#857159'].map(t => granuleSprite(rndSprites, t, 'wet'));
const GRAINS = ['#7d8186', '#6d7176', '#8b8f94', '#62666b', '#757a7f', '#868a8e'].flatMap(t => [granuleSprite(rndSprites, t, 'grain'), granuleSprite(rndSprites, t, 'grain')]);

// el sprite mide 96px y el granulo 30px de radio: 96/30 = 3.2
function drawSprite(g, s, x, y, r, a) {
  if (a <= 0) return;
  g.globalAlpha = Math.min(a, 1);
  g.drawImage(s, x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
}

// grano fotografico para que el canvas no se vea "digital"
const NOISE = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
})();
function grain(g, w, h, alpha) {
  g.save();
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = alpha;
  g.fillStyle = g.createPattern(NOISE, 'repeat');
  g.fillRect(0, 0, w, h);
  g.restore();
}

// rellena un area con granulos, de abajo hacia arriba
function packGranules(w, h, r, surface, rnd, layers) {
  const list = [];
  layers.forEach(({ scale, deep, shift }) => {
    const rr = r * scale, stepX = rr * 1.7, stepY = rr * 1.45;
    const sprites = deep ? PEARLS_DEEP : PEARLS;
    let row = 0;
    for (let y = h + rr; y > -rr; y -= stepY, row++) {
      const off = (row % 2) * stepX / 2 + shift * stepX;
      for (let x = off - rr; x < w + rr; x += stepX) {
        const px = x + (rnd() - 0.5) * rr * 1.05;
        const py = y + (rnd() - 0.5) * rr * 0.95;
        if (py < surface(px)) continue;
        list.push({
          x: px, y: py, r: rr * (0.65 + rnd() * 0.6),
          s: sprites[Math.floor(rnd() * sprites.length)],
          front: !deep, ox: 0, oy: 0, vx: 0, vy: 0, k: rnd()
        });
      }
    }
  });
  return list;
}

/* =========================================================
   1. PORTADA: vistazo dentro de la bolsa
   La arena de adentro se dibuja una sola vez; al mover el
   cursor solo cambia la mascara (CSS), por eso va fluido.
   ========================================================= */
const hero = $('#inicio');
const bag = $('#bag');
const bagImg = $('#bag-img');
const bagCanvas = $('#bag-pearls');
const bagBtn = $('#bag-toggle');
const B = { w: 0, h: 0, x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0, R: 100, raf: 0, last: 0 };
let bagHover = false, bagPinned = false, bagTouched = false, bagTouchTimer = 0;

function setupBag() {
  B.w = bag.offsetWidth;
  B.h = bag.offsetHeight;
  if (!B.w || !B.h) return;
  B.R = Math.min(115, B.w * 0.29);
  const g = sizeCanvas(bagCanvas, B.w, B.h, 2);
  g.fillStyle = '#0f2a24';
  g.fillRect(0, 0, B.w, B.h);
  const rnd = seeded(23);
  const surface = x => B.h * 0.26 - Math.sin((x / B.w) * Math.PI) * B.h * 0.025;
  packGranules(B.w, B.h, B.w / 46, surface, rnd, [
    { scale: 0.85, deep: true, shift: 0.33 },
    { scale: 1, deep: false, shift: 0 }
  ]).forEach(p => drawSprite(g, p.s, p.x, p.y, p.r, 1));
  g.globalAlpha = 1;
  grain(g, B.w, B.h, 0.18);
  const side = g.createLinearGradient(0, 0, B.w, 0);
  side.addColorStop(0, 'rgba(4,30,25,0.6)');
  side.addColorStop(0.2, 'rgba(4,30,25,0)');
  side.addColorStop(0.8, 'rgba(4,30,25,0)');
  side.addColorStop(1, 'rgba(4,30,25,0.6)');
  g.fillStyle = side;
  g.fillRect(0, 0, B.w, B.h);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(bagImg, 0, 0, B.w, B.h);
  g.globalCompositeOperation = 'source-over';
}

function bagTick(now) {
  const dt = Math.min(now - (B.last || now - 16.7), 64);
  B.last = now;
  B.x += (B.tx - B.x) * follow(0.2, dt);
  B.y += (B.ty - B.y) * follow(0.2, dt);
  B.r += (B.tr - B.r) * follow(0.12, dt);
  const settled = Math.abs(B.tr - B.r) < 0.3 && Math.abs(B.tx - B.x) < 0.2 && Math.abs(B.ty - B.y) < 0.2;
  if (settled) { B.r = B.tr; B.x = B.tx; B.y = B.ty; }
  bag.style.setProperty('--x', `${B.x.toFixed(1)}px`);
  bag.style.setProperty('--y', `${B.y.toFixed(1)}px`);
  bag.style.setProperty('--r', `${B.r.toFixed(1)}px`);
  B.raf = settled ? 0 : requestAnimationFrame(bagTick);
  if (!B.raf) B.last = 0;
}
function wakeBag() { if (!B.raf) B.raf = requestAnimationFrame(bagTick); }

function peekAt(x, y, snap) {
  B.tx = x;
  B.ty = y;
  if (snap || B.r < 1) { B.x = x; B.y = y; }
  B.tr = B.R;
  wakeBag();
}
function closePeek() {
  if (bagPinned || bagHover) return;
  B.tr = 0;
  wakeBag();
}
function localPoint(e) {
  const rect = bag.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

bag.addEventListener('pointerenter', e => {
  if (e.pointerType === 'touch') return;
  bagTouched = true;
  bagHover = true;
  peekAt(...localPoint(e), false);
});
bag.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' && !bag.hasPointerCapture(e.pointerId)) return;
  const [x, y] = localPoint(e);
  B.tx = x;
  B.ty = y;
  wakeBag();
});
bag.addEventListener('pointerleave', e => {
  if (e.pointerType === 'touch') return;
  bagHover = false;
  closePeek();
});
// en celular: toca y arrastra el dedo sobre la bolsa
bag.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  bagTouched = true;
  clearTimeout(bagTouchTimer);
  bag.setPointerCapture(e.pointerId);
  peekAt(...localPoint(e), true);
});
bag.addEventListener('pointerup', e => {
  if (e.pointerType !== 'touch') return;
  bagTouchTimer = setTimeout(closePeek, 1800);
});
bagBtn.addEventListener('click', () => {
  bagTouched = true;
  bagPinned = !bagPinned;
  bagBtn.setAttribute('aria-pressed', String(bagPinned));
  if (bagPinned) peekAt(B.w * 0.5, B.h * 0.62, true);
  else closePeek();
});

let heroIntroDone = false;
function heroIntro() {
  if (heroIntroDone) return;
  heroIntroDone = true;
  if (reduceMotion) return;
  // un vistazo breve que se desliza, para que se note que la bolsa se puede mirar por dentro
  setTimeout(() => {
    if (bagTouched || !isActive(hero)) return;
    peekAt(B.w * 0.36, B.h * 0.52, true);
    setTimeout(() => { if (!bagTouched) { B.tx = B.w * 0.62; B.ty = B.h * 0.7; wakeBag(); } }, 450);
    setTimeout(() => { if (!bagTouched) closePeek(); }, 2100);
  }, 1100);
}

/* =========================================================
   3. PRUEBALA: el liquido moja la arena, se forma un grumo
   y una pala entra a sacarlo. Se repite solo mientras la
   seccion esta en pantalla; tambien se puede tocar.
   ========================================================= */
const fieldSection = $('#tocala');
const fieldCanvas = $('#field');
const FD = { g: null, w: 0, h: 0, r: 9, front: [], under: null, top: null, vignette: null, events: [], raf: 0, auto: 0, lastUser: -1e9 };
const TAU = Math.PI * 2;
const EVENT_MS = 4600;

function setupField() {
  FD.w = fieldSection.clientWidth;
  FD.h = fieldSection.clientHeight;
  if (!FD.w || !FD.h) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  FD.g = sizeCanvas(fieldCanvas, FD.w, FD.h, 1.5);
  FD.r = clamp(FD.w / 150, 7, 10);
  FD.events = [];
  const rnd = seeded(31);
  const all = packGranules(FD.w, FD.h, FD.r, () => -1e4, rnd, [
    { scale: 0.85, deep: true, shift: 0.33 },
    { scale: 1, deep: false, shift: 0 }
  ]);
  FD.front = all.filter(p => p.front);

  // capa de abajo: lo que se ve en el hueco cuando sacas el grumo
  let g;
  [FD.under, g] = offscreen(FD.w, FD.h, dpr);
  g.fillStyle = '#4a3c2c';
  g.fillRect(0, 0, FD.w, FD.h);
  all.filter(p => !p.front).forEach(p => drawSprite(g, p.s, p.x, p.y, p.r, 1));
  g.globalAlpha = 1;

  [FD.top, g] = offscreen(FD.w, FD.h, dpr);
  g.drawImage(FD.under, 0, 0, FD.w, FD.h);
  FD.front.forEach(p => drawSprite(g, p.s, p.x, p.y, p.r, 1));
  g.globalAlpha = 1;

  [FD.vignette, g] = offscreen(FD.w, FD.h, dpr);
  const v = g.createRadialGradient(FD.w * 0.6, FD.h * 0.45, Math.min(FD.w, FD.h) * 0.25, FD.w * 0.6, FD.h * 0.45, Math.max(FD.w, FD.h) * 0.75);
  v.addColorStop(0, 'rgba(0,30,26,0)');
  v.addColorStop(1, 'rgba(0,30,26,0.6)');
  g.fillStyle = v;
  g.fillRect(0, 0, FD.w, FD.h);

  drawField(performance.now());
}

// borde irregular de la mancha de humedad (no es un circulo perfecto)
function stainRadius(e, a) {
  return e.R * (1 + e.w1 * Math.sin(3 * a + e.p1) + e.w2 * Math.sin(5 * a + e.p2) + e.w3 * Math.sin(2 * a + e.p3));
}
function blobOf(e, scale) {
  const pts = [];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU, r = stainRadius(e, a) * scale;
    pts.push([e.x + Math.cos(a) * r, e.y + Math.sin(a) * r]);
  }
  return smoothPath(pts);
}

function spawnClump(x, y, byUser) {
  const now = performance.now();
  if (FD.events.length >= 3) return false;
  const R = FD.r * (4.8 + Math.random() * 1.2);
  for (const e of FD.events) {
    if (Math.hypot(e.x - x, e.y - y) < (e.R + R) * 2.2) return false;
  }
  const e = {
    x, y, R, t0: now,
    w1: 0.06 + Math.random() * 0.05, w2: 0.03 + Math.random() * 0.04, w3: 0.04 + Math.random() * 0.05,
    p1: Math.random() * TAU, p2: Math.random() * TAU, p3: Math.random() * TAU
  };
  e.clipR = R * 1.3 + FD.r * 1.8;
  // la pala entra desde abajo a la derecha, como la tomaria una mano diestra
  const ang = Math.atan2(FD.h * 1.15 - y, FD.w * 1.05 - x) + (Math.random() - 0.5) * 0.4;
  e.dir = [Math.cos(ang), Math.sin(ang)];
  e.rot = ang - Math.PI / 2;
  e.travel = Math.hypot(FD.w, FD.h) * 0.8;
  e.members = [];
  e.neighbors = [];
  for (const p of FD.front) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), edge = stainRadius(e, a);
    if (d < edge) e.members.push({ p, d, a, edge, rd: Math.random() * 350, wet: WET[Math.floor(p.k * WET.length)] });
    else if (d < e.clipR + FD.r * 1.6) e.neighbors.push(p);
  }
  e.body = blobOf(e, 0.92);
  e.stain = blobOf(e, 1.14);
  // granos secos que quedan sobre la pala y caen por las ranuras al levantarla
  e.loose = Array.from({ length: 8 }, () => {
    const a = Math.random() * TAU, rr = R * (0.98 + Math.random() * 0.18);
    return { x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.92, r: FD.r * (0.7 + Math.random() * 0.4), s: PEARLS[Math.floor(Math.random() * PEARLS.length)] };
  });
  FD.events.push(e);
  if (byUser) FD.lastUser = now;
  if (!FD.raf) FD.raf = requestAnimationFrame(fieldTick);
  return true;
}

// el grumo: perlas mojadas unidas por la arcilla en una sola pieza
function drawClump(g, e, wetK, pull, lift) {
  if (pull > 0) {
    g.save();
    g.globalAlpha = pull;
    g.shadowColor = 'rgba(20,12,4,0.55)';
    g.shadowBlur = 8 + lift * 22;
    g.shadowOffsetX = 2 + lift * 10;
    g.shadowOffsetY = 4 + lift * 18;
    const body = g.createRadialGradient(e.x - e.R * 0.3, e.y - e.R * 0.35, e.R * 0.1, e.x, e.y, e.R * 1.1);
    body.addColorStop(0, '#9a8670');
    body.addColorStop(1, '#5e4d3b');
    g.fillStyle = body;
    g.fill(e.body);
    g.restore();
  }
  const k = 0.14 * pull;
  for (const m of e.members) {
    const wet = clamp01((wetK * m.edge * 1.12 - m.d) / (FD.r * 1.2));
    const x = m.p.x + (e.x - m.p.x) * k;
    const y = m.p.y + (e.y - m.p.y) * k;
    const r = m.p.r * (1 + 0.06 * pull); // las perlas se hinchan un poco al absorber
    drawSprite(g, m.p.s, x, y, r, 1 - wet);
    drawSprite(g, m.wet, x, y, r, wet);
  }
  if (pull > 0) { // borde oscuro que separa el grumo de la arena seca
    g.globalAlpha = 0.5 * pull;
    g.strokeStyle = 'rgba(40,26,12,0.6)';
    g.lineWidth = FD.r * 0.5;
    g.stroke(e.body);
  }
  g.globalAlpha = 1;
}

// pala de plastico vista desde arriba, con ranuras para cernir
function drawScoop(g, e, x, y, s, lift, looseAlpha) {
  const R = e.R, W = R * 2.7, L = R * 2.55;
  const bladeTop = -L / 2, bladeEnd = L / 2;
  const blade = new Path2D();
  blade.roundRect(-W / 2, bladeTop, W, L, [W * 0.2, W * 0.2, W * 0.32, W * 0.32]);
  const handle = new Path2D();
  handle.moveTo(-W * 0.2, bladeEnd - 4);
  handle.lineTo(W * 0.2, bladeEnd - 4);
  handle.lineTo(R * 0.24, bladeEnd + R * 0.6);
  handle.lineTo(-R * 0.24, bladeEnd + R * 0.6);
  handle.closePath();
  handle.roundRect(-R * 0.24, bladeEnd + R * 0.5, R * 0.48, R * 3.3, R * 0.24);

  g.save();
  g.translate(x, y);
  g.rotate(e.rot);
  g.scale(s, s);

  // sombra sobre la arena (crece cuando se levanta)
  g.save();
  g.shadowColor = `rgba(12,8,3,${0.5 - lift * 0.15})`;
  g.shadowBlur = 10 + lift * 26;
  g.shadowOffsetX = 6 + lift * 22;
  g.shadowOffsetY = 8 + lift * 30;
  g.fillStyle = '#0c544b';
  g.fill(blade);
  g.fill(handle);
  g.restore();

  const plastic = g.createLinearGradient(-W / 2, 0, W / 2, 0);
  plastic.addColorStop(0, '#16786b');
  plastic.addColorStop(0.5, '#0d5a50');
  plastic.addColorStop(1, '#08443c');
  g.fillStyle = plastic;
  g.fill(blade);
  g.fill(handle);
  g.lineWidth = R * 0.09;
  g.strokeStyle = '#05352f';
  g.stroke(blade);

  // ranuras
  for (let i = 0; i < 6; i++) {
    const sx = -W * 0.3 + i * (W * 0.6 / 5);
    const slot = new Path2D();
    slot.roundRect(sx - R * 0.065, -L * 0.3, R * 0.13, L * 0.58, R * 0.065);
    g.fillStyle = '#04302a';
    g.fill(slot);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(sx + R * 0.05, -L * 0.28, R * 0.02, L * 0.54);
  }

  // mango con agarre amarillo LOVET
  const grip = new Path2D();
  grip.roundRect(-R * 0.24, bladeEnd + R * 2.3, R * 0.48, R * 1.5, R * 0.24);
  g.fillStyle = '#edde00';
  g.fill(grip);
  g.fillStyle = '#8f8500';
  g.beginPath(); g.arc(0, bladeEnd + R * 3.45, R * 0.08, 0, TAU); g.fill();

  // granos secos encima de la pala que caen por las ranuras
  if (looseAlpha > 0) {
    for (const l of e.loose) drawSprite(g, l.s, l.x, l.y + (1 - looseAlpha) * 6, l.r * (0.6 + looseAlpha * 0.4), looseAlpha);
    g.globalAlpha = 1;
  }
  g.restore();
}

// suelo dentro del recorte del evento: humedad, hueco y relleno
function drawGround(g, e, t) {
  const wetK = easeOut(clamp01(t / 1000));
  g.save();
  g.beginPath(); g.arc(e.x, e.y, e.clipR, 0, TAU); g.clip();
  g.globalAlpha = 1;
  g.drawImage(FD.under, 0, 0, FD.w, FD.h);
  for (const p of e.neighbors) drawSprite(g, p.s, p.x, p.y, p.r, 1);
  if (t < 2700) {
    g.globalAlpha = 0.22 * wetK;
    g.fillStyle = '#3d2c1c';
    g.fill(e.stain);
  } else {
    // hueco limpio que la arena de alrededor vuelve a cubrir
    const fill = clamp01((t - 3300) / 900);
    g.globalAlpha = 0.45 * (1 - fill);
    g.fillStyle = '#120c06';
    g.fill(e.body);
    for (const m of e.members) {
      const k = easeOut(clamp01((t - 3300 - m.rd) / 600));
      if (k <= 0) continue;
      const push = (1 - k) * FD.r * 1.6;
      drawSprite(g, m.p.s, m.p.x + Math.cos(m.a) * push, m.p.y + Math.sin(m.a) * push, m.p.r, k);
    }
  }
  g.restore();
}

// pala y grumo, encima de todo
function drawLifted(g, e, t) {
  const wetK = easeOut(clamp01(t / 1000));
  const pull = easeInOut(clamp01((t - 1000) / 600));
  const approach = easeOut(clamp01((t - 1800) / 900));
  const lift = easeInOut(clamp01((t - 2700) / 500));
  const carry = clamp01((t - 3200) / 800) ** 2;
  const scoopOn = t >= 1800 && carry < 1;
  let sx = e.x, sy = e.y;
  if (scoopOn) {
    const away = (1 - approach) + carry; // 1 = fuera de la pantalla
    sx = e.x + e.dir[0] * e.travel * away;
    sy = e.y + e.dir[1] * e.travel * away - lift * 18;
    drawScoop(g, e, sx, sy, 1 + lift * 0.14, lift, approach >= 1 ? 1 - lift : 0);
  }
  if (t < 2700) {
    drawClump(g, e, wetK, pull, 0);
  } else if (scoopOn) {
    const s = 1 + lift * 0.14;
    g.save();
    g.translate(sx, sy);
    g.scale(s, s);
    g.translate(-e.x, -e.y);
    drawClump(g, e, 1, 1, lift);
    g.restore();
  }
}

function drawField(now) {
  const g = FD.g;
  if (!FD.top) return;
  g.globalAlpha = 1;
  g.drawImage(FD.top, 0, 0, FD.w, FD.h);
  for (const e of FD.events) drawGround(g, e, now - e.t0);
  for (const e of FD.events) drawLifted(g, e, now - e.t0);
  g.globalAlpha = 1;
  g.drawImage(FD.vignette, 0, 0, FD.w, FD.h);
  grain(g, FD.w, FD.h, 0.16);
}

function fieldTick(now) {
  FD.events = FD.events.filter(e => now - e.t0 < EVENT_MS);
  drawField(now);
  FD.raf = FD.events.length ? requestAnimationFrame(fieldTick) : 0;
}

function randomClump(byUser) {
  const wide = FD.w >= 1024;
  for (let i = 0; i < 6; i++) {
    const x = FD.w * (wide ? 0.55 + Math.random() * 0.25 : 0.25 + Math.random() * 0.5);
    const y = FD.h * (wide ? 0.25 + Math.random() * 0.4 : 0.48 + Math.random() * 0.12);
    if (spawnClump(x, y, byUser)) return;
  }
}

fieldCanvas.addEventListener('pointerdown', e => {
  const rect = fieldCanvas.getBoundingClientRect();
  spawnClump(e.clientX - rect.left, e.clientY - rect.top, true);
});
$('#field-btn').addEventListener('click', () => randomClump(true));

// demostracion automatica: un grumo nuevo cada pocos segundos
function autoClump() {
  clearTimeout(FD.auto);
  if (reduceMotion || !isActive(fieldSection)) return;
  if (!FD.events.length && performance.now() - FD.lastUser > 5000) randomClump(false);
  FD.auto = setTimeout(autoClump, 5400);
}
function fieldEnter() {
  clearTimeout(FD.auto);
  FD.auto = setTimeout(autoClump, 700);
}
function fieldLeave() {
  clearTimeout(FD.auto);
}

/* =========================================================
   4. PRESENTACIONES: cuanto te dura cada bolsa
   ========================================================= */
// supuestos de la estimacion (ajustar con datos reales de LOVET)
const FILL_KG = 6;       // kg por caja en cada cambio completo
const CHANGE_DAYS = 28;  // cambio completo cada 4 semanas
const CAT_KG_DAY = 0.17; // grumos que se retiran al dia por gato
const SIZES = [5, 10, 20];

const calc = { cats: 1, boxes: 1 };
const LIMITS = { cats: [1, 6], boxes: [1, 6] };
const sizeEls = $$('.size');
const sizePicks = $$('.size__pick');
let pickedIdx = null;

function durationText(days) {
  if (days >= 56) return `unos ${decimal(Math.round((days / 30) * 2) / 2)} meses`;
  if (days >= 14) return `unas ${decimal(Math.round((days / 7) * 2) / 2)} semanas`;
  return `unos ${plural(Math.round(days), 'día', 'días')}`;
}

function updateCalc() {
  const { cats, boxes } = calc;
  $('#cats').textContent = cats;
  $('#boxes').textContent = boxes;
  $$('[data-step]').forEach(btn => {
    const key = btn.dataset.step, next = calc[key] + Number(btn.dataset.delta);
    btn.disabled = next < LIMITS[key][0] || next > LIMITS[key][1];
  });

  const kgDay = (boxes * FILL_KG) / CHANGE_DAYS + cats * CAT_KG_DAY;
  const days = SIZES.map(kg => kg / kgDay);
  // recomendamos la bolsa mas chica que dure al menos tres semanas
  let rec = days.findIndex(d => d >= 21);
  if (rec < 0) rec = SIZES.length - 1;
  const sel = pickedIdx ?? rec;

  sizeEls.forEach((li, i) => {
    li.classList.toggle('is-rec', i === rec);
    li.querySelector('.size__last strong').textContent = durationText(days[i]);
    sizePicks[i].setAttribute('aria-checked', String(i === sel));
    sizePicks[i].tabIndex = i === sel ? 0 : -1;
  });

  let tip;
  if (boxes < cats) tip = 'Consejo veterinario: lo ideal es una caja por gato y una extra. Con menos cajas, algunos gatos dejan de usarlas.';
  else if (boxes === cats) tip = 'Consejo veterinario: suma una caja extra a las que ya tienes, así cada gato encuentra una limpia.';
  else tip = 'Bien: tienes una caja por gato y una extra, como recomiendan los veterinarios.';
  $('#calc-tip').textContent = tip;

  const kg = SIZES[sel];
  const msg = `Hola LOVET, quiero pedir la bolsa de ${kg} kg de arena perlada. En casa tenemos ${plural(cats, 'gato', 'gatos')} y ${plural(boxes, 'caja', 'cajas')} de arena.`;
  const wa = $('#wa-order');
  wa.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  $('#pick-name').textContent = `bolsa de ${kg} kg`;
  $('#pick-last').textContent = `En tu casa dura ${durationText(days[sel])}.${sel === rec ? ' Es la ideal para tu casa.' : ''}`;
  $('#calc-summary').textContent = `Te recomendamos la bolsa de ${SIZES[rec]} kilos: en tu casa dura ${durationText(days[rec])}.`;
}

$$('[data-step]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.step;
    calc[key] = clamp(calc[key] + Number(btn.dataset.delta), LIMITS[key][0], LIMITS[key][1]);
    pickedIdx = null;
    updateCalc();
  });
});

sizePicks.forEach((btn, i) => {
  btn.addEventListener('click', () => {
    pickedIdx = i;
    updateCalc();
  });
  // flechas para moverse entre tamaños, como un grupo de opciones
  btn.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    pickedIdx = (i + step + SIZES.length) % SIZES.length;
    updateCalc();
    sizePicks[pickedIdx].focus();
  });
});

/* =========================================================
   5. EL CAMBIO: una caja de arena que pasa de su arena actual
   (gris, angulosa) a LOVET (perlas claras) dia a dia
   ========================================================= */
const MIX_STEPS = [
  { share: 0.25, rule: 'Una parte de LOVET por tres de su arena actual.', days: 'los días 1 y 2' },
  { share: 0.5, rule: 'Mitad LOVET y mitad su arena actual.', days: 'los días 3 y 4' },
  { share: 0.75, rule: 'Tres partes de LOVET por una de su arena actual.', days: 'los días 5 y 6' },
  { share: 1, rule: 'Solo LOVET: el cambio está hecho.', days: 'el día 7' }
];
const STEP_MS = 3400;
const mixCanvas = $('#mix-box');
const dayTabs = $$('.days [role="tab"]');
const MX = { g: null, w: 0, h: 0, pad: 0, slots: [], share: 0.25, from: 0.25, t0: -1, raf: 0, step: 0, timer: 0, userPicked: false };

// tazas medidoras: una taza = una parte
const CUP_SVG = `<svg class="cup" viewBox="0 0 48 48">
  <path class="cup__body" d="M9 15h26l-3 25a3 3 0 0 1-3 2.6H15a3 3 0 0 1-3-2.6z"/>
  <g class="cup__pearls"><circle cx="15" cy="13" r="4"/><circle cx="22" cy="11" r="4.4"/><circle cx="29" cy="13" r="4"/></g>
  <g class="cup__rocks"><path d="M11 15l3-5 5 1 1 4z"/><path d="M19 14l4-5 5 2-1 4z"/><path d="M27 15l2-4 5 1 0 3z"/></g>
  <path class="cup__line" d="M9 15h26l-3 25a3 3 0 0 1-3 2.6H15a3 3 0 0 1-3-2.6zM35 19h3.5a4 4 0 0 1 0 8H33.5"/>
</svg>`;
$('.cups').innerHTML = CUP_SVG.repeat(4);
const cups = $$('.cups .cup');

function setupMixBox() {
  MX.w = mixCanvas.clientWidth;
  MX.h = mixCanvas.clientHeight;
  if (!MX.w || !MX.h) return;
  MX.g = sizeCanvas(mixCanvas, MX.w, MX.h, 2);
  MX.pad = Math.min(MX.w, MX.h) * 0.07;
  const rnd = seeded(77);
  const r = MX.w / 30, stepX = r * 1.65, stepY = r * 1.42;
  const x0 = MX.pad, y0 = MX.pad, x1 = MX.w - MX.pad, y1 = MX.h - MX.pad;
  MX.slots = [];
  let row = 0;
  for (let y = y0 - r * 0.5; y < y1 + r; y += stepY, row++) {
    for (let x = x0 + (row % 2) * stepX / 2 - r * 0.5; x < x1 + r; x += stepX) {
      MX.slots.push({
        x: x + (rnd() - 0.5) * r * 0.7, y: y + (rnd() - 0.5) * r * 0.6,
        r: r * (0.75 + rnd() * 0.45),
        rank: rnd(), delay: rnd() * 0.55,
        pearl: PEARLS[Math.floor(rnd() * PEARLS.length)],
        rock: GRAINS[Math.floor(rnd() * GRAINS.length)]
      });
    }
  }
  drawMix(performance.now());
}

function drawMix(now) {
  const g = MX.g;
  if (!g) return;
  const { w, h, pad } = MX;
  g.clearRect(0, 0, w, h);
  // caja de plastico vista desde arriba
  const outer = new Path2D();
  outer.roundRect(0, 0, w, h, Math.min(w, h) * 0.08);
  const rim = g.createLinearGradient(0, 0, 0, h);
  rim.addColorStop(0, '#f3f5f2');
  rim.addColorStop(1, '#cfd6d0');
  g.fillStyle = rim;
  g.fill(outer);
  const inner = new Path2D();
  inner.roundRect(pad, pad, w - pad * 2, h - pad * 2, Math.min(w, h) * 0.05);
  g.fillStyle = '#3a3128';
  g.fill(inner);

  g.save();
  g.clip(inner);
  const k = MX.t0 < 0 ? 1 : clamp01((now - MX.t0) / 1100);
  for (const s of MX.slots) {
    const isNew = s.rank < MX.share, wasNew = s.rank < MX.from;
    let sprite = isNew ? s.pearl : s.rock, scale = 1;
    if (isNew !== wasNew) {
      // el grano cambia de tipo: se achica, se reemplaza y vuelve a crecer
      const local = clamp01((k - s.delay) / 0.45);
      if (local < 0.5) { sprite = wasNew ? s.pearl : s.rock; scale = 1 - local * 1.4; }
      else scale = 0.3 + (local - 0.5) * 1.4;
    }
    drawSprite(g, sprite, s.x, s.y, s.r * scale, 1);
  }
  g.globalAlpha = 1;
  // sombra interior de las paredes de la caja
  g.lineWidth = pad * 0.9;
  g.strokeStyle = 'rgba(20,14,8,0.35)';
  g.stroke(inner);
  g.restore();
  grain(g, w, h, 0.12);
}

function mixTick(now) {
  drawMix(now);
  MX.raf = now - MX.t0 < 1150 ? requestAnimationFrame(mixTick) : 0;
}

function setMixStep(i, byUser) {
  const step = MIX_STEPS[i];
  MX.from = MX.share;
  MX.share = step.share;
  MX.step = i;
  MX.t0 = reduceMotion ? -1 : performance.now();
  if (reduceMotion) drawMix(performance.now());
  else if (!MX.raf) MX.raf = requestAnimationFrame(mixTick);

  dayTabs.forEach((tab, j) => {
    tab.setAttribute('aria-selected', String(j === i));
    tab.tabIndex = j === i ? 0 : -1;
  });
  $('#mix-panel').setAttribute('aria-labelledby', dayTabs[i].id);
  cups.forEach((cup, j) => cup.classList.toggle('is-lovet', j < step.share * 4));
  $('#mix-rule').textContent = step.rule;
  const pct = Math.round(step.share * 100);
  const lovet = $('#ratio-lovet'), old = $('#ratio-old');
  lovet.style.setProperty('--lovet', `${pct}%`);
  lovet.textContent = `${pct}% LOVET`;
  old.textContent = pct < 100 ? `${100 - pct}% su arena` : '';
  old.hidden = pct >= 100;
  mixCanvas.setAttribute('aria-label', `Caja de arena con la mezcla de ${step.days}: ${step.rule}`);

  if (byUser) {
    MX.userPicked = true;
    stopMixAuto();
  }
  // reinicia la barrita de avance del boton activo
  const days = $('.days');
  days.classList.remove('is-playing');
  if (!MX.userPicked && !reduceMotion) {
    days.getBoundingClientRect();
    days.classList.add('is-playing');
  }
}

function startMixAuto() {
  stopMixAuto();
  if (MX.userPicked || reduceMotion) return;
  $('.days').classList.add('is-playing');
  MX.timer = setInterval(() => setMixStep((MX.step + 1) % MIX_STEPS.length, false), STEP_MS);
}
function stopMixAuto() {
  clearInterval(MX.timer);
  $('.days').classList.remove('is-playing');
}

dayTabs.forEach((tab, i) => {
  tab.addEventListener('click', () => setMixStep(i, true));
  tab.addEventListener('keydown', e => {
    const move = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!move) return;
    e.preventDefault();
    const next = (i + move + dayTabs.length) % dayTabs.length;
    setMixStep(next, true);
    dayTabs[next].focus();
  });
});

/* =========================================================
   6. DONDE COMPRAR: mapa con los puntos de venta
   ========================================================= */
// DATOS DE EJEMPLO: reemplazar por los distribuidores reales de LOVET
const DISTRICTS = {
  'Miraflores': [-12.1211, -77.0297],
  'San Isidro': [-12.0977, -77.0365],
  'Santiago de Surco': [-12.1335, -76.9935],
  'San Borja': [-12.1010, -76.9985],
  'Surquillo': [-12.1125, -77.0170],
  'Barranco': [-12.1470, -77.0210],
  'Lince': [-12.0855, -77.0350],
  'Jesús María': [-12.0745, -77.0480],
  'Magdalena del Mar': [-12.0915, -77.0695],
  'Pueblo Libre': [-12.0755, -77.0630],
  'San Miguel': [-12.0790, -77.0880],
  'La Molina': [-12.0870, -76.9440]
};
const STORES = [
  ['Kiwoko', 'kiwoko', 'Tienda para mascotas', 'Miraflores', 'Av. José Larco cdra. 7', 0.002, -0.001],
  ['Caprabo', 'caprabo', 'Supermercado', 'Miraflores', 'Av. Benavides cdra. 4', -0.004, 0.003],
  ['Tiendanimal', 'tiendanimal', 'Tienda para mascotas', 'Miraflores', 'Av. Comandante Espinar cdra. 3', 0.005, -0.004],
  ['Distrivet', 'distrivet', 'Distribuidora veterinaria', 'San Isidro', 'Av. Conquistadores cdra. 5', 0.002, -0.003],
  ['Eroski', 'eroski', 'Supermercado', 'San Isidro', 'Av. Dos de Mayo cdra. 13', -0.003, 0.004],
  ['Clarel', 'clarel', 'Tienda de cuidado personal', 'San Isidro', 'Av. Camino Real cdra. 3', 0.004, 0.006],
  ['DinoSol', 'dinosol', 'Supermercado', 'Santiago de Surco', 'Av. Primavera cdra. 16', 0.01, 0.002],
  ['Alimerka', 'alimerka', 'Supermercado', 'Santiago de Surco', 'Av. Caminos del Inca cdra. 2', 0.004, 0.008],
  ['Llobet', 'llobet', 'Supermercado', 'Santiago de Surco', 'Av. Benavides cdra. 40', -0.004, -0.006],
  ['Bonpreu Esclat', 'bonpreu-esclat', 'Supermercado', 'San Borja', 'Av. San Luis cdra. 25', 0.003, 0.002],
  ['Plaza', 'plaza', 'Supermercado', 'San Borja', 'Av. Aviación cdra. 28', -0.004, -0.004],
  ['SPAR', 'spar', 'Supermercado', 'Surquillo', 'Av. Angamos Este cdra. 5', 0.002, 0.001],
  ['Lupa', 'lupa', 'Supermercado', 'Surquillo', 'Av. República de Panamá cdra. 48', -0.003, -0.004],
  ['Pladevall', 'pladevall', 'Supermercado', 'Barranco', 'Av. Grau cdra. 3', 0.002, 0.001],
  ['Sorli', 'sorli', 'Supermercado', 'Barranco', 'Av. San Martín cdra. 2', -0.003, -0.003],
  ['Gadisa', 'gadisa', 'Supermercado', 'Lince', 'Av. Arequipa cdra. 21', 0.001, 0.003],
  ['Novavenda', 'novavenda', 'Tienda online con recojo', 'Lince', 'Av. Petit Thouars cdra. 22', -0.003, 0.005],
  ['Altoaragón', 'altoaragon', 'Supermercado', 'Jesús María', 'Av. Salaverry cdra. 20', 0.001, 0.004],
  ['Cencosu SPAR', 'cencosu-spar', 'Supermercado', 'Jesús María', 'Av. Brasil cdra. 14', 0.003, -0.004],
  ['Fragadis SPAR', 'fragadis-spar', 'Supermercado', 'Magdalena del Mar', 'Av. Brasil cdra. 30', 0.002, 0.002],
  ['Plusfresc', 'plusfresc', 'Supermercado', 'Pueblo Libre', 'Av. La Mar cdra. 9', 0, 0],
  ['SPAR Exclub', 'spar-exclub', 'Supermercado', 'San Miguel', 'Av. La Marina cdra. 20', 0.001, 0.002],
  ['Super Grup', 'super-grup', 'Supermercado', 'La Molina', 'Av. La Molina cdra. 12', 0, 0]
].map(([name, logo, type, district, addr, dLat, dLng], id) => ({
  id, name, logo: `assets/logos/${logo}.png`, type, district, addr,
  lat: DISTRICTS[district][0] + dLat,
  lng: DISTRICTS[district][1] + dLng
}));

const storeList = $('#store-list');
const storeCount = $('#store-count');
const storeQuery = $('#store-q');
const nearBtn = $('#near-me');
let map = null, mapReady = false, selectedId = null, userPos = null, popup = null, meMarker = null;

const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const directionsUrl = s => `https://www.google.com/maps/dir/?api=1&destination=${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;

function distanceKm(a, b) {
  const rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const distanceText = km => (km < 1 ? `a ${Math.round(km * 100) * 10} m` : `a ${decimal(Math.round(km * 10) / 10)} km`);

function visibleStores() {
  const q = normalize(storeQuery.value);
  let list = STORES.filter(s => !q || normalize(`${s.name} ${s.district} ${s.addr} ${s.type}`).includes(q));
  if (userPos) list = list.map(s => ({ ...s, km: distanceKm(userPos, s) })).sort((a, b) => a.km - b.km);
  return list;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderStores() {
  const list = visibleStores();
  storeList.innerHTML = '';
  const districts = [...new Set(list.map(s => s.district))];
  if (!userPos) districts.sort((a, b) => a.localeCompare(b, 'es'));
  storeCount.textContent = list.length
    ? `${plural(list.length, 'punto de venta', 'puntos de venta')} en ${plural(districts.length, 'distrito', 'distritos')}${userPos ? ', del más cercano al más lejano' : ''}.`
    : '';

  if (!list.length) {
    storeList.appendChild(el('p', 'stores__empty', `No encontramos puntos de venta para “${storeQuery.value.trim()}”. Prueba con otro distrito o escríbenos por WhatsApp.`));
  }
  districts.forEach(d => {
    const items = list.filter(s => s.district === d);
    const head = el('h3', 'stores__district', d);
    head.appendChild(el('span', '', String(items.length)));
    storeList.appendChild(head);
    items.forEach(s => {
      const row = el('div', 'store');
      row.dataset.id = s.id;
      if (s.id === selectedId) row.classList.add('is-active');
      const logo = el('span', 'store__logo');
      const img = el('img');
      img.src = s.logo;
      img.alt = '';
      img.loading = 'lazy';
      logo.appendChild(img);
      const pick = el('button', 'store__pick');
      pick.type = 'button';
      pick.appendChild(el('span', 'store__name', s.name));
      pick.appendChild(el('span', 'store__addr', s.addr));
      if (s.km !== undefined) pick.appendChild(el('span', 'store__dist', distanceText(s.km)));
      const go = el('a', 'store__go', 'Cómo llegar');
      go.href = directionsUrl(s);
      go.target = '_blank';
      go.rel = 'noopener';
      go.setAttribute('aria-label', `Cómo llegar a ${s.name}, ${s.addr}`);
      row.append(logo, pick, go);
      row.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        selectStore(s.id, true);
      });
      storeList.appendChild(row);
    });
  });

  if (mapReady) {
    map.getSource('stores').setData(toGeoJSON(list));
  }
}

function toGeoJSON(list) {
  return {
    type: 'FeatureCollection',
    features: list.map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { id: s.id } }))
  };
}

function selectStore(id, fly) {
  selectedId = id;
  const s = STORES[id];
  $$('.store').forEach(row => row.classList.toggle('is-active', Number(row.dataset.id) === id));
  const row = storeList.querySelector(`[data-id="${id}"]`);
  if (row) storeList.scrollTop = row.offsetTop - storeList.clientHeight / 3;
  if (!mapReady) return;
  map.setLayoutProperty('store-points', 'icon-image', ['case', ['==', ['get', 'id'], id], 'lovet-pin-on', 'lovet-pin']);
  map.setLayoutProperty('store-points', 'symbol-sort-key', ['case', ['==', ['get', 'id'], id], 1, 0]);
  if (fly) {
    const wide = window.innerWidth >= 1024;
    map.flyTo({ center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 14.2), offset: wide ? [200, 0] : [0, 0], duration: reduceMotion ? 0 : 900 });
  }
  if (popup) popup.remove();
  const box = el('div', 'pop');
  const img = el('img');
  img.src = s.logo;
  img.alt = '';
  const go = el('a', '', 'Cómo llegar');
  go.href = directionsUrl(s);
  go.target = '_blank';
  go.rel = 'noopener';
  box.append(img, el('strong', '', s.name), el('span', '', `${s.type}. ${s.addr}, ${s.district}.`), go);
  popup = new maplibregl.Popup({ offset: [0, -40], maxWidth: '260px', focusAfterOpen: false })
    .setLngLat([s.lng, s.lat]).setDOMContent(box).addTo(map);
}

// pin de LOVET: gota verde con una huella amarilla (la huella del sello de la bolsa)
function pinImage(active) {
  const s = 2, w = 34, h = 44;
  const c = document.createElement('canvas');
  c.width = w * s;
  c.height = h * s;
  const g = c.getContext('2d');
  g.scale(s, s);
  g.shadowColor = 'rgba(0,30,26,0.35)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 2;
  g.beginPath();
  g.arc(17, 16, 14, Math.PI * 0.8, Math.PI * 0.2);
  g.lineTo(17, 40);
  g.closePath();
  g.fillStyle = active ? '#edde00' : '#00433c';
  g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 2.5;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = active ? '#00433c' : '#edde00';
  g.beginPath(); g.ellipse(17, 19.5, 5, 4.2, 0, 0, Math.PI * 2); g.fill();
  [[11.6, 14.6, 2.1], [15, 11.5, 2.2], [19, 11.5, 2.2], [22.4, 14.6, 2.1]].forEach(([x, y, r]) => {
    g.beginPath(); g.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2); g.fill();
  });
  return g.getImageData(0, 0, c.width, c.height);
}

// recolorea el mapa base con la paleta de LOVET
function brandMap() {
  const style = map.getStyle();
  for (const l of style.layers) {
    const sl = l['source-layer'] || '', id = l.id;
    try {
      if (l.type === 'background') map.setPaintProperty(id, 'background-color', '#eef1ec');
      else if (l.type === 'fill') {
        let c = null;
        if (sl === 'water') c = '#c9ddd6';
        else if (sl === 'park' || /park|wood|grass|forest/.test(id)) c = '#dde7da';
        else if (sl === 'building') c = '#e2e6df';
        else if (sl === 'landuse' || sl === 'landcover') c = '#e7ebe4';
        if (c) map.setPaintProperty(id, 'fill-color', c);
      } else if (l.type === 'line') {
        let c = null;
        if (sl === 'transportation') {
          if (/rail/.test(id)) c = '#c9d1c7';
          else if (/casing/.test(id)) c = /motorway/.test(id) ? '#e6e0b4' : '#dbe1d8';
          else c = /motorway/.test(id) ? '#f7f0c6' : '#ffffff';
        }
        else if (sl === 'waterway') c = '#c9ddd6';
        else if (sl === 'boundary') c = '#9db0a8';
        if (c) map.setPaintProperty(id, 'line-color', c);
      } else if (l.type === 'symbol' && l.layout && l.layout['text-field']) {
        map.setPaintProperty(id, 'text-color', sl === 'place' ? '#00433c' : '#6b6f66');
        map.setPaintProperty(id, 'text-halo-color', '#eef1ec');
      }
    } catch (err) { /* capa sin esa propiedad */ }
  }
  // limites de distrito punteados
  const vector = Object.keys(style.sources).find(k => style.sources[k].type === 'vector');
  const firstSymbol = style.layers.find(l => l.type === 'symbol');
  if (vector) {
    map.addLayer({
      id: 'lovet-districts', type: 'line', source: vector, 'source-layer': 'boundary',
      filter: ['==', ['get', 'admin_level'], 8],
      paint: { 'line-color': '#00433c', 'line-opacity': 0.55, 'line-width': 1.4, 'line-dasharray': [3, 2] }
    }, firstSymbol && firstSymbol.id);
  }
}

function addStoreLayers() {
  map.addImage('lovet-pin', pinImage(false), { pixelRatio: 2 });
  map.addImage('lovet-pin-on', pinImage(true), { pixelRatio: 2 });
  map.addSource('stores', { type: 'geojson', data: toGeoJSON(visibleStores()), cluster: true, clusterRadius: 36, clusterMaxZoom: 13 });
  map.addLayer({
    id: 'store-clusters', type: 'circle', source: 'stores', filter: ['has', 'point_count'],
    paint: { 'circle-color': '#00433c', 'circle-radius': ['step', ['get', 'point_count'], 16, 4, 20], 'circle-stroke-color': '#edde00', 'circle-stroke-width': 2.5 }
  });
  map.addLayer({
    id: 'store-count', type: 'symbol', source: 'stores', filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true },
    paint: { 'text-color': '#edde00' }
  });
  map.addLayer({
    id: 'store-points', type: 'symbol', source: 'stores', filter: ['!', ['has', 'point_count']],
    layout: { 'icon-image': 'lovet-pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'symbol-sort-key': 0 }
  });

  map.on('click', 'store-points', e => selectStore(Number(e.features[0].properties.id), false));
  map.on('click', 'store-clusters', async e => {
    const f = e.features[0];
    const zoom = await map.getSource('stores').getClusterExpansionZoom(f.properties.cluster_id);
    map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 0.4, duration: reduceMotion ? 0 : 600 });
  });
  ['store-points', 'store-clusters'].forEach(id => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  });
}

function fitStores(list, animate) {
  if (!list.length) return;
  const bounds = new maplibregl.LngLatBounds();
  list.forEach(s => bounds.extend([s.lng, s.lat]));
  const wide = window.innerWidth >= 1024;
  const padding = wide
    ? { top: 110, bottom: 50, left: Math.min(520, window.innerWidth * 0.4), right: 190 }
    : { top: 70, bottom: 50, left: 30, right: 30 };
  map.fitBounds(bounds, { padding, maxZoom: 14.5, duration: animate && !reduceMotion ? 700 : 0 });
}

function initMap() {
  if (map) { map.resize(); return; }
  if (!window.maplibregl) {
    $('#map').appendChild(el('p', 'map__fallback', 'No pudimos cargar el mapa. Revisa tu conexión: la lista de puntos de venta sigue disponible.'));
    return;
  }
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/positron',
    center: [-77.02, -12.105],
    zoom: 12.4,
    attributionControl: { compact: true },
    cooperativeGestures: true,
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda del mouse para acercar el mapa',
      'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda del mouse para acercar el mapa',
      'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
      'NavigationControl.ZoomIn': 'Acercar',
      'NavigationControl.ZoomOut': 'Alejar'
    }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.on('load', () => {
    brandMap();
    addStoreLayers();
    mapReady = true;
    fitStores(visibleStores(), false);
    if (selectedId !== null) selectStore(selectedId, true);
  });
}

let searchTimer;
storeQuery.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    renderStores();
    if (mapReady) fitStores(visibleStores(), true);
  }, 160);
});

nearBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    storeCount.textContent = 'Tu navegador no comparte la ubicación. Busca por distrito o tienda.';
    return;
  }
  nearBtn.disabled = true;
  nearBtn.textContent = 'Buscando…';
  navigator.geolocation.getCurrentPosition(pos => {
    userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    nearBtn.disabled = false;
    nearBtn.textContent = 'Cerca de mí';
    renderStores();
    const nearest = visibleStores()[0];
    if (mapReady) {
      if (!meMarker) {
        const dot = el('span', 'me-dot');
        dot.setAttribute('aria-label', 'Tu ubicación');
        meMarker = new maplibregl.Marker({ element: dot });
      }
      meMarker.setLngLat([userPos.lng, userPos.lat]).addTo(map);
    }
    if (nearest) selectStore(nearest.id, true);
  }, () => {
    nearBtn.disabled = false;
    nearBtn.textContent = 'Cerca de mí';
    storeCount.textContent = 'No pudimos ver tu ubicación. Revisa el permiso del navegador o busca por distrito.';
  }, { timeout: 8000, maximumAge: 60000 });
});

/* =========================================================
   7. CONTACTO
   ========================================================= */
const contactForm = $('#contact-form');
const contactDone = $('#contact-done');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setError(id, msg) {
  const input = $(`#${id}`);
  input.closest('.field').classList.toggle('has-error', Boolean(msg));
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  $(`#${id}-err`).textContent = msg;
}

function checkField(id) {
  const v = $(`#${id}`).value.trim();
  if (id === 'c-name') setError(id, v ? '' : 'Escribe tu nombre.');
  if (id === 'c-mail') setError(id, EMAIL_RE.test(v) ? '' : 'Escribe un correo válido, por ejemplo nombre@correo.com.');
  if (id === 'c-phone') setError(id, !v || /^(\+?51)?\d{7,9}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Escribe un número válido, por ejemplo 987 654 321.');
  if (id === 'c-msg') setError(id, v ? '' : 'Cuéntanos en qué te podemos ayudar.');
}

contactForm.addEventListener('submit', e => {
  e.preventDefault();
  ['c-name', 'c-mail', 'c-phone', 'c-msg'].forEach(checkField);
  const firstBad = contactForm.querySelector('[aria-invalid="true"]');
  if (firstBad) { firstBad.focus(); return; }
  // aqui se conecta el envio real (Formspree, backend propio, CRM...)
  const name = $('#c-name').value.trim(), mail = $('#c-mail').value.trim();
  const news = $('#c-news').checked ? ' También te sumamos a los correos de novedades.' : '';
  $('#contact-done-text').textContent = `Gracias, ${name}. Te responderemos a ${mail}.${news}`;
  contactForm.hidden = true;
  contactDone.hidden = false;
  contactDone.focus();
});
contactForm.addEventListener('input', e => {
  if (e.target.closest('.has-error')) checkField(e.target.id);
});
$('#contact-again').addEventListener('click', () => {
  contactForm.reset();
  contactForm.hidden = false;
  contactDone.hidden = true;
  $('#c-name').focus();
});

/* =========================================================
   NAVEGACION: una seccion por cada scroll
   ========================================================= */
const html = document.documentElement;
const pages = $$('.page');
const railLinks = $$('.rail a');
const themeMeta = $('meta[name="theme-color"]');
const THEME = { dark: '#00433c', light: '#eef1ec' };
const DURATION = reduceMotion ? 0 : 950;
let current = 0, pagerOn = false, moving = false;

pages.forEach(p => p.querySelector('h1, h2').setAttribute('tabindex', '-1'));

function isActive(section) {
  return pagerOn ? pages[current] === section : true;
}

function setActive(i) {
  const tone = pages[i].dataset.tone;
  document.body.dataset.tone = tone;
  themeMeta.content = THEME[tone];
  railLinks.forEach((a, j) => a.setAttribute('aria-current', String(j === i)));
  $('#progress-bar').style.width = `${((i + 1) / pages.length) * 100}%`;
}

function enterSection(i) {
  const id = pages[i].id;
  if (id === 'inicio') heroIntro();
  if (id === 'tocala') fieldEnter();
  if (id === 'cambio') startMixAuto();
  if (id === 'donde') initMap();
}

function leaveSection(i) {
  const id = pages[i].id;
  if (id === 'tocala') fieldLeave();
  if (id === 'cambio') stopMixAuto();
}

function innerOf(i) { return pages[i].querySelector('.page__inner'); }
function canScroll(node, dir) {
  return dir > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 2 : node.scrollTop > 2;
}
// busca un contenedor con scroll propio (seccion, lista de tiendas...) que aun pueda moverse
function scrollerFor(target, dir) {
  const stop = pages[current];
  for (let node = target; node && node !== stop; node = node.parentElement) {
    if (node.nodeType !== 1 || node.scrollHeight <= node.clientHeight + 2) continue;
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && canScroll(node, dir)) return node;
  }
  return null;
}

function go(to, focus) {
  if (!pagerOn) {
    pages[to].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    return;
  }
  if (moving || to === current || to < 0 || to >= pages.length) return;
  const from = pages[current], next = pages[to], dir = to > current ? 1 : -1;
  leaveSection(current);
  current = to;
  moving = true;
  setActive(to);
  history.replaceState(null, '', `#${next.id}`);
  next.inert = false;
  innerOf(to).scrollTop = 0;

  const finish = () => {
    from.classList.remove('is-active', 'is-leaving', 'is-moving');
    from.style.transform = '';
    from.inert = true;
    next.classList.remove('is-entering', 'is-moving');
    next.classList.add('is-active');
    next.style.transform = '';
    moving = false;
    enterSection(to);
    if (focus) next.querySelector('h1, h2').focus({ preventScroll: true });
  };

  if (!DURATION) { finish(); return; }

  // la nueva seccion se desliza encima y la anterior se queda atras, mas lenta y oscura
  next.style.transform = `translateY(${dir * 100}%)`;
  next.classList.add('is-entering');
  from.classList.add('is-leaving', 'is-moving');
  next.getBoundingClientRect();
  next.classList.add('is-moving');
  next.style.transform = 'translateY(0)';
  from.style.transform = `translateY(${-22 * dir}vh)`;
  setTimeout(finish, DURATION + 40);
}

// rueda del mouse / trackpad: un gesto = una seccion
let lastWheel = 0, wheelAcc = 0, gestureUsed = false, innerScrollAt = 0;
window.addEventListener('wheel', e => {
  if (!pagerOn || e.ctrlKey || e.metaKey) return; // ctrl + rueda = zoom del mapa
  const now = performance.now();
  if (now - lastWheel > 220) { wheelAcc = 0; gestureUsed = false; }
  lastWheel = now;
  const dir = Math.sign(e.deltaY);
  if (!dir) return;
  if (scrollerFor(e.target, dir)) { innerScrollAt = now; return; }
  e.preventDefault();
  if (moving) { gestureUsed = true; return; }
  if (gestureUsed || now - innerScrollAt < 300) return;
  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) > 40) {
    gestureUsed = true;
    wheelAcc = 0;
    go(current + dir);
  }
}, { passive: false });

// tactil: deslizar arriba o abajo
let touch = null;
window.addEventListener('touchstart', e => {
  if (!pagerOn) return;
  const t = e.target;
  // en la bolsa el dedo mueve el vistazo; con dos dedos se mueve el mapa
  if (e.touches.length > 1 || t.closest('.bag')) { touch = null; return; }
  const scrollers = [];
  for (let node = t; node && node !== pages[current]; node = node.parentElement) {
    if (node.nodeType === 1 && node.scrollHeight > node.clientHeight + 2) scrollers.push([node, node.scrollTop]);
  }
  touch = { y: e.touches[0].clientY, target: t, scrollers };
}, { passive: true });
window.addEventListener('touchend', e => {
  if (!pagerOn || !touch) return;
  const dy = touch.y - e.changedTouches[0].clientY;
  const { target, scrollers } = touch;
  touch = null;
  if (Math.abs(dy) < 50) return;
  const dir = dy > 0 ? 1 : -1;
  if (scrollers.some(([node, top]) => node.scrollTop !== top)) return; // se movio una lista por dentro
  if (scrollerFor(target, dir)) return;
  go(current + dir);
}, { passive: true });

// teclado
window.addEventListener('keydown', e => {
  if (!pagerOn || e.target.closest('input, textarea, select, .map')) return;
  let dir = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
  if (e.key === ' ' && !e.target.closest('button, a')) dir = e.shiftKey ? -1 : 1;
  if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    go(e.key === 'Home' ? 0 : pages.length - 1, true);
    return;
  }
  if (!dir) return;
  e.preventDefault();
  const scroller = scrollerFor(e.target, dir) || (canScroll(innerOf(current), dir) ? innerOf(current) : null);
  if (scroller) scroller.scrollBy({ top: dir * scroller.clientHeight * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
  else go(current + dir);
});

// enlaces internos (#donde, #bolsas...)
document.addEventListener('click', e => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const i = pages.findIndex(p => `#${p.id}` === link.getAttribute('href'));
  if (i < 0) return;
  e.preventDefault();
  go(i, true);
});

function enablePager() {
  pagerOn = true;
  html.classList.add('pager');
  const fromHash = pages.findIndex(p => `#${p.id}` === location.hash);
  current = fromHash >= 0 ? fromHash : 0;
  pages.forEach((p, i) => {
    p.classList.toggle('is-active', i === current);
    p.inert = i !== current;
  });
  window.scrollTo(0, 0);
  setActive(current);
  enterSection(current);
}

// pantallas muy bajas (celular en horizontal): scroll normal
let observer = null;
function enableScrollMode() {
  pagerOn = false;
  html.classList.remove('pager');
  pages.forEach(p => {
    p.classList.remove('is-active', 'is-entering', 'is-leaving', 'is-moving');
    p.inert = false;
    p.style.transform = '';
  });
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const i = pages.indexOf(entry.target);
      if (!entry.isIntersecting) { leaveSection(i); return; }
      current = i;
      setActive(current);
      enterSection(current);
    });
  }, { threshold: 0.5 });
  pages.forEach(p => observer.observe(p));
}

const tallEnough = matchMedia('(min-height: 540px)');
function chooseMode() {
  if (observer) { observer.disconnect(); observer = null; }
  if (tallEnough.matches) enablePager();
  else enableScrollMode();
}
tallEnough.addEventListener('change', () => {
  chooseMode();
  setupAll();
});

/* =========================================================
   ARRANQUE
   ========================================================= */
function setupAll() {
  setupBag();
  setupField();
  setupMixBox();
}

updateCalc();
setMixStep(0, false);
renderStores();
window.addEventListener('load', () => {
  chooseMode();
  setupAll();
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(setupAll, 150);
});
