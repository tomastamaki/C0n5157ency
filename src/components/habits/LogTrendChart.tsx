import { useState } from "react";
import type { TrendPoint } from "../../lib/habitTrend";

const WIDTH = 326;
const HEIGHT = 128;
const PAD_X = 10;
const PAD_TOP = 18;
const PAD_BOTTOM = 18;

interface Props {
  points: TrendPoint[];
  mode: "bar" | "line";
  unit: string;
  color: string;
  goal?: number | null;
  average?: number | null;
  /** Promedio móvil de 7 días superpuesto (solo peso); mismo índice que `points`. */
  movingAverage?: (number | null)[];
  ariaLabel: string;
}

function formatValue(v: number, unit: string): string {
  return `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ""}`;
}

function shortDate(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

/**
 * Gráfico de evolución para Detalle de hábito: barras (agregación "sum", ej.
 * agua) o línea (agregación "last", ej. peso), con línea de objetivo punteada
 * y promedio del período. Etiquetas visibles solo en primero/último/máximo/
 * mínimo (igual criterio que TrendChart/ProgressChart) — el resto se revela
 * al tocar ese punto, para no amontonar un número en cada uno de hasta 90 días.
 */
export function LogTrendChart({ points, mode, unit, color, goal, average, movingAverage, ariaLabel }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const valueIdxs = points.map((p, i) => (p.value !== null ? i : -1)).filter((i) => i >= 0);
  if (valueIdxs.length === 0) {
    return <p className="text-sm text-muted">Sin registros en este período.</p>;
  }

  const values = valueIdxs.map((i) => points[i].value as number);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (goal !== null && goal !== undefined) {
    min = Math.min(min, goal);
    max = Math.max(max, goal);
  }
  if (average !== null && average !== undefined) {
    min = Math.min(min, average);
    max = Math.max(max, average);
  }
  if (mode === "bar") min = Math.min(min, 0);
  const range = max - min || 1;

  const n = points.length;
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  function xFor(i: number): number {
    return n === 1 ? PAD_X + innerW / 2 : PAD_X + (i / (n - 1)) * innerW;
  }
  function yFor(v: number): number {
    return PAD_TOP + innerH - ((v - min) / range) * innerH;
  }

  const maxIdx = valueIdxs.reduce((best, i) => ((points[i].value as number) > (points[best].value as number) ? i : best), valueIdxs[0]);
  const minIdx = valueIdxs.reduce((best, i) => ((points[i].value as number) < (points[best].value as number) ? i : best), valueIdxs[0]);
  const labeledIdx = new Set([
    valueIdxs[0],
    valueIdxs[valueIdxs.length - 1],
    maxIdx,
    minIdx,
    ...(selectedIdx !== null ? [selectedIdx] : []),
  ]);
  const midY = PAD_TOP + innerH / 2;

  function buildPath(vals: (number | null)[]): string {
    let d = "";
    let open = false;
    vals.forEach((v, i) => {
      if (v === null) {
        open = false;
        return;
      }
      d += `${open ? "L" : "M"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)} `;
      open = true;
    });
    return d.trim();
  }

  const barW = Math.max(2, Math.min(18, innerW / n - 3));

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={ariaLabel}>
        {average !== null && average !== undefined && (
          <line x1={PAD_X} x2={WIDTH - PAD_X} y1={yFor(average)} y2={yFor(average)} className="stroke-faint" strokeWidth={1} strokeDasharray="2 3" />
        )}
        {goal !== null && goal !== undefined && (
          <line x1={PAD_X} x2={WIDTH - PAD_X} y1={yFor(goal)} y2={yFor(goal)} className="stroke-muted" strokeWidth={1.2} strokeDasharray="4 3" />
        )}

        {mode === "bar" &&
          points.map(
            (p, i) =>
              p.value !== null && (
                <rect
                  key={i}
                  x={xFor(i) - barW / 2}
                  y={yFor(p.value)}
                  width={barW}
                  height={Math.max(1, yFor(min) - yFor(p.value))}
                  rx={3}
                  className="cursor-pointer"
                  style={{ fill: color }}
                  onClick={() => setSelectedIdx(i)}
                />
              )
          )}

        {mode === "line" && (
          <>
            {movingAverage && (
              <path d={buildPath(movingAverage)} fill="none" className="stroke-muted" strokeWidth={1.6} strokeDasharray="3 3" />
            )}
            <path d={buildPath(points.map((p) => p.value))} fill="none" style={{ stroke: color }} strokeWidth={2} />
            {points.map(
              (p, i) =>
                p.value !== null && (
                  <g key={i} onClick={() => setSelectedIdx(i)} className="cursor-pointer">
                    <circle cx={xFor(i)} cy={yFor(p.value)} r={10} fill="transparent" />
                    <circle cx={xFor(i)} cy={yFor(p.value)} r={selectedIdx === i ? 4 : 2.5} style={{ fill: color }} />
                  </g>
                )
            )}
          </>
        )}

        {points.map(
          (p, i) =>
            p.value !== null &&
            labeledIdx.has(i) && (
              <text
                key={`l-${i}`}
                x={xFor(i)}
                y={mode === "bar" ? yFor(p.value) - 5 : yFor(p.value) + (yFor(p.value) < midY ? 13 : -7)}
                textAnchor={mode === "bar" ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                className="pointer-events-none fill-ink font-mono text-[9px] font-bold"
              >
                {formatValue(p.value, unit)}
              </text>
            )
        )}

        {valueIdxs.length === 1 ? (
          <text x={xFor(valueIdxs[0])} y={HEIGHT - 4} textAnchor={valueIdxs[0] === 0 ? "start" : valueIdxs[0] === n - 1 ? "end" : "middle"} className="fill-faint text-[9px]">
            {shortDate(points[valueIdxs[0]].date)}
          </text>
        ) : (
          <>
            <text x={xFor(valueIdxs[0])} y={HEIGHT - 4} textAnchor="start" className="fill-faint text-[9px]">
              {shortDate(points[valueIdxs[0]].date)}
            </text>
            <text x={xFor(valueIdxs[valueIdxs.length - 1])} y={HEIGHT - 4} textAnchor="end" className="fill-faint text-[9px]">
              {shortDate(points[valueIdxs[valueIdxs.length - 1]].date)}
            </text>
          </>
        )}
      </svg>

      {selectedIdx !== null && points[selectedIdx].value !== null && (
        <p className="mt-1 text-center text-xs text-muted">
          {shortDate(points[selectedIdx].date)}: <span className="font-mono text-ink">{formatValue(points[selectedIdx].value as number, unit)}</span>
        </p>
      )}

      <div className="mt-1 flex items-center justify-center gap-3 font-mono text-[10.5px] text-faint">
        {average !== null && average !== undefined && <span>Prom. {formatValue(average, unit)}</span>}
        {goal !== null && goal !== undefined && <span>Meta {formatValue(goal, unit)}</span>}
      </div>
    </div>
  );
}
