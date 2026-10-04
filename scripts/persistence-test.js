// E2E-тест персистентности: фаза 1 меняет состояние через UI и завершает
// приложение, фаза 2 (новый процесс) проверяет, что всё пережило перезапуск.
// Запуск: electron scripts/persistence-test.js            (фаза 1 + фаза 2)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), 'hotkeys-trainer-persist'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(1);
const phase = args.includes('--phase2') ? 2 : 1;

app.whenReady().then(async () => {
  // заглушки IPC (в приложении их регистрирует main.js)
  ipcMain.handle('trainer-mode', () => true);
  ipcMain.handle('app-version', () => '1.2.3-test');
  ipcMain.handle('export-data', () => null);
  ipcMain.handle('import-data', () => null);

  const win = new BrowserWindow({
    width: 1200, height: 800, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await wait(1200);
  const js = (code) => win.webContents.executeJavaScript(code);

  if (phase === 1) {
    await js('localStorage.clear()');
    await win.webContents.reload();
    await wait(1500);

    // 1. Язык EN
    await js(`document.querySelector('[data-lang="en"]').click()`);
    await wait(300);

    // 2. Заметка через UI (учебник → карточка → textarea)
    await js(`(async () => {
      document.querySelector('[data-tab="learn"]').click();
      await new Promise(r => setTimeout(r, 300));
      const item = document.querySelector('#learn-list .shortcut-item');
      item.click();
      await new Promise(r => setTimeout(r, 200));
      const ta = item.querySelector('textarea');
      ta.value = 'Persist note 42';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(300);

    // 3. Своё сочетание через UI
    await js(`(async () => {
      document.querySelector('[data-tab="notes"]').click();
      await new Promise(r => setTimeout(r, 300));
      document.getElementById('custom-name').value = 'Persist custom';
      document.getElementById('custom-combo').value = 'Ctrl+Shift+K';
      document.getElementById('custom-add').click();
    })()`);
    await wait(300);

    // 4. Режим и категория тренажёра через UI
    await js(`(async () => {
      document.querySelector('[data-tab="trainer"]').click();
      await new Promise(r => setTimeout(r, 300));
      document.querySelector('#trainer-modes .chip[data-mode="quiz"]').click();
      const sel = document.getElementById('trainer-category');
      sel.value = 'keys';
      sel.dispatchEvent(new Event('change'));
    })()`);
    await wait(300);

    // 5. Запись попытки в прогресс
    const recorded = await js(`(() => {
      const ht = window.__ht;
      const id = ht.allShortcuts().find(s => s.cat === 'keys').id;
      ht.store.record(id, false);
      return { id, seen: ht.store.progressOf(id).seen };
    })()`);
    if (!recorded || recorded.seen !== 1) {
      console.log('PERSIST_FAIL phase1 record ' + JSON.stringify(recorded));
      app.exit(1);
      return;
    }

    await wait(800); // даём хранилищу дописаться
    console.log('PERSIST_PHASE1_DONE');
    app.exit(0);
    return;
  }

  // ── Фаза 2: новый процесс, состояние должно сохраниться ──
  const state = await js(`(() => {
    const ht = window.__ht;
    if (!ht) return { boot: false };
    const notes = ht.store.notes;
    const noteKey = Object.keys(notes).find(k => notes[k] === 'Persist note 42');
    const sel = document.getElementById('trainer-category');
    const activeMode = document.querySelector('#trainer-modes .chip.active')?.dataset.mode;
    return {
      boot: true,
      lang: ht.store.lang,
      note: Boolean(noteKey),
      custom: ht.store.custom.length === 1 && ht.store.custom[0].title === 'Persist custom',
      mode: ht.store.trainerMode,
      cat: ht.store.trainerCat,
      uiMode: activeMode,
      uiCat: sel ? sel.value : null,
      title: document.title,
      version: document.getElementById('app-version-line')?.textContent || ''
    };
  })()`);

  const fail = [];
  if (!state.boot) fail.push('app did not boot');
  if (state.lang !== 'en') fail.push('lang=' + state.lang);
  if (!state.note) fail.push('note lost');
  if (!state.custom) fail.push('custom lost');
  if (state.mode !== 'quiz') fail.push('mode=' + state.mode);
  if (state.cat !== 'keys') fail.push('cat=' + state.cat);
  if (state.uiMode !== 'quiz') fail.push('uiMode=' + state.uiMode);
  if (state.uiCat !== 'keys') fail.push('uiCat=' + state.uiCat);
  if (state.title !== 'Keyboard Shortcuts Trainer') fail.push('title=' + state.title);
  if (!state.version.includes('1.2.3-test')) fail.push('version=' + state.version);

  console.log('PERSIST_PHASE2 ' + JSON.stringify(state));
  if (fail.length) {
    console.log('PERSIST_FAIL ' + fail.join('; '));
    app.exit(1);
    return;
  }
  console.log('PERSIST_OK');
  app.exit(0);
}).catch((e) => {
  console.log('PERSIST_FAIL ' + (e && e.message));
  app.exit(1);
});
