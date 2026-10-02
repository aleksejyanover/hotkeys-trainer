import { CATEGORIES, SHORTCUTS, comboFor, isOsLevel } from './data.js';
import { I18N } from './i18n.js';

// ────────────────────────────────────────────────────────────
// Состояние и хранилище
// ────────────────────────────────────────────────────────────
const detectPlatform = () =>
  (window.hotkeysTrainer && window.hotkeysTrainer.platform === 'darwin') ? 'mac' : 'win';

const state = {
  lang: localStorage.getItem('ht_lang') || 'ru',
  platform: detectPlatform(),
  tab: 'learn',
  activeCat: 'all',
  trainer: { running: false, pool: [], idx: 0, score: 0, attempts: 0, streak: 0, best: 0, locked: false }
};

let notes = load('ht_notes', {});
let custom = load('ht_custom', []);

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const t = (key) => I18N[state.lang][key] ?? key;
const $ = (id) => document.getElementById(id);

// ────────────────────────────────────────────────────────────
// Сочетания: разбор и клавиатурные события
// ────────────────────────────────────────────────────────────
const MOD_KEYS = {
  cmd: 'meta', meta: 'meta', command: 'meta',
  ctrl: 'ctrl', control: 'ctrl',
  opt: 'alt', alt: 'alt', option: 'alt',
  shift: 'shift'
};

const NAMED_KEYS = {
  space: 'Space', enter: 'Enter', return: 'Enter', tab: 'Tab',
  backspace: 'Backspace', delete: 'Delete', del: 'Delete', escape: 'Escape', esc: 'Escape',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  comma: ',', period: '.', slash: '/', backslash: '\\',
  minus: '-', equal: '=', semicolon: ';', quote: "'",
  bracketleft: '[', bracketright: ']', backquote: '`'
};

const CODE_MAP = {
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down',
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
  Delete: 'Delete', Escape: 'Escape', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown',
  BracketLeft: '[', BracketRight: ']', Backquote: '`', Comma: ',',
  Period: '.', Slash: '/', Backslash: '\\', Minus: '-', Equal: '=',
  Semicolon: ';', Quote: "'"
};

// "Cmd+Shift+Z" → { meta:true, ctrl:false, alt:false, shift:true, key:'Z' }
function parseCombo(str) {
  const exp = { meta: false, ctrl: false, alt: false, shift: false, key: null };
  if (!str) return exp;
  for (const raw of str.split('+')) {
    const part = raw.trim();
    if (!part) continue;
    const low = part.toLowerCase();
    if (MOD_KEYS[low]) {
      exp[MOD_KEYS[low]] = true;
    } else if (NAMED_KEYS[low]) {
      exp.key = NAMED_KEYS[low];
    } else if (part.length === 1) {
      exp.key = part.toUpperCase();
    } else if (/^f\d{1,2}$/i.test(part)) {
      exp.key = part.toUpperCase();
    } else {
      exp.key = part; // например 'Left', 'PageUp'
      if (part.length > 1) {
        const canon = NAMED_KEYS[low];
        if (canon) exp.key = canon;
      }
    }
  }
  return exp;
}

// Код клавиши события → каноничное имя
function keyFromEvent(e) {
  const code = e.code || '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return code.slice(6);
  if (/^F\d{1,2}$/.test(code)) return code;
  if (CODE_MAP[code]) return CODE_MAP[code];
  const k = e.key;
  if (k === ' ' || k === 'Spacebar') return 'Space';
  if (k === 'Meta') return 'Meta';
  if (k && k.length === 1) return k.toUpperCase();
  return k || code;
}

function eventMatches(e, exp) {
  return (
    e.metaKey === exp.meta &&
    e.ctrlKey === exp.ctrl &&
    e.altKey === exp.alt &&
    e.shiftKey === exp.shift &&
    keyFromEvent(e) === exp.key
  );
}

