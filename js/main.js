'use strict';

/* =====================================================================
   CONFIG — ปรับค่าทั้งหมดได้ที่นี่
   ===================================================================== */
const CONFIG = {
  // สี
  colors:      ['#ffb3d9', '#ff80bf', '#ff4da6', '#ffd6ec'], // สีจุดของตัวเค้ก
  flameColors: ['#ffffff', '#fff0f7', '#ffd6ec', '#ffc2e0'], // สีเปลวไฟ / ประกาย
  colorJitter: 14,          // สุ่มเฉดเพิ่ม/ลด (0–255) ต่อ sprite

  // จำนวนจุด
  areaPerParticle: 42,      // พื้นที่เค้ก (px²) ต่อ 1 จุด — น้อย = แน่นขึ้น
  minParticles: 1500,
  maxParticles: 3000,
  maxParticlesMobile: 2000, // อุปกรณ์จอสัมผัส
  flameRatio: 0.06,         // สัดส่วนจุดที่เป็นเปลวไฟ
  ambientCount: 70,         // จุดดาวจางๆ บนพื้นหลัง
  sparkCount: 28,           // ประกายที่ลอยขึ้นจากเปลวเทียน

  // ลักษณะจุด
  sizeMin: 1.5,             // เส้นผ่านศูนย์กลาง (px)
  sizeMax: 4,
  alphaMin: 0.45,
  alphaMax: 1,
  glow: 3.2,                // ขนาด glow เทียบกับขนาดจุด

  // ขนาดเค้กบนจอ
  cakeWidthRatio: 0.82,
  cakeHeightRatio: 0.92,    // สัดส่วนของพื้นที่ที่เหลือหลังหักหัวข้อ/ปุ่ม
  topReserve: 0.16,         // สัดส่วนความสูงจอด้านบนที่เว้นไว้ให้ข้อความอวยพร
  bottomReserve: 104,       // px ด้านล่างที่เว้นไว้ให้ปุ่มควบคุม

  // เทียน
  flameOutDuration: 900,    // ms เปลวไฟปลิวหาย
  relightDuration: 700,     // ms เปลวไฟงอกกลับจากไส้เทียน
  smokeDuration: 2600,      // ms ปล่อยควันหลังเทียนดับ
  smokeMax: 50,

  // Animation
  introDuration: 2000,      // ms รวมตัวเป็นเค้กตอนโหลด
  introStagger: 450,        // ms หน่วงแบบสุ่มต่อจุด
  idleAmplitude: 1.2,       // px ระยะไหวรอบตำแหน่งเดิม
  idleSpeed: 1.4,
  breathe: 0.012,           // เค้ก "หายใจ" (สเกล ±1.2%)

  // จุดหลุดลอยที่ขอบขวาบน
  driftRatio: 0.12,         // 12% ของจุดตัวเค้ก
  driftDistance: [30, 140], // หน่วยในพิกัดเค้ก (คูณสเกลอัตโนมัติ)
  driftPeriod: [6, 12],     // วินาทีต่อรอบ

  // Physics
  spring: 0.06,             // แรงดึงกลับตำแหน่ง
  damping: 0.86,            // แรงหน่วง (ยิ่งน้อยยิ่งหยุดเร็ว)
  mouseRadius: 90,          // px
  mouseForce: 2.2,
  rippleSpeed: 900,         // px/s ความเร็วระลอก
  rippleWidth: 70,          // px ความหนาของระลอก
  rippleForce: 6,
  rippleLife: 1.4,          // วินาที

  // Performance
  maxDPR: 2,
  adaptivePerf: true,       // ลดจำนวนจุดเองถ้า fps ตก
};

/* =====================================================================
   Utilities
   ===================================================================== */
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const white = a => `rgba(255,255,255,${a})`;

// seeded RNG: รูปทรงเค้ก (หยดครีม/เม็ดน้ำตาล) จะเหมือนเดิมทุกครั้งที่ resize
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* =====================================================================
   State
   ===================================================================== */
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarseMQ = window.matchMedia('(pointer: coarse)');

