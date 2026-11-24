'use strict';

/* =====================================================================
   App — อ่านชื่อจาก URL, ผูกปุ่ม, ประสาน Cake / BirthdayAudio / Confetti
   URL: index.html?name=มุก&age=25
   ===================================================================== */
(() => {
  const MAX_NAME = 40;
  const $ = id => document.getElementById(id);

  const el = {
    name: $('greeting-name'),
    age: $('greeting-age'),
    status: $('status'),
    blow: $('btn-blow'),
    relight: $('btn-relight'),
    music: $('btn-music'),
    share: $('btn-share'),
    dialog: $('share-dialog'),
    form: $('share-form'),
    inName: $('share-name'),
    inAge: $('share-age'),
    result: $('share-result'),
    url: $('share-url'),
    note: $('share-note'),
    close: $('share-close'),
    meter: $('mic-meter'),
    meterFill: $('mic-meter-fill'),
  };

  // level 0–1; เกณฑ์เป่าอยู่ที่ 2/3 (ดู onLevel ใน audio.js)
  function showLevel(level) {
    const pct = Math.round(level * 100);
    el.meterFill.style.width = `${pct}%`;
    el.meterFill.classList.toggle('is-hot', level >= 2 / 3);
    el.meterFill.parentElement.setAttribute('aria-valuenow', String(pct));
  }

  /* ---------------- ชื่อ/อายุจาก URL ---------------- */

  // ตัดตาม grapheme เพื่อไม่ให้สระ/วรรณยุกต์ไทยหลุดจากพยัญชนะ
  function truncateGraphemes(str, max) {
    if (window.Intl && Intl.Segmenter) {
      const seg = new Intl.Segmenter('th', { granularity: 'grapheme' });
      return Array.from(seg.segment(str), s => s.segment).slice(0, max).join('');
    }
    return Array.from(str).slice(0, max).join('');
  }

  function sanitizeName(raw) {
    if (!raw) return '';
    const clean = raw
      .normalize('NFC')
      .replace(/[\p{Cc}\p{Cf}]/gu, '')   // ตัด control/format chars (เช่น RTL override)
      .replace(/\s+/g, ' ')
      .trim();
    return truncateGraphemes(clean, MAX_NAME);
  }

  function parseAge(raw) {
    const n = Number.parseInt(raw, 10);
    return Number.isInteger(n) && n >= 1 && n <= 150 ? n : null;
  }

  const person = { name: '', age: null };

  function readParams(search) {
    const p = new URLSearchParams(search);
    person.name = sanitizeName(p.get('name'));
    person.age = parseAge(p.get('age'));
  }

  // ใช้ textContent เท่านั้น — ชื่อมาจาก URL ที่ใครก็แก้ได้ ห้ามใช้ innerHTML (XSS)
  function renderGreeting() {
    el.name.textContent = person.name;
    el.name.hidden = !person.name;
    el.age.textContent = person.age ? `ครบ ${person.age} ปี 🎂` : '';
    el.age.hidden = !person.age;
    document.title = person.name ? `สุขสันต์วันเกิด ${person.name} 🎂` : 'สุขสันต์วันเกิด 🎂';
  }

  /* ---------------- สถานะ ---------------- */
  const setStatus = msg => { el.status.textContent = msg; };
  const HINT_IDLE = 'กด 🎤 แล้วเป่าไมค์เพื่อดับเทียน';

  /* ---------------- เพลง ---------------- */
  function syncMusicBtn() {
    el.music.setAttribute('aria-pressed', String(BirthdayAudio.isPlaying()));
    el.music.querySelector('.btn__label').textContent = BirthdayAudio.isPlaying() ? 'หยุดเพลง' : 'เพลง';
  }
  function playSong() {
    BirthdayAudio.playSong(syncMusicBtn);
    syncMusicBtn();
  }
  el.music.addEventListener('click', () => {
    if (BirthdayAudio.isPlaying()) BirthdayAudio.stopSong();
    else playSong();
    syncMusicBtn();
  });

  /* ---------------- เป่าเทียน ---------------- */
  let stopMic = null;     // ฟังก์ชันหยุดไมค์ ถ้ากำลังฟังอยู่
  let micFailed = false;  // ใช้ไมค์ไม่ได้ → ปุ่มเปลี่ยนเป็นเป่าด้วยการกดแทน

  function setBlowBtn(listening) {
    el.blow.setAttribute('aria-pressed', String(listening));
    el.meter.hidden = !listening;
    if (!listening) showLevel(0);
    el.blow.querySelector('.btn__label').textContent =
      listening ? 'กำลังฟัง… (กดเพื่อหยุด)' : micFailed ? 'กดเพื่อเป่า' : 'เป่าเทียน';
  }

  function endMic() {
    if (stopMic) { stopMic(); stopMic = null; }
    setBlowBtn(false);
  }

  // in-app browser ของแอปแชท/โซเชียล มักไม่รองรับ getUserMedia หรือบล็อกไว้
  const IN_APP_UA = /\b(Line|FBAN|FBAV|FB_IAB|Instagram|Messenger|TikTok|Twitter|MicroMessenger)\b/i;

  function micErrorMessage(err) {
    const name = (err && err.name) || 'Error';
    if (IN_APP_UA.test(navigator.userAgent)) {
      return 'เปิดในแอปแชทใช้ไมค์ไม่ได้ ให้กด ⋯ แล้วเลือก "เปิดใน Chrome/Safari"';
    }
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
        return 'ไม่ได้รับสิทธิ์ใช้ไมโครโฟน (กดไอคอนแม่กุญแจข้างแถบที่อยู่เพื่ออนุญาต)';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
      case 'OverconstrainedError': return 'ไม่พบไมโครโฟนในเครื่องนี้';
      case 'NotReadableError':
      case 'TrackStartError':
      case 'AbortError':           return 'ไมโครโฟนถูกโปรแกรมอื่นใช้อยู่ หรือเปิดไม่ได้';
      case 'InsecureContextError': return 'ไมโครโฟนใช้ได้เฉพาะ https หรือ localhost';
      case 'NotSupportedError':    return 'browser นี้ไม่รองรับไมโครโฟน ลองเปิดใน Chrome หรือ Safari';
      default:                     return `ใช้ไมโครโฟนไม่ได้ (${name})`; // แสดงชื่อ error ไว้ช่วยหาสาเหตุ
    }
  }

  async function startMic() {
    el.blow.disabled = true;
    setStatus('กำลังขอสิทธิ์ไมโครโฟน…');
    try {
      stopMic = await BirthdayAudio.startBlowDetector({
        onLevel: lvl => { Cake.setWind(lvl); showLevel(lvl); },
        onBlow: celebrate,
      });
      setBlowBtn(true);
      setStatus('เป่าไมค์แรงๆ ให้แถบเลยเส้นเหลือง 🌬️');
    } catch (err) {
      console.warn('[mic]', err);
      micFailed = true;
      setBlowBtn(false);
      setStatus(`${micErrorMessage(err)} — กดปุ่มเพื่อเป่าเทียนแทน`);
    } finally {
      el.blow.disabled = false;
    }
  }

  el.blow.addEventListener('click', () => {
    BirthdayAudio.getCtx(); // ปลดล็อกเสียงด้วย user gesture ไว้ก่อน เพลงจะได้เล่นหลังเป่าได้
    if (stopMic) { endMic(); setStatus(HINT_IDLE); return; }
    if (micFailed) { celebrate(); return; }
    startMic();
  });

  function celebrate() {
    if (!Cake.blowOut()) return;
    endMic();
    Confetti.burst();
    playSong();
    el.blow.hidden = true;
    el.relight.hidden = false;
    setStatus(person.name ? `🎉 เย้! สุขสันต์วันเกิด ${person.name}!` : '🎉 เย้! สุขสันต์วันเกิด!');
    el.relight.focus({ preventScroll: true });
  }

  el.relight.addEventListener('click', () => {
    Cake.relight();
    el.relight.hidden = true;
    el.blow.hidden = false;
    setBlowBtn(false);
    setStatus(micFailed ? 'กดปุ่มเพื่อเป่าเทียน' : HINT_IDLE);
    el.blow.focus({ preventScroll: true });
  });

  /* ---------------- สร้างลิงก์ ---------------- */
  function buildUrl(name, age) {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    if (name) url.searchParams.set('name', name);
    if (age) url.searchParams.set('age', String(age));
    return url;
  }

  el.share.addEventListener('click', () => {
    el.inName.value = person.name;
    el.inAge.value = person.age || '';
    el.result.hidden = true;
    el.dialog.showModal();
    el.inName.focus();
  });
  el.close.addEventListener('click', () => el.dialog.close());

  el.form.addEventListener('submit', async e => {
    e.preventDefault();
    person.name = sanitizeName(el.inName.value);
    person.age = parseAge(el.inAge.value);
    const url = buildUrl(person.name, person.age);
    history.replaceState(null, '', url);   // อัปเดตหน้าปัจจุบันทันที ไม่ต้องรีโหลด
    renderGreeting();

    el.url.value = url.href;
    el.result.hidden = false;
    el.url.select();
    try {
      await navigator.clipboard.writeText(url.href);
      el.note.textContent = 'คัดลอกลิงก์แล้ว ✓';
    } catch {
      el.note.textContent = 'คัดลอกลิงก์ด้านบนเองได้เลย';
    }
    if (location.protocol === 'file:') {
      el.note.textContent += ' (ลิงก์ file:// เปิดได้เฉพาะเครื่องนี้ — ต้อง deploy ก่อนส่งให้คนอื่น)';
    }
  });

  /* ---------------- Boot ---------------- */
  readParams(location.search);
  renderGreeting();
  setStatus(HINT_IDLE);

  // ปิดไมค์ตอนสลับแท็บ — ไม่ฟังเสียงผู้ใช้เบื้องหลัง
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && stopMic) { endMic(); setStatus(HINT_IDLE); }
  });
})();
