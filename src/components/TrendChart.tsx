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
          <circle key={i} cx={c.x} cy={c.y} r={2.5} fill="currentColor">
            <title>
              {c.point.date}: {c.point.value}
              {unit}
            </title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between font-mono text-xs text-faint">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}
