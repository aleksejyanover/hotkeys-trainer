// Тренажёр: 4 режима — классический, спринт, квиз, печать.
import { comboFor, isOsLevel } from './data.js';
import { I18N } from './i18n.js';
import { store } from './store.js';
import { renderKeyboard, comboToKeyIds, renderTokenChips, renderComboChips } from './keyboard.js';
import { TYPING_TEXTS } from './typing.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const t = (key) => I18N[store.lang][key] ?? key;

// ── Разбор комбинаций и клавиатурных событий ──────────────
const MOD_KEYS = { cmd: 'meta', meta: 'meta', command: 'meta', ctrl: 'ctrl', control: 'ctrl',
  opt: 'alt', alt: 'alt', option: 'alt', shift: 'shift' };

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

function parseCombo(str) {
  const exp = { meta: false, ctrl: false, alt: false, shift: false, key: null };
  if (!str) return exp;
  for (const raw of str.split('+')) {
    const part = raw.trim();
    if (!part) continue;
    const low = part.toLowerCase();
    if (MOD_KEYS[low]) exp[MOD_KEYS[low]] = true;
    else if (NAMED_KEYS[low]) exp.key = NAMED_KEYS[low];
    else if (part.length === 1) exp.key = part.toUpperCase();
    else if (/^f\d{1,2}$/i.test(part)) exp.key = part.toUpperCase();
    else exp.key = part;
  }
  return exp;
}

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
  return e.metaKey === exp.meta && e.ctrlKey === exp.ctrl && e.altKey === exp.alt &&
    e.shiftKey === exp.shift && keyFromEvent(e) === exp.key;
}

function pressedTokens(e) {
  const tokens = [];
  if (e.ctrlKey) tokens.push('Ctrl');
  if (e.altKey) tokens.push(store.platform === 'mac' ? 'Opt' : 'Alt');
  if (e.shiftKey) tokens.push('Shift');
  if (e.metaKey) tokens.push(store.platform === 'mac' ? 'Cmd' : 'Win');
  const key = keyFromEvent(e);
  if (key && !['Meta', 'Shift', 'Control', 'Alt'].includes(key)) tokens.push(key);
  return tokens;
}

const isPureModifier = (e) => ['Shift', 'Control', 'Meta', 'Alt', 'CapsLock', 'Dead'].includes(e.key);

function setTrainerActive(active) {
  if (window.hotkeysTrainer && typeof window.hotkeysTrainer.setTrainerMode === 'function') {
    window.hotkeysTrainer.setTrainerMode(active).catch(() => {});
  }
}

// ── Состояние модуля ──────────────────────────────────────
let ctx = null;                 // { t, allShortcuts, onFinished }
let mode = 'classic';
let running = false;
let pool = [], idx = 0;
let score = 0, attempts = 0, streak = 0, best = 0;
let locked = false;
let wrongThisTask = 0;
let mapVisible = false;
let timer = null, timeLeft = 60;
let quizCorrectId = null, quizLocked = false, quizPrevIdx = -1;
let typingText = '', typingEls = [], typeStart = 0, typeDone = false, typingPrev = '';