const state = {
  w: 0, h: 0, dpr: 1,
  layout: null,
  particles: [],
  sparks: [],
  ambient: [],
  ripples: [],
  sprites: [],
  flameSprites: [],
  smokeSprites: [],
  smoke: [],
  smokeUntil: 0,
  flame: { lit: true, changedAt: -1e9 },
  flameLevel: 1,                  // 0 = ดับสนิท, 1 = ติดเต็มที่ (คำนวณใน update)
  wind: { value: 0, target: 0 },  // ระดับเสียงไมค์ 0–1 ทำให้เปลวไฟไหว
  pointer: { x: -9999, y: -9999, active: false },
  reduced: reduceMQ.matches,
  introStart: 0,
  introDone: false,
  rafId: 0,
  lastTime: 0,
  perf: { ema: 16.7, frames: 0, trims: 0 },
};

/* =====================================================================
   Glow sprites — เรนเดอร์ครั้งเดียว ถูกกว่า shadowBlur มาก
   ===================================================================== */
function makeSprite(rgb) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const [r, gr, b] = rgb;
  const core = `rgb(${(r + 255) >> 1},${(gr + 255) >> 1},${(b + 255) >> 1})`;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, core);
  grad.addColorStop(0.2, `rgba(${r},${gr},${b},1)`);
  grad.addColorStop(0.32, `rgba(${r},${gr},${b},0.38)`);
  grad.addColorStop(0.6, `rgba(${r},${gr},${b},0.1)`);
  grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function buildSprites() {
  const variants = (list) => {
    const out = [];
    for (const hex of list) {
      const base = hexToRgb(hex);
      for (let i = 0; i < 3; i++) {
        const j = CONFIG.colorJitter;
        out.push(makeSprite(base.map(v => clamp(Math.round(v + rand(-j, j)), 0, 255))));
      }
    }
    return out;
  };
  state.sprites = variants(CONFIG.colors);
  state.flameSprites = variants(CONFIG.flameColors);
  state.smokeSprites = variants(['#a89bbd', '#cfc4dd']);
}

/* =====================================================================
   createShape — วาดเค้กลง offscreen canvas (พิกัดออกแบบ 400×500)
   ความหนาแน่นของจุดถูก "เข้ารหัส" ด้วย alpha:
   ตัวเค้ก ≈ 0.18, ครีม ≈ 0.6, เส้นขอบ/ลวดลาย = 1
   ===================================================================== */
const DESIGN_W = 400, DESIGN_H = 500;

function tierPath(o) {
  const cx = (o.x1 + o.x2) / 2, rx = (o.x2 - o.x1) / 2;
  const p = new Path2D();
  p.moveTo(o.x1, o.top);
  p.lineTo(o.x1, o.bot);
  p.ellipse(cx, o.bot, rx, o.ry, 0, Math.PI, 0, true);   // ขอบล่างด้านหน้า
  p.lineTo(o.x2, o.top);
  p.ellipse(cx, o.top, rx, o.ry, 0, 0, Math.PI, true);   // ขอบบนด้านหลัง
  p.closePath();
  return p;
}

