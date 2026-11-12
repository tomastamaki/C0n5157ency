import type { MetricKpi } from "../lib/habitMetricsKpis";
import type { HabitMetricKind } from "../types/habits";

function VariationBadge({ kpi }: { kpi: MetricKpi }) {
  if (kpi.variationPct === null) return null;
  const isUp = kpi.variationPct >= 0;
  let colorClass = "text-muted";
  if (kpi.goodness !== "neutral") {
    const isGood = kpi.goodness === "up-is-good" ? isUp : !isUp;
    colorClass = isGood ? "text-success" : "text-warning";
  }
  return (
    <span className={`font-mono text-[11px] font-semibold ${colorClass}`}>
      {isUp ? "↑" : "↓"} {Math.abs(kpi.variationPct).toFixed(0)}%
    </span>
  );
}

interface Props {
  kpis: MetricKpi[];
  onSelect: (metricKind: HabitMetricKind) => void;
}

/** Fila con los últimos valores de los hábitos nativos de Métricas (Peso/Sueño/Pasos/Agua). Cada tile se omite si no hay ningún dato cargado todavía. */
export function MetricKpiRow({ kpis, onSelect }: Props) {
  if (kpis.length === 0) return null;

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}>
      {kpis.map((kpi) => (
        <button
          key={kpi.habitId}
          type="button"
          onClick={() => onSelect(kpi.metricKind)}
          className="rounded-card border border-border bg-surface p-2.5 text-center shadow-elevated-sm"
        >
          <p className="text-[11px] text-faint">{kpi.label}</p>
          <p className="font-mono text-sm font-bold text-ink">{kpi.displayValue}</p>
          <VariationBadge kpi={kpi} />
        </button>
      ))}
    </div>
  );
}
