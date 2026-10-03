#!/usr/bin/env node
// Валидация проекта без запуска Electron:
//  1) данные сочетаний (id, категории, токены клавиш, переводы)
//  2) паритет RU/EN в i18n
//  3) тексты для тренажёра печати
//  4) перекрёстная проверка id между index.html и JS-кодом
// Запуск: node scripts/validate.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ── 1. Данные ─────────────────────────────────────────────
const { CATEGORIES, SHORTCUTS } = await import(path.join(root, 'src', 'data.js'));

const MODIFIERS = new Set(['Cmd', 'Ctrl', 'Opt', 'Alt', 'Shift', 'Win']);
const NAMED = new Set([
  'Space', 'Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'Esc', 'Del', 'Home', 'End',
  'PageUp', 'PageDown', 'Up', 'Down', 'Left', 'Right'
]);
// id, которые запрашиваются динамически ('panel-' + tab, setBar(prefix…)) или
// являются структурными обёртками — их отсутствие в прямых запросах не ошибка
const DYNAMIC_IDS = new Set([
  'panel-learn', 'panel-trainer', 'panel-map', 'panel-progress', 'panel-search', 'panel-notes',
  'daily-new-bar', 'daily-new-count', 'daily-review-bar', 'daily-review-count',
  'tip-block', 'trainer-actions'
]);
const catIds = new Set(CATEGORIES.map((c) => c.id));
const ids = new Set();

function checkCombo(combo, where) {
  if (!combo || typeof combo !== 'object') { err(`${where}: нет combo`); return; }
  const platforms = Object.keys(combo);
  if (!platforms.some((p) => ['mac', 'win'].includes(p))) {
    err(`${where}: combo не содержит mac/win`);
  }
  for (const p of platforms) {
    if (!['mac', 'win'].includes(p)) { err(`${where}: неизвестная платформа «${p}»`); continue; }
    const str = combo[p];
    if (!str || typeof str !== 'string') { err(`${where} [${p}]: пустая комбинация`); continue; }
    const tokens = str.split('+').map((s) => s.trim()).filter(Boolean);
    if (!tokens.length) { err(`${where} [${p}]: пустые токены`); continue; }
    // последний токен — основная клавиша, остальные — модификаторы
    tokens.forEach((tok, i) => {
      const isLast = i === tokens.length - 1;
      if (MODIFIERS.has(tok)) {
        if (isLast && tokens.length === 1) err(`${where} [${p}]: «${tok}» — только модификатор, нет основной клавиши`);
        return; // модификатор ок
      }
      if (NAMED.has(tok)) { if (!isLast) err(`${where} [${p}]: «${tok}» — основная клавиша не последняя`); return; }
      if (/^F\d{1,2}$/.test(tok)) { if (!isLast) err(`${where} [${p}]: «${tok}» — основная клавиша не последняя`); return; }
      if (tok.length === 1) { if (!isLast) err(`${where} [${p}]: символ «${tok}» не последний`); return; }
      err(`${where} [${p}]: неизвестный токен «${tok}»`);
    });
  }
}

for (const s of SHORTCUTS) {
  const where = s.id || '<без id>';
  if (!s.id) err('есть запись без id');
  if (ids.has(s.id)) err(`дублирующийся id: ${s.id}`);
  ids.add(s.id);
  if (!catIds.has(s.cat)) err(`${where}: неизвестная категория «${s.cat}»`);
  checkCombo(s.combo, where);
  for (const f of ['title', 'desc']) {
    for (const lang of ['ru', 'en']) {
      if (!s[f] || typeof s[f][lang] !== 'string' || !s[f][lang].trim()) {
        err(`${where}: нет ${f}.${lang}`);
      }
    }
  }
  if (s.opens) {
    for (const lang of ['ru', 'en']) {
      if (typeof s.opens[lang] !== 'string' || !s.opens[lang].trim())
        err(`${where}: opens.${lang} пустой`);
    }
  }
  if (s.os) {
    if (!Array.isArray(s.os)) err(`${where}: os не массив`);
    else s.os.forEach((o) => { if (!['mac', 'win'].includes(o)) err(`${where}: os содержит «${o}»`); });
  }
}

for (const c of CATEGORIES) {
  if (!c.icon) err(`категория ${c.id}: нет иконки`);
  for (const lang of ['ru', 'en']) {
    if (!c.title || !c.title[lang]) err(`категория ${c.id}: нет title.${lang}`);
  }
}

// ── 2. i18n паритет ───────────────────────────────────────
const { I18N } = await import(path.join(root, 'src', 'i18n.js'));
const ruKeys = Object.keys(I18N.ru).sort();
const enKeys = Object.keys(I18N.en).sort();
for (const k of ruKeys) if (!enKeys.includes(k)) err(`i18n: нет en-перевода для «${k}»`);
for (const k of enKeys) if (!ruKeys.includes(k)) err(`i18n: нет ru-строки для «${k}»`);
for (const k of ruKeys) {
  if (typeof I18N.ru[k] !== 'string' || !I18N.ru[k].trim()) err(`i18n.ru.${k} пустая`);
  if (typeof I18N.en[k] !== 'string' || !I18N.en[k].trim()) err(`i18n.en.${k} пустая`);
}

// ── 3. Тексты печати ──────────────────────────────────────
const { TYPING_TEXTS } = await import(path.join(root, 'src', 'typing.js'));
for (const lang of ['ru', 'en']) {
  const arr = TYPING_TEXTS[lang];
  if (!Array.isArray(arr) || arr.length < 3) err(`typing.${lang}: нужно минимум 3 текста`);
  else arr.forEach((txt, i) => {
    if (typeof txt !== 'string' || txt.length < 30) err(`typing.${lang}[${i}]: слишком короткий`);
    if (txt.length > 300) warn(`typing.${lang}[${i}]: длинный (${txt.length} символов)`);
  });
}

// ── 4. id: index.html ↔ JS ────────────────────────────────
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const dup = htmlIds.filter((id, i) => htmlIds.indexOf(id) !== i);
if (dup.length) err(`дублирующиеся id в index.html: ${[...new Set(dup)].join(', ')}`);
const htmlIdSet = new Set(htmlIds);

const jsFiles = fs.readdirSync(path.join(root, 'src'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));
const usedIds = new Set();
for (const f of jsFiles) {
  const code = fs.readFileSync(path.join(root, 'src', f), 'utf8');
  for (const m of code.matchAll(/\$\('([^']+)'\)/g)) usedIds.add(m[1]);
  for (const m of code.matchAll(/getElementById\('([^']+)'\)/g)) usedIds.add(m[1]);
}
for (const id of usedIds) {
  if (!htmlIdSet.has(id)) err(`JS запрашивает id «${id}», но его нет в index.html`);
}
for (const id of htmlIdSet) {
  if (!usedIds.has(id) && !DYNAMIC_IDS.has(id)) warn(`id «${id}» есть в HTML, но не запрашивается в JS`);
}

// ── Итог ──────────────────────────────────────────────────
console.log(`Категорий: ${CATEGORIES.length}, сочетаний: ${SHORTCUTS.length}`);
console.log(`Строк i18n: ${ruKeys.length}, id в HTML: ${htmlIdSet.size}, id используется в JS: ${usedIds.size}`);
if (warnings.length) {
  console.log('\n⚠ Предупреждения:');
  warnings.forEach((w) => console.log('  - ' + w));
}
if (errors.length) {
  console.log('\n✗ Ошибки:');
  errors.forEach((e) => console.log('  - ' + e));
  process.exit(1);
}
console.log('\n✓ Валидация пройдена');
