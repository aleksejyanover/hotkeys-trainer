// Временный smoke-test: проверяет все вкладки, режимы тренажёра,
// одиночные клавиши и корректность всех комбинаций из data.js.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

// ВАЖНО: тест работает в отдельной папке данных, чтобы не стирать
// настоящие заметки и прогресс пользователя.
app.setPath('userData', path.join(os.tmpdir(), 'hotkeys-trainer-smoke'));

app.whenReady().then(() => {
  ipcMain.handle('trainer-mode', () => true);
  ipcMain.handle('app-version', () => '1.2.3-test');

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const problems = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3) problems.push('[console] ' + message);
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => problems.push('[load-fail] ' + code + ' ' + desc));
  win.webContents.on('render-process-gone', (_e, details) => problems.push('[renderer-gone] ' + details.reason));

  const evalJs = (fn) => win.webContents.executeJavaScript(fn);

  win.loadFile(path.join(__dirname, 'src', 'index.html')).then(async () => {
    await new Promise((r) => setTimeout(r, 1500));
    await evalJs(`localStorage.clear()`);
    await win.webContents.reload();
    await new Promise((r) => setTimeout(r, 1500));

    const results = [];
    const step = async (name, fn) => {
      try {
        const r = await evalJs(fn);
        results.push(name + ' ' + JSON.stringify(r));
      } catch (err) {
        results.push(name + ' ERROR: ' + err.message);
      }
    };

    // 1. Учебник
    await step('LEARN', `(async () => ({
      items: document.querySelectorAll('#learn-list .shortcut-item').length,
      chips: document.querySelectorAll('#category-chips .chip').length,
      tabs: document.querySelectorAll('.tabs button').length
    }))()`);

    // 2. Поиск
    await step('SEARCH', `(async () => {
      document.querySelector('[data-tab="search"]').click();
      const input = document.getElementById('search-input');
      input.value = 'копировать';
      input.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 200));
      return { count: document.getElementById('search-count').textContent,
               results: document.querySelectorAll('#search-list .shortcut-item').length };
    })()`);

    // 3. Язык EN → RU
    await step('LANG', `(async () => {
      document.querySelector('[data-lang="en"]').click();
      await new Promise(r => setTimeout(r, 300));
      const en = document.getElementById('app-title').textContent;
      const enTab = document.getElementById('tab-progress').textContent;
      document.querySelector('[data-lang="ru"]').click();
      await new Promise(r => setTimeout(r, 300));
      return { en, enTab, back: document.getElementById('app-title').textContent };
    })()`);

    // 4. Платформа win/mac/auto
    await step('PLATFORM', `(async () => {
      const first = () => document.querySelector('#learn-list .shortcut-item kbd')?.textContent;
      document.querySelector('[data-platform="win"]').click();
      await new Promise(r => setTimeout(r, 300));
      const winK = first();
      document.querySelector('[data-platform="mac"]').click();
      await new Promise(r => setTimeout(r, 300));
      const macK = first();
      document.querySelector('[data-platform="auto"]').click();
      await new Promise(r => setTimeout(r, 300));
      return { winK, macK, auto: first() };
    })()`);

    // 5. Тема
    await step('THEME', `(async () => {
      document.querySelector('[data-theme="light"]').click();
      await new Promise(r => setTimeout(r, 200));
      const light = document.documentElement.dataset.theme;
      document.querySelector('[data-theme="dark"]').click();
      await new Promise(r => setTimeout(r, 200));
      return { light, back: document.documentElement.dataset.theme };
    })()`);

    // 6. Тренажёр: классический
    await step('CLASSIC', `(async () => {
      document.querySelector('[data-tab="trainer"]').click();
      await new Promise(r => setTimeout(r, 200));
      const tip = document.getElementById('tip-body').textContent;
      document.getElementById('trainer-start').click();
      await new Promise(r => setTimeout(r, 300));
      const running = !document.getElementById('trainer-game').classList.contains('hidden');
      const task = document.getElementById('task-title').textContent;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 200));
      const fb = document.getElementById('trainer-feedback').textContent;
      const attempts = document.getElementById('stat-attempts').textContent;
      // карта клавиш в тренажёре
      document.getElementById('trainer-map-toggle').click();
      await new Promise(r => setTimeout(r, 200));
      const kb = document.querySelectorAll('#hint-keyboard .kb-key').length;
      document.getElementById('trainer-map-toggle').click();
      document.getElementById('trainer-skip').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('trainer-stop').click();
      await new Promise(r => setTimeout(r, 200));
      const result = !document.getElementById('trainer-result').classList.contains('hidden');
      const resultStats = document.getElementById('result-stats').textContent;
      if (!result) throw new Error('result screen not shown');
      if (resultStats.includes('%%')) throw new Error('double percent in result stats: ' + resultStats);
      if (!resultStats.includes('Точность')) throw new Error('accuracy label missing: ' + resultStats);
      document.getElementById('trainer-again').click();
      return { running, task, fb: fb.slice(0, 20), attempts, kb, result, stats: resultStats.slice(0, 60), tip: tip.slice(0, 30) };
    })()`);

    // 6b. Звук: переключение
    await step('SOUND', `(async () => {
      document.querySelector('[data-sound="off"]').click();
      await new Promise(r => setTimeout(r, 200));
      const off = document.querySelector('#sound-switch [data-sound="off"]').classList.contains('active');
      document.querySelector('[data-sound="on"]').click();
      await new Promise(r => setTimeout(r, 200));
      const on = document.querySelector('#sound-switch [data-sound="on"]').classList.contains('active');
      const m = await import('./store.js');
      return { off, on, sfx: m.store.sfxEnabled };
    })()`);

    // 7. Спринт
    await step('SPRINT', `(async () => {
      document.querySelector('[data-mode="sprint"]').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('trainer-start').click();
      await new Promise(r => setTimeout(r, 300));
      const timerShown = !document.getElementById('sprint-stat').classList.contains('hidden');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 100));
      const attempts = document.getElementById('stat-attempts').textContent;
      document.getElementById('trainer-stop').click();
      await new Promise(r => setTimeout(r, 200));
      const title = document.getElementById('result-title').textContent;
      const stats = document.getElementById('result-stats').textContent;
      document.getElementById('trainer-again').click();
      return { timerShown, attempts, title, hasPerMin: stats.includes('мин') || stats.includes('min') };
    })()`);

    // 8. Квиз
    await step('QUIZ', `(async () => {
      document.querySelector('[data-mode="quiz"]').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('trainer-start').click();
      await new Promise(r => setTimeout(r, 300));
      const options = document.querySelectorAll('.quiz-option').length;
      const nums = [...document.querySelectorAll('.quiz-num')].map(n => n.textContent).join('');
      const combo = document.getElementById('quiz-combo').textContent;
      document.querySelector('.quiz-option').click();
      await new Promise(r => setTimeout(r, 300));
      const fb = document.getElementById('quiz-feedback').textContent;
      const attempts = document.getElementById('stat-attempts').textContent;
      await new Promise(r => setTimeout(r, 1400));
      const fbHidden = document.getElementById('quiz-feedback').classList.contains('hidden');
      // ответ цифрами с клавиатуры на свежем вопросе
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 300));
      const fbKeyEl = document.getElementById('quiz-feedback');
      const fbKey = fbKeyEl.textContent;
      const keyAnswered = !fbKeyEl.classList.contains('hidden');
      await new Promise(r => setTimeout(r, 1400)); // дождаться следующего вопроса без таймера
      document.getElementById('trainer-stop').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('trainer-again').click();
      if (nums !== '1234') throw new Error('quiz number badges missing: ' + nums);
      if (!fbHidden) throw new Error('feedback not hidden on new question');
      if (!keyAnswered || !fbKey) throw new Error('digit answer did not register');
      return { options, nums, combo: combo.slice(0, 20), fb: fb.slice(0, 20), attempts, fbHidden, fbKey: fbKey.slice(0, 20) };
    })()`);

    // 8б. Остановка во время отложенного перехода квиза не ломает экран
    await step('STOP_RACE', `(async () => {
      document.getElementById('trainer-start').click();
      await new Promise(r => setTimeout(r, 300));
      document.querySelector('.quiz-option').click();          // ответ планирует next через 1300мс
      document.getElementById('trainer-stop').click();         // стоп сразу после ответа
      await new Promise(r => setTimeout(r, 1700));             // даём таймеру сработать
      const result = !document.getElementById('trainer-result').classList.contains('hidden');
      const setupHidden = document.getElementById('trainer-setup').classList.contains('hidden');
      const gameHidden = document.getElementById('trainer-game').classList.contains('hidden');
      if (!result) throw new Error('result screen lost after stop race');
      if (!setupHidden || !gameHidden) throw new Error('panels wrong after stop race');
      document.getElementById('trainer-again').click();
      return { result, setupHidden, gameHidden };
    })()`);

    // 9. Печать
    await step('TYPING', `(async () => {
      document.querySelector('[data-mode="typing"]').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('trainer-start').click();
      await new Promise(r => setTimeout(r, 400));
      const text = document.getElementById('typing-text').textContent;
      const ta = document.getElementById('typing-input');
      ta.value = text;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      const resultShown = !document.getElementById('trainer-result').classList.contains('hidden');
      const title = document.getElementById('result-title').textContent;
      const stats = document.getElementById('result-stats').textContent;
      document.getElementById('trainer-again').click();
      document.querySelector('[data-mode="classic"]').click();
      await new Promise(r => setTimeout(r, 200));
      return { len: text.length, resultShown, title, hasWpm: /\\d/.test(stats) };
    })()`);

    // 10. Карта клавиш: выбор сочетания, клик по клавише, сброс
    await step('MAP', `(async () => {
      document.querySelector('[data-tab="map"]').click();
      await new Promise(r => setTimeout(r, 400));
      const keys = document.querySelectorAll('#map-keyboard .kb-key').length;
      const hl = document.querySelectorAll('#map-keyboard .kb-key.hl').length;
      const combo = document.getElementById('map-combo').textContent;
      const sel = document.getElementById('map-select');
      sel.selectedIndex = 5;
      sel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 300));
      // клик по клавише «C»
      const keyEl = [...document.querySelectorAll('#map-keyboard .kb-key')].find(k => k.dataset.keyId === 'c');
      keyEl.click();
      await new Promise(r => setTimeout(r, 300));
      const related = document.querySelectorAll('#map-list .shortcut-item').length;
      const hl2 = document.querySelectorAll('#map-keyboard .kb-key.hl, #map-keyboard .kb-key.hl2').length;
      document.getElementById('map-clear').click();
      await new Promise(r => setTimeout(r, 300));
      const afterClear = document.querySelectorAll('#map-list .shortcut-item').length;
      return { keys, hl, combo: combo.slice(0, 24), related, hl2, afterClear };
    })()`);

    // 11. Прогресс: карточки, челлендж, график, категории, слабые места
    await step('PROGRESS', `(async () => {
      document.querySelector('[data-tab="progress"]').click();
      await new Promise(r => setTimeout(r, 400));
      return {
        learned: document.getElementById('prog-learned').textContent,
        attempts: document.getElementById('prog-attempts').textContent,
        accuracy: document.getElementById('prog-accuracy').textContent,
        dailyNew: document.getElementById('daily-new-count').textContent,
        dailyReview: document.getElementById('daily-review-count').textContent,
        chartCols: document.querySelectorAll('#chart .chart-col').length,
        cats: document.querySelectorAll('#cat-progress .daily-row').length,
        weak: document.getElementById('weak-list').children.length,
        exportBtn: Boolean(document.getElementById('export-btn')),
        importBtn: Boolean(document.getElementById('import-btn'))
      };
    })()`);

    // 12. Заметки + свои сочетания + экспорт/импорт локально
    await step('NOTES', `(async () => {
      document.querySelector('[data-tab="learn"]').click();
      await new Promise(r => setTimeout(r, 200));
      const item = document.querySelector('#learn-list .shortcut-item');
      item.click();
      await new Promise(r => setTimeout(r, 200));
      const ta = item.querySelector('textarea');
      ta.value = 'Моя заметка';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      document.querySelector('[data-tab="notes"]').click();
      await new Promise(r => setTimeout(r, 300));
      const noted = document.querySelectorAll('#notes-list .shortcut-item').length;
      // неверная комбинация (кириллица) должна быть отклонена с подсказкой
      document.getElementById('custom-name').value = 'Плохая комбинация';
      document.getElementById('custom-combo').value = 'Ctrl+Ы';
      document.getElementById('custom-add').click();
      await new Promise(r => setTimeout(r, 300));
      const rejected = document.querySelectorAll('#custom-list .shortcut-item').length;
      const errShown = document.getElementById('custom-hint').textContent.includes('распознать');
      if (rejected !== 0) throw new Error('invalid custom combo accepted: ' + rejected);
      if (!errShown) throw new Error('no validation hint shown');
      // а корректная (в нижнем регистре — тоже допустима) — добавляется
      document.getElementById('custom-name').value = 'Открыть терминал';
      document.getElementById('custom-combo').value = 'ctrl+alt+t';
      document.getElementById('custom-add').click();
      await new Promise(r => setTimeout(r, 300));
      const customCount = document.querySelectorAll('#custom-list .shortcut-item').length;
      if (customCount !== 1) throw new Error('valid custom combo not added: ' + customCount);
      // отображение нормализуется: чипы «Ctrl+Alt+T»
      document.querySelector('[data-tab="learn"]').click();
      await new Promise(r => setTimeout(r, 300));
      const myCard = [...document.querySelectorAll('#learn-list .shortcut-item')]
        .find(el => el.textContent.includes('Открыть терминал'));
      if (!myCard) throw new Error('custom card missing in learn list');
      const chips = [...myCard.querySelectorAll('kbd')].map(k => k.textContent).join('+');
      if (chips !== 'Ctrl+Alt+T') throw new Error('bad chip display: ' + chips);
      document.querySelector('[data-tab="notes"]').click();
      await new Promise(r => setTimeout(r, 200));
      // экспорт → импорт через store
      const m = await import('./store.js');
      const json = m.store.exportBundle();
      const parsed = JSON.parse(json);
      const ok = m.store.importBundle(parsed);
      return { noted, rejected, errShown, customCount, exportOk: parsed.app === 'hotkeys-trainer', importOk: ok };
    })()`);

    // 12б. Импорт мусорного файла не ломает состояние
    await step('BAD_IMPORT', `(async () => {
      const m = await import('./store.js');
      const notesBefore = Object.keys(m.store.state.notes).length;
      // не-объект и объект без известных полей → отклоняются
      if (m.store.importBundle('garbage')) throw new Error('string accepted as import');
      if (m.store.importBundle({ foo: 1 })) throw new Error('unknown object accepted');
      // поля неверного типа игнорируются, корректные — фильтруются
      const ok = m.store.importBundle({
        notes: 123,                       // неверный тип → игнорируется
        custom: [                         // мусор отфильтрован, валидный остаётся
          { id: 1, title: 2, combo: 3 },
          { id: 'empty', title: 'X', combo: '' },
          { id: 'ok2', title: 'Good', combo: 'ctrl+alt+t' }
        ],
        progress: { fake: { seen: 'x' } } // мусорная запись удаляется
      });
      if (!ok) throw new Error('object with fields rejected');
      const notesAfter = Object.keys(m.store.state.notes).length;
      if (notesAfter !== notesBefore) throw new Error('notes lost: ' + notesBefore + ' -> ' + notesAfter);
      const custom = m.store.state.custom;
      if (custom.length !== 1 || custom[0].id !== 'ok2') throw new Error('custom not filtered: ' + JSON.stringify(custom));
      if ('fake' in m.store.state.progress) throw new Error('garbage progress kept');
      return { notesKept: notesAfter, customFiltered: custom.length, garbage: !('fake' in m.store.state.progress) };
    })()`);

    // 13. Все комбинации из data.js → синтетическое событие → распознаётся
    await step('KEYS_ROUNDTRIP', `(async () => {
      const d = await import('./data.js');
      const k = await import('./keys.js');
      const bad = [];
      let checked = 0;
      for (const s of d.SHORTCUTS) {
        for (const p of ['mac', 'win']) {
          const combo = s.combo && s.combo[p];
          if (!combo) continue;
          const init = k.comboToEventInit(combo);
          if (!init) { bad.push(s.id + ' ' + p + ': нет события'); continue; }
          const e = new KeyboardEvent('keydown', init);
          const exp = k.parseCombo(combo);
          checked++;
          if (!k.eventMatches(e, exp)) {
            bad.push(s.id + ' [' + p + '] ' + combo + ' → got ' + k.keyFromEvent(e) +
              ' mods ' + [e.ctrlKey, e.altKey, e.shiftKey, e.metaKey].join(','));
          }
        }
      }
      return { checked, bad: bad.slice(0, 8), ok: bad.length === 0 };
    })()`);

    // 14. Новые категории: одиночные клавиши и презентации
    await step('NEW_CATS', `(async () => {
      document.querySelector('[data-tab="learn"]').click();
      await new Promise(r => setTimeout(r, 300));
      const chips = [...document.querySelectorAll('#category-chips .chip')];
      const keysChip = chips.find(c => c.textContent.includes('Одиночные'));
      const slidesChip = chips.find(c => c.textContent.includes('Презентации'));
      keysChip.click();
      await new Promise(r => setTimeout(r, 300));
      const keysItems = document.querySelectorAll('#learn-list .shortcut-item').length;
      const firstCombo = document.querySelector('#learn-list .shortcut-item kbd')?.textContent;
      const spaceItem = [...document.querySelectorAll('#learn-list .shortcut-item')]
        .find(el => el.textContent.includes('Пробел'));
      const spaceCombo = spaceItem ? spaceItem.querySelector('kbd')?.textContent : null;
      slidesChip.click();
      await new Promise(r => setTimeout(r, 300));
      const slidesItems = document.querySelectorAll('#learn-list .shortcut-item').length;
      const hasBlack = document.body.textContent.includes('Чёрный экран');
      const hasWhite = document.body.textContent.includes('Белый экран');
      const hasF5 = [...document.querySelectorAll('#learn-list kbd')].some(k2 => k2.textContent === 'F5');
      document.querySelector('#category-chips .chip').click();
      await new Promise(r => setTimeout(r, 200));
      return { chips: chips.length, keysItems, firstCombo, spaceCombo, slidesItems, hasBlack, hasWhite, hasF5 };
    })()`);

    // 15. Поиск по символу стрелки (отображаемый вид комбинации)
    await step('SEARCH_ARROW', `(async () => {
      document.querySelector('[data-tab="search"]').click();
      await new Promise(r => setTimeout(r, 200));
      const input = document.getElementById('search-input');
      input.value = 'стрелка';
      input.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 250));
      const byName = document.querySelectorAll('#search-list .shortcut-item').length;
      input.value = 'презентац';
      input.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 250));
      const byCat = document.getElementById('search-count').textContent;
      input.value = '';
      input.dispatchEvent(new Event('input'));
      return { byName, byCat };
    })()`);

    // 15b. Платформа Windows: каталог и отсутствие ошибок
    await step('WIN_PLATFORM', `(async () => {
      document.querySelector('[data-tab="learn"]').click();
      document.querySelector('[data-platform="win"]').click();
      await new Promise(r => setTimeout(r, 400));
      const items = document.querySelectorAll('#learn-list .shortcut-item').length;
      const chips = document.querySelectorAll('#category-chips .chip').length;
      const combo = document.querySelector('#learn-list .shortcut-item kbd')?.textContent;
      // карта клавиш на Windows
      document.querySelector('[data-tab="map"]').click();
      await new Promise(r => setTimeout(r, 400));
      const mapKeys = document.querySelectorAll('#map-keyboard .kb-key').length;
      const hasWinKey = [...document.querySelectorAll('#map-keyboard .kb-key')]
        .some(k2 => k2.dataset.keyId === 'win');
      document.querySelector('[data-tab="learn"]').click();
      document.querySelector('[data-platform="auto"]').click();
      await new Promise(r => setTimeout(r, 300));
      return { items, chips, combo, mapKeys, hasWinKey };
    })()`);

    // 16. E2E: тренажёр с одиночной клавишей (B) и стрелкой (→)
    await step('SINGLE_KEY_E2E', `(async () => {
      const ht = window.__ht;
      document.querySelector('[data-tab="trainer"]').click();
      await new Promise(r => setTimeout(r, 200));
      ht.trainer.setMode('classic');
      ht.trainer.start({ ids: ['p-black'] });
      await new Promise(r => setTimeout(r, 300));
      const task1 = document.getElementById('task-title').textContent;
      window.dispatchEvent(new KeyboardEvent('keydown',
        { key: 'b', code: 'KeyB', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 300));
      const score1 = document.getElementById('stat-score').textContent;
      const fb1 = document.getElementById('trainer-feedback').textContent;
      ht.trainer.stop(false);

      ht.trainer.start({ ids: ['k-right'] });
      await new Promise(r => setTimeout(r, 300));
      const task2 = document.getElementById('task-title').textContent;
      window.dispatchEvent(new KeyboardEvent('keydown',
        { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 300));
      const score2 = document.getElementById('stat-score').textContent;
      // неверная клавиша не засчитывается
      window.dispatchEvent(new KeyboardEvent('keydown',
        { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 300));
      const scoreAfterWrong = document.getElementById('stat-score').textContent;
      ht.trainer.stop(false);
      return { task1, score1, fb1: fb1.slice(0, 8), task2, score2, scoreAfterWrong };
    })()`);

    // 17. Восстановление после испорченного localStorage
    await step('CORRUPT_SET', `(function () {
      localStorage.setItem('ht_store_v2', JSON.stringify({
        lang: 42, platform: 'linux', theme: [], notes: 'str',
        custom: { a: 1 }, progress: 'nope', days: 5,
        daily: 'today', typing: null, sfx: 'yes'
      }));
      location.reload();
      return 'saved';
    })()`);
    await new Promise((r) => setTimeout(r, 2500));
    await step('CORRUPT_RECOVERY', `(async () => {
      if (!window.__ht) throw new Error('app did not boot after corruption');
      const st = window.__ht.store;
      const items = document.querySelectorAll('#learn-list .shortcut-item').length;
      const tabs = document.querySelectorAll('.tabs button').length;
      if (items < 70) throw new Error('catalog lost: ' + items);
      if (tabs !== 6) throw new Error('tabs lost: ' + tabs);
      if (st.lang !== 'ru' || st.theme !== 'dark') throw new Error('settings broken');
      if (!['auto', 'mac', 'win'].includes(st.platformChoice)) throw new Error('platform broken');
      // прогресс и запись не падают на восстановленном состоянии
      document.querySelector('[data-tab="progress"]').click();
      await new Promise(r => setTimeout(r, 400));
      document.querySelector('[data-tab="trainer"]').click();
      await new Promise(r => setTimeout(r, 300));
      window.__ht.trainer.setMode('classic');
      window.__ht.trainer.start();
      await new Promise(r => setTimeout(r, 400));
      const task = document.getElementById('task-title').textContent;
      window.__ht.trainer.stop(false);
      if (!task) throw new Error('trainer broken after recovery');
      return { items, tabs, lang: st.lang, theme: st.theme, task: task.slice(0, 20) };
    })()`);

    // 18. Ошибки консоли renderer'а и падения страницы за весь прогон
    results.push('CONSOLE_PROBLEMS ' + JSON.stringify({ count: problems.length, list: problems.slice(0, 5) }));

    console.log(results.join('\n'));
    const stepFailed = results.some((r) => r.includes(' ERROR:'));
    if (stepFailed || problems.length) {
      console.log('HAS_ERRORS');
      app.exit(1);
      return;
    }
    console.log('NO_ERRORS');
    app.exit(0);
  }).catch((err) => {
    console.log('LOAD_ERROR ' + err.message);
    app.exit(1);
  });
});
