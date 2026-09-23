/**
 * Vibración y sonido "best effort": ni la Vibration API ni WebAudio están
 * garantizadas en todos los navegadores/dispositivos (iOS Safari no soporta
 * `navigator.vibrate`, por ejemplo), así que todo acá falla en silencio si no
 * está disponible o si el navegador lo bloquea.
 */

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Sin soporte o bloqueado: no rompe nada.
  }
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let sharedAudioCtx: AudioContext | null = null;

/**
 * Crea (o reactiva) el AudioContext compartido. Los navegadores solo dejan
 * arrancarlo o reanudarlo dentro de un gesto del usuario (ej. el toque que
 * confirma una serie), así que hay que llamarlo ahí para que el beep que
 * suena más tarde (cuando termina el descanso) funcione sin otra interacción.
 */
export function unlockAudio(): void {
  try {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
    if (sharedAudioCtx.state === "suspended") void sharedAudioCtx.resume();
  } catch {
    // Sin soporte o bloqueado: no rompe nada.
  }
}

export function playBeep(): void {
  try {
    const ctx = sharedAudioCtx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Sin soporte o bloqueado: no rompe nada.
  }
}
