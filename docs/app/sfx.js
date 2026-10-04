// Звуки тренажёра на WebAudio — без внешних файлов.
import { store } from './store.js';

let ctx = null;

function ac() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null; // окружение без аудио (например, CI) — молча пропускаем
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// один тон: частота, задержка старта, длительность, тип, громкость
function tone(freq, delay, dur, type = 'sine', gain = 0.14) {
  if (!store.sfxEnabled) return;
  try {
    const a = ac();
    if (!a) return;
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    // игнорируем любые проблемы со звуком — они не должны ломать тренажёр
  }
}

export const sfx = {
  correct() { tone(660, 0, 0.10); tone(880, 0.09, 0.14); },
  wrong() { tone(200, 0, 0.16, 'sawtooth', 0.10); tone(150, 0.12, 0.20, 'sawtooth', 0.10); },
  finish() {
    tone(523, 0, 0.12, 'triangle', 0.16);
    tone(659, 0.12, 0.12, 'triangle', 0.16);
    tone(784, 0.24, 0.12, 'triangle', 0.16);
    tone(1046, 0.36, 0.30, 'triangle', 0.18);
  },
  tick() { tone(1000, 0, 0.05, 'square', 0.06); },
  click() { tone(520, 0, 0.05, 'triangle', 0.10); }
};