function drawTier(c, o, rng) {
  const cx = (o.x1 + o.x2) / 2, rx = (o.x2 - o.x1) / 2;
  const body = tierPath(o);

  // ลบสิ่งที่อยู่ด้านหลังก่อน ชั้นบนจะได้บังชั้นล่างอย่างถูกต้อง
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  c.fill(body);
  c.globalCompositeOperation = 'source-over';

  c.fillStyle = white(0.18);
  c.fill(body);

  // เส้นขอบด้านข้างและฐาน
  c.strokeStyle = white(1);
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(o.x1, o.top);
  c.lineTo(o.x1, o.bot);
  c.ellipse(cx, o.bot, rx, o.ry, 0, Math.PI, 0, true);
  c.lineTo(o.x2, o.top);
  c.stroke();

  // เม็ดน้ำตาลโรยหน้า
  c.lineCap = 'round';
  c.lineWidth = 2.4;
  for (let i = 0; i < o.sprinkles; i++) {
    const x = rand2(rng, o.x1 + 10, o.x2 - 10);
    const y = rand2(rng, o.top + o.ry + 26, o.bot + o.ry * 0.4);
    const a = rng() * TAU;
    c.beginPath();
    c.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3);
    c.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3);
    c.stroke();
  }

  // ลูกปัดครีมรอบฐาน
  c.fillStyle = white(0.9);
  for (let i = 0; i <= o.beads; i++) {
    const th = Math.PI - (Math.PI * i) / o.beads;
    c.beginPath();
    c.arc(cx + rx * Math.cos(th), o.bot + o.ry * Math.sin(th) - 2, 3.6, 0, TAU);
    c.fill();
  }

  // ครีมด้านบน + หยดครีมไหล
  c.fillStyle = white(0.5);
  c.beginPath();
  c.ellipse(cx, o.top, rx, o.ry, 0, 0, TAU);
  c.fill();

  const drips = [];
  for (let i = 0; i < o.drips; i++) {
    drips.push({
      th: (Math.PI * (i + 0.5)) / o.drips + (rng() - 0.5) * (Math.PI / o.drips) * 0.6,
      len: 8 + rng() * 22,
      w: 0.06 + rng() * 0.06,
    });
  }
  const pts = [];
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const th = Math.PI - (Math.PI * i) / N;   // ซ้าย → ขวา ผ่านขอบหน้า
    let d = 7;
    for (const dr of drips) d += dr.len * Math.exp(-Math.pow((th - dr.th) / dr.w, 2));
    pts.push([cx + rx * Math.cos(th), o.top + o.ry * Math.sin(th) + d]);
  }
  const dripLine = new Path2D();
  pts.forEach(([x, y], i) => (i ? dripLine.lineTo(x, y) : dripLine.moveTo(x, y)));

  const cream = new Path2D(dripLine);
  cream.ellipse(cx, o.top, rx, o.ry, 0, 0, Math.PI, false);
  cream.closePath();
  c.fillStyle = white(0.62);
  c.fill(cream);

  c.lineWidth = 2.2;
  c.strokeStyle = white(1);
  c.stroke(dripLine);

  // ขอบครีมด้านหลัง
  c.lineWidth = 1.8;
  c.strokeStyle = white(0.9);
  c.beginPath();
  c.ellipse(cx, o.top, rx, o.ry, 0, Math.PI, TAU);
  c.stroke();
}

function rand2(rng, a, b) { return a + rng() * (b - a); }

function drawCake(c) {
  const rng = mulberry32(20261124);

  // จาน
  c.fillStyle = white(0.12);
  c.beginPath();
  c.ellipse(200, 462, 192, 26, 0, 0, TAU);
  c.fill();
  c.strokeStyle = white(0.75);
  c.lineWidth = 2;
  c.stroke();

  // 3 ชั้น (วาดจากล่างขึ้นบน)
  drawTier(c, { x1: 48,  x2: 352, top: 345, bot: 455, ry: 18, drips: 9, sprinkles: 16, beads: 26 }, rng);
  drawTier(c, { x1: 88,  x2: 312, top: 262, bot: 345, ry: 15, drips: 7, sprinkles: 11, beads: 20 }, rng);
  drawTier(c, { x1: 125, x2: 275, top: 185, bot: 262, ry: 12, drips: 5, sprinkles: 7,  beads: 14 }, rng);

  // เทียน
  const candle = new Path2D();
  candle.rect(193, 112, 14, 78);
  c.globalCompositeOperation = 'destination-out';
  c.fill(candle);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = white(0.5);
  c.fill(candle);

  c.save();
  c.clip(candle);
  c.strokeStyle = white(1);
  c.lineWidth = 3;
  for (let y = 100; y < 200; y += 11) {
    c.beginPath();
    c.moveTo(190, y + 8);
    c.lineTo(210, y);
    c.stroke();
  }
  c.restore();

  c.strokeStyle = white(1);
  c.lineWidth = 1.6;
  c.stroke(candle);

  // ไส้เทียน
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(200, 112);
  c.lineTo(200, 102);
  c.stroke();
}

function drawFlame(c) {
  c.fillStyle = white(1);
  c.beginPath();
  c.moveTo(200, 44);
  c.bezierCurveTo(206, 60, 214, 74, 212, 88);
  c.bezierCurveTo(211, 101, 189, 101, 188, 88);
  c.bezierCurveTo(186, 74, 194, 60, 200, 44);
  c.fill();
}

