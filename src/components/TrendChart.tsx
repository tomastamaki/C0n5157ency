import { useState } from "react";
import { EmptyState } from "./EmptyState";
import { IconActivity } from "./icons";

const WIDTH = 320;
const HEIGHT = 100;
const PADDING = 20;

export interface TrendPoint {
  date: string;
  value: number;
}

interface Props {
  points: TrendPoint[];
  unit?: string;
  colorClassName?: string;
}

export function TrendChart({ points, unit = "", colorClassName = "text-primary" }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <EmptyState
        icon={<IconActivity className="h-8 w-8" />}
        title="Todavía no hay registros"
        hint="Cargá algunos datos en la pestaña Cargar para ver la tendencia acá."
      />
    );
  }

  if (points.length === 1) {
    return (
      <p className="text-sm text-muted">
        Un solo registro: <span className="font-mono">{points[0].value}{unit}</span>
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const innerW = WIDTH - PADDING * 2;
  const innerH = HEIGHT - PADDING * 2;

  const coords = points.map((p, i) => {
    const x = PADDING + (i / (points.length - 1)) * innerW;
    const y = PADDING + innerH - ((p.value - min) / range) * innerH;
    return { x, y, point: p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  // Etiquetas visibles por defecto: primero, último, máximo y mínimo (evita amontonar un número en cada punto).
  // El resto se revela al tocar ese punto.
  const maxIdx = values.indexOf(max);
  const minIdx = values.indexOf(min);
  const labeledIdx = new Set([0, coords.length - 1, maxIdx, minIdx, ...(selectedIdx !== null ? [selectedIdx] : [])]);
  const midY = PADDING + innerH / 2;

  function formatValue(v: number): string {
    return `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${unit}`;
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={`w-full ${colorClassName}`}
        role="img"
        aria-label="Tendencia en el tiempo"
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
        {coords.map((c, i) => (
          <g key={i} onClick={() => setSelectedIdx(i)} className="cursor-pointer">
            {/* Área de toque más grande que el punto visible, para que sea fácil de tocar en mobile. */}
            <circle cx={c.x} cy={c.y} r={10} fill="transparent" />
            <circle cx={c.x} cy={c.y} r={selectedIdx === i ? 4 : 2.5} fill="currentColor" />
          </g>
        ))}
        {coords.map(
          (c, i) =>
            labeledIdx.has(i) && (
              <text
                key={`label-${i}`}
                x={c.x}
                y={c.y + (c.y < midY ? 13 : -7)}
                textAnchor={i === 0 ? "start" : i === coords.length - 1 ? "end" : "middle"}
                className="pointer-events-none fill-current font-mono text-[9px] text-ink"
              >
                {formatValue(c.point.value)}
              </text>
            )
        )}
      </svg>
      {selectedIdx !== null && (
        <p className="mt-1 text-center text-xs text-muted">
          {coords[selectedIdx].point.date}:{" "}
          <span className="font-mono text-ink">{formatValue(coords[selectedIdx].point.value)}</span>
        </p>
      )}
      <div className="flex justify-between font-mono text-xs text-faint">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}
