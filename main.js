const { app, BrowserWindow, Menu, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Один экземпляр: повторный запуск показывает уже открытое окно,
// а не плодит новые (два процесса не должны делить одну папку данных).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}
app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

// ── Сохранение размера/позиции окна между запусками ───────
const WINDOW_STATE_FILE = 'window-state.json';

function readWindowState() {
  try {
    const p = path.join(app.getPath('userData'), WINDOW_STATE_FILE);
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (s && [s.x, s.y, s.width, s.height].every((n) => typeof n === 'number')) return s;
  } catch {}
  return null;
}

// окно должно быть хотя бы частично видно на одном из подключённых экранов
function boundsOnScreen(b) {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width - 50 && b.y < a.y + a.height - 50 &&
      b.x + b.width > a.x + 50 && b.y + b.height > a.y + 50;
  });
}

function writeWindowState(win) {
  try {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    const p = path.join(app.getPath('userData'), WINDOW_STATE_FILE);
    fs.writeFileSync(p, JSON.stringify(win.getBounds()));
  } catch {}
}

function createWindow() {
  const opts = {
    width: 1180,
    height: 800,
    minWidth: 920,
    minHeight: 620,
    title: 'Hotkeys Trainer',
    backgroundColor: '#12141c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
  const saved = readWindowState();
  if (saved && saved.width >= 920 && saved.height >= 620 && boundsOnScreen(saved)) {
    opts.x = saved.x;
    opts.y = saved.y;
    opts.width = saved.width;
    opts.height = saved.height;
  }

  const win = new BrowserWindow(opts);
  win.on('close', () => writeWindowState(win));
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  return win;
}

// Minimal menu: on macOS a menu with Edit roles is required so that
// Cmd+C / Cmd+V work in text inputs. No app/window/quit shortcuts —
// the trainer needs to receive key combinations itself.
function buildMenu() {
  if (process.platform === 'darwin') {
    const template = [
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } else {
    Menu.setApplicationMenu(null);
  }
}

app.whenReady().then(() => {
  if (!gotLock) return;
  buildMenu();
  createWindow();

  // версия приложения для строки «О программе» в интерфейсе
  ipcMain.handle('app-version', () => app.getVersion());

  // Во время тренировки убираем меню, иначе его сочетания (Cmd+C и т.п.)
  // перехватываются и не доходят до окна как обычные нажатия.
  ipcMain.handle('trainer-mode', (_event, active) => {
    if (active) {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: ' ', submenu: [] }]));
    } else {
      buildMenu();
    }
  });

  // Экспорт данных приложения в JSON-файл
  ipcMain.handle('export-data', async (event, json) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const today = new Date().toISOString().slice(0, 10);
    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Hotkeys Trainer',
      defaultPath: `hotkeys-trainer-backup-${today}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!filePath) return null;
    await fs.promises.writeFile(filePath, json, 'utf8');
    return filePath;
  });

  // Импорт данных из JSON-файла
  ipcMain.handle('import-data', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Hotkeys Trainer',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths[0]) return null;
    try {
      const raw = await fs.promises.readFile(filePaths[0], 'utf8');
      return JSON.parse(raw);
    } catch {
      return { error: true };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
