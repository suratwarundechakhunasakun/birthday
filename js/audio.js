'use strict';

/* =====================================================================
   BirthdayAudio — เพลง Happy Birthday (สังเคราะห์ด้วย Web Audio ไม่ต้องโหลดไฟล์)
   + ตัวตรวจจับการเป่าไมโครโฟน
   ตั้งชื่อ BirthdayAudio เพื่อไม่ทับ window.Audio ของ browser
   ===================================================================== */
window.BirthdayAudio = (() => {
  const BLOW = {
    calibrateMs: 600,   // ช่วงวัดเสียงรบกวนรอบข้างตอนเริ่ม
    minRms: 0.08,       // ความดังขั้นต่ำที่นับว่า "เป่า" (0–1)
    noiseFactor: 4,     // ต้องดังกว่าเสียงรบกวนกี่เท่า
    holdMs: 350,        // ต้องดังต่อเนื่องนานเท่านี้ กันเสียงกระแทกสั้นๆ
  };

  let ctx = null;

  /** ต้องเรียกครั้งแรกจาก user gesture (click) ไม่งั้น browser จะไม่ให้เล่นเสียง */
  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ---------------- เพลง ---------------- */
  // [MIDI note, จังหวะ (หน่วย = ตัวดำ)] — ทำนองเป็นสาธารณสมบัติ
  const MELODY = [
    [67, .75], [67, .25], [69, 1], [67, 1], [72, 1], [71, 2],
    [67, .75], [67, .25], [69, 1], [67, 1], [74, 1], [72, 2],
    [67, .75], [67, .25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
    [77, .75], [77, .25], [76, 1], [72, 1], [74, 1], [72, 2.5],
  ];
  const BEAT = 0.42; // วินาทีต่อตัวดำ
  const midiToHz = n => 440 * Math.pow(2, (n - 69) / 12);

  let song = null;

  // เสียงแบบกล่องดนตรี: triangle + harmonic, attack สั้น decay ยาว
  function pluck(c, out, hz, t, dur) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    g.connect(out);
    [[hz, 'triangle', 1], [hz * 2, 'sine', 0.25]].forEach(([f, type, amp]) => {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = type;
      o.frequency.value = f;
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.4);
    });
  }

  function playSong(onEnd) {
    stopSong();
    const c = getCtx();
    if (!c) return false;
    const master = c.createGain();
    master.gain.value = 0.16;
    master.connect(c.destination);
    let t = c.currentTime + 0.08;
    for (const [note, beats] of MELODY) {
      pluck(c, master, midiToHz(note), t, beats * BEAT);
      t += beats * BEAT;
    }
    const ms = (t - c.currentTime) * 1000 + 500;
    song = {
      master,
      timer: setTimeout(() => { song = null; master.disconnect(); onEnd && onEnd(); }, ms),
      onEnd,
    };
    return true;
  }

  function stopSong() {
    if (!song) return;
    const { master, timer, onEnd } = song;
    song = null;
    clearTimeout(timer);
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(0, now, 0.05);
    setTimeout(() => master.disconnect(), 300);
    onEnd && onEnd();
  }

  /* ---------------- ตรวจจับการเป่า ----------------
     การเป่าลมใส่ไมค์ = เสียงดังแบบ broadband ต่อเนื่อง
     ใช้ RMS เทียบกับเสียงรบกวนรอบข้าง + ต้องต่อเนื่อง holdMs
     (ปิด echoCancellation / noiseSuppression / AGC เพราะพวกนี้จะกดเสียงลมทิ้ง) */
  async function startBlowDetector({ onLevel, onBlow }) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('getUserMedia unavailable');
      err.name = window.isSecureContext ? 'NotSupportedError' : 'InsecureContextError';
      throw err;
    }
    const c = getCtx();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const src = c.createMediaStreamSource(stream);
    const analyser = c.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser); // ไม่ต่อเข้า destination เพื่อไม่ให้เสียงไมค์ออกลำโพง (feedback)
    const buf = new Float32Array(analyser.fftSize);

    const startAt = performance.now();
    let noise = 0, noiseSamples = 0, held = 0, last = startAt, raf = 0, stopped = false;

    const tick = (now) => {
      if (stopped) return;
      const dt = Math.min(100, now - last);
      last = now;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);

      if (now - startAt < BLOW.calibrateMs) {
        noise += rms; noiseSamples++;
      } else {
        const base = noiseSamples ? noise / noiseSamples : 0;
        const threshold = Math.max(BLOW.minRms, base * BLOW.noiseFactor);
        onLevel && onLevel(Math.min(1, Math.max(0, (rms - base) / (threshold * 1.5))));
        held = rms > threshold ? held + dt : Math.max(0, held - dt * 2);
        if (held >= BLOW.holdMs) {
          held = 0;
          onBlow && onBlow();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      src.disconnect();
      stream.getTracks().forEach(tr => tr.stop()); // ปิดไฟไมค์ของ browser ด้วย
      onLevel && onLevel(0);
    };
  }

  return Object.freeze({
    getCtx,
    playSong,
    stopSong,
    isPlaying: () => !!song,
    startBlowDetector,
  });
})();
