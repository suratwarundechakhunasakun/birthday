'use strict';

/* =====================================================================
   Confetti — canvas ซ้อนบนสุด (pointer-events: none)
   loop ทำงานเฉพาะตอนมีกระดาษอยู่บนจอ ไม่กินแบตตอนว่าง
   ===================================================================== */
window.Confetti = (() => {
  const COLORS = ['#ff4da6', '#ffb3d9', '#ffd166', '#7ee8c7', '#b39dff', '#ffffff'];
  const GRAVITY = 520;   // px/s²
  const DRAG = 0.985;    // ต่อเฟรม 60fps
  const MAX = 400;

  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pieces = [], raf = 0, last = 0, w = 0, h = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  function piece(x, y, angle, speed) {
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI * 2,
      vr: rand(-10, 10),
      tilt: Math.random() * Math.PI * 2,  // หมุนรอบแกนตั้ง → แผ่นกระดาษพลิกไปมา
      vt: rand(4, 10),
      w: rand(6, 11), h: rand(3, 6),
      round: Math.random() < 0.25,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      age: 0,
    };
  }

  function burst() {
    if (!w) resize();
    const reduced = reduceMQ.matches;
    const add = [];
    if (reduced) {
      // ลดการเคลื่อนไหว: โปรยเบาๆ จากด้านบนอย่างเดียว
      for (let i = 0; i < 50; i++) add.push(piece(rand(0, w), rand(-h * 0.3, 0), Math.PI / 2, rand(20, 60)));
    } else {
      const speed = Math.max(w, h) * 1.1;
      for (let i = 0; i < 110; i++) { // ยิงจากมุมล่างซ้าย/ขวาเข้าหากลางจอ
        const a = rand(-1.35, -0.75); // ชี้ขึ้นไปทางขวา
        add.push(piece(0, h, a, rand(0.5, 1) * speed));
        add.push(piece(w, h, Math.PI - a, rand(0.5, 1) * speed)); // สะท้อนให้ชี้ขึ้นไปทางซ้าย
      }
      for (let i = 0; i < 60; i++) add.push(piece(rand(0, w), rand(-h * 0.4, -10), Math.PI / 2, rand(0, 80)));
    }
    pieces = pieces.concat(add).slice(-MAX);
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const reduced = reduceMQ.matches;
    const g = reduced ? GRAVITY * 0.15 : GRAVITY;
    const drag = Math.pow(DRAG, dt * 60);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    for (const p of pieces) {
      p.age += dt;
      p.vy += g * dt;
      p.vx *= drag; p.vy *= drag;
      // จำกัดความเร็วตก ให้ร่วงช้าๆ แบบกระดาษ
      if (p.vy > 260) p.vy = 260;
      p.x += (p.vx + Math.sin(p.age * 3 + p.tilt) * 30) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.tilt += p.vt * dt;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.tilt));
      ctx.globalAlpha = Math.min(1, 6 - p.age); // จางออกหลัง 5 วินาที
      ctx.fillStyle = p.color;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    pieces = pieces.filter(p => p.y < h + 30 && p.age < 6);

    if (pieces.length) raf = requestAnimationFrame(frame);
    else { raf = 0; ctx.clearRect(0, 0, w, h); }
  }

  window.addEventListener('resize', resize);
  resize();

  return Object.freeze({ burst });
})();
