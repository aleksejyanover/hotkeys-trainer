// Хранилище состояния: язык/тема/платформа, заметки, свои сочетания,
// прогресс по каждой комбинации (SRS), статистика по дням, челлендж.

const KEY = 'ht_store_v2';
const DAY = 86400000;
// интервалы повторения в днях для «коробок» 0..5
const BOX_DAYS = [0, 1, 2, 4, 7, 14];
export const DAILY_GOALS = { new: 5, review: 10 };

function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const yesterdayStr = () => localDate(new Date(Date.now() - DAY));

function defaults() {
  return {
    lang: 'ru',
    platform: 'auto', // 'auto' | 'mac' | 'win'
    theme: 'dark',
    notes: {},
    custom: [],
    progress: {}, // id -> {seen, correct, wrong, box, due, lastAt}
    days: {},     // 'YYYY-MM-DD' -> {attempts, correct, wrong}
    daily: null,  // {date, newDone, reviewDone, streak, lastDate}
    typing: { best: 0 },
    sfx: true,    // звуки в тренажёре
    trainerMode: 'classic', // последний режим тренажёра
    trainerCat: 'all'       // последняя категория тренажёра
  };
}

function load() {
  const s = defaults();
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (raw && typeof raw === 'object') {
    Object.assign(s, raw);
    sanitize(s);
  } else {
    // миграция со старой версии (otдельные ключи)
    try {
      s.lang = localStorage.getItem('ht_lang') || s.lang;
      const n = JSON.parse(localStorage.getItem('ht_notes'));
      const c = JSON.parse(localStorage.getItem('ht_custom'));
      if (n && typeof n === 'object') s.notes = n;
      if (Array.isArray(c)) s.custom = c;
    } catch {}
    sanitize(s);
  }
  return s;
}

// Защита от испорченных данных (ручная правка localStorage, частичная запись):
// любое поле неожиданного типа сбрасывается к значению по умолчанию.
function sanitize(s) {
  const d = defaults();
  if (!['ru', 'en'].includes(s.lang)) s.lang = d.lang;
  if (!['auto', 'mac', 'win'].includes(s.platform)) s.platform = d.platform;
  if (!['dark', 'light'].includes(s.theme)) s.theme = d.theme;
  if (!s.notes || typeof s.notes !== 'object' || Array.isArray(s.notes)) s.notes = {};
  if (!Array.isArray(s.custom)) s.custom = [];
  s.custom = s.custom.filter((c) => c && typeof c === 'object' &&
    typeof c.id === 'string' && typeof c.title === 'string' && typeof c.combo === 'string');
  if (!s.progress || typeof s.progress !== 'object' || Array.isArray(s.progress)) s.progress = {};
  for (const [id, p] of Object.entries(s.progress)) {
    if (!p || typeof p !== 'object' ||
        typeof p.seen !== 'number' || typeof p.correct !== 'number' ||
        typeof p.wrong !== 'number' || typeof p.box !== 'number' ||
        typeof p.due !== 'number') delete s.progress[id];
  }
  if (!s.days || typeof s.days !== 'object' || Array.isArray(s.days)) s.days = {};
  for (const [day, v] of Object.entries(s.days)) {
    if (!v || typeof v !== 'object' || typeof v.attempts !== 'number' ||
        typeof v.correct !== 'number') delete s.days[day];
  }
  if (s.daily !== null && (typeof s.daily !== 'object' || typeof s.daily.date !== 'string')) {
    s.daily = null;
  }
  if (!s.typing || typeof s.typing !== 'object' || typeof s.typing.best !== 'number') {
    s.typing = d.typing;
  }
  if (!['classic', 'sprint', 'quiz', 'typing'].includes(s.trainerMode)) {
    s.trainerMode = d.trainerMode;
  }
  if (typeof s.trainerCat !== 'string' || !s.trainerCat) s.trainerCat = d.trainerCat;
}

let state = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

function ensureDaily() {
  const t = localDate();
  if (state.daily && state.daily.date === t) return;
  const prev = state.daily;
  state.daily = {
    date: t,
    newDone: 0,
    reviewDone: 0,
    streak: prev && prev.lastDate === yesterdayStr() ? prev.streak : 0,
    lastDate: prev ? prev.lastDate : null
  };
}