// Нажатая комбинация → список токенов для отображения
function pressedTokens(e) {
  const tokens = [];
  if (e.ctrlKey) tokens.push('Ctrl');
  if (e.altKey) tokens.push(state.platform === 'mac' ? 'Opt' : 'Alt');
  if (e.shiftKey) tokens.push('Shift');
  if (e.metaKey) tokens.push(state.platform === 'mac' ? 'Cmd' : 'Win');
  const key = keyFromEvent(e);
  if (key && !['Meta', 'Shift', 'Control', 'Alt'].includes(key)) tokens.push(key);
  return tokens;
}

function renderTokens(container, tokens) {
  container.innerHTML = '';
  tokens.forEach((tok, i) => {
    if (i > 0) {
      const plus = document.createElement('span');
      plus.className = 'kbd-plus';
      plus.textContent = '+';
      container.appendChild(plus);
    }
    const kbd = document.createElement('kbd');
    kbd.textContent = tok;
    container.appendChild(kbd);
  });
}

function renderCombo(container, comboStr) {
  renderTokens(container, comboStr.split('+').map((s) => s.trim()).filter(Boolean));
}

// ────────────────────────────────────────────────────────────
// Данные: сочетания + пользовательские
// ────────────────────────────────────────────────────────────
function allShortcuts() {
  const customItems = custom.map((c) => ({
    id: c.id,
    cat: 'my',
    custom: true,
    title: { ru: c.title, en: c.title },
    desc: { ru: c.desc || '', en: c.desc || '' },
    combo: { mac: c.combo, win: c.combo }
  }));
  return [...SHORTCUTS, ...customItems];
}

const visibleOn = (s) => Boolean(comboFor(s, state.platform));

// ────────────────────────────────────────────────────────────
// Статичные подписи (i18n)
// ────────────────────────────────────────────────────────────
function applyStatic() {
  document.documentElement.lang = state.lang === 'ru' ? 'ru' : 'en';
  $('app-title').textContent = t('appTitle');
  $('app-tagline').textContent = t('appTagline');
  $('tab-learn').textContent = t('tabLearn');
  $('tab-trainer').textContent = t('tabTrainer');
  $('tab-search').textContent = t('tabSearch');
  $('tab-notes').textContent = t('tabNotes');
  $('lang-label').textContent = t('language');
  $('platform-label').textContent = t('platform');
  $('trainer-cat-label').textContent = t('trainerPickCategory');
  $('trainer-start').textContent = t('trainerStart');
  $('trainer-hint').textContent = t('trainerOnlyCapturable');
  $('task-prompt').textContent = t('trainerPrompt');
  $('trainer-answer').textContent = t('trainerShowAnswer');
  $('trainer-skip').textContent = t('trainerSkip');
  $('trainer-stop').textContent = t('trainerStop');
  $('result-title').textContent = t('trainerFinished');
  $('trainer-again').textContent = t('trainerStart');
  $('search-input').placeholder = t('searchPlaceholder');
  $('notes-title').textContent = '⭐ ' + t('tabNotes');
  $('notes-empty').textContent = t('notesEmpty');
  $('custom-title').textContent = t('notesCustomTitle');
  $('custom-hint').textContent = t('notesCustomHint');
  $('custom-name').placeholder = t('customTitlePlaceholder');
  $('custom-combo').placeholder = t('customComboPlaceholder');
  $('custom-add').textContent = t('customAdd');
  $('stat-score-label').textContent = t('trainerScore');
  $('stat-attempts-label').textContent = t('trainerAttempts');
  $('stat-streak-label').textContent = t('trainerStreak');
  $('stat-score').previousElementSibling; // no-op

  document.querySelectorAll('#lang-switch button').forEach((b) =>
    b.classList.toggle('active', b.dataset.lang === state.lang));
  document.querySelectorAll('#platform-switch button').forEach((b) =>
    b.classList.toggle('active', b.dataset.platform === state.platform));
}

// ────────────────────────────────────────────────────────────
// Учебник
// ────────────────────────────────────────────────────────────
function renderChips() {
  const box = $('category-chips');
  box.innerHTML = '';
  const items = allShortcuts().filter(visibleOn);
  const cats = CATEGORIES.filter((c) => c.id === 'my' || items.some((s) => s.cat === c.id));

  const mk = (id, label) => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (state.activeCat === id ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => { state.activeCat = id; renderChips(); renderLearn(); };
    box.appendChild(btn);
  };

  const allLabel = state.lang === 'ru'
    ? `Все (${items.length})`
    : `All (${items.length})`;
  mk('all', allLabel);
  cats.forEach((c) => {
    const n = items.filter((s) => s.cat === c.id).length;
    const name = typeof c.title === 'string' ? c.title : c.title[state.lang];
    mk(c.id, `${c.icon} ${name} (${n})`);
  });
}

