// Разбор комбинаций клавиш и сопоставление с клавиатурными событиями.
// Используется тренажёром и тестами (без DOM-зависимостей).

export const MOD_KEYS = {
  cmd: 'meta', meta: 'meta', command: 'meta',
  ctrl: 'ctrl', control: 'ctrl',
  opt: 'alt', alt: 'alt', option: 'alt',
  shift: 'shift'
};

export const NAMED_KEYS = {
  space: 'Space', enter: 'Enter', return: 'Enter', tab: 'Tab',
  backspace: 'Backspace', delete: 'Delete', del: 'Delete', escape: 'Escape', esc: 'Escape',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  comma: ',', period: '.', slash: '/', backslash: '\\',
  minus: '-', equal: '=', semicolon: ';', quote: "'",
  bracketleft: '[', bracketright: ']', backquote: '`'
};

export const CODE_MAP = {
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down',
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
  Delete: 'Delete', Escape: 'Escape', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown',
  BracketLeft: '[', BracketRight: ']', Backquote: '`', Comma: ',',
  Period: '.', Slash: '/', Backslash: '\\', Minus: '-', Equal: '=',
  Semicolon: ';', Quote: "'"
};

// Токен символа → его физический код на клавиатуре (для синтетических событий в тестах)
const PUNCT_CODES = {
  '[': 'BracketLeft', ']': 'BracketRight', '`': 'Backquote', ',': 'Comma',
  '.': 'Period', '/': 'Slash', '\\': 'Backslash', '-': 'Minus', '=': 'Equal',
  ';': 'Semicolon', "'": 'Quote'
};

const NAMED_TO_EVENT = {
  space: { key: ' ', code: 'Space' },
  enter: { key: 'Enter', code: 'Enter' },
  return: { key: 'Enter', code: 'Enter' },
  tab: { key: 'Tab', code: 'Tab' },
  backspace: { key: 'Backspace', code: 'Backspace' },
  delete: { key: 'Delete', code: 'Delete' },
  del: { key: 'Delete', code: 'Delete' },
  escape: { key: 'Escape', code: 'Escape' },
  esc: { key: 'Escape', code: 'Escape' },
  home: { key: 'Home', code: 'Home' },
  end: { key: 'End', code: 'End' },
  pageup: { key: 'PageUp', code: 'PageUp' },
  pagedown: { key: 'PageDown', code: 'PageDown' },
  up: { key: 'ArrowUp', code: 'ArrowUp' },
  down: { key: 'ArrowDown', code: 'ArrowDown' },
  left: { key: 'ArrowLeft', code: 'ArrowLeft' },
  right: { key: 'ArrowRight', code: 'ArrowRight' },
  comma: { key: ',', code: 'Comma' },
  period: { key: '.', code: 'Period' },
  slash: { key: '/', code: 'Slash' },
  backslash: { key: '\\', code: 'Backslash' },
  minus: { key: '-', code: 'Minus' },
  equal: { key: '=', code: 'Equal' },
  semicolon: { key: ';', code: 'Semicolon' },
  quote: { key: "'", code: 'Quote' },
  bracketleft: { key: '[', code: 'BracketLeft' },
  bracketright: { key: ']', code: 'BracketRight' },
  backquote: { key: '`', code: 'Backquote' }
};

// "Cmd+Shift+Z" → { meta:true, ctrl:false, alt:false, shift:false, key:'Z' }
export function parseCombo(str) {
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

// Код клавиши события → каноничное имя
export function keyFromEvent(e) {
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

export function eventMatches(e, exp) {
  return e.metaKey === exp.meta && e.ctrlKey === exp.ctrl &&
    e.altKey === exp.alt && e.shiftKey === exp.shift &&
    keyFromEvent(e) === exp.key;
}

// Нажатая комбинация → токены для отображения
export function pressedTokens(e, platform) {
  const tokens = [];
  if (e.ctrlKey) tokens.push('Ctrl');
  if (e.altKey) tokens.push(platform === 'mac' ? 'Opt' : 'Alt');
  if (e.shiftKey) tokens.push('Shift');
  if (e.metaKey) tokens.push(platform === 'mac' ? 'Cmd' : 'Win');
  const key = keyFromEvent(e);
  if (key && !['Meta', 'Shift', 'Control', 'Alt'].includes(key)) tokens.push(key);
  return tokens;
}

// Токен комбинации → синтетическое событие клавиатуры (для автотестов).
// Возвращает объект-инициализатор KeyboardEvent.
export function comboToEventInit(combo) {
  const exp = parseCombo(combo);
  const init = {
    metaKey: exp.meta, ctrlKey: exp.ctrl, altKey: exp.alt, shiftKey: exp.shift,
    key: '', code: ''
  };
  const tok = (combo || '').split('+').map((s) => s.trim()).filter(Boolean).pop();
  if (!tok) return null;
  const low = tok.toLowerCase();
  if (NAMED_TO_EVENT[low]) {
    Object.assign(init, NAMED_TO_EVENT[low]);
  } else if (/^f\d{1,2}$/i.test(tok)) {
    init.key = tok.toUpperCase();
    init.code = tok.toUpperCase();
  } else if (tok.length === 1) {
    if (/[a-z]/i.test(tok)) { init.key = tok.toLowerCase(); init.code = 'Key' + tok.toUpperCase(); }
    else if (/[0-9]/.test(tok)) { init.key = tok; init.code = 'Digit' + tok; }
    else { init.key = tok; init.code = PUNCT_CODES[tok] || ''; }
  } else {
    init.key = tok; init.code = '';
  }
  return init;
}
