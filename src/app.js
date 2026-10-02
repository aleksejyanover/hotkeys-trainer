import { CATEGORIES, SHORTCUTS, comboFor, isOsLevel } from './data.js';
import { I18N } from './i18n.js';
import { store } from './store.js';
import { renderComboChips, renderKeyboard, comboToKeyIds } from './keyboard.js';
import { trainer } from './trainer.js';

const $ = (id) => document.getElementById(id);
const t = (key) => I18N[store.lang][key] ?? key;

let activeCat = 'all';
let mapSelectedId = null;
let mapKeyFilter = null; // id клавиши-фильтра

// ── Данные: каталог + пользовательские ────────────────────
function allShortcuts() {
  const customItems = store.custom.map((c) => ({
    id: c.id,
    cat: 'my',
    custom: true,
    title: { ru: c.title, en: c.title },
    desc: { ru: '', en: '' },
    combo: { mac: c.combo, win: c.combo }
  }));
  return [...SHORTCUTS, ...customItems];
}

const visibleOn = (s) => Boolean(comboFor(s, store.platform));
const availableIds = () => allShortcuts().filter(visibleOn).map((s) => s.id);
const itemsInCat = (catId) => allShortcuts().filter((s) => visibleOn(s) && s.cat === catId);

// ── Статичные подписи ─────────────────────────────────────
function applyStatic() {
  document.documentElement.lang = store.lang;
  document.documentElement.dataset.theme = store.theme;

  $('app-title').textContent = t('appTitle');
  $('app-tagline').textContent = t('appTagline');
  $('tab-learn').textContent = t('tabLearn');
  $('tab-trainer').textContent = t('tabTrainer');
  $('tab-map').textContent = t('tabMap');
  $('tab-progress').textContent = t('tabProgress');
  $('tab-search').textContent = t('tabSearch');
  $('tab-notes').textContent = t('tabNotes');
  $('lang-label').textContent = t('language');
  $('platform-label').textContent = t('platform');
  $('theme-label').textContent = t('theme');
  $('sound-label').textContent = t('sound');
  $('tip-title').textContent = t('tipTitle');

  $('search-input').placeholder = t('searchPlaceholder');
  $('notes-title').textContent = '⭐ ' + t('tabNotes');
  $('notes-empty').textContent = t('notesEmpty');
  $('custom-title').textContent = t('notesCustomTitle');
  $('custom-hint').textContent = t('notesCustomHint');
  $('custom-name').placeholder = t('customTitlePlaceholder');
  $('custom-combo').placeholder = t('customComboPlaceholder');
  $('custom-add').textContent = t('customAdd');

  $('map-hint').textContent = t('mapHint');
  $('map-clear').textContent = t('mapClear');

  $('prog-learned-label').textContent = t('progLearned');
  $('prog-accuracy-label').textContent = t('progAccuracy');
  $('prog-attempts-label').textContent = t('progAttempts');
  $('prog-streak-label').textContent = t('progStreak');
  $('daily-title').textContent = t('dailyTitle');
  $('daily-new-label').textContent = t('dailyNew');
  $('daily-review-label').textContent = t('dailyReview');
  $('prog7-title').textContent = t('prog7');
  $('prog-cat-title').textContent = t('progCats');
  $('weak-title').textContent = t('weakTitle');
  $('weak-hint').textContent = t('weakHint');
  $('data-title').textContent = t('dataTitle');
  $('data-hint').textContent = t('dataHint');
  $('export-btn').textContent = t('exportBtn');
  $('import-btn').textContent = t('importBtn');

  document.querySelectorAll('#lang-switch button').forEach((b) =>
    b.classList.toggle('active', b.dataset.lang === store.lang));
  document.querySelectorAll('#platform-switch button').forEach((b) =>
    b.classList.toggle('active', b.dataset.platform === store.platformChoice));
  document.querySelectorAll('#theme-switch button').forEach((b) =>
    b.classList.toggle('active', b.dataset.theme === store.theme));
  document.querySelectorAll('#sound-switch button').forEach((b) =>
    b.classList.toggle('active', (b.dataset.sound === 'on') === store.sfxEnabled));
}

// ── Учебник ───────────────────────────────────────────────
function renderChips() {
  const box = $('category-chips');
  box.innerHTML = '';
  const items = allShortcuts().filter(visibleOn);
  const cats = CATEGORIES.filter((c) => c.id === 'my' || items.some((s) => s.cat === c.id));

  const mk = (id, label) => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (activeCat === id ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => { activeCat = id; renderChips(); renderLearn(); };
    box.appendChild(btn);
  };

  mk('all', `${t('tabLearn')} (${items.length})`);
  cats.forEach((c) => {
    const n = items.filter((s) => s.cat === c.id).length;
    mk(c.id, `${c.icon} ${c.title[store.lang]} (${n})`);
  });
}

