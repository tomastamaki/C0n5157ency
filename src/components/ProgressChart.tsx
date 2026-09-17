import type { ProgressionPoint } from "../lib/history";

const WIDTH = 320;
const HEIGHT = 120;
const PADDING = 24;

export function ProgressChart({ points }: { points: ProgressionPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-faint">Todavía no hay registros de este ejercicio.</p>;
  }

  if (points.length === 1) {
    return (
      <p className="text-sm text-faint">
        Un solo registro por ahora:{" "}
        <span className="font-mono">
          {points[0].weightKg}kg × {points[0].reps} (RIR {points[0].rir})
        </span>
        .
      </p>
    );
  }

  const weights = points.map((p) => p.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const innerW = WIDTH - PADDING * 2;
  const innerH = HEIGHT - PADDING * 2;

  const coords = points.map((p, i) => {
    const x = PADDING + (i / (points.length - 1)) * innerW;
    const y = PADDING + innerH - ((p.weightKg - min) / range) * innerH;
    return { x, y, point: p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full text-primary"
        role="img"
        aria-label="Progresión de peso a lo largo del tiempo"
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} fill="currentColor">
            <title>
              Semana {c.point.weekNumber}: {c.point.weightKg}kg × {c.point.reps} (RIR {c.point.rir})
            </title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between font-mono text-xs text-faint">
        <span>{min}kg</span>
        <span>{max}kg</span>
      </div>
    </div>
  );
}
