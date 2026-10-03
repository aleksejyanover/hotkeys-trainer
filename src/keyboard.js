// Виртуальная клавиатура: раскладки macOS и Windows, подсветка клавиш.

// ── Чипы клавиш (kbd-элементы) ────────────────────────────
// Токен → короткий символ для отображения
const TOKEN_DISPLAY = {
  Right: '→', Left: '←', Up: '↑', Down: '↓',
  Escape: 'Esc', PageUp: 'PgUp', PageDown: 'PgDn'
};
// регистронезависимый индекс (пользователь может ввести «ctrl+alt+t»)
const TOKEN_DISPLAY_LC = Object.fromEntries(
  Object.entries(TOKEN_DISPLAY).map(([k, v]) => [k.toLowerCase(), v])
);
const MOD_DISPLAY = {
  cmd: 'Cmd', command: 'Cmd', meta: 'Cmd',
  ctrl: 'Ctrl', control: 'Ctrl',
  opt: 'Opt', option: 'Opt', alt: 'Alt',
  shift: 'Shift'
};
export const displayToken = (tok) => {
  if (TOKEN_DISPLAY[tok]) return TOKEN_DISPLAY[tok];
  const s = String(tok).trim();
  const low = s.toLowerCase();
  if (TOKEN_DISPLAY_LC[low]) return TOKEN_DISPLAY_LC[low];
  if (MOD_DISPLAY[low]) return MOD_DISPLAY[low];
  if (/^f\d{1,2}$/.test(low)) return low.toUpperCase();
  if (/^[a-z]$/.test(low)) return low.toUpperCase();
  if (/^[a-z]+$/.test(low)) return low[0].toUpperCase() + low.slice(1);
  return s;
};

// "Right+Shift" → "→+Shift" (для строк вроде выпадающих списков)
export function displayCombo(combo) {
  return (combo || '').split('+')
    .map((s) => displayToken(s.trim()))
    .filter(Boolean)
    .join('+');
}

export function renderTokenChips(container, tokens) {
  container.innerHTML = '';
  tokens.forEach((raw, i) => {
    if (i > 0) {
      const plus = document.createElement('span');
      plus.className = 'kbd-plus';
      plus.textContent = '+';
      container.appendChild(plus);
    }
    const kbd = document.createElement('kbd');
    kbd.textContent = displayToken(raw);
    container.appendChild(kbd);
  });
}

export function renderComboChips(container, comboStr) {
  renderTokenChips(container, (comboStr || '').split('+').map((s) => s.trim()).filter(Boolean));
}


