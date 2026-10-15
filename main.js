// LOVET - interacciones de la pagina
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// misma condicion que en styles.css: celulares y tablets en vertical usan una sola columna
const stacked = matchMedia('(max-width: 1023px) and (orientation: portrait), (max-width: 639px)');

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
   ARENA LOVET
   La textura es la foto real de la arena: perlas claras y
   porosas con perlitas verdes. Asi se ve igual que el producto.
   ========================================================= */
function texture(src, grainR) {
  const img = new Image();
  img.src = src;
  img.grainR = grainR; // radio de una perla en la foto, en px de la foto
  return img;
}
const SAND = texture('assets/arena-lovet.jpg', 6);          // "Toca la arena" y el arenero
const SAND_BAG = texture('assets/arena-lovet-bolsa.jpg', 8); // dentro de la bolsa
const loaded = img => img.complete && img.naturalWidth > 0;
const sandReady = () => loaded(SAND) && loaded(SAND_BAG);

// pinta la foto cubriendo el area, como object-fit: cover; devuelve la escala usada
function drawSand(g, x, y, w, h, flip, zoom = 1, img = SAND) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  g.save();
  g.translate(x + w / 2, y + h / 2);
  if (flip) g.scale(-1, -1);
  g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  g.restore();
  return s;
}

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

// contorno de un grupo de perlas: redondeado, con un bulto por cada perla del borde
function clusterPoints(cx, cy, R, grainR, rnd) {
  const bumps = Math.max(6, Math.round((Math.PI * 2 * R) / (grainR * 2.1)));
  const p1 = rnd() * 7, p2 = rnd() * 7, p3 = rnd() * 7;
  const pts = [];
  const n = bumps * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = R * (1 + 0.07 * Math.sin(3 * a + p1) + 0.05 * Math.sin(5 * a + p2)) + grainR * 0.32 * Math.sin(bumps * a + p3);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
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
  if (!B.w || !B.h || !sandReady() || !bagImg.complete) return;
  B.R = Math.min(115, B.w * 0.29);
  const g = sizeCanvas(bagCanvas, B.w, B.h, 2);
  g.fillStyle = '#0f2a24';
  g.fillRect(0, 0, B.w, B.h);
  // la arena llena la bolsa hasta poco debajo del sello, con la superficie irregular
  const top = B.h * 0.24;
  const rnd = seeded(23);
  const fill = new Path2D();
  fill.moveTo(0, B.h);
  for (let x = 0; x <= B.w; x += B.w / 40) {
    fill.lineTo(x, top - Math.sin((x / B.w) * Math.PI) * B.h * 0.025 + (rnd() - 0.5) * B.w * 0.012);
  }
  fill.lineTo(B.w, B.h);
  fill.closePath();
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 18;
  g.fillStyle = '#6b6258';
  g.fill(fill);
  g.restore();
  g.save();
  g.clip(fill);
  drawSand(g, 0, top * 0.8, B.w, B.h - top * 0.8, false, 1.3, SAND_BAG);
  // adentro de la bolsa hay menos luz: la parte de arriba queda en sombra
  const depth = g.createLinearGradient(0, top * 0.8, 0, B.h);
  depth.addColorStop(0, 'rgba(10,22,18,0.55)');
  depth.addColorStop(0.25, 'rgba(10,22,18,0.05)');
  depth.addColorStop(1, 'rgba(10,22,18,0.2)');
  g.fillStyle = depth;
  g.fillRect(0, 0, B.w, B.h);
  g.restore();
  grain(g, B.w, B.h, 0.14);
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
const FD = { g: null, w: 0, h: 0, r: 6, u: 20, under: null, top: null, vignette: null, events: [], raf: 0, auto: 0, lastUser: -1e9 };
const TAU = Math.PI * 2;
const EVENT_MS = 4600;

function setupField() {
  FD.w = fieldSection.clientWidth;
  FD.h = fieldSection.clientHeight;
  if (!FD.w || !FD.h || !sandReady()) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  FD.g = sizeCanvas(fieldCanvas, FD.w, FD.h, 1.5);
  FD.events = [];

  let g;
  [FD.top, g] = offscreen(FD.w, FD.h, dpr);
  FD.r = SAND.grainR * drawSand(g, 0, 0, FD.w, FD.h, false);
  // medida del grumo, independiente del tamaño de las perlas de la foto
  FD.u = clamp(Math.min(FD.w, FD.h) / 37, 17, 26);

  // capa de abajo: otras perlas, en sombra, que se ven en el hueco cuando sale el grumo
  [FD.under, g] = offscreen(FD.w, FD.h, dpr);
  drawSand(g, 0, 0, FD.w, FD.h, true);
  g.fillStyle = 'rgba(30,20,10,0.5)';
  g.fillRect(0, 0, FD.w, FD.h);

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
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU, r = stainRadius(e, a) * scale;
    pts.push([e.x + Math.cos(a) * r, e.y + Math.sin(a) * r]);
  }
  return smoothPath(pts);
}

