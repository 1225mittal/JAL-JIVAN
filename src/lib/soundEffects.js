// Web Audio API Synthesizer & Haptic Feedback Utilities for Jal-Jivan Drivers

let globalAudioCtx = null;
let isAudioUnlocked = false;

/**
 * Returns or initializes the shared AudioContext singleton.
 * Handles mobile browser autoplay policies by resuming suspended contexts.
 */
export function getAudioContext() {
  if (typeof window === 'undefined') return null;

  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
  }

  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch((err) => {
      console.warn('AudioContext resume deferred until user interaction:', err);
    });
  }

  return globalAudioCtx;
}

/**
 * Explicitly unlock audio on user gesture (click, tap, keypress).
 */
export function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(() => {
      isAudioUnlocked = true;
    }).catch(() => {});
  } else if (ctx) {
    isAudioUnlocked = true;
  }
  return ctx;
}

// Global auto-unlock listeners for seamless mobile initialization on first tap
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    unlockAudioContext();
    if (isAudioUnlocked) {
      ['click', 'touchstart', 'touchend', 'keydown'].forEach((eventName) => {
        window.removeEventListener(eventName, handleFirstInteraction, { capture: true });
      });
    }
  };

  ['click', 'touchstart', 'touchend', 'keydown'].forEach((eventName) => {
    window.addEventListener(eventName, handleFirstInteraction, { capture: true, passive: true });
  });
}

/**
 * Play a punchy, alert "toing" tone (350Hz ascending rapidly to 880Hz + bright high beep)
 * plus device vibration for incoming delivery orders.
 */
export function playNewOrderSound() {
  // 1. Trigger haptic vibration pattern: 200ms pulse, 100ms pause, 200ms pulse
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch (e) {
      // ignore
    }
  }

  // 2. Synthesize audio "toing" chime
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Part A: Punchy "toing" spring tone (350Hz rapidly ascending to 880Hz)
    const oscToing = ctx.createOscillator();
    const gainToing = ctx.createGain();

    oscToing.type = 'triangle';
    oscToing.frequency.setValueAtTime(350, now);
    oscToing.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    oscToing.frequency.exponentialRampToValueAtTime(660, now + 0.25);

    gainToing.gain.setValueAtTime(0.85, now);
    gainToing.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    oscToing.connect(gainToing);
    gainToing.connect(ctx.destination);

    oscToing.start(now);
    oscToing.stop(now + 0.28);

    // Part B: Bright high alert beep (1318.5Hz - E6)
    const oscBeep = ctx.createOscillator();
    const gainBeep = ctx.createGain();

    oscBeep.type = 'sine';
    oscBeep.frequency.setValueAtTime(1318.51, now + 0.15);

    gainBeep.gain.setValueAtTime(0.75, now + 0.15);
    gainBeep.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    oscBeep.connect(gainBeep);
    gainBeep.connect(ctx.destination);

    oscBeep.start(now + 0.15);
    oscBeep.stop(now + 0.45);
  } catch (err) {
    console.warn('playNewOrderSound error:', err);
  }
}

/**
 * Play a pleasant, rewarding delivery completion chime (C5 523Hz -> E5 659Hz -> G5 784Hz -> C6 1046Hz)
 * plus a success vibration pulse for completed drop-offs and POD upload.
 */
export function playOrderCompletedSound() {
  // 1. Success vibration pulse: 150ms
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([150]);
    } catch (e) {
      // ignore
    }
  }

  // 2. Synthesize harmonious rewarding completion chime
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: now, duration: 0.22, gain: 0.65 },         // C5
      { freq: 659.25, time: now + 0.10, duration: 0.25, gain: 0.70 },  // E5
      { freq: 783.99, time: now + 0.20, duration: 0.30, gain: 0.75 },  // G5
      { freq: 1046.50, time: now + 0.32, duration: 0.55, gain: 0.85 }  // C6 (Reward bell)
    ];

    notes.forEach(({ freq, time, duration, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gainNode.gain.setValueAtTime(gain, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + duration);
    });
  } catch (err) {
    console.warn('playOrderCompletedSound error:', err);
  }
}

/**
 * Play authentic supermarket barcode laser scanner beep (2100Hz 65ms square wave)
 */
export function playBarcodeScanBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2093.00, now); // C7 crisp high beep

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.075);
  } catch (err) {
    // ignore
  }
}

/**
 * Play supermarket POS cash register settlement chime (Cha-Ching bell)
 */
export function playCashRegisterChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    // Fast dual bell
    [
      { freq: 987.77, delay: 0, dur: 0.15 },     // B5
      { freq: 1318.51, delay: 0.08, dur: 0.40 }  // E6
    ].forEach(({ freq, delay, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.5, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur);
    });
  } catch (err) {
    // ignore
  }
}

/**
 * Play subtle voice billing listening prompt chime
 */
export function playVoiceListenChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch (err) {
    // ignore
  }
}

