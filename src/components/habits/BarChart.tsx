interface Bar {
  label: string;
  value: number;
  isCurrent: boolean;
}

interface BarChartProps {
  bars: Bar[];
  /** Valor máximo de referencia para escalar las barras (p. ej. la meta); si no se pasa, se usa el máximo de los datos. */
  maxValue?: number;
  valueSuffix?: string;
  ariaLabel: string;
}

const W = 326;
const H = 128;
const AXIS_Y = 102;
const LABEL_Y = 120;

/** Gráfico de barras simple (una serie), estilo mono, igual al de habi7-diseno.html. */
export function BarChart({ bars, maxValue, valueSuffix = "", ariaLabel }: BarChartProps) {
  if (bars.length === 0) return null;
  const max = maxValue ?? Math.max(...bars.map((b) => b.value), 1);
  const barW = Math.min(30, (W - 16) / bars.length - 8);
  const gap = (W - 16 - barW * bars.length) / Math.max(1, bars.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel}>
      {bars.map((b, i) => {
        const h = (b.value / max) * (AXIS_Y - 16);
        const x = 8 + i * (barW + gap);
        const y = AXIS_Y - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 1)} rx={6} className={b.isCurrent ? "fill-primary" : "fill-primary/55"} />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-ink text-[11px] font-bold font-mono">
              {b.value}
              {valueSuffix}
            </text>
            <text x={x + barW / 2} y={LABEL_Y} textAnchor="middle" className="fill-faint text-[10.5px]">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