function createShape(w, h) {
  // เว้นที่ด้านบน (ข้อความอวยพร) และด้านล่าง (ปุ่ม) แล้ววางเค้กกลางพื้นที่ที่เหลือ
  const top = h * CONFIG.topReserve;
  const availH = Math.max(h * 0.5, h - top - CONFIG.bottomReserve);
  const s = Math.min((w * CONFIG.cakeWidthRatio) / DESIGN_W, (availH * CONFIG.cakeHeightRatio) / DESIGN_H);
  const cw = Math.max(1, Math.ceil(DESIGN_W * s));
  const ch = Math.max(1, Math.ceil(DESIGN_H * s));
  const ox = (w - cw) / 2;
  const oy = Math.min(top + (availH - ch) / 2, h - ch);

  const render = (fn) => {
    const off = document.createElement('canvas');
    off.width = cw; off.height = ch;
    const g = off.getContext('2d', { willReadFrequently: true });
    g.scale(s, s);
    fn(g);
    return g.getImageData(0, 0, cw, ch);
  };

  return {
    body: render(drawCake),
    flame: render(drawFlame),
    layout: {
      s, ox, oy, cw, ch,
      cx: ox + 200 * s,
      cy: oy + 300 * s,
      flameBaseX: ox + 200 * s,
      flameBaseY: oy + 100 * s,
      flameTipY: oy + 48 * s,
      flameH: 56 * s,
      cakeArea: 63000 * s * s, // พื้นที่ตัวเค้กโดยประมาณ (px²)
    },
  };
}

/* =====================================================================
   sampleParticles — สุ่มตำแหน่งจากพิกเซลในรูปทรง (ถ่วงน้ำหนักด้วย alpha)
   ===================================================================== */
function collectPoints(img, offX, offY, step) {
  const { width, height, data } = img;
  const pts = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 10 && Math.random() * 255 < a) {
        pts.push(offX + x + Math.random() * step, offY + y + Math.random() * step);
      }
    }
  }
  return pts;
}

function pickPoints(img, offX, offY, n) {
  let pts = collectPoints(img, offX, offY, 2);
  if (pts.length / 2 < n * 1.3) pts = collectPoints(img, offX, offY, 1);
  const total = pts.length / 2;
  n = Math.min(n, total);
  const idx = new Int32Array(total);
  for (let i = 0; i < total; i++) idx[i] = i;
  const out = [];
  for (let i = 0; i < n; i++) { // partial Fisher–Yates
    const j = i + ((Math.random() * (total - i)) | 0);
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    out.push([pts[idx[i] * 2], pts[idx[i] * 2 + 1]]);
  }
  return out;
}

function makeParticle(x, y, isFlame) {
  const sprites = isFlame ? state.flameSprites : state.sprites;
  const d = CONFIG.sizeMin + (CONFIG.sizeMax - CONFIG.sizeMin) * Math.pow(Math.random(), 1.7);
  return {
    hx: x, hy: y,             // ตำแหน่งบ้าน (ในรูปเค้ก)
    x, y, vx: 0, vy: 0,       // ตำแหน่ง/ความเร็วทางฟิสิกส์
    sx: 0, sy: 0,             // จุดเริ่มต้นตอน intro
    ox: 0, oy: 0, am: 1,      // render offset + ตัวคูณ alpha (ไม่ผ่าน spring)
    r: (isFlame ? d * 0.8 : d) / 2,
    alpha: rand(CONFIG.alphaMin, CONFIG.alphaMax),
    sprite: sprites[(Math.random() * sprites.length) | 0],
    phase: Math.random() * TAU,
    phase2: Math.random() * TAU,
    delay: Math.random() * CONFIG.introStagger,
    kick: rand(0.6, 1.4),     // ความแรงต่อแรงระเบิดแบบสุ่ม ให้ดูไม่เป็นวงกลมเป๊ะ
    flame: isFlame,
    drift: null,
  };
}