export const store = {
  get state() { return state; },

  // ── настройки ──────────────────────────────────────────
  get lang() { return state.lang; },
  setLang(l) { state.lang = l === 'en' ? 'en' : 'ru'; save(); },

  get theme() { return state.theme; },
  setTheme(th) { state.theme = th === 'light' ? 'light' : 'dark'; save(); },

  detectedPlatform() {
    return window.hotkeysTrainer && window.hotkeysTrainer.platform === 'darwin' ? 'mac' : 'win';
  },
  get platformChoice() { return state.platform; },
  setPlatformChoice(p) {
    state.platform = p === 'auto' || p === 'mac' || p === 'win' ? p : 'auto';
    save();
  },
  get platform() { // фактическая платформа
    return state.platform === 'auto' ? store.detectedPlatform() : state.platform;
  },

  // ── последняя сессия тренажёра ─────────────────────────
  get trainerMode() { return state.trainerMode; },
  setTrainerMode(m) {
    state.trainerMode = ['classic', 'sprint', 'quiz', 'typing'].includes(m) ? m : 'classic';
    save();
  },
  get trainerCat() { return state.trainerCat; },
  setTrainerCat(c) {
    state.trainerCat = typeof c === 'string' && c ? c : 'all';
    save();
  },

  // ── заметки и свои сочетания ───────────────────────────
  get notes() { return state.notes; },
  setNote(id, text) {
    if (text && text.trim()) state.notes[id] = text;
    else delete state.notes[id];
    save();
  },
  get custom() { return state.custom; },
  addCustom(title, combo) {
    state.custom.push({ id: 'custom-' + Date.now(), title, combo });
    save();
  },
  removeCustom(id) {
    state.custom = state.custom.filter((c) => c.id !== id);
    save();
  },

  // ── прогресс / SRS ─────────────────────────────────────
  progressOf(id) { return state.progress[id] || null; },

  record(id, ok) {
    ensureDaily();
    const p = state.progress[id] ||
      (state.progress[id] = { seen: 0, correct: 0, wrong: 0, box: 0, due: 0, lastAt: 0 });
    const isNew = p.seen === 0;
    p.seen += 1;
    if (ok) p.correct += 1; else p.wrong += 1;
    p.box = ok ? Math.min(BOX_DAYS.length - 1, p.box + 1) : 0;
    p.due = Date.now() + BOX_DAYS[p.box] * DAY;
    p.lastAt = Date.now();

    const t = localDate();
    const d = state.days[t] || (state.days[t] = { attempts: 0, correct: 0, wrong: 0 });
    d.attempts += 1;
    if (ok) d.correct += 1; else d.wrong += 1;

    const daily = state.daily;
    if (isNew) daily.newDone += 1; else daily.reviewDone += 1;
    if (daily.lastDate !== t) {
      daily.streak = daily.lastDate === yesterdayStr() ? daily.streak + 1 : 1;
      daily.lastDate = t;
    }
    save();
  },

  isLearned(id) {
    const p = state.progress[id];
    return Boolean(p && p.seen >= 3 && p.correct / p.seen >= 0.7);
  },

  daily() {
    ensureDaily();
    return { ...state.daily, goalNew: DAILY_GOALS.new, goalReview: DAILY_GOALS.review };
  },

  // сводка по списку id (доступные на платформе)
  summary(ids) {
    ensureDaily();
    let attempts = 0, correct = 0, learned = 0;
    for (const id of ids) {
      const p = state.progress[id];
      if (!p) continue;
      attempts += p.seen;
      correct += p.correct;
      if (store.isLearned(id)) learned += 1;
    }
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = localDate(new Date(Date.now() - i * DAY));
      days.push({ date, ...(state.days[date] || { attempts: 0, correct: 0, wrong: 0 }) });
    }
    return {
      total: ids.length,
      learned,
      attempts,
      correct,
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
      streak: state.daily ? state.daily.streak : 0,
      days
    };
  },

  // процент выученного по категориям
  categoryStats(categories, itemsByCat) {
    return categories.map((c) => {
      const items = itemsByCat(c.id) || [];
      const learned = items.filter((s) => store.isLearned(s.id)).length;
      return { cat: c, total: items.length, learned };
    }).filter((x) => x.total > 0);
  },

  // слабые места: часто ошибающиеся
  weakSpots(ids, limit = 8) {
    const weak = [];
    for (const id of ids) {
      const p = state.progress[id];
      if (!p || p.seen < 3) continue;
      const acc = p.correct / p.seen;
      if (acc < 0.6) weak.push({ id, acc, seen: p.seen, wrong: p.wrong });
    }
    weak.sort((a, b) => a.acc - b.acc || b.wrong - a.wrong);
    return weak.slice(0, limit);
  },

  // ── экспорт / импорт ───────────────────────────────────
  exportBundle() {
    return JSON.stringify({
      app: 'hotkeys-trainer',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        notes: state.notes,
        custom: state.custom,
        progress: state.progress,
        days: state.days,
        daily: state.daily,
        typing: state.typing
      }
    }, null, 2);
  },

  importBundle(obj) {
    const d = obj && obj.data ? obj.data : obj;
    if (!d || typeof d !== 'object') return false;
    if (d.notes && typeof d.notes === 'object') state.notes = d.notes;
    if (Array.isArray(d.custom)) state.custom = d.custom;
    if (d.progress && typeof d.progress === 'object') state.progress = d.progress;
    if (d.days && typeof d.days === 'object') state.days = d.days;
    if (d.daily && typeof d.daily === 'object') state.daily = d.daily;
    if (d.typing && typeof d.typing === 'object') state.typing = d.typing;
    save();
    return true;
  },

  typingBest() { return state.typing.best || 0; },
  setTypingBest(wpm) {
    if (wpm > (state.typing.best || 0)) { state.typing.best = wpm; save(); }
  },

  get sfxEnabled() { return state.sfx !== false; },
  setSfxEnabled(on) { state.sfx = Boolean(on); save(); }
};