function spawnClump(x, y, byUser) {
  const now = performance.now();
  if (FD.events.length >= 3) return false;
  const R = FD.u * (3.8 + Math.random() * 0.6);
  for (const e of FD.events) {
    if (Math.hypot(e.x - x, e.y - y) < (e.R + R) * 2.2) return false;
  }
  const e = {
    x, y, R, t0: now,
    w1: 0.06 + Math.random() * 0.05, w2: 0.03 + Math.random() * 0.04, w3: 0.04 + Math.random() * 0.05,
    p1: Math.random() * TAU, p2: Math.random() * TAU, p3: Math.random() * TAU
  };
  // la pala entra desde abajo a la derecha, como la tomaria una mano diestra
  const ang = Math.atan2(FD.h * 1.15 - y, FD.w * 1.05 - x) + (Math.random() - 0.5) * 0.4;
  e.dir = [Math.cos(ang), Math.sin(ang)];
  e.rot = ang - Math.PI / 2;
  e.travel = Math.hypot(FD.w, FD.h) * 0.8;
  // el grumo: las perlas mojadas de la foto, con el borde de perlas sueltas
  const rnd = seeded(1 + Math.floor(Math.random() * 1e6));
  e.body = smoothPath(clusterPoints(x, y, R * 0.92, FD.r, rnd).map(([px, py]) => {
    const a = Math.atan2(py - y, px - x), k = stainRadius(e, a) / R;
    return [x + (px - x) * k, y + (py - y) * k];
  }));
  // la humedad se esparce en capas: borde suave, centro mas oscuro
  e.wet = [1.2, 1.1, 1, 0.9, 0.78, 0.62].map(k => blobOf(e, k));
  FD.events.push(e);
  if (byUser) FD.lastUser = now;
  if (!FD.raf) FD.raf = requestAnimationFrame(fieldTick);
  return true;
}

// la arena mojada se oscurece sin perder la textura de las perlas
function wetTint(g, e, k) {
  if (k <= 0) return;
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#86715a';
  g.globalAlpha = 0.3 * k;
  g.translate(e.x, e.y);
  g.scale(0.35 + 0.65 * k, 0.35 + 0.65 * k);
  g.translate(-e.x, -e.y);
  for (const p of e.wet) g.fill(p);
  g.restore();
}

// el grumo: una sola pieza firme hecha de las mismas perlas
function drawClump(g, e, pull, lift) {
  if (pull <= 0) return;
  const c = 1 - 0.05 * pull; // al aglomerarse las perlas se juntan un poco
  g.save();
  g.translate(e.x, e.y);
  g.scale(c, c);
  g.translate(-e.x, -e.y);

  g.save();
  g.globalAlpha = pull;
  g.shadowColor = 'rgba(20,12,4,0.6)';
  g.shadowBlur = 6 + lift * 22;
  g.shadowOffsetX = 2 + lift * 10;
  g.shadowOffsetY = 3 + lift * 18;
  g.fillStyle = '#6b5c4a';
  g.fill(e.body);
  g.restore();

  g.save();
  g.clip(e.body);
  g.drawImage(FD.top, 0, 0, FD.w, FD.h);
  wetTint(g, e, 1);
  // volumen: luz arriba a la izquierda y el borde que se curva hacia abajo
  const vol = g.createRadialGradient(e.x - e.R * 0.3, e.y - e.R * 0.35, e.R * 0.1, e.x, e.y, e.R * 1.02);
  vol.addColorStop(0, `rgba(255,246,230,${0.2 * pull})`);
  vol.addColorStop(0.5, 'rgba(255,246,230,0)');
  vol.addColorStop(0.8, `rgba(40,26,12,${0.18 * pull})`);
  vol.addColorStop(1, `rgba(30,18,8,${0.6 * pull})`);
  g.fillStyle = vol;
  g.fillRect(e.x - e.R * 1.4, e.y - e.R * 1.4, e.R * 2.8, e.R * 2.8);
  g.restore();
  g.restore();
}

