const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
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
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
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
  buildMenu();
  createWindow();

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
    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Hotkeys Trainer',
      defaultPath: 'hotkeys-trainer-backup.json',
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
