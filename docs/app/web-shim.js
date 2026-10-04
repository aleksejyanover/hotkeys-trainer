// Браузерная замена Electron preload-моста (window.hotkeysTrainer).
// Подключается только в веб-сборке (docs/app) — в десктопном приложении
// эту роль играет preload.js.
(() => {
  const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || '');
  const download = (json, name) => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return name;
  };
  window.hotkeysTrainer = {
    platform: isMac ? 'darwin' : 'win32',
    versions: {
      electron: 'web',
      chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '—',
      node: '—'
    },
    // во вкладке тренажёра меню приложения нет — no-op
    setTrainerMode: async () => {},
    // экспорт — скачивание JSON-файла
    exportData: async (json) =>
      download(json, `hotkeys-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`),
    // импорт — выбор файла через <input type=file>, как в системном диалоге
    importData: () => new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) { resolve(null); return; }
        const r = new FileReader();
        r.onload = () => {
          try { resolve(JSON.parse(r.result)); } catch { resolve({ error: true }); }
        };
        r.onerror = () => resolve({ error: true });
        r.readAsText(f);
      };
      document.body.appendChild(input);
      input.click();
      input.remove();
    }),
    appVersion: async () => '1.3.0-web'
  };
})();