function shortcutCard(s) {
  const item = document.createElement('div');
  item.className = 'shortcut-item';

  const combo = comboFor(s, store.platform);
  const osLevel = isOsLevel(s, store.platform);
  const note = store.notes[s.id];
  const learned = store.isLearned(s.id);

  const head = document.createElement('div');
  head.className = 'shortcut-head';

  const title = document.createElement('div');
  title.className = 'shortcut-title';
  title.append(document.createTextNode(s.title[store.lang]));
  if (osLevel) title.appendChild(badge(t('osBadge'), ''));
  if (note) title.appendChild(badge('⭐', 'note-badge'));
  if (learned) title.appendChild(badge('✓', 'learned-badge'));

  const keys = document.createElement('div');
  keys.className = 'keys';
  renderComboChips(keys, combo);

  head.append(title, keys);
  item.appendChild(head);

  const desc = document.createElement('p');
  desc.className = 'shortcut-desc';
  desc.textContent = s.desc[store.lang] || '';
  item.appendChild(desc);

  const detail = document.createElement('div');
  detail.className = 'shortcut-detail';

  if (s.opens) {
    const opens = document.createElement('p');
    opens.className = 'shortcut-desc';
    opens.textContent = s.opens[store.lang];
    detail.appendChild(opens);
  }
  if (osLevel) {
    const h = document.createElement('p');
    h.className = 'os-hint';
    h.textContent = t('osHint');
    detail.appendChild(h);
  }

  const label = document.createElement('div');
  label.className = 'hint';
  label.textContent = t('note');
  const ta = document.createElement('textarea');
  ta.className = 'note-area';
  ta.placeholder = t('notePlaceholder');
  ta.value = note || '';
  ta.addEventListener('click', (e) => e.stopPropagation());
  ta.addEventListener('input', () => {
    store.setNote(s.id, ta.value);
    saved.textContent = ta.value.trim() ? t('noteSaved') : '';
    setTimeout(() => { saved.textContent = ''; }, 1500);
  });
  const saved = document.createElement('div');
  saved.className = 'note-saved';
  detail.append(label, ta, saved);

  item.appendChild(detail);
  item.addEventListener('click', () => item.classList.toggle('open'));
  return item;
}

function badge(text, cls) {
  const b = document.createElement('span');
  b.className = 'badge' + (cls ? ' ' + cls : '');
  b.textContent = text;
  return b;
}

function renderLearn() {
  const list = $('learn-list');
  list.innerHTML = '';
  let items = allShortcuts().filter(visibleOn);
  if (activeCat !== 'all') items = items.filter((s) => s.cat === activeCat);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = t('emptyCategory');
    list.appendChild(empty);
    return;
  }
  items.forEach((s) => list.appendChild(shortcutCard(s)));
}

// ── Поиск ─────────────────────────────────────────────────
function renderSearch() {
  const q = $('search-input').value.trim().toLowerCase();
  const list = $('search-list');
  const count = $('search-count');
  list.innerHTML = '';
  if (!q) { count.textContent = ''; return; }

  const results = allShortcuts().filter((s) => {
    if (!visibleOn(s)) return false;
    const cat = CATEGORIES.find((c) => c.id === s.cat);
    const hay = [
      s.title.ru, s.title.en, s.desc.ru, s.desc.en,
      s.combo.mac, s.combo.win,
      cat ? cat.title.ru : '', cat ? cat.title.en : ''
    ].filter(Boolean);
    return hay.join(' ').toLowerCase().includes(q);
  });

  count.textContent = `${t('searchResults')}: ${results.length}`;
  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = t('searchNone');
    list.appendChild(empty);
    return;
  }
  results.forEach((s) => list.appendChild(shortcutCard(s)));
}

// ── Заметки ───────────────────────────────────────────────
function renderNotes() {
  const list = $('notes-list');
  list.innerHTML = '';
  const withNotes = allShortcuts().filter((s) => store.notes[s.id]);
  $('notes-empty').classList.toggle('hidden', withNotes.length > 0);
  withNotes.forEach((s) => {
    const card = shortcutCard(s);
    card.classList.add('open');
    list.appendChild(card);
  });

  const cl = $('custom-list');
  cl.innerHTML = '';
  store.custom.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    const head = document.createElement('div');
    head.className = 'shortcut-head';
    const title = document.createElement('div');
    title.className = 'shortcut-title';
    title.textContent = c.title;
    const right = document.createElement('div');
    right.className = 'keys';
    const combo = document.createElement('span');
    combo.className = 'combo-text';
    combo.textContent = c.combo;
    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '✕ ' + t('customDelete');
    del.onclick = () => { store.removeCustom(c.id); renderAll(); };
    right.append(combo, del);
    head.append(title, right);
    item.appendChild(head);
    cl.appendChild(item);
  });
}