export const trainer = {
  get mode() { return mode; },
  get running() { return running; },

  init(context) {
    ctx = context;
    bindEvents();
    applyLabels();
  },

  // перевести текста внутри тренажёра
  applyLabels,

  fillCategorySelect,

  setMode(m) {
    if (running) trainer.stop(false);
    mode = ['classic', 'sprint', 'quiz', 'typing'].includes(m) ? m : 'classic';
    document.querySelectorAll('#trainer-modes .chip').forEach((b) =>
      b.classList.toggle('active', b.dataset.mode === mode));
    applyModeUi();
    applyLabels();
  },

  start(opts = {}) {
    const platform = store.platform;
    if (mode === 'typing') {
      running = true;
      hideSetupAndResult();
      applyModeUi();
      setupTyping();
      return;
    }
    // пул задач: сначала созревшие для повторения (SRS), затем новые
    let items = ctx.allShortcuts().filter(
      (s) => comboFor(s, platform) && !isOsLevel(s, platform));
    if (opts.ids) items = items.filter((s) => opts.ids.includes(s.id));
    else if (opts.category && opts.category !== 'all') items = items.filter((s) => s.cat === opts.category);
    if (!items.length) return;

    const now = Date.now();
    const rank = (s) => { const p = store.progressOf(s.id); if (!p) return 1; return p.due <= now ? 0 : 2; };
    pool = items.map((s) => ({ s, r: rank(s), r2: Math.random() }))
      .sort((a, b) => a.r - b.r || a.r2 - b.r2).map((x) => x.s);

    idx = 0; score = 0; attempts = 0; streak = 0; best = 0;
    locked = false; quizLocked = false; wrongThisTask = 0;

    running = true;
    setTrainerActive(mode === 'classic' || mode === 'sprint');
    hideSetupAndResult();
    applyModeUi();
    updateStats();

    if (mode === 'classic') showTask();
    else if (mode === 'sprint') { timeLeft = 60; $('sprint-time').textContent = timeLeft; startTimer(); showTask(); }
    else if (mode === 'quiz') nextQuiz();
  },

  stop(showResult = true) {
    running = false;
    locked = false; quizLocked = false;
    stopTimer();
    setTrainerActive(false);
    $('trainer-game').classList.add('hidden');
    if (showResult && mode !== 'typing') {
      sfx.finish();
      $('trainer-result').classList.remove('hidden');
      renderResult();
      if (ctx && ctx.onFinished) ctx.onFinished();
    } else {
      $('trainer-setup').classList.remove('hidden');
    }
  }
};

// ── UI-помощники ──────────────────────────────────────────
function hideSetupAndResult() {
  $('trainer-setup').classList.add('hidden');
  $('trainer-result').classList.add('hidden');
  $('trainer-game').classList.remove('hidden');
}

function applyModeUi() {
  const isCard = mode === 'classic' || mode === 'sprint';
  $('trainer-card').classList.toggle('hidden', !isCard);
  $('quiz-area').classList.toggle('hidden', mode !== 'quiz');
  $('typing-area').classList.toggle('hidden', mode !== 'typing');
  $('sprint-stat').classList.toggle('hidden', mode !== 'sprint');
  $('trainer-cat-field').classList.toggle('hidden', mode === 'typing');
  $('trainer-map-toggle').classList.toggle('hidden', !isCard);
  $('trainer-answer').classList.toggle('hidden', mode !== 'classic');
  $('trainer-skip').classList.toggle('hidden', mode === 'quiz' || mode === 'typing');
  $('hint-keyboard').classList.toggle('hidden', !(mapVisible && isCard));
}

function applyLabels() {
  $('mode-classic').textContent = t('modeClassic');
  $('mode-sprint').textContent = t('modeSprint');
  $('mode-quiz').textContent = t('modeQuiz');
  $('mode-typing').textContent = t('modeTyping');
  $('mode-hint').textContent = t('modeHint' + mode.charAt(0).toUpperCase() + mode.slice(1));
  $('trainer-start').textContent = t('trainerStart');
  $('trainer-hint').textContent = t('trainerOnlyCapturable');
  $('trainer-cat-label').textContent = t('trainerPickCategory');
  $('task-prompt').textContent = t('trainerPrompt');
  $('trainer-map-toggle').textContent = t('trainerMapBtn');
  $('trainer-answer').textContent = t('trainerShowAnswer');
  $('trainer-skip').textContent = t('trainerSkip');
  $('trainer-stop').textContent = t('trainerStop');
  $('stat-score-label').textContent = t('trainerScore');
  $('stat-attempts-label').textContent = t('trainerAttempts');
  $('stat-streak-label').textContent = t('trainerStreak');
  $('sprint-time-label').textContent = t('sprintSeconds');
  $('quiz-ask').textContent = t('quizAsk');
  $('type-wpm-label').textContent = t('typeWpm');
  $('type-acc-label').textContent = t('typeAcc');
  $('type-best-label').textContent = t('typeBest');
  $('typing-restart').textContent = t('typeRestart');
  $('result-title').textContent = mode === 'sprint' ? t('sprintEndTitle') : t('trainerFinished');
  fillCategorySelect();
  renderTip();
}

