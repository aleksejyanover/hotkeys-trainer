const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hotkeysTrainer', {
  platform: process.platform, // 'darwin' | 'win32' | other
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  // Пока идёт тренировка, меню приложения убирается, чтобы сочетания
  // (например Cmd+C) доходили до окна, а не срабатывали как команда меню.
  setTrainerMode: (active) => ipcRenderer.invoke('trainer-mode', Boolean(active)),
  // Экспорт/импорт данных (прогресс, заметки, свои сочетания)
  exportData: (json) => ipcRenderer.invoke('export-data', json),
  importData: () => ipcRenderer.invoke('import-data')
});