function addCustom() {
  const name = $('custom-name').value.trim();
  const combo = $('custom-combo').value.trim();
  if (!name || !combo) return;
  store.addCustom(name, combo);
  $('custom-name').value = '';
  $('custom-combo').value = '';
  renderAll();
}

// ── Карта клавиш ──────────────────────────────────────────
function fillMapSelect() {
  const sel = $('map-select');
  const prev = mapSelectedId;
  sel.innerHTML = '';
  const items = allShortcuts().filter(visibleOn);
  for (const c of CATEGORIES) {
    const inCat = items.filter((s) => s.cat === c.id);
    if (!inCat.length) continue;
    const og = document.createElement('optgroup');
    og.label = `${c.icon} ${c.title[store.lang]}`;
    inCat.forEach((s) => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = `${s.title[store.lang]} — ${comboFor(s, store.platform)}`;
      og.appendChild(o);
    });
    sel.appendChild(og);
  }
  if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  else if (sel.options.length) mapSelectedId = sel.options[0].value;
}

function renderMap() {
  fillMapSelect();
  const sel = $('map-select');
  const items = allShortcuts().filter(visibleOn);
  const s = items.find((x) => x.id === sel.value) || items[0];
  if (!s) return;
  mapSelectedId = s.id;

  const combo = comboFor(s, store.platform);
  renderComboChips($('map-combo'), combo);
  $('map-desc').textContent = (s.desc[store.lang] || '') + (s.opens ? ' · ' + s.opens[store.lang] : '');

  // подсветка: комбинация (+ ключ-фильтр, если выбран)
  let keyIds = comboToKeyIds(combo);
  if (mapKeyFilter) keyIds = [...new Set([...keyIds, mapKeyFilter])];
  renderKeyboard($('map-keyboard'), store.platform, keyIds);

  // список сочетаний, содержащих выбранные клавиши
  const filter = mapKeyFilter ? [mapKeyFilter] : null;
  const related = filter
    ? items.filter((x) => comboToKeyIds(comboFor(x, store.platform)).some((id) => filter.includes(id)))
    : [s];

  $('map-count').textContent = filter
    ? `${t('mapRelated')} · ${t('mapFilterBy')} [${filter.join(', ')}] — ${related.length}`
    : `${t('mapSelectLabel')}: ${related.length}`;
  const list = $('map-list');
  list.innerHTML = '';
  if (!related.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = t('mapNone');
    list.appendChild(p);
    return;
  }
  related.forEach((x) => list.appendChild(shortcutCard(x)));
}