function fillCategorySelect() {
  const sel = $('trainer-category');
  if (!sel || !ctx) return;
  const prev = sel.value;
  sel.innerHTML = '';
  const add = (val, label) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = label;
    sel.appendChild(o);
  };
  add('all', t('trainerAll'));
  const platform = store.platform;
  const poolAll = ctx.allShortcuts().filter((s) => comboFor(s, platform) && !isOsLevel(s, platform));
  const cats = new Map();
  for (const s of poolAll) cats.set(s.cat, (cats.get(s.cat) || 0) + 1);
  for (const c of ctx.categories()) {
    const n = cats.get(c.id) || 0;
    if (n > 0) add(c.id, `${c.icon} ${c.title[store.lang]} (${n})`);
  }
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function updateStats() {
  $('stat-score').textContent = score;
  $('stat-attempts').textContent = attempts;
  $('stat-streak').textContent = streak;
}

// ── Классический режим ────────────────────────────────────
const currentTask = () => pool[idx];

function showTask() {
  if (idx >= pool.length) { trainer.stop(true); return; }
  const s = currentTask();
  locked = false;
  wrongThisTask = 0;
  $('task-title').textContent = s.title[store.lang];
  $('task-desc').textContent = s.desc[store.lang] || '';
  $('task-prompt').textContent = t('trainerPrompt');
  $('key-display').innerHTML = '';
  const fb = $('trainer-feedback');
  fb.className = 'trainer-feedback hidden';
  fb.textContent = '';
  $('trainer-card').classList.remove('ok', 'fail');
  renderHintKeyboard(s);
}

function renderHintKeyboard(s) {
  const box = $('hint-keyboard');
  if (!mapVisible || !s) { box.innerHTML = ''; return; }
  const combo = comboFor(s, store.platform);
  renderKeyboard(box, store.platform, comboToKeyIds(combo));
}

function handleClassic(ok, s) {
  if (ok) {
    attempts++; score++; streak++;
    best = Math.max(best, streak);
    locked = true;
    store.record(s.id, wrongThisTask === 0);
    sfx.correct();
    const fb = $('trainer-feedback');
    fb.className = 'trainer-feedback ok';
    fb.textContent = t('trainerCorrect');
    $('trainer-card').classList.remove('fail');
    $('trainer-card').classList.add('ok');
    updateStats();
    setTimeout(() => { idx++; showTask(); }, 850);
  } else {
    attempts++;
    streak = 0;
    wrongThisTask++;
    sfx.wrong();
    const fb = $('trainer-feedback');
    fb.className = 'trainer-feedback fail';
    fb.textContent = t('trainerWrong');
    const card = $('trainer-card');
    card.classList.remove('ok');
    card.classList.add('fail');
    setTimeout(() => card.classList.remove('fail'), 350);
    updateStats();
  }
}

// ── Спринт ────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  timer = setInterval(() => {
    timeLeft -= 1;
    $('sprint-time').textContent = Math.max(0, timeLeft);
    if (timeLeft <= 5 && timeLeft > 0) sfx.tick();
    if (timeLeft <= 0) trainer.stop(true);
  }, 1000);
}
const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

function handleSprint(ok, s) {
  attempts++;
  if (ok) {
    score++; streak++;
    best = Math.max(best, streak);
    store.record(s.id, true);
    sfx.correct();
    idx = (idx + 1) % pool.length;
    const fb = $('trainer-feedback');
    fb.className = 'trainer-feedback ok';
    fb.textContent = t('trainerCorrect');
    $('trainer-card').classList.add('ok');
    updateStats();
    setTimeout(() => showTask(), 250);
  } else {
    streak = 0;
    store.record(s.id, false);
    sfx.wrong();
    const fb = $('trainer-feedback');
    fb.className = 'trainer-feedback fail';
    fb.textContent = `${t('trainerWrong')}`;
    const card = $('trainer-card');
    card.classList.add('fail');
    setTimeout(() => card.classList.remove('fail'), 300);
    updateStats();
  }
}

// ── Квиз ──────────────────────────────────────────────────
function nextQuiz() {
  if (!pool.length) { trainer.stop(true); return; }
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === quizPrevIdx) i = (i + 1) % pool.length;
  quizPrevIdx = i;
  const s = pool[i];
  quizCorrectId = s.id;
  quizLocked = false;

  renderComboChips($('quiz-combo'), comboFor(s, store.platform));

  // 4 варианта ответа
  const others = pool.filter((x) => x.id !== s.id);
  const distract = [];
  while (distract.length < 3 && others.length) {
    const pick = others.splice(Math.floor(Math.random() * others.length), 1)[0];
    distract.push(pick);
  }
  const options = [s, ...distract].sort(() => Math.random() - 0.5);

  const box = $('quiz-options');
  box.innerHTML = '';
  options.forEach((o, i2) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = o.title[store.lang];
    btn.onclick = () => answerQuiz(o.id === quizCorrectId, btn, o, s);
    box.appendChild(btn);
  });

  const fb = $('quiz-feedback');
  fb.className = 'trainer-feedback hidden';
  fb.textContent = '';
}