/* pala de plastico vista desde arriba, como una de verdad: paredes
   laterales, rejilla de ranuras por donde cae la arena limpia y un
   mango largo con agujero para colgarla */
function scoopPaths(R) {
  const W = R * 2.7, L = R * 2.5;
  const fw = W / 2, bw = W * 0.43, y0 = -L / 2, y1 = L / 2, cr = W * 0.11;
  const neck = R * 0.5, hw = R * 0.27, hl = R * 3.4;

  const edge = (p, close) => {
    p.moveTo(-fw, y0 + cr);
    p.quadraticCurveTo(-fw, y0, -fw + cr, y0);
    p.quadraticCurveTo(0, y0 - R * 0.14, fw - cr, y0); // borde de ataque, apenas curvo
    p.quadraticCurveTo(fw, y0, fw, y0 + cr);
    p.lineTo(bw, y1 - cr);
    p.quadraticCurveTo(bw, y1, bw - cr, y1);
    if (close) { p.lineTo(-bw + cr, y1); }
    else {
      p.lineTo(neck, y1);
      p.quadraticCurveTo(hw, y1 + R * 0.12, hw, y1 + R * 0.6);
      p.lineTo(hw * 0.92, y1 + hl - hw);
      p.arc(0, y1 + hl - hw, hw * 0.92, 0, Math.PI);
      p.lineTo(-hw, y1 + R * 0.6);
      p.quadraticCurveTo(-hw, y1 + R * 0.12, -neck, y1);
      p.lineTo(-bw + cr, y1);
    }
    p.quadraticCurveTo(-bw, y1, -bw, y1 - cr);
    p.closePath();
  };

  const blade = new Path2D();
  edge(blade, true);
  const shape = new Path2D();
  edge(shape, false);

  // rejilla de ranuras: cada fila se angosta un poco hacia atras, como la pala
  const holes = new Path2D();
  const rows = 4, cols = 7;
  const top = y0 + L * 0.16, bottom = y1 - L * 0.13, rh = (bottom - top) / rows;
  for (let r = 0; r < rows; r++) {
    const yy = top + r * rh;
    const half = fw - (fw - bw) * ((yy + rh / 2 - y0) / L) - W * 0.11;
    const cw = (half * 2) / cols;
    for (let c = 0; c < cols; c++) {
      holes.roundRect(-half + c * cw + cw * 0.26, yy + rh * 0.12, cw * 0.48, rh * 0.76, cw * 0.24);
    }
  }
  // agujero para colgarla
  holes.moveTo(hw * 0.36, y1 + hl - hw * 1.7);
  holes.ellipse(0, y1 + hl - hw * 1.7, hw * 0.36, hw * 0.7, 0, 0, TAU);

  const cut = new Path2D();
  cut.addPath(shape);
  cut.addPath(holes);
  return { W, L, y0, y1, hw, hl, blade, shape, holes, cut };
}

