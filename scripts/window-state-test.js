// E2E-тест восстановления размера/позиции окна между запусками.
// Фаза 1: главное окно меняет размер → закрывается → файл состояния корректен.
// Фаза 2: новое окно открывается с сохранённой геометрией.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const DIR = path.join(os.tmpdir(), 'hotkeys-trainer-window-state');
const FILE = path.join(DIR, 'window-state.json');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const phase2 = process.argv.includes('--phase2');

app.setPath('userData', DIR);
if (!phase2) { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {} }

app.whenReady().then(async () => {
  require(path.join(__dirname, '..', 'main.js'));

  const expected = { x: 200, y: 120, width: 1000, height: 700 };
  let fail = null;

  if (!phase2) {
    await wait(1800);
    const [win] = BrowserWindow.getAllWindows();
    if (!win) fail = 'no window created';
    else {
      win.setBounds(expected);
      await wait(400);
      win.close();
      await wait(700);
      let saved = null;
      try { saved = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
      if (!saved) fail = 'window-state.json not written';
      else if (saved.x !== expected.x || saved.y !== expected.y ||
               saved.width !== expected.width || saved.height !== expected.height) {
        fail = 'saved bounds mismatch: ' + JSON.stringify(saved);
      }
    }
    console.log(fail ? 'WSTATE_FAIL phase1: ' + fail : 'WSTATE_PHASE1_DONE');
    app.exit(fail ? 1 : 0);
    return;
  }

  await wait(1800);
  const [win] = BrowserWindow.getAllWindows();
  if (!win) fail = 'no window created';
  else {
    const b = win.getBounds();
    // macOS может незначительно корректировать позицию — допуск ±64px,
    // размер обязан совпасть точно.
    const near = (a, b2) => Math.abs(a - b2) <= 64;
    if (!near(b.x, expected.x) || !near(b.y, expected.y) ||
        b.width !== expected.width || b.height !== expected.height) {
      fail = 'restored bounds mismatch: ' + JSON.stringify(b);
    }
  }
  console.log(fail ? 'WSTATE_FAIL phase2: ' + fail : 'WSTATE_OK ' + JSON.stringify(win && win.getBounds()));
  app.exit(fail ? 1 : 0);
}).catch((e) => {
  console.log('WSTATE_FAIL ' + (e && e.message));
  app.exit(1);
});