function answerQuiz(ok, btn, chosen, correct) {
  if (quizLocked) return;
  quizLocked = true;
  attempts++;
  store.record(correct.id, ok);
  if (ok) { score++; streak++; best = Math.max(best, streak); sfx.correct(); }
  else { streak = 0; sfx.wrong(); }
  updateStats();

  document.querySelectorAll('.quiz-option').forEach((b) => b.disabled = true);
  if (ok) {
    btn.classList.add('right');
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('.quiz-option').forEach((b) => {
      if (b.textContent === correct.title[store.lang]) b.classList.add('right');
    });
  }
  const fb = $('quiz-feedback');
  fb.className = 'trainer-feedback ' + (ok ? 'ok' : 'fail');
  fb.textContent = ok ? t('quizRight') : t('quizWrong');
  setTimeout(() => nextQuiz(), 1300);
}

// ── Печать ────────────────────────────────────────────────
function setupTyping() {
  const texts = TYPING_TEXTS[store.lang] || TYPING_TEXTS.en;
  let pick = texts[Math.floor(Math.random() * texts.length)];
  if (texts.length > 1 && pick === typingPrev) pick = texts[(texts.indexOf(pick) + 1) % texts.length];
  typingPrev = pick;
  typingText = pick;
  typeStart = 0;
  typeDone = false;

  const box = $('typing-text');
  box.innerHTML = '';
  typingEls = [];
  for (const ch of typingText) {
    const sp = document.createElement('span');
    sp.textContent = ch;
    box.appendChild(sp);
    typingEls.push(sp);
  }
  const ta = $('typing-input');
  ta.value = '';
  ta.disabled = false;
  updateTypingLive();
  setTimeout(() => ta.focus(), 60);
}

function updateTypingLive(val = $('typing-input').value) {
  const typed = val.length;
  let correctChars = 0;
  typingEls.forEach((sp, i) => {
    sp.classList.remove('ok', 'err', 'cur');
    if (i < typed) {
      if (sp.textContent === val[i]) { sp.classList.add('ok'); correctChars++; }
      else sp.classList.add('err');
    } else if (i === typed) {
      sp.classList.add('cur');
    }
  });
  const elapsedMin = typeStart ? (Date.now() - typeStart) / 60000 : 0;
  const wpm = elapsedMin > 0 ? Math.round((typed / 5) / elapsedMin) : 0;
  const acc = typed ? Math.round((correctChars / typed) * 100) : 100;
  $('type-wpm').textContent = wpm;
  $('type-acc').textContent = acc + '%';
  $('type-best').textContent = store.typingBest();
  return { wpm, acc, correctChars };
}

function finishTyping(val) {
  typeDone = true;
  const st = updateTypingLive(val);
  store.setTypingBest(st.wpm);
  sfx.finish();
  running = false;
  $('trainer-game').classList.add('hidden');
  $('trainer-result').classList.remove('hidden');
  $('result-title').textContent = t('typeFinished');
  document.querySelector('#trainer-result .result-emoji').textContent = '⌨️';
  const secs = typeStart ? Math.round((Date.now() - typeStart) / 1000) : 0;
  $('result-stats').innerHTML = `
    <div><b>${st.wpm}</b>${t('typeWpm')}</div>
    <div><b>${st.acc}%</b>${t('typeAcc')}</div>
    <div><b>${secs}s</b>${t('typeResult')}</div>
    <div><b>${store.typingBest()}</b>${t('typeBest')}</div>`;
  if (ctx && ctx.onFinished) ctx.onFinished();
}