// ── Прогресс ──────────────────────────────────────────────
function renderProgress() {
  const ids = availableIds();
  const sum = store.summary(ids);

  $('prog-learned').textContent = `${sum.learned}/${sum.total}`;
  $('prog-accuracy').textContent = sum.accuracy + '%';
  $('prog-attempts').textContent = sum.attempts;
  $('prog-streak').textContent = sum.streak;

  // челлендж
  const d = store.daily();
  setBar('daily-new', d.newDone, d.goalNew);
  setBar('daily-review', d.reviewDone, d.goalReview);
  const done = d.newDone >= d.goalNew && d.reviewDone >= d.goalReview;
  $('daily-streak').textContent = done
    ? t('dailyDone')
    : (d.streak > 0 ? t('dailyStreak').replace('{n}', d.streak) : t('dailyStreakZero'));

  // график 7 дней
  const chart = $('chart');
  chart.innerHTML = '';
  const max = Math.max(1, ...sum.days.map((x) => x.attempts));
  for (const day of sum.days) {
    const col = document.createElement('div');
    col.className = 'chart-col';
    const h = day.attempts ? Math.max(6, Math.round((day.attempts / max) * 100)) : 2;
    col.innerHTML = `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${h}%" title="${day.date}: ${day.attempts}"></div></div>
      <div class="chart-label"></div>`;
    col.querySelector('.chart-label').textContent =
      new Date(day.date + 'T12:00:00').toLocaleDateString(
        store.lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' });
    if (!day.attempts) col.classList.add('dim');
    chart.appendChild(col);
  }

  // категории
  const catsBox = $('cat-progress');
  catsBox.innerHTML = '';
  const stats = store.categoryStats(CATEGORIES, itemsInCat);
  for (const st of stats) {
    const pct = Math.round((st.learned / st.total) * 100);
    const row = document.createElement('div');
    row.className = 'daily-row';
    row.innerHTML = `<span>${st.cat.icon} ${st.cat.title[store.lang]}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <span class="daily-count">${st.learned}/${st.total}</span>`;
    catsBox.appendChild(row);
  }

  // слабые места
  const weakBox = $('weak-list');
  weakBox.innerHTML = '';
  const weak = store.weakSpots(ids);
  if (!weak.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = t('weakNone');
    weakBox.appendChild(p);
  } else {
    for (const w of weak) {
      const s = allShortcuts().find((x) => x.id === w.id);
      if (!s) continue;
      const item = document.createElement('div');
      item.className = 'shortcut-item';
      const head = document.createElement('div');
      head.className = 'shortcut-head';
      const title = document.createElement('div');
      title.className = 'shortcut-title';
      title.textContent = s.title[store.lang];
      const acc = badge(`${t('weakAccuracy')}: ${Math.round(w.acc * 100)}%`, 'weak-badge');
      title.appendChild(acc);
      const keys = document.createElement('div');
      keys.className = 'keys';
      renderComboChips(keys, comboFor(s, store.platform));
      const train = document.createElement('button');
      train.className = 'btn ghost';
      train.textContent = t('weakTrain');
      train.onclick = (e) => {
        e.stopPropagation();
        trainer.setMode('classic');
        switchTab('trainer');
        trainer.start({ ids: [w.id, ...ids.filter((x) => x !== w.id).sort(() => Math.random() - 0.5).slice(0, 9)] });
      };
      keys.appendChild(train);
      head.append(title, keys);
      item.appendChild(head);
      const desc = document.createElement('p');
      desc.className = 'shortcut-desc';
      desc.textContent = s.desc[store.lang] || '';
      item.appendChild(desc);
      weakBox.appendChild(item);
    }
  }
}

function setBar(prefix, value, goal) {
  const pct = Math.min(100, Math.round((value / Math.max(1, goal)) * 100));
  $(prefix + '-bar').style.width = pct + '%';
  $(prefix + '-count').textContent = `${value}/${goal}`;
}

// ── Экспорт / импорт ──────────────────────────────────────
async function exportData() {
  const status = $('data-status');
  status.textContent = '…';
  try {
    const json = store.exportBundle();
    const path = await window.hotkeysTrainer.exportData(json);
    status.textContent = path ? `${t('dataExported')} ${path}` : '';
  } catch {
    status.textContent = t('dataImportErr');
  }
}

async function importData() {
  const status = $('data-status');
  try {
    const res = await window.hotkeysTrainer.importData();
    if (!res) return;
    if (res.error) { status.textContent = t('dataImportErr'); return; }
    if (store.importBundle(res)) {
      status.textContent = t('dataImported');
      renderAll();
    } else status.textContent = t('dataImportErr');
  } catch {
    status.textContent = t('dataImportErr');
  }
}

// ── Табы ──────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach((p) =>
    p.classList.toggle('active', p.id === 'panel-' + tab));
  if (tab === 'search') setTimeout(() => $('search-input').focus(), 50);
  if (tab === 'notes') renderNotes();
  if (tab === 'map') renderMap();
  if (tab === 'progress') renderProgress();
  if (tab === 'learn') { renderChips(); renderLearn(); }
}

// ── Общий рендер ──────────────────────────────────────────
function renderAll() {
  applyStatic();
  trainer.applyLabels();
  renderChips();
  renderLearn();
  renderSearch();
  renderNotes();
  if ($('panel-map').classList.contains('active')) renderMap();
  if ($('panel-progress').classList.contains('active')) renderProgress();
}

// ── События ───────────────────────────────────────────────
function bindEvents() {
  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (btn) switchTab(btn.dataset.tab);
  });

  $('lang-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    store.setLang(btn.dataset.lang);
    renderAll();
  });

  $('platform-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-platform]');
    if (!btn) return;
    store.setPlatformChoice(btn.dataset.platform);
    renderAll();
  });

  $('theme-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-theme]');
    if (!btn) return;
    store.setTheme(btn.dataset.theme);
    applyStatic();
  });

  $('sound-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-sound]');
    if (!btn) return;
    store.setSfxEnabled(btn.dataset.sound === 'on');
    applyStatic();
  });

  $('search-input').addEventListener('input', renderSearch);
  $('custom-add').addEventListener('click', addCustom);
  $('custom-combo').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCustom(); });

  $('map-select').addEventListener('change', () => { mapKeyFilter = null; renderMap(); });
  $('map-keyboard').addEventListener('click', (e) => {
    const key = e.target.closest('.kb-key');
    if (!key || !key.dataset.keyId) return;
    mapKeyFilter = mapKeyFilter === key.dataset.keyId ? null : key.dataset.keyId;
    renderMap();
  });
  $('map-clear').addEventListener('click', () => { mapKeyFilter = null; renderMap(); });

  $('export-btn').addEventListener('click', exportData);
  $('import-btn').addEventListener('click', importData);
}

// ── Запуск ────────────────────────────────────────────────
bindEvents();
trainer.init({
  allShortcuts,
  categories: () => CATEGORIES,
  onFinished: () => { /* прогресс перерисуется при переходе на вкладку */ }
});
renderAll();
switchTab('learn');