// Элемент: [id, label, ширина в «единицах» (по умолчанию 1)] | null (пустое место)
const MAC_ROWS = [
  [['esc', 'esc', 1.5], ['f1', 'F1'], ['f2', 'F2'], ['f3', 'F3'], ['f4', 'F4'], ['f5', 'F5'], ['f6', 'F6'],
   ['f7', 'F7'], ['f8', 'F8'], ['f9', 'F9'], ['f10', 'F10'], ['f11', 'F11'], ['f12', 'F12']],
  [['`', '`'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'],
   ['9', '9'], ['0', '0'], ['-', '-'], ['=', '='], ['backspace', '⌫', 2], ['delete', '⌦']],
  [['tab', '⇥', 1.5], ['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'], ['y', 'Y'], ['u', 'U'],
   ['i', 'I'], ['o', 'O'], ['p', 'P'], ['[', '['], [']', ']'], ['\\', '\\', 1.5]],
  [['caps', '⇪', 1.75], ['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'], ['h', 'H'], ['j', 'J'],
   ['k', 'K'], ['l', 'L'], [';', ';'], ["'", "'"], ['enter', '⏎', 2.25]],
  [['shift', '⇧', 2.25], ['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'], ['n', 'N'], ['m', 'M'],
   [',', ','], ['.', '.'], ['/', '/'], ['shift', '⇧', 2.75]],
  [['ctrl', '⌃'], ['alt', '⌥'], ['cmd', '⌘'], ['space', '', 6], ['cmd', '⌘'], ['alt', '⌥'], null, null,
   ['left', '←'], ['down', '↓'], ['up', '↑'], ['right', '→']]
];

const WIN_ROWS = [
  [['esc', 'Esc', 1.5], ['f1', 'F1'], ['f2', 'F2'], ['f3', 'F3'], ['f4', 'F4'], ['f5', 'F5'], ['f6', 'F6'],
   ['f7', 'F7'], ['f8', 'F8'], ['f9', 'F9'], ['f10', 'F10'], ['f11', 'F11'], ['f12', 'F12']],
  [['`', '`'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'],
   ['9', '9'], ['0', '0'], ['-', '-'], ['=', '='], ['backspace', '⌫', 2], ['delete', 'Del']],
  [['tab', 'Tab', 1.5], ['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'], ['y', 'Y'], ['u', 'U'],
   ['i', 'I'], ['o', 'O'], ['p', 'P'], ['[', '['], [']', ']'], ['\\', '\\', 1.5]],
  [['caps', 'Caps', 1.75], ['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'], ['h', 'H'], ['j', 'J'],
   ['k', 'K'], ['l', 'L'], [';', ';'], ["'", "'"], ['enter', 'Enter', 2.25]],
  [['shift', 'Shift', 2.25], ['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'], ['n', 'N'], ['m', 'M'],
   [',', ','], ['.', '.'], ['/', '/'], ['shift', 'Shift', 2.75]],
  [['ctrl', 'Ctrl'], ['win', '⊞'], ['alt', 'Alt'], ['space', '', 6], ['alt', 'Alt'], ['win', '⊞'],
   ['menu', '≡'], ['ctrl', 'Ctrl'], null, ['left', '←'], ['down', '↓'], ['up', '↑'], ['right', '→']]
];

// Токен комбинации → id клавиши на клавиатуре
export function comboToKeyIds(combo) {
  const ids = [];
  if (!combo) return ids;
  for (const raw of combo.split('+')) {
    const part = raw.trim();
    if (!part) continue;
    const low = part.toLowerCase();
    if (low === 'cmd' || low === 'meta') ids.push('cmd');
    else if (low === 'ctrl') ids.push('ctrl');
    else if (low === 'alt' || low === 'opt') ids.push('alt');
    else if (low === 'shift') ids.push('shift');
    else if (low === 'space') ids.push('space');
    else if (low === 'enter' || low === 'return') ids.push('enter');
    else if (low === 'tab') ids.push('tab');
    else if (low === 'backspace') ids.push('backspace');
    else if (low === 'delete') ids.push('delete');
    else if (low === 'escape' || low === 'esc') ids.push('esc');
    else if (low === 'left' || low === 'right' || low === 'up' || low === 'down') ids.push(low);
    else if (/^f\d{1,2}$/.test(low)) ids.push(low);
    else if (part.length === 1) ids.push(low);
    else ids.push(low); // home/end/pagedown…
  }
  return [...new Set(ids)];
}

// Рендер клавиатуры с подсветкой ключей из keyIds
export function renderKeyboard(container, platform, keyIds = []) {
  container.innerHTML = '';
  const rows = platform === 'mac' ? MAC_ROWS : WIN_ROWS;
  const hl = new Set(keyIds);
  const seen = new Set(); // первое вхождение каждого id — яркая подсветка

  for (const row of rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    for (const key of row) {
      if (key === null) {
        const spacer = document.createElement('span');
        spacer.className = 'kb-key kb-spacer';
        rowEl.appendChild(spacer);
        continue;
      }
      const [id, label, width = 1] = key;
      const el = document.createElement('span');
      el.className = 'kb-key';
      if (width > 1) el.style.width = `calc(var(--kb-unit) * ${width} + ${Math.round((width - 1) * 4)}px)`;
      el.textContent = label;
      el.dataset.keyId = id;
      if (hl.has(id)) {
        if (seen.has(id)) el.classList.add('hl2'); // напр. правый Shift
        else { el.classList.add('hl'); seen.add(id); }
      }
      rowEl.appendChild(el);
    }
    container.appendChild(rowEl);
  }
}
