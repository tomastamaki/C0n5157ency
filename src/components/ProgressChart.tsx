import { useState } from "react";
import { rirToNumber } from "../types/logs";
import { getPctImprovement, type ProgressionPoint } from "../lib/history";

const WIDTH = 320;
const HEIGHT = 120;
const PADDING = 24;

type Metric = "e1rm" | "weight" | "reps" | "rir";

const METRICS: { id: Metric; label: string; unit: string; valueOf: (p: ProgressionPoint) => number }[] = [
  { id: "e1rm", label: "e1RM", unit: "kg", valueOf: (p) => p.e1rm },
  { id: "weight", label: "Peso", unit: "kg", valueOf: (p) => p.weightKg },
  { id: "reps", label: "Reps", unit: "", valueOf: (p) => p.reps },
  { id: "rir", label: "RIR", unit: "", valueOf: (p) => rirToNumber(p.rir as "0" | "1" | "2" | "3+") },
];

function ImprovementBadge({ points }: { points: ProgressionPoint[] }) {
  const pct = getPctImprovement(points);
  if (pct === null) return null;
  const rounded = Math.round(pct);
  const tone =
    rounded > 0
      ? "bg-success/15 text-success"
      : rounded < 0
        ? "bg-red-500/15 text-red-500"
        : "bg-surface2 text-faint";
  return (
    <span className={`rounded-pill px-2 py-0.5 font-mono text-xs font-semibold ${tone}`}>
      {rounded > 0 ? "+" : ""}
      {rounded}%
    </span>
  );
}

export function ProgressChart({ points }: { points: ProgressionPoint[] }) {
  const [metric, setMetric] = useState<Metric>("e1rm");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay registros de este ejercicio.</p>;
  }

  if (points.length === 1) {
    return (
      <p className="text-sm text-muted">
        Un solo registro por ahora:{" "}
        <span className="font-mono">
          {points[0].weightKg}kg × {points[0].reps} (RIR {points[0].rir})
        </span>
        .
      </p>
    );
  }

  const active = METRICS.find((m) => m.id === metric)!;
  const values = points.map(active.valueOf);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const innerW = WIDTH - PADDING * 2;
  const innerH = HEIGHT - PADDING * 2;

  const coords = points.map((p, i) => {
    const x = PADDING + (i / (points.length - 1)) * innerW;
    const y = PADDING + innerH - ((active.valueOf(p) - min) / range) * innerH;
    return { x, y, point: p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const shown = points[selectedIdx ?? points.length - 1];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={`rounded-pill px-2.5 py-1 text-xs font-semibold transition-colors ${
                metric === m.id ? "bg-primary text-white" : "bg-surface2 text-faint"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ImprovementBadge points={points} />
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full text-primary"
        role="img"
        aria-label="Progresión a lo largo del tiempo"
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={selectedIdx === i ? 4.5 : 3}
            fill="currentColor"
            onClick={() => setSelectedIdx(i)}
            className="cursor-pointer"
          />
        ))}
      </svg>
      <div className="flex justify-between font-mono text-xs text-faint">
        <span>
          {Math.round(min * 10) / 10}
          {active.unit}
        </span>
        <span>
          {Math.round(max * 10) / 10}
          {active.unit}
        </span>
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        Semana {shown.weekNumber} ·{" "}
        <span className="font-mono text-ink">
          {shown.weightKg}kg × {shown.reps} @ RIR {shown.rir}
        </span>
        <span className="ml-1 text-faint">(e1RM {Math.round(shown.e1rm * 10) / 10}kg)</span>
      </p>
    </div>
  );
}
