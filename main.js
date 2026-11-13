// LOVET - interacciones de la pagina
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
// ruta de las imagenes: junto a la pagina, o la carpeta del tema en WordPress (window.LOVET_BASE)
const asset = path => (window.LOVET_BASE || '') + path;
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
const SAND = texture(asset('assets/arena-lovet.jpg'), 6);          // "Toca la arena" y el arenero
const SAND_BAG = texture(asset('assets/arena-lovet-bolsa.jpg'), 8); // dentro de la bolsa
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
  B.R = Math.min(150, B.w * 0.29);
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
   y la pala de LOVET entra a sacarlo. Solo pasa cuando el
   visitante toca la arena, y de a un grumo por vez.
   ========================================================= */
const fieldSection = $('#tocala');
const fieldCanvas = $('#field');
const FD = { g: null, w: 0, h: 0, r: 6, u: 20, under: null, top: null, vignette: null, events: [], raf: 0, busyUntil: 0 };
const TAU = Math.PI * 2;
const EVENT_MS = 4600;
// la pala sale de la pantalla a los 4 s; recien ahi se puede formar otro grumo
const NEXT_CLUMP_MS = 4300;

// foto de la pala real de LOVET (fondo y ranuras transparentes), con la hoja a la izquierda y el mango a la derecha
const SCOOP = new Image();
SCOOP.src = asset('assets/pala-lovet.webp');
// centro y ancho de la hoja en la foto, en px de la foto
const SCOOP_BLADE = { x: 415, y: 340, w: 681 };

