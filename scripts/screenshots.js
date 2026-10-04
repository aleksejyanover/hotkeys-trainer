// Скриншоты всех вкладок/тем/языков для визуальной самопроверки.
// Запуск: npx electron scripts/screenshots.js  (PNG → /tmp/ht-shots)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const OUT = '/tmp/ht-shots';
app.setPath('userData', path.join(os.tmpdir(), 'ht-shots-userdata'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  ipcMain.handle('trainer-mode', () => true);
  ipcMain.handle('app-version', () => '1.2.3-test');
  const win = new BrowserWindow({
    width: 1440, height: 900, show: true, x: 4000, y: 0,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      backgroundThrottling: false
    }
  });
  const root = path.join(__dirname, '..', 'src');
  await win.loadFile(path.join(root, 'index.html'));
  await wait(1200);
  await win.webContents.executeJavaScript('localStorage.clear()');
  await win.webContents.reload();
  await wait(1500);

  const evalJs = (code) => win.webContents.executeJavaScript(code);
  // Гарантированно дождаться свежего кадра рендерера перед снимком
  const syncFrame = () => Promise.race([
    evalJs(`new Promise(r =>
      requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`),
    wait(1500).then(() => false)
  ]);
  const shot = async (name) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await syncFrame();
        const img = await win.webContents.capturePage();
        if (img.isEmpty()) throw new Error('empty frame');
        const file = path.join(OUT, name + '.png');
        fs.writeFileSync(file, img.toPNG());
        console.log('SHOT', name, img.getSize().width + 'x' + img.getSize().height);
        return;
      } catch (e) {
        console.log('RETRY', name, 'attempt', attempt + 1, e.message);
        await wait(700);
      }
    }
    throw new Error('capture failed: ' + name);
  };
  const goTab = async (tab) => {
    await evalJs(`document.querySelector('[data-tab="${tab}"]').click()`);
    await wait(600);
  };

  // 1. Основные вкладки (тёмная тема, RU)
  for (const tab of ['learn', 'trainer', 'map', 'progress', 'search', 'notes']) {
    await goTab(tab);
    await shot('1-tab-' + tab);
  }

  // 2. Новые разделы в учебнике: одиночные клавиши и презентации
  await goTab('learn');
  await evalJs(`[...document.querySelectorAll('#category-chips .chip')]
    .find(c => c.textContent.includes('Одиночные')).click()`);
  await wait(500);
  await shot('2-category-keys');
  await evalJs(`[...document.querySelectorAll('#category-chips .chip')]
    .find(c => c.textContent.includes('Презентации')).click()`);
  await wait(500);
  await shot('3-category-slides');

  // 3. Тренажёр: классический режим с заданием
  await goTab('trainer');
  await evalJs(`window.__ht.trainer.setMode('classic'); window.__ht.trainer.start();`);
  await wait(600);
  await shot('4-trainer-classic');
  // результат (ввод пароля неверный — покажет экран с ошибкой)
  await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',
    { key: 'F13', code: 'F13', bubbles: true, cancelable: true }))`);
  await wait(400);
  await shot('5-trainer-wrong');
  await evalJs(`window.__ht.trainer.stop(false)`);

  // 4. Светлая тема (учебник + тренажёр)
  await evalJs(`document.querySelector('[data-theme="light"]').click()`);
  await goTab('learn');
  await wait(400);
  await shot('6-light-learn');
  await goTab('progress');
  await wait(400);
  await shot('7-light-progress');

  // 5. Английский интерфейс
  await evalJs(`document.querySelector('[data-theme="dark"]').click()`);
  await evalJs(`document.querySelector('[data-lang="en"]').click()`);
  await goTab('learn');
  await wait(500);
  await shot('8-en-learn');
  await goTab('trainer');
  await wait(400);
  await shot('9-en-trainer');

  // 6. Платформа Windows (учебник + карта)
  await evalJs(`document.querySelector('[data-lang="ru"]').click()`);
  await evalJs(`document.querySelector('[data-platform="win"]').click()`);
  await goTab('map');
  await wait(700);
  await shot('10-win-map');
  await goTab('learn');
  await wait(500);
  await shot('11-win-learn');

  // 7. Остальные режимы тренажёра
  await evalJs(`document.querySelector('[data-platform="auto"]').click()`);
  await goTab('trainer');
  await evalJs(`window.__ht.trainer.setMode('quiz'); window.__ht.trainer.start();`);
  await wait(600);
  await shot('12-trainer-quiz');
  await evalJs(`window.__ht.trainer.stop(false)`);
  await evalJs(`window.__ht.trainer.setMode('sprint'); window.__ht.trainer.start();`);
  await wait(600);
  await shot('13-trainer-sprint');
  await evalJs(`window.__ht.trainer.stop(false)`);
  await evalJs(`window.__ht.trainer.setMode('typing'); window.__ht.trainer.start();`);
  await wait(600);
  await shot('14-trainer-typing');
  await evalJs(`window.__ht.trainer.stop(false)`);

  // 8. Поиск с результатами и заметки с записью
  await goTab('search');
  await evalJs(`const i = document.getElementById('search-input');
    i.value = 'презентац'; i.dispatchEvent(new Event('input'))`);
  await wait(400);
  await shot('15-search-results');
  await goTab('notes');
  await wait(400);
  await shot('16-notes-empty');

  app.exit(0);
}).catch((e) => { console.error('FAIL', e); app.exit(1); });