function assignDrifters(particles, L) {
  const ang = -Math.PI / 4.5; // ทิศขวาบน
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const body = particles.filter(p => !p.flame);
  for (const p of body) p.score = (p.hx - L.cx) * ux + (p.hy - L.cy) * uy;
  body.sort((a, b) => b.score - a.score);
  const n = Math.round(body.length * CONFIG.driftRatio);
  for (let i = 0; i < n; i++) {
    const a = ang + rand(-0.55, 0.55);
    const period = rand(CONFIG.driftPeriod[0], CONFIG.driftPeriod[1]);
    body[i].drift = {
      dx: Math.cos(a), dy: Math.sin(a),
      dist: rand(CONFIG.driftDistance[0], CONFIG.driftDistance[1]) * L.s,
      period,
      offset: Math.random() * period,
    };
  }
}

function particleCount(L) {
  const max = coarseMQ.matches ? CONFIG.maxParticlesMobile : CONFIG.maxParticles;
  return Math.round(clamp(L.cakeArea / CONFIG.areaPerParticle, CONFIG.minParticles, max));
}

function sampleParticles(shape, count, prev) {
  const L = shape.layout;
  const nFlame = Math.round(count * CONFIG.flameRatio);
  const particles = [
    ...pickPoints(shape.body, L.ox, L.oy, count - nFlame).map(([x, y]) => makeParticle(x, y, false)),
    ...pickPoints(shape.flame, L.ox, L.oy, nFlame).map(([x, y]) => makeParticle(x, y, true)),
  ];
  assignDrifters(particles, L);

  const { w, h } = state;
  particles.forEach((p, i) => {
    if (prev && prev[i]) {
      // resize: เริ่มจากตำแหน่งเดิม แล้ว spring ไปยังรูปทรงใหม่
      p.x = prev[i].x; p.y = prev[i].y;
    } else if (!state.introDone) {
      p.sx = rand(-0.1 * w, 1.1 * w);
      p.sy = rand(-0.1 * h, 1.1 * h);
      p.x = p.sx; p.y = p.sy;
    }
  });
  return particles;
}

/* ประกายจากเปลวเทียน + ดาวพื้นหลัง */
function spawnSpark(sp, initial) {
  const L = state.layout;
  const slow = state.reduced ? 0.4 : 1;
  sp.x = L.flameBaseX + rand(-4, 4) * L.s;
  sp.y = L.flameTipY + rand(0, 12) * L.s;
  sp.vx = rand(-8, 8) * L.s * slow;
  sp.vy = -rand(25, 55) * L.s * slow;
  sp.max = rand(1, 2.2);
  sp.life = initial ? Math.random() * sp.max : 0;
  sp.r = rand(0.6, 1.4);
  sp.phase = Math.random() * TAU;
  sp.sprite = state.flameSprites[(Math.random() * state.flameSprites.length) | 0];
}

function initExtras() {
  const n = state.reduced ? Math.round(CONFIG.sparkCount / 3) : CONFIG.sparkCount;
  state.sparks = Array.from({ length: n }, () => {
    const s = {}; spawnSpark(s, true); s.dead = !state.flame.lit; return s;
  });
  state.ambient = Array.from({ length: CONFIG.ambientCount }, () => ({
    x: Math.random() * state.w,
    y: Math.random() * state.h,
    r: rand(0.4, 1.1),
    base: rand(0.08, 0.3),
    speed: rand(0.4, 1.4),
    phase: Math.random() * TAU,
    sprite: state.sprites[(Math.random() * state.sprites.length) | 0],
  }));
}

/* =====================================================================
   Setup / resize
   ===================================================================== */
function resizeCanvas() {
  state.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDPR);
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = Math.round(state.w * state.dpr);
  canvas.height = Math.round(state.h * state.dpr);
}

function build(keepPositions) {
  resizeCanvas();
  const shape = createShape(state.w, state.h);
  state.layout = shape.layout;
  const prev = keepPositions ? state.particles : null;
  state.particles = sampleParticles(shape, particleCount(shape.layout), prev);
  initExtras();
}

/* =====================================================================
   update
   ===================================================================== */