function drawScoop(g, e, x, y, s, lift) {
  const R = e.R;
  if (!e.scoop) e.scoop = scoopPaths(R);
  const { W, y0, y1, hw, hl, blade, holes, cut } = e.scoop;

  g.save();
  g.translate(x, y);
  g.rotate(e.rot);
  g.scale(s, s);

  // sombra sobre la arena: se aleja y se suaviza al levantar la pala
  g.save();
  g.shadowColor = `rgba(12,8,3,${0.55 - lift * 0.15})`;
  g.shadowBlur = 8 + lift * 26;
  g.shadowOffsetX = 5 + lift * 22;
  g.shadowOffsetY = 7 + lift * 30;
  g.fillStyle = '#0b4b43';
  g.fill(cut, 'evenodd');
  g.restore();

  // plastico satinado con la luz entrando por la izquierda
  const plastic = g.createLinearGradient(-W / 2, 0, W / 2, 0);
  plastic.addColorStop(0, '#1a8475');
  plastic.addColorStop(0.35, '#11695d');
  plastic.addColorStop(1, '#0a4c43');
  g.fillStyle = plastic;
  g.fill(cut, 'evenodd');

  g.save();
  g.clip(cut, 'evenodd');
  // pared de la pala: un borde levantado mas claro y su sombra hacia adentro
  g.lineJoin = 'round';
  g.lineWidth = R * 0.3;
  g.strokeStyle = 'rgba(0,26,22,0.35)';
  g.stroke(blade);
  g.lineWidth = R * 0.16;
  g.strokeStyle = '#1b8a7a';
  g.stroke(blade);
  g.lineWidth = R * 0.035;
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.stroke(blade);
  // brillo largo del plastico
  const sheen = g.createLinearGradient(-W / 2, 0, W * 0.1, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.13)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(-W / 2, y0 - R, W, y1 + hl - y0 + R * 2);
  // nervio central del mango y agarre antideslizante
  g.lineCap = 'round';
  g.lineWidth = R * 0.06;
  g.strokeStyle = 'rgba(255,255,255,0.2)';
  g.beginPath(); g.moveTo(-R * 0.03, y1 + R * 0.5); g.lineTo(-R * 0.03, y1 + hl - hw * 2.8); g.stroke();
  g.strokeStyle = 'rgba(0,26,22,0.35)';
  g.beginPath(); g.moveTo(R * 0.04, y1 + R * 0.5); g.lineTo(R * 0.04, y1 + hl - hw * 2.8); g.stroke();
  g.lineWidth = R * 0.035;
  for (let i = 0; i < 6; i++) {
    const yy = y1 + hl * 0.42 + i * R * 0.2;
    g.strokeStyle = 'rgba(0,26,22,0.4)';
    g.beginPath(); g.moveTo(-hw * 0.6, yy); g.lineTo(hw * 0.6, yy); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.beginPath(); g.moveTo(-hw * 0.6, yy - R * 0.04); g.lineTo(hw * 0.6, yy - R * 0.04); g.stroke();
  }
  g.restore();

  // canto de las ranuras: el grosor del plastico
  g.lineWidth = R * 0.035;
  g.strokeStyle = 'rgba(0,22,18,0.75)';
  g.stroke(holes);
  g.restore();
}

// suelo alrededor del grumo: humedad, hueco y relleno
function drawGround(g, e, t) {
  const wetK = easeOut(clamp01(t / 1000));
  if (t < 2700) { wetTint(g, e, wetK); return; }
  // al sacar el grumo queda un hueco que la arena de alrededor vuelve a cubrir
  const fill = easeInOut(clamp01((t - 3300) / 900));
  g.save();
  g.clip(e.body);
  g.drawImage(FD.under, 0, 0, FD.w, FD.h);
  g.shadowColor = 'rgba(15,9,3,0.85)';
  g.shadowBlur = FD.u * 0.9;
  g.lineWidth = FD.u * 0.5;
  g.strokeStyle = 'rgba(15,9,3,0.6)';
  g.stroke(e.body);
  g.restore();
  if (fill > 0) {
    const hole = new Path2D();
    hole.addPath(e.body);
    hole.addPath(blobOf(e, 0.92 * (1 - fill)));
    g.save();
    g.clip(hole, 'evenodd');
    g.drawImage(FD.top, 0, 0, FD.w, FD.h);
    g.restore();
  }
  wetTint(g, e, 1 - fill);
}

// pala y grumo, encima de todo
function drawLifted(g, e, t) {
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
    drawScoop(g, e, sx, sy, 1 + lift * 0.14, lift);
  }
  if (t < 2700) {
    drawClump(g, e, pull, 0);
  } else if (scoopOn) {
    const s = 1 + lift * 0.14;
    g.save();
    g.translate(sx, sy);
    g.scale(s, s);
    g.translate(-e.x, -e.y);
    drawClump(g, e, 1, lift);
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
  grain(g, FD.w, FD.h, 0.12);
}

function fieldTick(now) {
  FD.events = FD.events.filter(e => now - e.t0 < EVENT_MS);
  drawField(now);
  FD.raf = FD.events.length ? requestAnimationFrame(fieldTick) : 0;
}

function randomClump(byUser) {
  const wide = !stacked.matches;
  for (let i = 0; i < 6; i++) {
    const x = FD.w * (wide ? 0.55 + Math.random() * 0.25 : 0.25 + Math.random() * 0.5);
    const y = FD.h * (wide ? 0.25 + Math.random() * 0.4 : 0.48 + Math.random() * 0.12);
    if (spawnClump(x, y, byUser)) return;
  }
}

