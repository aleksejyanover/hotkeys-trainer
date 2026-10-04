#!/usr/bin/env node
// Сборка статического сайта в docs/ (источник GitHub Pages):
//   site/index.html + site/assets  →  docs/
//   src/*                         →  docs/app/  (веб-версия тренажёра)
//   src/index.html                →  docs/app/index.html (+ подключение web-shim)
//   + docs/app/web-shim.js — браузерная замена Electron-моста window.hotkeysTrainer
// Запуск: npm run site   (после правок src/ или site/ — обязательно, иначе
// npm test упадёт на проверке синхронности docs/ с src/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const site = path.join(root, 'site');
const docs = path.join(root, 'docs');
const app = path.join(docs, 'app');

// маркер, который валидатор убирает при сравнении docs/app/index.html с src/index.html
export const SHIM_MARKER = '<!-- web-shim -->\n  <script src="web-shim.js"></script>';

const WEB_SHIM = `// Браузерная замена Electron preload-моста (window.hotkeysTrainer).
// Подключается только в веб-сборке (docs/app) — в десктопном приложении
// эту роль играет preload.js.
(() => {
  const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || '');
  const download = (json, name) => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return name;
  };
  window.hotkeysTrainer = {
    platform: isMac ? 'darwin' : 'win32',
    versions: {
      electron: 'web',
      chrome: navigator.userAgent.match(/Chrome\\/([\\d.]+)/)?.[1] || '—',
      node: '—'
    },
    // во вкладке тренажёра меню приложения нет — no-op
    setTrainerMode: async () => {},
    // экспорт — скачивание JSON-файла
    exportData: async (json) =>
      download(json, \`hotkeys-trainer-backup-\${new Date().toISOString().slice(0, 10)}.json\`),
    // импорт — выбор файла через <input type=file>, как в системном диалоге
    importData: () => new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) { resolve(null); return; }
        const r = new FileReader();
        r.onload = () => {
          try { resolve(JSON.parse(r.result)); } catch { resolve({ error: true }); }
        };
        r.onerror = () => resolve({ error: true });
        r.readAsText(f);
      };
      document.body.appendChild(input);
      input.click();
      input.remove();
    }),
    appVersion: async () => '1.3.0-web'
  };
})();
`;

fs.rmSync(docs, { recursive: true, force: true });
fs.mkdirSync(app, { recursive: true });

// 1. лендинг из site/
fs.cpSync(site, docs, { recursive: true });

// 2. приложение из src/
let files = 0;
for (const f of fs.readdirSync(src)) {
  if (f === 'index.html') continue;
  fs.copyFileSync(path.join(src, f), path.join(app, f));
  files++;
}

// 3. index.html с подключением web-shim (до модулей приложения)
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
if (!html.includes('</head>')) throw new Error('src/index.html: нет </head>');
fs.writeFileSync(
  path.join(app, 'index.html'),
  html.replace('</head>', `  ${SHIM_MARKER}\n</head>`)
);

// 4. сам shim + .nojekyll (GitHub Pages без Jekyll-обработки)
fs.writeFileSync(path.join(app, 'web-shim.js'), WEB_SHIM);
fs.writeFileSync(path.join(docs, '.nojekyll'), '');

console.log(`✓ Сайт собран: docs/ (лендинг + app/ из ${files} файлов src/)`);
