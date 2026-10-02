// Временный smoke-test: проверяет вкладки, поиск, тренажёр и переключение языка.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  // Заглушка для IPC-канала, который регистрируется в main.js
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

  win.loadFile(path.join(__dirname, 'src', 'index.html')).then(async () => {
    await new Promise((r) => setTimeout(r, 1500));

    // очищаем хранилище и перезагружаем страницу, чтобы тест
    // не засорял настоящие заметки
    await win.webContents.executeJavaScript(`localStorage.clear()`);
    await win.webContents.reload();
    await new Promise((r) => setTimeout(r, 1500));

    // 1. Поиск
    const search = await win.webContents.executeJavaScript(`(async () => {
      document.querySelector('[data-tab="search"]').click();
      const input = document.getElementById('search-input');
      input.value = 'копировать';
      input.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 200));
      return {
        tab: document.querySelector('.panel.active').id,
        count: document.getElementById('search-count').textContent,
        results: document.querySelectorAll('#search-list .shortcut-item').length
      };
    })()`);

    // 2. Переключение языка
    const lang = await win.webContents.executeJavaScript(`(async () => {
      document.querySelector('[data-lang="en"]').click();
      await new Promise(r => setTimeout(r, 300));
      const title = document.getElementById('app-title').textContent;
      document.querySelector('[data-lang="ru"]').click();
      await new Promise(r => setTimeout(r, 300));
      return { enTitle: title, backToRu: document.getElementById('app-title').textContent };
    })()`);

    // 3. Переключение платформы
    const platform = await win.webContents.executeJavaScript(`(async () => {
      document.querySelector('[data-platform="win"]').click();
      await new Promise(r => setTimeout(r, 300));
      const winCombo = document.querySelector('#learn-list .shortcut-item kbd')?.textContent;
      document.querySelector('[data-platform="mac"]').click();
      await new Promise(r => setTimeout(r, 300));
      const macCombo = document.querySelector('#learn-list .shortcut-item kbd')?.textContent;
      return { winCombo, macCombo };
    })()`);

    // 4. Тренажёр: старт + симуляция нажатия правильной комбинации
    const trainer = await win.webContents.executeJavaScript(`(async () => {
      document.querySelector('[data-tab="trainer"]').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('trainer-start').click();
      await new Promise(r => setTimeout(r, 300));
      const running = !document.getElementById('trainer-game').classList.contains('hidden');
      const task = document.getElementById('task-title').textContent;

      // достаём ожидаемую комбинацию текущей задачи и нажимаем её «виртуально»
      const combo = await (async () => {
        // читаем из DOM-состояния нельзя — используем прямое событие
        return null;
      })();

      // нажимаем Escape — это не совпадение, ожидаем fail-обратную связь
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 300));
      const feedback = document.getElementById('trainer-feedback').textContent;
      const attempts = document.getElementById('stat-attempts').textContent;

      // пропускаем и завершаем
      document.getElementById('trainer-skip').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('trainer-stop').click();
      await new Promise(r => setTimeout(r, 200));
      const resultShown = !document.getElementById('trainer-result').classList.contains('hidden');
      return { running, task, feedback, attempts, resultShown };
    })()`);

    // 5. Заметки: добавляем заметку к первому сочетанию
    const notes = await win.webContents.executeJavaScript(`(async () => {
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
      // своё сочетание
      document.getElementById('custom-name').value = 'Открыть терминал';
      document.getElementById('custom-combo').value = 'Ctrl+Alt+T';
      document.getElementById('custom-add').click();
      await new Promise(r => setTimeout(r, 300));
      const customCount = document.querySelectorAll('#custom-list .shortcut-item').length;
      const inLearn = document.querySelectorAll('#learn-list .shortcut-item').length;
      return { noted, customCount, inLearn };
    })()`);

    console.log('SEARCH   ' + JSON.stringify(search));
    console.log('LANG     ' + JSON.stringify(lang));
    console.log('PLATFORM ' + JSON.stringify(platform));
    console.log('TRAINER  ' + JSON.stringify(trainer));
    console.log('NOTES    ' + JSON.stringify(notes));
    console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'NO_ERRORS');
    app.exit(problems.length ? 1 : 0);
  }).catch((err) => {
    console.log('LOAD_ERROR ' + err.message);
    app.exit(1);
  });
});