function shortcutCard(s, opts = {}) {
  const item = document.createElement('div');
  item.className = 'shortcut-item';

  const combo = comboFor(s, state.platform);
  const osLevel = isOsLevel(s, state.platform);
  const note = notes[s.id];

  const head = document.createElement('div');
  head.className = 'shortcut-head';

  const title = document.createElement('div');
  title.className = 'shortcut-title';
  title.append(document.createTextNode(s.title[state.lang]));
  if (osLevel) {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = t('osBadge');
    title.appendChild(b);
  }
  if (note) {
    const b = document.createElement('span');
    b.className = 'badge note-badge';
    b.textContent = '⭐';
    title.appendChild(b);
  }

  const keys = document.createElement('div');
  keys.className = 'keys';
  renderCombo(keys, combo);

  head.append(title, keys);
  item.appendChild(head);

  const desc = document.createElement('p');
  desc.className = 'shortcut-desc';
  desc.textContent = s.desc[state.lang] || '';
  item.appendChild(desc);

  // Раскрываемая область: подсказка + заметка
  const detail = document.createElement('div');
  detail.className = 'shortcut-detail';

  if (s.opens) {
    const opens = document.createElement('p');
    opens.className = 'shortcut-desc';
    opens.textContent = s.opens[state.lang];
    detail.appendChild(opens);
  }
  if (osLevel) {
    const h = document.createElement('p');
    h.className = 'os-hint';
    h.textContent = t('osHint');
    detail.appendChild(h);
  }

  if (!opts.noNote) {
    const label = document.createElement('div');
    label.className = 'hint';
    label.textContent = t('note');
    const ta = document.createElement('textarea');
    ta.className = 'note-area';
    ta.placeholder = t('notePlaceholder');
    ta.value = note || '';
    ta.addEventListener('click', (e) => e.stopPropagation());
    ta.addEventListener('input', () => {
      notes[s.id] = ta.value;
      if (!ta.value.trim()) delete notes[s.id];
      save('ht_notes', notes);
      saved.textContent = ta.value.trim() ? t('noteSaved') : '';
      setTimeout(() => { saved.textContent = ''; }, 1500);
    });
    const saved = document.createElement('div');
    saved.className = 'note-saved';
    detail.append(label, ta, saved);
  }

  item.appendChild(detail);
  if (opts.noNote) item.style.cursor = 'default';
  else item.addEventListener('click', () => item.classList.toggle('open'));

  return item;
}

function renderLearn() {
  const list = $('learn-list');
  list.innerHTML = '';
  let items = allShortcuts().filter(visibleOn);
  if (state.activeCat !== 'all') items = items.filter((s) => s.cat === state.activeCat);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = t('emptyCategory');
    list.appendChild(empty);
    return;
  }
  items.forEach((s) => list.appendChild(shortcutCard(s)));
}

