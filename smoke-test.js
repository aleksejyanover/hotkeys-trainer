// Временный smoke-test: проверяет все вкладки и режимы тренажёра.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  ipcMain.handle('trainer-mode', () => true);

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
      document.getElementById('trainer-again').click();
      return { running, task, fb: fb.slice(0, 20), attempts, kb, result, tip: tip.slice(0, 30) };
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
      const combo = document.getElementById('quiz-combo').textContent;
      document.querySelector('.quiz-option').click();
      await new Promise(r => setTimeout(r, 300));
      const fb = document.getElementById('quiz-feedback').textContent;
      const attempts = document.getElementById('stat-attempts').textContent;
      await new Promise(r => setTimeout(r, 1200));
      const nextOptions = document.querySelectorAll('.quiz-option').length;
      document.getElementById('trainer-stop').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('trainer-again').click();
      return { options, combo: combo.slice(0, 20), fb: fb.slice(0, 20), attempts, nextOptions };
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
      document.getElementById('custom-name').value = 'Открыть терминал';
      document.getElementById('custom-combo').value = 'Ctrl+Alt+T';
      document.getElementById('custom-add').click();
      await new Promise(r => setTimeout(r, 300));
      const customCount = document.querySelectorAll('#custom-list .shortcut-item').length;
      // экспорт → импорт через store
      const m = await import('./store.js');
      const json = m.store.exportBundle();
      const parsed = JSON.parse(json);
      const ok = m.store.importBundle(parsed);
      return { noted, customCount, exportOk: parsed.app === 'hotkeys-trainer', importOk: ok };
    })()`);

    console.log(results.join('\n'));
    console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'NO_ERRORS');
    app.exit(problems.length ? 1 : 0);
  }).catch((err) => {
    console.log('LOAD_ERROR ' + err.message);
    app.exit(1);
  });
});