fieldCanvas.addEventListener('pointerdown', e => {
  if (!FD.top) return;
  const rect = fieldCanvas.getBoundingClientRect();
  spawnClump(e.clientX - rect.left, e.clientY - rect.top, true);
});
$('#field-btn').addEventListener('click', () => { if (FD.top) randomClump(true); });

// demostracion automatica: un grumo nuevo cada pocos segundos
function autoClump() {
  clearTimeout(FD.auto);
  if (reduceMotion || !isActive(fieldSection)) return;
  if (FD.top && !FD.events.length && performance.now() - FD.lastUser > 5000) randomClump(false);
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
   4. EL CAMBIO: un arenero real donde LOVET se va sumando a
   su arena de siempre en tres pasos
   ========================================================= */
const MIX_STEPS = [
  // cada puñado cubre unas tres celdas: con 7% y 22% se ve un poco y casi la mitad
  { share: 0.07, label: 'un poco de LOVET mezclado con su arena habitual' },
  { share: 0.22, label: 'más LOVET que en el primer paso, mezclado con su arena habitual' },
  { share: 1, label: 'solo arena LOVET' }
];
const STEP_MS = 4200;
const mixCanvas = $('#mix-box');
const stepTabs = $$('.steps [role="tab"]');
const MX = { g: null, w: 0, h: 0, rect: null, flat: null, fg: null, lovet: null, layer: null, lg: null, mask: null, patches: [], share: 0.07, from: 0.07, t0: -1, raf: 0, step: 0, timer: 0, userPicked: false };

// arenero real (foto recortada, con su sombra) con arena comun gris de puntitos,
// y la mascara de la zona de arena donde se va sumando LOVET
const TRAY = new Image();
TRAY.src = 'assets/arenero.webp';
const TRAY_SAND = new Image();
TRAY_SAND.src = 'assets/arenero-arena.png';
const trayReady = () => [TRAY, TRAY_SAND].every(img => img.complete && img.naturalWidth > 0);
// superficie de la arena en la foto, en fracciones del ancho y alto:
// y del borde de atras y de adelante, y x de sus extremos izquierdo y derecho.
// Un poco mas grande que la arena real: la mascara recorta el borde exacto
const TRAY_SURFACE = { y0: 0.18, b0: 0.17, b1: 0.785, y1: 0.61, f0: 0.07, f1: 0.86 };

function setupMixBox() {
  MX.w = mixCanvas.clientWidth;
  MX.h = mixCanvas.clientHeight;
  if (!MX.w || !MX.h || !sandReady() || !trayReady()) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  MX.g = sizeCanvas(mixCanvas, MX.w, MX.h, 2);
  // la foto entra completa en el lienzo (como object-fit: contain)
  const s = Math.min(MX.w / TRAY.naturalWidth, MX.h / TRAY.naturalHeight);
  const dw = TRAY.naturalWidth * s, dh = TRAY.naturalHeight * s;
  MX.rect = { x: (MX.w - dw) / 2, y: (MX.h - dh) / 2, w: dw, h: dh };

  let g;
  [MX.mask, g] = offscreen(MX.w, MX.h, dpr);
  g.drawImage(TRAY_SAND, MX.rect.x, MX.rect.y, dw, dh);
  [MX.layer, MX.lg] = offscreen(MX.w, MX.h, dpr);

  // LOVET se arma visto desde arriba en un lienzo plano y luego se proyecta sobre la arena
  const S = TRAY_SURFACE;
  const FW = Math.round((S.f1 - S.f0) * dw), FH = Math.round((S.y1 - S.y0) * dh * 1.3);
  MX.fw = FW;
  MX.fh = FH;
  [MX.lovet, g] = offscreen(FW, FH, dpr);
  const grainR = SAND.grainR * drawSand(g, 0, 0, FW, FH, false, 1.15);
  [MX.flat, MX.fg] = offscreen(FW, FH, dpr);

  // LOVET entra en puñados: manchas de perlas que crecen y se juntan
  const rnd = seeded(77);
  const cols = 9, cell = FW / cols, rows = Math.ceil(FH / cell);
  MX.patches = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cx = (i + 0.5 + (rnd() - 0.5) * 0.35) * cell;
      const cy = (j + 0.5 + (rnd() - 0.5) * 0.35) * (FH / rows);
      // contorno relativo al centro, para poder escalar la mancha al crecer
      // borde irregular de puñado: bultos mas grandes que una perla sola
      MX.patches.push({ x: cx, y: cy, pts: clusterPoints(0, 0, cell * 0.95, grainR * 3, rnd), rank: rnd(), delay: rnd() * 0.5 });
    }
  }
  drawMix(performance.now());
}