// ────────────────────────────────────────────────────────────
// Поиск
// ────────────────────────────────────────────────────────────
function renderSearch() {
  const q = $('search-input').value.trim().toLowerCase();
  const list = $('search-list');
  const count = $('search-count');
  list.innerHTML = '';
  if (!q) { count.textContent = ''; return; }

  const results = allShortcuts().filter((s) => {
    if (!visibleOn(s)) return false;
    const hay = [
      s.title.ru, s.title.en, s.desc.ru, s.desc.en,
      s.combo.mac, s.combo.win,
      (CATEGORIES.find((c) => c.id === s.cat) || {}).title
    ].filter(Boolean);
    const catTitle = CATEGORIES.find((c) => c.id === s.cat);
    if (catTitle && catTitle.title && catTitle.title.ru) hay.push(catTitle.title.ru, catTitle.title.en);
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

// ────────────────────────────────────────────────────────────
// Заметки и свои сочетания
// ────────────────────────────────────────────────────────────
function renderNotes() {
  const list = $('notes-list');
  list.innerHTML = '';
  const withNotes = allShortcuts().filter((s) => notes[s.id]);
  $('notes-empty').classList.toggle('hidden', withNotes.length > 0);
  withNotes.forEach((s) => {
    const card = shortcutCard(s);
    card.classList.add('open');
    list.appendChild(card);
  });

  const cl = $('custom-list');
  cl.innerHTML = '';
  custom.forEach((c) => {
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
    del.onclick = () => {
      custom = custom.filter((x) => x.id !== c.id);
      save('ht_custom', custom);
      renderAll();
    };
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
  custom.push({ id: 'custom-' + Date.now(), title: name, combo });
  save('ht_custom', custom);
  $('custom-name').value = '';
  $('custom-combo').value = '';
  renderAll();
}

// ────────────────────────────────────────────────────────────
// Тренажёр
// ────────────────────────────────────────────────────────────
function trainerPool() {
  let items = allShortcuts().filter(
    (s) => visibleOn(s) && !isOsLevel(s, state.platform) && comboFor(s, state.platform)
  );
  const cat = $('trainer-category').value;
  if (cat && cat !== 'all') items = items.filter((s) => s.cat === cat);
  // перемешать
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function fillTrainerCategories() {
  const sel = $('trainer-category');
  const prev = sel.value;
  sel.innerHTML = '';
  const add = (val, label) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = label;
    sel.appendChild(o);
  };
  add('all', t('trainerAll'));
  const poolAll = allShortcuts().filter((s) => visibleOn(s) && !isOsLevel(s, state.platform));
  CATEGORIES.filter((c) => c.id !== 'my').forEach((c) => {
    const n = poolAll.filter((s) => s.cat === c.id).length;
    if (n > 0) add(c.id, `${c.icon} ${c.title[state.lang]} (${n})`);
  });
  if (poolAll.some((s) => s.cat === 'my')) {
    add('my', `⭐ ${CATEGORIES.find((c) => c.id === 'my').title[state.lang]}`);
  }
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function setTrainerActive(active) {
  if (window.hotkeysTrainer && typeof window.hotkeysTrainer.setTrainerMode === 'function') {
    window.hotkeysTrainer.setTrainerMode(active).catch(() => {});
  }
}

function startTrainer() {
  const tr = state.trainer;
  tr.pool = trainerPool();
  if (!tr.pool.length) return;
  tr.idx = 0; tr.score = 0; tr.attempts = 0; tr.streak = 0; tr.best = 0; tr.locked = false;
  tr.running = true;
  setTrainerActive(true);
  $('trainer-setup').classList.add('hidden');
  $('trainer-result').classList.add('hidden');
  $('trainer-game').classList.remove('hidden');
  updateStats();
  showTask();
}

function stopTrainer(showResult = true) {
  const tr = state.trainer;
  tr.running = false;
  tr.locked = false;
  setTrainerActive(false);
  $('trainer-game').classList.add('hidden');
  if (showResult) {
    $('trainer-result').classList.remove('hidden');
    renderResult();
  } else {
    $('trainer-setup').classList.remove('hidden');
  }
}

function currentTask() {
  return state.trainer.pool[state.trainer.idx];
}

function showTask() {
  const tr = state.trainer;
  if (tr.idx >= tr.pool.length) { stopTrainer(true); return; }
  const s = currentTask();
  tr.locked = false;
  $('task-title').textContent = s.title[state.lang];
  $('task-desc').textContent = s.desc[state.lang] || '';
  $('task-prompt').textContent = t('trainerPrompt');
  $('key-display').innerHTML = '';
  const fb = $('trainer-feedback');
  fb.className = 'trainer-feedback hidden';
  fb.textContent = '';
  $('trainer-card').classList.remove('ok', 'fail');
}

function updateStats() {
  const tr = state.trainer;
  $('stat-score').textContent = tr.score;
  $('stat-attempts').textContent = tr.attempts;
  $('stat-streak').textContent = tr.streak;
}

function onTrainerKey(e) {
  const tr = state.trainer;
  e.preventDefault();
  e.stopPropagation();
  if (tr.locked || !tr.running) return;
  if (e.repeat) return;
  if (['Shift', 'Control', 'Meta', 'Alt', 'CapsLock', 'Dead'].includes(e.key)) return;

  const tokens = pressedTokens(e);
  renderTokens($('key-display'), tokens);

  const s = currentTask();
  if (!s) return;
  const exp = parseCombo(comboFor(s, state.platform));
  const fb = $('trainer-feedback');
  const card = $('trainer-card');

  if (eventMatches(e, exp)) {
    tr.attempts++;
    tr.score++;
    tr.streak++;
    tr.best = Math.max(tr.best, tr.streak);
    tr.locked = true;
    fb.className = 'trainer-feedback ok';
    fb.textContent = t('trainerCorrect');
    card.classList.remove('fail');
    card.classList.add('ok');
    updateStats();
    setTimeout(() => {
      tr.idx++;
      showTask();
    }, 850);
  } else {
    tr.attempts++;
    tr.streak = 0;
    fb.className = 'trainer-feedback fail';
    fb.textContent = `${t('trainerWrong')} — ${t('trainerYourPress')} ${tokens.join('+')}`;
    card.classList.remove('ok');
    card.classList.add('fail');
    updateStats();
    setTimeout(() => card.classList.remove('fail'), 350);
  }
}

function showAnswer() {
  const s = currentTask();
  if (!s) return;
  const combo = comboFor(s, state.platform);
  renderTokens($('key-display'), combo.split('+').map((x) => x.trim()));
  const fb = $('trainer-feedback');
  fb.className = 'trainer-feedback';
  fb.style.color = 'var(--yellow)';
  fb.textContent = `${t('comboLabel')}: ${combo}`;
}

function renderResult() {
  const tr = state.trainer;
  const acc = tr.attempts ? Math.round((tr.score / tr.attempts) * 100) : 0;
  $('result-stats').innerHTML = `
    <div><b>${tr.score}</b>${t('trainerScore')}</div>
    <div><b>${tr.attempts}</b>${t('trainerAttempts')}</div>
    <div><b>${tr.best}</b>${t('trainerStreak')}</div>
    <div><b>${acc}%</b>%</div>`;
}

// ────────────────────────────────────────────────────────────
// Табы и события
// ────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach((p) =>
    p.classList.toggle('active', p.id === 'panel-' + tab));
  if (tab === 'search') setTimeout(() => $('search-input').focus(), 50);
  if (tab === 'notes') renderNotes();
}

function renderAll() {
  applyStatic();
  fillTrainerCategories();
  renderChips();
  renderLearn();
  renderSearch();
  renderNotes();
}

function bindEvents() {
  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (btn) switchTab(btn.dataset.tab);
  });

  $('lang-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    state.lang = btn.dataset.lang;
    localStorage.setItem('ht_lang', state.lang);
    renderAll();
  });

  $('platform-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-platform]');
    if (!btn) return;
    if (state.trainer.running) stopTrainer(false);
    state.platform = btn.dataset.platform;
    renderAll();
    $('trainer-setup').classList.remove('hidden');
  });

  $('search-input').addEventListener('input', renderSearch);
  $('custom-add').addEventListener('click', addCustom);
  $('custom-combo').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCustom(); });

  $('trainer-start').addEventListener('click', startTrainer);
  $('trainer-again').addEventListener('click', () => {
    $('trainer-result').classList.add('hidden');
    $('trainer-setup').classList.remove('hidden');
  });
  $('trainer-stop').addEventListener('click', () => stopTrainer(true));
  $('trainer-skip').addEventListener('click', () => {
    if (!state.trainer.running) return;
    state.trainer.streak = 0;
    state.trainer.idx++;
    updateStats();
    showTask();
  });
  $('trainer-answer').addEventListener('click', showAnswer);

  window.addEventListener('keydown', (e) => {
    if (state.trainer.running) onTrainerKey(e);
  }, true);
}

// ────────────────────────────────────────────────────────────
// Запуск
// ────────────────────────────────────────────────────────────
bindEvents();
renderAll();
switchTab('learn');