function update(dt, t, now) {
  const L = state.layout;
  const reduced = state.reduced;
  const f = Math.min(dt / 16.667, 3);              // normalise ให้ทำงานเท่ากันทุก refresh rate
  const damp = Math.pow(CONFIG.damping, f);
  const k = CONFIG.spring;
  const breathe = reduced ? 0 : CONFIG.breathe * Math.sin(t * 1.1);
  const amp = reduced ? CONFIG.idleAmplitude * 0.25 : CONFIG.idleAmplitude;
  const fl = reduced ? 0.3 : 1;

  // สถานะเปลวไฟ: ค่อยๆ ดับ / ค่อยๆ ติดใหม่
  const lit = state.flame.lit;
  const fe = (now - state.flame.changedAt) / (lit ? CONFIG.relightDuration : CONFIG.flameOutDuration);
  const fLevel = lit ? easeOutCubic(clamp(fe, 0, 1)) : 1 - clamp(fe, 0, 1);
  state.flameLevel = fLevel;
  const wind = state.wind;
  wind.value += (wind.target - wind.value) * Math.min(1, dt / 80);
  const gust = 1 + wind.value * 3;

  // ระลอกจากการคลิก
  for (const r of state.ripples) {
    r.age += dt / 1000;
    r.radius = r.age * CONFIG.rippleSpeed;
    r.strength = 1 - r.age / CONFIG.rippleLife;
  }
  state.ripples = state.ripples.filter(r => r.age < CONFIG.rippleLife);

  const introElapsed = now - state.introStart;
  if (!state.introDone && introElapsed > CONFIG.introDuration + CONFIG.introStagger) {
    state.introDone = true;
  }

  const ptr = state.pointer;
  const R = CONFIG.mouseRadius, R2 = R * R;
  const mForce = CONFIG.mouseForce * (reduced ? 0.5 : 1);
  const rForce = CONFIG.rippleForce * (reduced ? 0.3 : 1);
  const rw = CONFIG.rippleWidth;

  for (const p of state.particles) {
    // ตำแหน่งเป้าหมาย: บ้าน + หายใจ + ไหวเบาๆ
    const tx = L.cx + (p.hx - L.cx) * (1 + breathe) + Math.sin(t * CONFIG.idleSpeed + p.phase) * amp;
    const ty = L.cy + (p.hy - L.cy) * (1 + breathe) + Math.cos(t * CONFIG.idleSpeed * 0.8 + p.phase2) * amp;

    // render offsets (ไม่ผ่าน physics)
    p.ox = 0; p.oy = 0; p.am = 1;
    if (p.flame) {
      const kh = clamp((L.flameBaseY - p.hy) / L.flameH, 0, 1); // 0 = ฐาน, 1 = ปลาย
      // ลมจากไมค์ทำให้ไหวแรงขึ้นและเอนไปทางขวา
      const sway = Math.sin(t * 5.2 + kh * 1.5) * kh * kh * 3.2 * L.s * fl * gust
                 + wind.value * kh * kh * 14 * L.s;
      const widen = Math.sin(t * 9 + p.phase * 0.2) * 0.08 * fl;
      p.ox = (p.hx - L.flameBaseX) * widen + sway;
      p.oy = -Math.sin(t * 7.3) * kh * 2 * L.s * fl;
      p.am = 0.75 + 0.25 * Math.sin(t * 14 + p.phase) * fl;
      if (fLevel < 1) {
        const e = 1 - fLevel;
        if (lit) {
          // ติดใหม่: หดเข้าหาไส้เทียนแล้วขยายออก
          p.ox += (L.flameBaseX - p.hx) * e;
          p.oy += (L.flameBaseY - p.hy) * e;
        } else {
          // ถูกเป่า: ปลิวขึ้นและไปทางขวา พร้อมจางหาย
          p.ox += (Math.sin(p.phase) * 18 + 30 * p.kick) * e * L.s;
          p.oy -= (40 + 50 * kh) * e * e * L.s * p.kick;
        }
        p.am *= fLevel;
      }
    } else if (p.drift && !reduced) {
      const d = p.drift;
      const c = ((t + d.offset) / d.period) % 1;
      const out = Math.pow(smoothstep(0.08, 1, c), 1.6);
      p.ox = d.dx * d.dist * out + Math.sin(t * 1.7 + p.phase) * out * 12;
      p.oy = d.dy * d.dist * out + Math.cos(t * 1.3 + p.phase2) * out * 12;
      // จางหายตอนลอยไกล แล้วค่อยๆ ปรากฏที่เดิมเมื่อวนรอบใหม่
      p.am = smoothstep(0, 0.08, c) * (1 - smoothstep(0.55, 1, c));
    }

    // Intro: ease-out จากตำแหน่งสุ่มเข้ารูปเค้ก
    if (!state.introDone) {
      const e = easeOutCubic(clamp((introElapsed - p.delay) / CONFIG.introDuration, 0, 1));
      p.x = p.sx + (tx - p.sx) * e;
      p.y = p.sy + (ty - p.sy) * e;
      p.vx = p.vy = 0;
      continue;
    }

    // Spring physics
    let ax = (tx - p.x) * k;
    let ay = (ty - p.y) * k;

    if (ptr.active) {
      const dx = p.x - ptr.x, dy = p.y - ptr.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < R2 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const force = (1 - d / R) * (1 - d / R) * mForce;
        ax += (dx / d) * force;
        ay += (dy / d) * force;
      }
    }

    for (const r of state.ripples) {
      const dx = p.x - r.x, dy = p.y - r.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = Math.abs(d - r.radius);
      if (diff < rw) {
        const force = (1 - diff / rw) * rForce * r.strength * p.kick;
        ax += (dx / d) * force;
        ay += (dy / d) * force;
      }
    }

    p.vx = (p.vx + ax * f) * damp;
    p.vy = (p.vy + ay * f) * damp;
    p.x += p.vx * f;
    p.y += p.vy * f;
  }

  // ประกายเปลวเทียน
  const dts = dt / 1000;
  for (const sp of state.sparks) {
    if (sp.dead) {
      if (lit) { spawnSpark(sp, false); sp.dead = false; }
      continue;
    }
    sp.life += dts;
    if (sp.life >= sp.max) {
      if (lit) spawnSpark(sp, false); else sp.dead = true; // เทียนดับ = ไม่สร้างประกายใหม่
      continue;
    }
    sp.x += (sp.vx + Math.sin(t * 3 + sp.phase) * 6 * L.s) * dts;
    sp.y += sp.vy * dts;
  }

  // ควันหลังเทียนดับ
  const smokeMax = reduced ? CONFIG.smokeMax / 3 : CONFIG.smokeMax;
  if (!lit && now < state.smokeUntil && state.smoke.length < smokeMax && Math.random() < dt / 45) {
    state.smoke.push({
      x: L.flameBaseX + rand(-2, 2) * L.s,
      y: L.flameBaseY + 2 * L.s,
      vx: rand(-4, 10) * L.s,
      vy: -rand(18, 34) * L.s * (reduced ? 0.5 : 1),
      r0: rand(1.2, 2.2),
      life: 0,
      max: rand(2.2, 3.4),
      phase: Math.random() * TAU,
      sprite: state.smokeSprites[(Math.random() * state.smokeSprites.length) | 0],
    });
  }
  for (const sm of state.smoke) {
    sm.life += dts;
    sm.x += (sm.vx + Math.sin(t * 1.5 + sm.phase) * 8 * L.s) * dts;
    sm.y += sm.vy * dts;
  }
  state.smoke = state.smoke.filter(sm => sm.life < sm.max);
}

