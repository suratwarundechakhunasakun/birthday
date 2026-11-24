// รวม index.html + css + js เป็นไฟล์เดียว (ส่งต่อทาง LINE/อีเมลได้ หรือเปิดออฟไลน์)
// ใช้: node scripts/build-single.mjs  → dist/birthday-cake.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

let html = read('index.html')
  .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}</style>`)
  .replace(/<script src="(js\/[^"]+)" defer><\/script>\n?/g, (_, p) => `<script>\n${read(p)}</script>\n`);

// สคริปต์ inline ไม่รองรับ defer → ย้ายทั้งหมดไปท้าย body (อยู่แล้ว) ก็ทำงานหลัง DOM พร้อม
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/birthday-cake.html'), html);
console.log(`dist/birthday-cake.html (${(html.length / 1024).toFixed(1)} KB)`);