// manchas de LOVET vistas desde arriba, sobre fondo transparente; devuelve si hay alguna
function drawFlat(now) {
  const g = MX.fg, { fw, fh } = MX;
  g.clearRect(0, 0, fw, fh);
  const k = MX.t0 < 0 ? 1 : clamp01((now - MX.t0) / 1300);
  const lovet = new Path2D();
  let any = false;
  for (const p of MX.patches) {
    const on = p.rank < MX.share, was = p.rank < MX.from;
    let sc = on ? 1 : 0;
    if (on !== was) {
      const local = easeOut(clamp01((k - p.delay) / 0.5));
      sc = on ? local : 1 - local;
    }
    if (sc < 0.02) continue;
    any = true;
    lovet.addPath(smoothPath(p.pts.map(([x, y]) => [p.x + x * sc, p.y + y * sc])));
  }
  if (!any) return false;
  // sombra suave de cada puñado sobre la arena comun
  g.save();
  g.shadowColor = 'rgba(20,18,16,0.55)';
  g.shadowBlur = fw * 0.012;
  g.shadowOffsetY = fw * 0.004;
  g.fillStyle = '#b7aea4';
  g.fill(lovet);
  g.restore();
  g.save();
  g.clip(lovet);
  g.drawImage(MX.lovet, 0, 0, fw, fh);
  g.restore();
  return true;
}

function drawMix(now) {
  const g = MX.g;
  if (!g) return;
  const { w, h, rect } = MX;
  g.clearRect(0, 0, w, h);
  g.drawImage(TRAY, rect.x, rect.y, rect.w, rect.h);
  if (!drawFlat(now)) return;

  // proyeccion por franjas: cada franja del lienzo plano ocupa el ancho de la arena a esa profundidad
  const S = TRAY_SURFACE, lg = MX.lg;
  const y0 = rect.y + S.y0 * rect.h, y1 = rect.y + S.y1 * rect.h;
  const strips = Math.ceil(y1 - y0);
  lg.globalCompositeOperation = 'source-over';
  lg.clearRect(0, 0, w, h);
  for (let i = 0; i < strips; i++) {
    const v = i / strips;
    const left = rect.x + (S.b0 + (S.f0 - S.b0) * v) * rect.w;
    const right = rect.x + (S.b1 + (S.f1 - S.b1) * v) * rect.w;
    lg.drawImage(MX.flat, 0, v * MX.flat.height, MX.flat.width, MX.flat.height / strips, left, y0 + i, right - left, 1.6);
  }
  // misma luz que la foto: el fondo de la arena queda bajo la sombra de la pared
  lg.globalCompositeOperation = 'source-atop';
  const depth = lg.createLinearGradient(0, y0, 0, y1);
  depth.addColorStop(0, 'rgba(25,22,20,0.4)');
  depth.addColorStop(0.3, 'rgba(25,22,20,0.08)');
  depth.addColorStop(1, 'rgba(25,22,20,0)');
  lg.fillStyle = depth;
  lg.fillRect(0, 0, w, h);
  // solo dentro de la arena del arenero
  lg.globalCompositeOperation = 'destination-in';
  lg.drawImage(MX.mask, 0, 0, w, h);
  lg.globalCompositeOperation = 'source-over';
  g.drawImage(MX.layer, 0, 0, w, h);
}

function mixTick(now) {
  drawMix(now);
  MX.raf = now - MX.t0 < 1350 ? requestAnimationFrame(mixTick) : 0;
}

function setMixStep(i, byUser) {
  const step = MIX_STEPS[i];
  MX.from = MX.share;
  MX.share = step.share;
  MX.step = i;
  MX.t0 = reduceMotion ? -1 : performance.now();
  if (reduceMotion) drawMix(performance.now());
  else if (!MX.raf) MX.raf = requestAnimationFrame(mixTick);

  stepTabs.forEach((tab, j) => {
    tab.setAttribute('aria-selected', String(j === i));
    tab.tabIndex = j === i ? 0 : -1;
  });
  $('#mix-panel').setAttribute('aria-labelledby', stepTabs[i].id);
  mixCanvas.setAttribute('aria-label', `Caja de arena con ${step.label}.`);

  if (byUser) {
    MX.userPicked = true;
    stopMixAuto();
  }
  // reinicia la barrita de avance de la tarjeta activa
  const steps = $('.steps');
  steps.classList.remove('is-playing');
  if (!MX.userPicked && !reduceMotion && MX.timer) {
    steps.getBoundingClientRect();
    steps.classList.add('is-playing');
  }
}