/* =====================================================================
   draw
   ===================================================================== */
function drawSprite(img, x, y, radius, alpha) {
  if (alpha <= 0.01) return;
  const size = radius * 2 * CONFIG.glow;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
}

function draw(t) {
  const { w, h, dpr, layout: L } = state;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);        // พื้นหลัง gradient มาจาก CSS
  ctx.globalCompositeOperation = 'lighter';

  for (const a of state.ambient) {
    drawSprite(a.sprite, a.x, a.y, a.r, a.base * (0.5 + 0.5 * Math.sin(t * a.speed + a.phase)));
  }

  // แสงเรืองรอบเปลวไฟ
  const flick = state.reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 4.3);
  if (state.flameSprites.length) {
    drawSprite(state.flameSprites[6], L.flameBaseX, L.flameBaseY - L.flameH * 0.45, 14 * L.s,
      0.22 * flick * state.flameLevel);
  }

  for (const sm of state.smoke) {
    const life = sm.life / sm.max;
    drawSprite(sm.sprite, sm.x, sm.y, (sm.r0 + life * 7) * L.s,
      0.3 * smoothstep(0, 0.15, life) * (1 - life));
  }

  for (const p of state.particles) {
    drawSprite(p.sprite, p.x + p.ox, p.y + p.oy, p.r, p.alpha * p.am);
  }

  for (const sp of state.sparks) {
    if (sp.dead) continue;
    const life = sp.life / sp.max;
    drawSprite(sp.sprite, sp.x, sp.y, sp.r, (1 - life) * smoothstep(0, 0.12, life) * 0.9);
  }
}

