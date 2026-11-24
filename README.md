# Particle Birthday Cake 🎂

การ์ดวันเกิดรูปเค้ก particle เรืองแสง ทำด้วย HTML5 Canvas + Web Audio + JavaScript ล้วน ไม่มี library ภายนอก

## ฟีเจอร์

- **ใส่ชื่อคนเกิดผ่าน URL**: `index.html?name=มุก&age=25` (`age` ไม่ใส่ก็ได้) หรือกดปุ่ม 🔗 สร้างลิงก์
- **เป่าเทียนผ่านไมโครโฟน**: กด 🎤 แล้วเป่าใส่ไมค์ เปลวไฟจะไหวตามแรงลม แล้วดับพร้อมควัน
  - ถ้าใช้ไมค์ไม่ได้ (ไม่ให้สิทธิ์ / ไม่มีไมค์ / ไม่ใช่ https) ปุ่มจะเปลี่ยนเป็นกดเพื่อเป่าแทน
- **Confetti + เพลง Happy Birthday** ตอนเทียนดับ (เพลงสังเคราะห์สดด้วย Web Audio ไม่ใช้ไฟล์เสียง)
- กด 🕯️ จุดเทียนใหม่ เพื่อเป่าซ้ำได้

## โครงสร้าง

```
birthday-cake/
├── index.html              # markup, ปุ่ม, dialog สร้างลิงก์
├── css/style.css
├── js/main.js              # เค้ก particle + เปลวไฟ/ควัน → window.Cake
├── js/audio.js             # เพลง + ตัวตรวจจับการเป่า → window.BirthdayAudio
├── js/confetti.js          # confetti overlay → window.Confetti
├── js/app.js               # อ่าน URL, ผูกปุ่ม, ประสานทุกส่วน
└── scripts/build-single.mjs  # รวมเป็นไฟล์เดียว → dist/birthday-cake.html
```

## วิธีรัน

ไมโครโฟนต้องใช้ **https หรือ localhost** จึงควรรันผ่าน local server:

```bash
npx serve .
# หรือ
python -m http.server 8000
```

ถ้าดับเบิลคลิกเปิด `index.html` ตรงๆ ทุกอย่างทำงาน แต่บาง browser จะไม่ให้ใช้ไมค์

### Deploy (GitHub Pages)

Settings → Pages → Source: `main` / root จะได้ลิงก์แบบ
`https://<user>.github.io/birthday/?name=ชื่อ` สำหรับส่งให้เพื่อน

### ไฟล์เดียว

```bash
node scripts/build-single.mjs
```

## ปรับแต่ง

- `CONFIG` ใน `js/main.js`: สี, จำนวนจุด, glow, intro, แรง spring, ความเร็วเทียนดับ, ควัน
- `BLOW` ใน `js/audio.js`: ความไวของการเป่า (`minRms`, `noiseFactor`, `holdMs`)
- `MELODY` / `BEAT` ใน `js/audio.js`: ทำนองและความเร็วเพลง

## Interaction

- เลื่อนเมาส์ / ลากนิ้ว: จุดผลักหนีแล้วดีดกลับ
- คลิก / แตะ: แตกกระจายเป็นระลอกแล้วรวมกลับ
- Tab ไปที่ canvas แล้วกด Enter / Space: แตกกระจายจากกลางเค้ก
- รองรับ `prefers-reduced-motion` (ลด animation, confetti โปรยเบาๆ)
- ปิดไมค์อัตโนมัติเมื่อเทียนดับหรือสลับแท็บ
