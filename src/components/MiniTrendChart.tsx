interface Point {
  date: string;
  value: number;
}

const WIDTH = 120;
const HEIGHT = 32;
const PADDING_Y = 3;

/** Versión chica de TrendChart para un vistazo rápido: solo la línea, sin ejes ni etiquetas. */
export function MiniTrendChart({ points, colorClassName = "text-primary" }: { points: Point[]; colorClassName?: string }) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerH = HEIGHT - PADDING_Y * 2;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * WIDTH,
    y: PADDING_Y + innerH - ((p.value - min) / range) * innerH,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={`h-8 w-full ${colorClassName}`} preserveAspectRatio="none" aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