function startMixAuto() {
  stopMixAuto();
  if (MX.userPicked || reduceMotion) return;
  $('.steps').classList.add('is-playing');
  MX.timer = setInterval(() => setMixStep((MX.step + 1) % MIX_STEPS.length, false), STEP_MS);
}
function stopMixAuto() {
  clearInterval(MX.timer);
  MX.timer = 0;
  $('.steps').classList.remove('is-playing');
}

stepTabs.forEach((tab, i) => {
  tab.addEventListener('click', () => setMixStep(i, true));
  tab.addEventListener('keydown', e => {
    const move = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!move) return;
    e.preventDefault();
    const next = (i + move + stepTabs.length) % stepTabs.length;
    setMixStep(next, true);
    stepTabs[next].focus();
  });
});

/* =========================================================
   5. DONDE COMPRAR: mapa con los puntos de venta
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
    storeList.appendChild(el('p', 'stores__empty', `No encontramos puntos de venta para “${storeQuery.value.trim()}”. Prueba con otro distrito o tienda.`));
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
    const wide = !stacked.matches;
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
  const wide = !stacked.matches;
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
   6. CONTACTO
   ========================================================= */
const contactForm = $('#contact-form');
const contactDone = $('#contact-done');
const MAIL_TO = 'marketingpets@solvet.com.pe';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHECKED = ['c-name', 'c-mail', 'c-phone', 'c-ruc', 'c-msg'];

function setError(id, msg) {
  const input = $(`#${id}`);
  input.closest('.field').classList.toggle('has-error', Boolean(msg));
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  $(`#${id}-err`).textContent = msg;
}

function checkField(id) {
  const v = $(`#${id}`).value.trim();
  if (id === 'c-name') setError(id, v ? '' : 'Escribe tu nombre completo.');
  if (id === 'c-mail') setError(id, EMAIL_RE.test(v) ? '' : 'Escribe un correo válido, por ejemplo nombre@correo.com.');
  if (id === 'c-phone') setError(id, !v || /^(\+?51)?\d{7,9}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Escribe un número válido, por ejemplo 987 654 321.');
  if (id === 'c-ruc') setError(id, !v || /^\d{11}$/.test(v) ? '' : 'El RUC tiene 11 dígitos, por ejemplo 20123456789.');
  if (id === 'c-msg') setError(id, v ? '' : 'Cuéntanos en qué te podemos ayudar.');
}

// sin servidor: el envio abre el correo del visitante con el mensaje listo para LOVET
contactForm.addEventListener('submit', e => {
  e.preventDefault();
  CHECKED.forEach(checkField);
  const firstBad = contactForm.querySelector('[aria-invalid="true"]');
  if (firstBad) { firstBad.focus(); return; }
  const val = id => $(`#${id}`).value.trim();
  const name = val('c-name'), biz = val('c-biz'), who = val('c-who');
  const lines = [
    `Nombre completo: ${name}`,
    biz && `Nombre comercial: ${biz}`,
    `Correo: ${val('c-mail')}`,
    val('c-phone') && `Número: ${val('c-phone')}`,
    val('c-place') && `Distrito / Provincia: ${val('c-place')}`,
    val('c-ruc') && `RUC: ${val('c-ruc')}`,
    `¿Quién nos escribe?: ${who}`,
    '',
    val('c-msg')
  ].filter(line => typeof line === 'string');
  const subject = `Contacto web LOVET: ${who}${biz ? ` (${biz})` : ''}`;
  window.location.href = `mailto:${MAIL_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\r\n'))}`;
  $('#contact-done-text').textContent = `Gracias, ${name}. Abrimos tu programa de correo con el mensaje para ${MAIL_TO}: solo falta que lo envíes. Si no se abrió, escríbenos directamente a esa dirección.`;
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

setMixStep(0, false);
renderStores();
window.addEventListener('load', () => {
  chooseMode();
  setupAll();
});
[SAND, SAND_BAG, TRAY, TRAY_SAND].forEach(img => img.addEventListener('load', () => { if (document.readyState === 'complete') setupAll(); }));

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(setupAll, 150);
});
