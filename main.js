const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