function setupField() {
  FD.w = fieldSection.clientWidth;
  FD.h = fieldSection.clientHeight;
  if (!FD.w || !FD.h || !sandReady() || !loaded(SCOOP)) return;
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

function spawnClump(x, y) {
  const now = performance.now();
  if (now < FD.busyUntil) return false;
  const R = FD.u * (3.8 + Math.random() * 0.6);
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
  FD.busyUntil = now + NEXT_CLUMP_MS;
  fieldCanvas.classList.add('is-busy');
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

/* la pala real de LOVET vista desde arriba: la hoja centrada en (x, y) y el mango
   hacia afuera de la pantalla, en la direccion por la que entra */
function drawScoop(g, e, x, y, s, lift) {
  const k = (e.R * 3) / SCOOP_BLADE.w; // la hoja mide 3 veces el radio del grumo
  g.save();
  g.translate(x, y);
  g.rotate(e.rot);
  g.scale(s, s);
  g.rotate(Math.PI / 2); // en la foto el mango va a la derecha; aqui apunta hacia +y
  // sombra sobre la arena: se aleja y se suaviza al levantar la pala
  g.shadowColor = `rgba(12,8,3,${0.55 - lift * 0.15})`;
  g.shadowBlur = 8 + lift * 26;
  g.shadowOffsetX = 5 + lift * 22;
  g.shadowOffsetY = 7 + lift * 30;
  g.drawImage(SCOOP, -SCOOP_BLADE.x * k, -SCOOP_BLADE.y * k, SCOOP.naturalWidth * k, SCOOP.naturalHeight * k);
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
  if (now >= FD.busyUntil) fieldCanvas.classList.remove('is-busy');
  drawField(now);
  FD.raf = FD.events.length ? requestAnimationFrame(fieldTick) : 0;
}

// el boton forma un grumo en una zona despejada de la arena (lejos del texto)
function randomClump() {
  const wide = !stacked.matches;
  const x = FD.w * (wide ? 0.55 + Math.random() * 0.25 : 0.25 + Math.random() * 0.5);
  const y = FD.h * (wide ? 0.25 + Math.random() * 0.4 : 0.48 + Math.random() * 0.12);
  spawnClump(x, y);
}

fieldCanvas.addEventListener('pointerdown', e => {
  if (!FD.top) return;
  const rect = fieldCanvas.getBoundingClientRect();
  spawnClump(e.clientX - rect.left, e.clientY - rect.top);
});
$('#field-btn').addEventListener('click', () => { if (FD.top) randomClump(); });

/* =========================================================
   4. EL CAMBIO: un arenero real donde LOVET se va sumando a
   su arena de siempre en tres pasos
   ========================================================= */
const MIX_STEPS = [
  // share: parte de la arena que ya es LOVET; pour: donde se vierte, en fracciones de la superficie
  { share: 0.25, pour: [0.36, 0.5], label: 'un poco de LOVET mezclado con su arena habitual' },
  { share: 0.55, pour: [0.64, 0.42], label: 'más LOVET que en el primer paso, mezclado con su arena habitual' },
  { share: 1, pour: [0.5, 0.56], label: 'solo arena LOVET' }
];
const STEP_MS = 5200;
// tiempos de un cambio (ms): se vierte, se forma un monticulo y se revuelve hasta mezclar
const POUR_MS = 1100, MIX_FROM = 900, MIX_MS = 1700, MIX_END = MIX_FROM + MIX_MS;
const mixCanvas = $('#mix-box');
const stepTabs = $$('.steps [role="tab"]');
const MX = { g: null, w: 0, h: 0, rect: null, flat: null, fg: null, lovet: null, layer: null, lg: null, mask: null, share: 0.25, from: 0.25, pour: null, t0: -1, raf: 0, step: 0, timer: 0, userPicked: false, drops: [] };

// arenero real (foto recortada, con su sombra) con arena comun gris de puntitos,
// y la mascara de la zona de arena donde se va sumando LOVET
const TRAY = new Image();
TRAY.src = asset('assets/arenero.webp');
const TRAY_SAND = new Image();
TRAY_SAND.src = asset('assets/arenero-arena.png');
const trayReady = () => [TRAY, TRAY_SAND].every(img => img.complete && img.naturalWidth > 0);
// superficie de la arena en la foto, en fracciones del ancho y alto:
// y del borde de atras y de adelante, y x de sus extremos izquierdo y derecho.
// Un poco mas grande que la arena real: la mascara recorta el borde exacto
const TRAY_SURFACE = { y0: 0.18, b0: 0.17, b1: 0.785, y1: 0.61, f0: 0.07, f1: 0.86 };

// ruido suave en una grilla: base de la mezcla grano a grano
function valueNoise(w, h, cell, rnd) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const grid = Float32Array.from({ length: gw * gh }, () => rnd());
  const out = new Float32Array(w * h);
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    const gy = y / cell, iy = Math.floor(gy), ty = sm(gy - iy);
    for (let x = 0; x < w; x++) {
      const gx = x / cell, ix = Math.floor(gx), tx = sm(gx - ix);
      const a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1];
      const c = grid[(iy + 1) * gw + ix], d = grid[(iy + 1) * gw + ix + 1];
      out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

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
  // la mezcla se calcula pixel a pixel en cada cuadro: a 1,5x basta y va fluida en celulares
  const fdpr = Math.min(dpr, 1.5);
  [MX.lovet, g] = offscreen(FW, FH, fdpr);
  const grainR = SAND.grainR * drawSand(g, 0, 0, FW, FH, false, 1.15);
  [MX.flat, MX.fg] = offscreen(FW, FH, fdpr);
  const pw = MX.flat.width, ph = MX.flat.height, k = pw / FW;
  MX.lovetPx = g.getImageData(0, 0, pw, ph).data;
  MX.img = MX.fg.createImageData(pw, ph);

  // mezcla: manchitas del tamaño de una o dos perlas, repartidas de forma irregular
  const rnd = seeded(77);
  const fine = valueNoise(pw, ph, Math.max(2, grainR * k * 1.7), rnd);
  const coarse = valueNoise(pw, ph, grainR * k * 9, rnd);
  MX.noise = fine.map((v, i) => v * 0.7 + coarse[i] * 0.3);
  // umbral de cada proporcion: con estos valores se ve exactamente esa parte de LOVET
  MX.sorted = Float32Array.from(MX.noise).sort();
  drawMix(performance.now());
}
const shareLimit = share => (share >= 1 ? 2 : share <= 0 ? -1 : MX.sorted[Math.floor(share * (MX.sorted.length - 1))]);

// punto de la superficie plana (px del lienzo plano) -> punto del arenero en pantalla
function project(fx, fy) {
  const S = TRAY_SURFACE, r = MX.rect;
  const v = fy / MX.fh;
  const left = r.x + (S.b0 + (S.f0 - S.b0) * v) * r.w;
  const right = r.x + (S.b1 + (S.f1 - S.b1) * v) * r.w;
  return [left + (fx / MX.fw) * (right - left), r.y + (S.y0 + (S.y1 - S.y0) * v) * r.h];
}

// estado del cambio en el instante t (ms desde que empezo)
function mixState(t) {
  const back = MX.share < MX.from; // volver a un paso anterior: la mezcla se aclara sin verter
  if (MX.t0 < 0 || back) {
    const k = MX.t0 < 0 ? 1 : easeInOut(clamp01(t / 700));
    return { spread: 1, k, mound: 0, back };
  }
  const pour = easeOut(clamp01(t / POUR_MS));
  const mix = easeInOut(clamp01((t - MIX_FROM) / MIX_MS));
  // el monticulo crece mientras se vierte y desaparece al revolver
  const mound = pour * (1 - easeInOut(clamp01((t - MIX_FROM - 200) / (MIX_MS - 400))));
  return { spread: mix, k: 1, mound, back };
}

// LOVET visto desde arriba: grano a grano segun la proporcion, mas el monticulo recien vertido
function drawFlat(now) {
  const t = now - MX.t0;
  const st = mixState(t);
  const img = MX.img, out = img.data, src = MX.lovetPx, noise = MX.noise;
  const pw = MX.flat.width, ph = MX.flat.height, k = pw / MX.fw;
  const lo = shareLimit(st.back ? MX.share + (MX.from - MX.share) * (1 - st.k) : MX.from);
  const hi = shareLimit(MX.share);
  const [px, py] = MX.pour ? [MX.pour[0] * pw, MX.pour[1] * ph] : [pw / 2, ph / 2];
  // la mezcla avanza desde donde se vertio hasta cubrir toda la caja
  const reach = Math.hypot(Math.max(px, pw - px), Math.max(py, ph - py));
  const front = st.spread * (reach + pw * 0.25), band = pw * 0.25;
  const moundR = st.mound * pw * 0.13;
  const eps = 0.012;
  let any = false;
  for (let y = 0, i = 0; y < ph; y++) {
    const dy = (y - py) * 1.6; // la superficie se ve en perspectiva: mas corta de adelante hacia atras
    for (let x = 0; x < pw; x++, i++) {
      const d = Math.hypot(x - px, dy);
      let limit = lo;
      if (!st.back && hi > lo) {
        const p = clamp01((front - d) / band);
        if (p > 0) limit = lo + (hi - lo) * p;
      } else if (st.back) limit = lo;
      let a = clamp01((limit - noise[i]) / eps + 0.5);
      // monticulo: todo LOVET, con borde granulado
      if (moundR > 0) {
        const m = clamp01((moundR - d + (noise[i] - 0.5) * moundR * 0.6) / 2);
        if (m > a) a = m;
      }
      const o = i * 4;
      if (a <= 0) { out[o + 3] = 0; continue; }
      any = true;
      out[o] = src[o]; out[o + 1] = src[o + 1]; out[o + 2] = src[o + 2];
      out[o + 3] = a * 255;
    }
  }
  const g = MX.fg;
  g.putImageData(img, 0, 0);
  if (moundR > 1) {
    // volumen del monticulo: luz arriba a la izquierda, sombra en el borde de abajo
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const cx = px - moundR * 0.25, cy = py - moundR * 0.35;
    const shade = g.createRadialGradient(cx, cy, moundR * 0.1, px, py, moundR * 1.15);
    shade.addColorStop(0, `rgba(255,250,240,${0.22 * st.mound})`);
    shade.addColorStop(0.55, 'rgba(255,250,240,0)');
    shade.addColorStop(0.85, `rgba(40,30,20,${0.28 * st.mound})`);
    shade.addColorStop(1, 'rgba(40,30,20,0)');
    g.fillStyle = shade;
    g.beginPath();
    g.ellipse(px, py, moundR * 1.2, moundR * 1.2 / 1.6, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  return any;
}

// perlas que caen desde arriba mientras se vierte
function updateDrops(g, t) {
  if (MX.t0 < 0 || MX.share <= MX.from || !MX.pour) { MX.drops.length = 0; return; }
  const [tx, ty] = project(MX.pour[0] * MX.fw, MX.pour[1] * MX.fh);
  const fall = Math.max(ty - 4, 40), dur = 420; // ms que tarda una perla en caer
  const size = Math.max(1.6, MX.rect.w / 260);
  // nuevas perlas mientras dura el chorro
  while (MX.nextDrop <= Math.min(t, POUR_MS - dur * 0.6)) {
    MX.drops.push({ t0: MX.nextDrop, dx: (Math.random() - 0.5) * size * 5, land: (Math.random() - 0.5) * size * 10, r: size * (0.8 + Math.random() * 0.6), tone: 205 + Math.random() * 40 });
    MX.nextDrop += 9;
  }
  for (const d of MX.drops) {
    const p = (t - d.t0) / dur;
    if (p < 0 || p > 1) continue;
    const x = tx + d.dx * (1 - p) + d.land * p, y = ty - fall * (1 - p * p);
    const c = d.tone;
    g.fillStyle = `rgb(${c},${c - 8},${c - 22})`;
    g.beginPath();
    g.arc(x, y, d.r, 0, TAU);
    g.fill();
  }
}

function drawMix(now) {
  const g = MX.g;
  if (!g) return;
  const { w, h, rect } = MX;
  g.clearRect(0, 0, w, h);
  g.drawImage(TRAY, rect.x, rect.y, rect.w, rect.h);
  if (drawFlat(now)) {
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
  updateDrops(g, now - MX.t0);
}

function mixTick(now) {
  drawMix(now);
  const busy = MX.share < MX.from ? 750 : MIX_END + 50;
  MX.raf = now - MX.t0 < busy ? requestAnimationFrame(mixTick) : 0;
}

// cambia la proporcion de LOVET en el arenero; desde un paso anterior se vierte y se revuelve
function animateMix(from, i) {
  MX.from = from;
  MX.share = MIX_STEPS[i].share;
  MX.pour = MIX_STEPS[i].pour;
  MX.drops = [];
  MX.nextDrop = 0;
  MX.t0 = reduceMotion ? -1 : performance.now();
  if (reduceMotion) drawMix(performance.now());
  else if (!MX.raf) MX.raf = requestAnimationFrame(mixTick);
}

function setMixStep(i, byUser) {
  const step = MIX_STEPS[i];
  animateMix(MX.share, i);
  MX.step = i;

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
  // al llegar a la seccion se ve el primer cambio desde la arena de siempre
  if (MX.step === 0 && MX.g) animateMix(0, 0);
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
// puntos de venta de LOVET (lista de distribución de Solpet). Coordenadas ubicadas por número de puerta con
// OpenStreetMap; "Cómo llegar" abre Google Maps con el nombre y la dirección.
// [nombre comercial, logo, distrito, dirección, lat, lng, vende online]; sin dirección = tienda solo online;
// sin coordenadas = local sin número de puerta: sale en la lista con "Cómo llegar", sin pin
const WEB = true;
const STORES = [
  ['Miushop', 'miushop', 'Santiago de Surco', 'Av. Caminos del Inca 1685', -12.12695, -76.98174, WEB],
  ['Wasi Pet', 'wasi-pet', 'San Miguel', 'Av. Brígida Silva de Ochoa 210', -12.08218, -77.08886],
  ['Royal Pet', 'royal-pet', 'Lince', 'Av. General Trinidad Morán 417', -12.08950, -77.03665],
  ['Brisa Petshop', 'brisa', 'Magdalena del Mar', 'Av. Javier Prado Oeste 205', -12.09079, -77.06533, WEB],
  ['Brisa Petshop', 'brisa', 'Santiago de Surco', 'Av. Caminos del Inca 848', -12.11917, -76.98852, WEB],
  ['Mundo Pet', 'mundo-pet', 'Magdalena del Mar', 'Jr. Castilla 778', -12.08978, -77.07317],
  ['Veterinaria San Felipe / Peluvet', 'san-felipe', 'Jesús María', 'Av. Faustino Sánchez Carrión 1051', -12.09124, -77.05579, WEB],
  ['Veterinaria San Felipe / Peluvet', 'san-felipe', 'San Miguel', 'Av. De Los Precursores 538', -12.06954, -77.09375, WEB],
  ['Veterinaria San Felipe / Peluvet', 'san-felipe', 'San Miguel', 'Av. Lima 679', -12.08855, -77.08064, WEB],
  ['Veterinaria San Felipe / Peluvet', 'san-felipe', 'Los Olivos', 'Asentamiento San Martín', undefined, undefined, WEB],
  ['Gatuario', 'gatuario', 'San Isidro', 'Calle Baltazar La Torre 1115', -12.10465, -77.05787, WEB],
  ['Gatuario', 'gatuario', 'Santiago de Surco', 'Av. Paseo La Castellana 191', -12.13051, -77.00176, WEB],
  ['+Kotas', 'mas-kotas', 'Breña', 'Jr. Carhuaz 514', -12.05383, -77.04809],
  ['Miau 100% Gatos', '100-miau-gatos', 'Miraflores', 'Calle José Toribio Polo 511', -12.11238, -77.04630, WEB],
  ['Top Can', 'top-can', 'La Victoria', 'Jr. Agustín Gamarra 1133', -12.06986, -77.01266],
  ['Nekohome', 'neko-home', 'Santiago de Surco', 'Jr. Morro Solar 1252', -12.13020, -76.97720],
  ['Monivet', 'monivet', 'Santiago de Surco', 'Calle Loma Ponciana 164', -12.13472, -76.98624, WEB],
  ['T&M Pet Style', 'tm-petshop', 'Lince', 'Av. Coronel José Leal 210', -12.08390, -77.03650, WEB],
  ['T&M Pet Style', 'tm-petshop', 'Santiago de Surco', 'Calle Las Retamas 100', -12.15087, -77.00782, WEB],
  ['Mr. Pet', 'mr-pet', 'La Molina', 'Calle Samoa 328', -12.08304, -76.89805],
  ['Pets Canada', 'pets-canada', 'La Victoria', 'Av. Canadá 1537', -12.08430, -77.00703],
  ['Patmo', 'patmo', 'Tiendas online'],
  ['Animalia Petstore', 'animalia', 'Tiendas online']
].map(([name, logo, district, addr, lat, lng, web], id) => ({
  id, name, logo: logo && asset(`assets/logos/${logo}.webp`), district, online: !addr,
  addr: addr || 'Venta online con delivery', web: !!web, lat, lng
}));
const ONLINE = 'Tiendas online';
const onMap = list => list.filter(s => s.lat !== undefined);

const storeList = $('#store-list');
const storeCount = $('#store-count');
const storeQuery = $('#store-q');
const nearBtn = $('#near-me');
let map = null, mapReady = false, selectedId = null, userPos = null, popup = null, meMarker = null;

const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const directionsUrl = s => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.name}, ${s.addr}, ${s.district}, Lima, Perú`)}`;

function distanceKm(a, b) {
  const rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const distanceText = km => (km < 1 ? `a ${Math.round(km * 100) * 10} m` : `a ${decimal(Math.round(km * 10) / 10)} km`);

function visibleStores() {
  const q = normalize(storeQuery.value);
  let list = STORES.filter(s => !q || normalize(`${s.name} ${s.district} ${s.addr}${s.web || s.online ? ' online' : ''}`).includes(q));
  if (userPos) list = list.map(s => (s.lat === undefined ? s : { ...s, km: distanceKm(userPos, s) })).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
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
  // las tiendas online van al final de la lista
  if (districts.includes(ONLINE)) districts.push(districts.splice(districts.indexOf(ONLINE), 1)[0]);
  const shops = list.filter(s => !s.online), online = list.length - shops.length;
  const shopDistricts = new Set(shops.map(s => s.district)).size;
  storeCount.textContent = list.length
    ? [
        shops.length ? `${plural(shops.length, 'punto de venta', 'puntos de venta')} en ${plural(shopDistricts, 'distrito', 'distritos')}` : '',
        online ? plural(online, 'tienda online', 'tiendas online') : ''
      ].filter(Boolean).join(' y ') + (userPos && shops.length ? ', del más cercano al más lejano.' : '.')
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
      const pick = el('button', 'store__pick');
      pick.type = 'button';
      pick.appendChild(el('span', 'store__name', s.name));
      pick.appendChild(el('span', 'store__addr', s.addr));
      if (s.web) pick.appendChild(el('span', 'store__note', 'También vende online'));
      if (s.km !== undefined) pick.appendChild(el('span', 'store__dist', distanceText(s.km)));
      row.append(storeLogo(s), pick);
      if (s.online) {
        row.classList.add('store--online');
        pick.disabled = true;
      } else {
        const go = el('a', 'store__go', 'Cómo llegar');
        go.href = directionsUrl(s);
        go.target = '_blank';
        go.rel = 'noopener';
        go.setAttribute('aria-label', `Cómo llegar a ${s.name}, ${s.addr}`);
        row.append(go);
        if (s.lat === undefined) {
          row.classList.add('store--nopin');
          pick.disabled = true;
        } else {
          row.addEventListener('click', e => {
            if (e.target.closest('a')) return;
            selectStore(s.id, true);
          });
        }
      }
      storeList.appendChild(row);
    });
  });

  if (mapReady) {
    map.getSource('stores').setData(toGeoJSON(list));
  }
}

// logo de la tienda; si aún no tenemos su logo, sus iniciales
function storeLogo(s) {
  const box = el('span', 'store__logo');
  if (s.logo) {
    const img = el('img');
    img.src = s.logo;
    img.alt = '';
    img.loading = 'lazy';
    img.width = img.height = 200;
    box.appendChild(img);
  } else {
    box.classList.add('store__logo--initials');
    box.textContent = s.name.split(' ').slice(0, 2).map(w => w[0]).join('');
  }
  return box;
}

function toGeoJSON(list) {
  return {
    type: 'FeatureCollection',
    features: onMap(list).map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { id: s.id } }))
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
  const go = el('a', '', 'Cómo llegar');
  go.href = directionsUrl(s);
  go.target = '_blank';
  go.rel = 'noopener';
  box.append(storeLogo(s), el('strong', '', s.name), el('span', '', `${s.addr}, ${s.district}.${s.web ? ' También vende online.' : ''}`), go);
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
        // nombres en español (el estilo base prefiere el nombre en inglés: "West Javier Prado Avenue")
        if (JSON.stringify(l.layout['text-field']).includes('name_en')) {
          map.setLayoutProperty(id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name_en']]);
        }
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
  list = onMap(list);
  if (!list.length) return;
  const bounds = new maplibregl.LngLatBounds();
  list.forEach(s => bounds.extend([s.lng, s.lat]));
  const wide = !stacked.matches;
  const padding = wide
    ? { top: 110, bottom: 50, left: Math.min(520, window.innerWidth * 0.4), right: 300 }
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
    const nearest = onMap(visibleStores())[0];
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
  if (id === 'cambio') startMixAuto();
  if (id === 'donde') initMap();
}

function leaveSection(i) {
  const id = pages[i].id;
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
[SAND, SAND_BAG, SCOOP, TRAY, TRAY_SAND].forEach(img => img.addEventListener('load', () => { if (document.readyState === 'complete') setupAll(); }));

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(setupAll, 150);
});
