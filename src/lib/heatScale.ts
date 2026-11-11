/**
 * Escala continua rojo→verde para los mapas de calor de hábitos (Fase 5).
 * Es la ÚNICA parte de la interfaz donde se permite rojo — reemplaza al
 * color propio del hábito en esos mapas específicamente (HeatGrid, HeatRow,
 * calendario de Detalle), para que el cambio salte a la vista. El resto de
 * la interfaz y los textos no usan rojo.
 */
export const HEAT_SCALE_STOPS: { pct: number; hex: string }[] = [
  { pct: 0, hex: "#e5534b" },
  { pct: 25, hex: "#f08a4b" },
  { pct: 50, hex: "#f0c24b" },
  { pct: 75, hex: "#9bcf5b" },
  { pct: 100, hex: "#22c586" },
];

/** Gris neutro: salteado, día sin programar, antes del inicio, o futuro — nunca rojo. */
export const HEAT_NEUTRAL = "rgb(var(--surface-2))";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Color interpolado de la escala para un `pct` 0-100 (se clampea fuera de rango). */
export function colorForPct(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  let lo = HEAT_SCALE_STOPS[0];
  let hi = HEAT_SCALE_STOPS[HEAT_SCALE_STOPS.length - 1];
  for (let i = 0; i < HEAT_SCALE_STOPS.length - 1; i++) {
    if (p >= HEAT_SCALE_STOPS[i].pct && p <= HEAT_SCALE_STOPS[i + 1].pct) {
      lo = HEAT_SCALE_STOPS[i];
      hi = HEAT_SCALE_STOPS[i + 1];
      break;
    }
  }
  const span = hi.pct - lo.pct || 1;
  const t = (p - lo.pct) / span;
  const [r1, g1, b1] = hexToRgb(lo.hex);
  const [r2, g2, b2] = hexToRgb(hi.hex);
  return `rgb(${Math.round(lerp(r1, r2, t))}, ${Math.round(lerp(g1, g2, t))}, ${Math.round(lerp(b1, b2, t))})`;
}