// ── Результат ─────────────────────────────────────────────
function renderResult() {
  document.querySelector('#trainer-result .result-emoji').textContent =
    mode === 'sprint' ? t('sprintEndEmoji') : '🏆';
  $('result-title').textContent = mode === 'sprint' ? t('sprintEndTitle') : t('trainerFinished');
  const acc = attempts ? Math.round((score / attempts) * 100) : 0;
  if (mode === 'sprint') {
    $('result-stats').innerHTML = `
      <div><b>${score}</b>${t('trainerScore')}</div>
      <div><b>${attempts - score}</b>${t('trainerWrong')}</div>
      <div><b>${acc}%</b>%</div>
      <div><b>${score}</b>${t('sprintPerMin')}</div>`;
  } else {
    $('result-stats').innerHTML = `
      <div><b>${score}</b>${t('trainerScore')}</div>
      <div><b>${attempts}</b>${t('trainerAttempts')}</div>
      <div><b>${best}</b>${t('trainerStreak')}</div>
      <div><b>${acc}%</b>%</div>`;
  }
}

// ── Клавиатура: общий обработчик ───────────────────────────
function onKey(e) {
  if (!running) return;
  if (mode !== 'classic' && mode !== 'sprint') return;
  e.preventDefault();
  e.stopPropagation();
  if (locked || e.repeat || isPureModifier(e)) return;

  renderTokenChips($('key-display'), pressedTokens(e));

  const s = currentTask();
  if (!s) return;
  const exp = parseCombo(comboFor(s, store.platform));
  const ok = eventMatches(e, exp);
  if (mode === 'sprint') handleSprint(ok, s);
  else handleClassic(ok, s);
}

// ── Совет дня (вкладка тренажёра, не главная) ─────────────
function renderTip() {
  const body = $('tip-body');
  if (!body || !ctx) return;
  const platform = store.platform;
  const items = ctx.allShortcuts().filter((s) => comboFor(s, platform));
  if (!items.length) { body.innerHTML = ''; return; }
  // детерминированный выбор по дате — один совет в течение дня
  const now = new Date();
  const dayKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const s = items[dayKey % items.length];
  body.innerHTML = '';
  const combo = document.createElement('div');
  combo.className = 'tip-combo';
  renderComboChips(combo, comboFor(s, platform));
  const title = document.createElement('div');
  title.className = 'tip-title';
  title.textContent = `${s.title[store.lang]} — ${comboFor(s, platform)}`;
  const desc = document.createElement('div');
  desc.className = 'tip-desc';
  desc.textContent = s.desc[store.lang] || '';
  body.append(combo, title, desc);
}

// ── События ───────────────────────────────────────────────
function bindEvents() {
  window.addEventListener('keydown', onKey, true);

  $('trainer-modes').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (btn) trainer.setMode(btn.dataset.mode);
  });
  $('trainer-start').addEventListener('click', () => {
    trainer.start({ category: $('trainer-category').value });
  });
  $('trainer-again').addEventListener('click', () => {
    document.querySelector('#trainer-result .result-emoji').textContent = '🏆';
    $('trainer-result').classList.add('hidden');
    $('trainer-setup').classList.remove('hidden');
  });
  $('trainer-stop').addEventListener('click', () => trainer.stop(true));
  $('trainer-skip').addEventListener('click', () => {
    if (!running || mode !== 'classic') return;
    streak = 0;
    idx++;
    updateStats();
    showTask();
  });
  $('trainer-answer').addEventListener('click', () => {
    const s = currentTask();
    if (!s || mode !== 'classic') return;
    const combo = comboFor(s, store.platform);
    renderTokenChips($('key-display'), combo.split('+').map((x) => x.trim()).filter(Boolean));
    const fb = $('trainer-feedback');
    fb.className = 'trainer-feedback';
    fb.style.color = 'var(--yellow)';
    fb.textContent = `${t('comboLabel')}: ${combo}`;
    renderHintKeyboard(s);
  });
  $('trainer-map-toggle').addEventListener('click', () => {
    mapVisible = !mapVisible;
    $('trainer-map-toggle').classList.toggle('primary', mapVisible);
    applyModeUi();
    renderHintKeyboard(currentTask());
  });

  // квиз — клики обрабатываются при построении вариантов
  $('typing-input').addEventListener('input', () => {
    if (!running || mode !== 'typing' || typeDone) return;
    const ta = $('typing-input');
    if (!typeStart && ta.value.length) typeStart = Date.now();
    if (ta.value.length >= typingText.length) { finishTyping(ta.value); return; }
    updateTypingLive(ta.value);
  });
  $('typing-restart').addEventListener('click', () => {
    if (mode === 'typing') setupTyping();
  });
}