/* =====================================================================
   Loop + adaptive performance
   ===================================================================== */
function trimParticles(ratio) {
  const stride = Math.max(2, Math.round(1 / ratio));
  let i = 0;
  state.particles = state.particles.filter(p => p.flame || (i++ % stride) !== 0);
}

function checkPerf(dt) {
  if (!CONFIG.adaptivePerf || !state.introDone) return;
  const perf = state.perf;
  perf.ema += (dt - perf.ema) * 0.05;
  if (++perf.frames % 90 !== 0) return;
  if (perf.ema > 21 && perf.trims < 3 && state.particles.length > 1000) {
    trimParticles(0.15);
    perf.trims++;
  }
}

function frame(now) {
  const dt = Math.min(50, now - (state.lastTime || now));
  state.lastTime = now;
  update(dt, now / 1000, now);
  draw(now / 1000);
  checkPerf(dt);
  state.rafId = requestAnimationFrame(frame);
}

function start() {
  cancelAnimationFrame(state.rafId);
  state.lastTime = 0;
  state.rafId = requestAnimationFrame(frame);
}

/* =====================================================================
   Interaction
   ===================================================================== */
function addRipple(x, y) {
  state.ripples.push({ x, y, age: 0, radius: 0, strength: 1 });
  if (state.ripples.length > 4) state.ripples.shift();
}

canvas.addEventListener('pointermove', e => {
  state.pointer.x = e.clientX;
  state.pointer.y = e.clientY;
  state.pointer.active = true;
});
canvas.addEventListener('pointerdown', e => {
  state.pointer.x = e.clientX;
  state.pointer.y = e.clientY;
  state.pointer.active = true;
  addRipple(e.clientX, e.clientY);
});
const releasePointer = e => { if (!e || e.pointerType !== 'mouse') state.pointer.active = false; };
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('pointerleave', () => { state.pointer.active = false; });

// คีย์บอร์ด: Enter / Space = แตกกระจายจากกลางเค้ก
canvas.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    addRipple(state.layout.cx, state.layout.cy);
  }
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => build(true), 150);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelAnimationFrame(state.rafId);
  else start();
});

reduceMQ.addEventListener('change', e => {
  state.reduced = e.matches;
  initExtras();
});

/* =====================================================================
   Public API — ให้ app.js สั่งเป่า/จุดเทียน และส่งระดับลมจากไมค์
   ===================================================================== */
window.Cake = Object.freeze({
  /** ดับเทียน คืนค่า false ถ้าดับอยู่แล้ว */
  blowOut() {
    if (!state.flame.lit) return false;
    const now = performance.now();
    state.flame = { lit: false, changedAt: now };
    state.smokeUntil = now + CONFIG.smokeDuration;
    state.wind.target = 0;
    const L = state.layout;
    addRipple(L.flameBaseX, L.flameBaseY); // แรงลมกระเพื่อมทั้งเค้ก
    return true;
  },
  relight() {
    if (state.flame.lit) return false;
    state.flame = { lit: true, changedAt: performance.now() };
    return true;
  },
  isLit: () => state.flame.lit,
  /** level 0–1 จากไมโครโฟน */
  setWind(level) { state.wind.target = clamp(level || 0, 0, 1); },
});

/* =====================================================================
   Boot
   ===================================================================== */
buildSprites();
if (state.reduced) state.introDone = true; // ข้าม intro เมื่อผู้ใช้ขอลดการเคลื่อนไหว
build(false);
state.introStart = performance.now();
start();
